// app/api/checker/grade-mcq/route.ts
// Thin HTTP wrapper around gradeMcqForSubmission() (src/lib/checker/gradeMcq.ts)
// — the actual grading logic moved there so the new orchestrator
// (/api/checker/grade) can call it directly for submissions that mix MCQ
// and subjective questions, without an internal HTTP round-trip.
//
// This route stays as the direct MCQ-only entry point: ?debug=1 still
// renders the composite PNG (every sampled bubble position + detected
// registration centroids) for visual alignment debugging, unchanged from
// before the extraction.
//
// Requires the 'paper_checker' feature (admin/super_admin bypass), and
// consumes one scan off the caller's pooled quota (consume_scan RPC) right
// before grading starts — 403 scan_quota_exhausted if none left.
//
// Needs Node (sharp uses native bindings) — not the Edge runtime.
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin, consumeScan } from '@/lib/entitlements';
import { isAcademyOwnerOfCreator } from '@/lib/checker/ownership';
import { gradeMcqForSubmission } from '@/lib/checker/gradeMcq';

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
      supabaseAdmin.from('papers').select('id, content, created_by').eq('id', submission.paper_id).maybeSingle(),
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

    const { data: layoutMapRow } = layoutMapResult;

    // Scan quota is consumed here — right before grading actually starts,
    // and only once every precondition has already been checked — so a
    // doomed-to-fail request never burns a scan.
    const scanOk = await consumeScan(supabaseAdmin, user.id);
    if (!scanOk) {
      return NextResponse.json({ error: 'scan_quota_exhausted' }, { status: 403 });
    }

    await supabaseAdmin.from('submissions').update({ status: 'processing', processing_error: null }).eq('id', submissionId);

    const result = await gradeMcqForSubmission({ submissionId, submission, paper, layoutMapRow, debugMode });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({
      mcq_score: result.mcqScore,
      max_mcq_score: result.maxScore,
      needs_review: result.anyNeedsReview,
      answers: result.answerRows,
      ...(debugMode ? { debugImageUrl: result.debugImageUrl } : {}),
    });
  } catch (error: any) {
    console.error('Error grading MCQ submission:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
