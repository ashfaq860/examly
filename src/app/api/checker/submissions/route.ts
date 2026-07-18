// app/api/checker/submissions/route.ts
// POST creates a submission: uploads its scan images (already downscaled
// client-side) to the private 'submission-scans' bucket via the
// service-role client (bucket RLS is select-only by design) and inserts
// the submissions row. Does NOT call grade-mcq itself — the client does
// that as a separate step so the UI can show distinct upload/grade
// progress.
//
// GET serves two purposes on one route: ?paperId= lists a paper's
// submissions (with a needs_review answer count per submission);
// ?submissionId= returns one submission's full detail (answers + signed
// scan URLs) for the review screen.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { verifyPaperOwnership, verifySubmissionOwnership } from '@/lib/checker/ownership';
import { getSignedScanUrl } from '@/lib/checker/scanStorage';

const SCAN_BUCKET = 'submission-scans';

export async function POST(req: NextRequest) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const formData = await req.formData();
    const paperId = formData.get('paperId') as string | null;
    if (!paperId) return NextResponse.json({ error: 'Missing paperId' }, { status: 400 });

    const ownership = await verifyPaperOwnership(paperId, user.id);
    if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });

    const files = formData.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) return NextResponse.json({ error: 'At least one scan image is required' }, { status: 400 });
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: `File '${file.name}' is not an image` }, { status: 400 });
      }
    }

    const studentId = (formData.get('student_id') as string | null) || null;
    const studentName = (formData.get('student_name') as string | null)?.trim() || null;
    const rollNo = (formData.get('roll_no') as string | null)?.trim() || null;

    const { data: created, error: insertErr } = await supabaseAdmin
      .from('submissions')
      .insert({
        paper_id: paperId,
        student_id: studentId,
        student_name_raw: studentName,
        roll_no_raw: rollNo,
        uploaded_by: user.id,
        scan_urls: [],
        status: 'uploaded',
      })
      .select()
      .single();

    if (insertErr || !created) {
      return NextResponse.json({ error: insertErr?.message || 'Failed to create submission' }, { status: 500 });
    }

    const uploadedPaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = `${paperId}/${created.id}/${i}.jpg`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(SCAN_BUCKET)
        .upload(path, buffer, { contentType: file.type || 'image/jpeg', upsert: true });

      if (uploadErr) {
        // Best-effort cleanup so a failed upload doesn't leave an orphaned
        // submission row or partial set of scan files behind.
        if (uploadedPaths.length > 0) {
          await supabaseAdmin.storage.from(SCAN_BUCKET).remove(uploadedPaths).catch(() => {});
        }
        await supabaseAdmin.from('submissions').delete().eq('id', created.id);
        return NextResponse.json({ error: `Failed to upload '${file.name}': ${uploadErr.message}` }, { status: 500 });
      }
      uploadedPaths.push(path);
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('submissions')
      .update({ scan_urls: uploadedPaths })
      .eq('id', created.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ submission: updated });
  } catch (error: any) {
    console.error('Error creating submission:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    const paperId = searchParams.get('paperId');
    const submissionId = searchParams.get('submissionId');

    if (submissionId) {
      const ownership = await verifySubmissionOwnership(submissionId, user.id);
      if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });
      const submission = ownership.submission;

      const { data: answers, error: answersErr } = await supabaseAdmin
        .from('submission_answers')
        .select('*')
        .eq('submission_id', submissionId)
        .order('q_number', { ascending: true });
      if (answersErr) return NextResponse.json({ error: answersErr.message }, { status: 500 });

      const scanUrls: string[] = Array.isArray(submission.scan_urls) ? submission.scan_urls : [];
      const signedScanUrls = await Promise.all(
        scanUrls.map(url => getSignedScanUrl(url).catch(() => null))
      );

      return NextResponse.json({ submission, answers: answers || [], signedScanUrls });
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

      const withCounts = (submissions || []).map(s => ({ ...s, needs_review_count: needsReviewCount[s.id] || 0 }));
      return NextResponse.json({ submissions: withCounts });
    }

    return NextResponse.json({ error: 'Provide either paperId or id' }, { status: 400 });
  } catch (error: any) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
