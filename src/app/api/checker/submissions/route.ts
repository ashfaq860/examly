// app/api/checker/submissions/route.ts
// GET serves two purposes on one route: ?paperId= lists a paper's
// submissions (with a needs_review answer count per submission);
// ?submissionId= returns one submission's full detail (answers + signed
// scan URLs + WhatsApp result-card fields) for the review screen.
//
// Submission CREATION lives in init/route.ts + [id]/complete/route.ts now
// (the client uploads scan bytes directly to Supabase Storage via signed
// upload URLs instead of proxying them through this route as multipart
// form data) — this route is read-only.
//
// Requires the 'paper_checker' feature (admin/super_admin bypass) — same
// as every other route under /api/checker/*.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { verifyPaperOwnership, verifySubmissionOwnership } from '@/lib/checker/ownership';
import { getSignedScanUrl } from '@/lib/checker/scanStorage';
import { computeMcqScoreAnchorFraction } from '@/lib/checker/annotatePdf';
import { computeSectionSubtotalAnchors, decideSubjectiveMarksSide, MarksSide } from '@/lib/checker/gradeSubjective';
import { BubbleLayoutV3 } from '@/types/checker';

export async function GET(req: NextRequest) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const gate = await requireFeatureOrAdmin(auth.supabase, user.id, 'paper_checker');
    if (gate) return gate;

    const { searchParams } = new URL(req.url);
    const paperId = searchParams.get('paperId');
    const submissionId = searchParams.get('submissionId');

    if (submissionId) {
      const ownership = await verifySubmissionOwnership(submissionId, user.id);
      if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });
      const submission = ownership.submission;

      const [{ data: answers, error: answersErr }, { data: paper }, { data: linkedStudent }, { data: layoutMapRow }] = await Promise.all([
        supabaseAdmin.from('submission_answers').select('*').eq('submission_id', submissionId).order('q_number', { ascending: true }),
        // class_name/subject_name/created_by added for the WhatsApp result
        // card (school name comes from the creator's profile, joined below);
        // content added for computeSectionSubtotalAnchors/
        // decideSubjectiveMarksSide below (the review overlay's own
        // section-subtotal badges + marks-side fallback).
        supabaseAdmin.from('papers').select('title, class_name, subject_name, created_by, content').eq('id', submission.paper_id).maybeSingle(),
        // Only submissions created via the roster dropdown (not free-typed
        // name/roll) have a student_id — that's the only case a WhatsApp
        // number is available for the "send result" action below.
        submission.student_id
          ? supabaseAdmin.from('students').select('whatsapp_number').eq('id', submission.student_id).maybeSingle()
          : Promise.resolve({ data: null }),
        // Needed only for mcqScoreAnchor below — the review overlay's own
        // small circled MCQ-marks badge, positioned via the SAME anchor
        // function (computeMcqScoreAnchorFraction) annotatePdf.ts calls for
        // the PDF's own circle, so the two can never drift apart.
        supabaseAdmin.from('paper_layout_maps').select('*').eq('paper_id', submission.paper_id).order('version', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (answersErr) return NextResponse.json({ error: answersErr.message }, { status: 500 });

      const schoolName = paper?.created_by
        ? (await supabaseAdmin.from('profiles').select('institution').eq('id', paper.created_by).maybeSingle()).data?.institution ?? null
        : null;

      const scanUrls: string[] = Array.isArray(submission.scan_urls) ? submission.scan_urls : [];
      const [signedScanUrls, annotatedPdfUrl] = await Promise.all([
        Promise.all(scanUrls.map(url => getSignedScanUrl(url).catch(() => null))),
        submission.annotated_pdf_path ? getSignedScanUrl(submission.annotated_pdf_path, 3600).catch(() => null) : Promise.resolve(null),
      ]);

      const mcqRows = (answers || []).filter((a: any) => a.answer_kind === 'mcq' && a.teacher_note !== 'EXCESS_ATTEMPT');
      const anchorFrac = mcqRows.length > 0
        ? computeMcqScoreAnchorFraction(submission.graded_fiducials ?? null, (layoutMapRow as BubbleLayoutV3) ?? null, submission.graded_image_width ?? null, submission.graded_image_height ?? null)
        : null;
      const mcqScoreAnchor = anchorFrac ? {
        ...anchorFrac,
        awarded: mcqRows.reduce((sum: number, r: any) => sum + (r.final_marks ?? 0), 0),
        max: mcqRows.reduce((sum: number, r: any) => sum + r.max_marks, 0),
      } : null;

      // ONE marks-side for the whole paper — prefers the persisted value
      // (finalizeSubmissionTotals writes it after every grade/regrade/
      // override), falling back to recomputing from the current rows for a
      // submission that predates this column. Same function annotatePdf.ts
      // falls back to, so the PDF and this overlay can never disagree.
      const subjectiveMarksSide: MarksSide = (submission.subjective_marks_side as MarksSide | null)
        ?? decideSubjectiveMarksSide(paper?.content ?? null, answers || []);

      // Section-subtotal badges for the review overlay — same anchor
      // function (pageIndex + topPct) annotatePdf.ts's own circle uses, so
      // the two positions can never drift apart. Not filtered by page here
      // — the review page filters by the CURRENTLY DISPLAYED page, same
      // pattern it already applies to `answers`.
      const sectionSubtotals = paper?.content
        ? computeSectionSubtotalAnchors(paper.content, answers || []).map(a => ({
            heading: a.heading,
            awarded: a.awarded,
            max: a.max,
            pageIndex: a.pageIndex,
            topPct: a.topPct,
          }))
        : [];

      return NextResponse.json({
        submission,
        answers: answers || [],
        signedScanUrls,
        annotatedPdfUrl,
        paperTitle: paper?.title ?? null,
        className: paper?.class_name ?? null,
        subjectName: paper?.subject_name ?? null,
        schoolName,
        studentWhatsapp: linkedStudent?.whatsapp_number ?? null,
        mcqScoreAnchor,
        subjectiveMarksSide,
        sectionSubtotals,
      });
    }

    if (paperId) {
      const ownership = await verifyPaperOwnership(paperId, user.id);
      if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });

      const { data: submissions, error: subsErr } = await supabaseAdmin
        .from('submissions')
        .select('*')
        .eq('paper_id', paperId)
        .order('created_at', { ascending: false });
      if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 });

      const submissionIds = (submissions || []).map(s => s.id);
      const needsReviewCount: Record<string, number> = {};
      if (submissionIds.length > 0) {
        const { data: answerFlags } = await supabaseAdmin
          .from('submission_answers')
          .select('submission_id, needs_review')
          .in('submission_id', submissionIds);
        for (const row of answerFlags || []) {
          if (row.needs_review) needsReviewCount[row.submission_id] = (needsReviewCount[row.submission_id] || 0) + 1;
        }
      }

      // Only submissions created via the roster dropdown have a student_id
      // (see the studentWhatsapp comment above) — batched here for the
      // whole list instead of the submissionId branch's single lookup, so
      // the bulk WhatsApp sender on this list knows upfront which rows have
      // a number on file without an extra round trip per row.
      const studentIds = [...new Set((submissions || []).map(s => s.student_id).filter((id): id is string => Boolean(id)))];
      const whatsappByStudentId: Record<string, string | null> = {};
      if (studentIds.length > 0) {
        const { data: linkedStudents } = await supabaseAdmin
          .from('students')
          .select('id, whatsapp_number')
          .in('id', studentIds);
        for (const row of linkedStudents || []) {
          whatsappByStudentId[row.id] = row.whatsapp_number;
        }
      }

      const withCounts = (submissions || []).map(s => ({
        ...s,
        needs_review_count: needsReviewCount[s.id] || 0,
        student_whatsapp: s.student_id ? whatsappByStudentId[s.student_id] ?? null : null,
      }));
      return NextResponse.json({ submissions: withCounts });
    }

    return NextResponse.json({ error: 'Provide either paperId or id' }, { status: 400 });
  } catch (error: any) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
