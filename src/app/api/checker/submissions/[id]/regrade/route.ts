// app/api/checker/submissions/[id]/regrade/route.ts
// Idempotent re-grade: wipes this submission's ungraded answers (or ALL of
// them with ?force=1, including teacher-reviewed ones) and re-runs the
// same orchestration /api/checker/grade uses. Used by the review screen's
// Retry button, and after a question's rubric is edited.
//
// Like /api/checker/grade, the scan-quota slot is reserved synchronously
// (so scan_quota_exhausted still comes back as an immediate 403) and the
// actual grading work runs afterward via startGradingInBackground (Next's
// after() under the hood — see its doc comment) — the caller picks up the
// result through Realtime/refetch, not by awaiting this call.
export const runtime = 'nodejs';
export const maxDuration = 120; // covers the background grading work too — Vercel's duration limit spans the whole invocation, not just the synchronous response

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { verifySubmissionOwnership } from '@/lib/checker/ownership';
import { reserveGradingSlot, startGradingInBackground } from '@/lib/checker/gradeOrchestrator';
import { buildSubjectiveQuestions } from '@/lib/checker/gradeSubjective';
import { startGradingProgress } from '@/lib/checker/gradingProgress';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const gate = await requireFeatureOrAdmin(auth.supabase, user.id, 'paper_checker');
    if (gate) return gate;

    const { id: submissionId } = await params;
    const force = new URL(req.url).searchParams.get('force') === '1';

    const ownership = await verifySubmissionOwnership(submissionId, user.id);
    if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });
    const submission = ownership.submission;

    if (submission.status === 'finalized') {
      return NextResponse.json({ error: 'Submission is already finalized' }, { status: 409 });
    }
    if (!Array.isArray(submission.scan_urls) || submission.scan_urls.length === 0) {
      return NextResponse.json({ error: 'Submission has no scan images' }, { status: 400 });
    }

    const [paperResult, layoutMapResult] = await Promise.all([
      supabaseAdmin.from('papers').select('id, content, settings, created_by').eq('id', submission.paper_id).maybeSingle(),
      supabaseAdmin.from('paper_layout_maps').select('*').eq('paper_id', submission.paper_id).order('version', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const { data: paper, error: paperErr } = paperResult;
    if (paperErr || !paper) {
      return NextResponse.json({ error: paperErr?.message || 'Paper not found' }, { status: 404 });
    }
    const { data: layoutMapRow } = layoutMapResult;

    const reserved = await reserveGradingSlot(submissionId, user.id);
    if (!reserved.ok) {
      return NextResponse.json({ error: reserved.error }, { status: reserved.status });
    }

    const hasMcq = ((layoutMapRow as any)?.mcq_bubbles?.length ?? 0) > 0;
    const hasSubjective = buildSubjectiveQuestions(paper.content).length > 0;
    await startGradingProgress(submissionId, hasMcq, hasSubjective);

    // Without ?force=1, a teacher's own reviewed answers (reviewed_by set)
    // are protected — gradeMcqForSubmission/gradeSubjectiveForSubmission
    // skip regrading and never delete those rows. force=1 wipes everything.
    startGradingInBackground({ submissionId, submission, paper, layoutMapRow, userId: user.id, force });

    return NextResponse.json({
      submission: { ...submission, status: 'processing', processing_error: null },
      processing: true,
    });
  } catch (error: any) {
    console.error('Error starting regrade:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
