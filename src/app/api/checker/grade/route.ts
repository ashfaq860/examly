// app/api/checker/grade/route.ts
// The single grading entry point the client calls after uploading a
// submission (replacing direct calls to /api/checker/grade-mcq): checks
// auth/ownership/preconditions and reserves a scan-quota slot SYNCHRONOUSLY
// (so a scan_quota_exhausted 403 still comes back immediately, same as
// before), then hands the actual grading off to startGradingInBackground
// (uses Next's after() under the hood — see its own doc comment for why,
// given this app deploys to Vercel) so the HTTP response returns right
// away instead of the client blocking on several Claude calls plus CV
// work. The submissions list picks up the result via Supabase Realtime
// once the background run finishes (see the checker page's subscription)
// instead of the client awaiting this request.
export const runtime = 'nodejs';
export const maxDuration = 120; // covers the background grading work too — Vercel's duration limit spans the whole invocation, not just the synchronous response

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { isAcademyOwnerOfCreator } from '@/lib/checker/ownership';
import { reserveGradingSlot, startGradingInBackground } from '@/lib/checker/gradeOrchestrator';
import { buildSubjectiveQuestions } from '@/lib/checker/gradeSubjective';
import { startGradingProgress } from '@/lib/checker/gradingProgress';

export async function POST(req: NextRequest) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const debugMode = new URL(req.url).searchParams.get('debug') === '1';
    const body = await req.json();
    const submissionId: string | undefined = body?.submission_id;
    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submission_id' }, { status: 400 });
    }

    const [gate, submissionResult] = await Promise.all([
      requireFeatureOrAdmin(auth.supabase, user.id, 'paper_checker'),
      supabaseAdmin.from('submissions').select('*').eq('id', submissionId).maybeSingle(),
    ]);
    if (gate) return gate;
    const { data: submission, error: subErr } = submissionResult;
    if (subErr || !submission) {
      return NextResponse.json({ error: subErr?.message || 'Submission not found' }, { status: 404 });
    }

    const [paperResult, layoutMapResult] = await Promise.all([
      supabaseAdmin.from('papers').select('id, content, settings, created_by').eq('id', submission.paper_id).maybeSingle(),
      supabaseAdmin.from('paper_layout_maps').select('*').eq('paper_id', submission.paper_id).order('version', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const { data: paper, error: paperErr } = paperResult;
    if (paperErr || !paper) {
      return NextResponse.json({ error: paperErr?.message || 'Paper not found' }, { status: 404 });
    }

    if (
      submission.uploaded_by !== user.id &&
      paper.created_by !== user.id &&
      !(await isAcademyOwnerOfCreator(user.id, paper.created_by))
    ) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (submission.status === 'finalized') {
      return NextResponse.json({ error: 'Submission is already finalized' }, { status: 409 });
    }
    if (!Array.isArray(submission.scan_urls) || submission.scan_urls.length === 0) {
      return NextResponse.json({ error: 'Submission has no scan images' }, { status: 400 });
    }

    const { data: layoutMapRow } = layoutMapResult;

    const reserved = await reserveGradingSlot(submissionId, user.id);
    if (!reserved.ok) {
      return NextResponse.json({ error: reserved.error }, { status: reserved.status });
    }

    // Same "does this section exist at all" checks gradeMcqForSubmission/
    // gradeSubjectiveForSubmission make internally (mcq_bubbles.length,
    // buildSubjectiveQuestions(content).length) — computed here too so the
    // progress TOTAL a fresh review-page load sees immediately matches
    // what gradeOrchestrator.ts will actually advance through.
    const hasMcq = ((layoutMapRow as any)?.mcq_bubbles?.length ?? 0) > 0;
    const hasSubjective = buildSubjectiveQuestions(paper.content).length > 0;
    await startGradingProgress(submissionId, hasMcq, hasSubjective);

    startGradingInBackground({ submissionId, submission, paper, layoutMapRow, userId: user.id, debugMode });

    return NextResponse.json({
      submission: { ...submission, status: 'processing', processing_error: null },
      processing: true,
    });
  } catch (error: any) {
    console.error('Error starting grading:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
