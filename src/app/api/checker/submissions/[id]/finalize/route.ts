// app/api/checker/submissions/[id]/finalize/route.ts
// Locks a submission once the teacher is done reviewing it. Re-checks
// server-side that no needs_review answers remain — never trusts the
// client-side button-disabled state alone for a state-changing action.
// mcq_status/subjective_status are trustworthy for this check now that
// every override/recapture/confirm-remaining route recomputes them from
// current rows (see lib/checker/answers.ts's recomputeSectionStatus) —
// before that fix they were frozen at whatever grading first set them,
// which is what kept this route (and the review page's button) permanently
// blocked even after every flagged answer was resolved.
// After locking, regenerates the annotated PDF from the FINAL (post-
// override) marks — best-effort, never fails the finalize itself; a
// missing refreshed PDF just means the teacher re-downloads a stale copy
// until the next successful regenerate.
// Requires the 'paper_checker' feature (admin/super_admin bypass).
export const runtime = 'nodejs';
export const maxDuration = 60; // covers the best-effort annotated-PDF regeneration too

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { verifySubmissionOwnership } from '@/lib/checker/ownership';
import { regenerateAnnotatedPdfForSubmission } from '@/lib/checker/annotatePdf';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const gate = await requireFeatureOrAdmin(auth.supabase, user.id, 'paper_checker');
    if (gate) return gate;

    const { id: submissionId } = await params;
    const ownership = await verifySubmissionOwnership(submissionId, user.id);
    if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });

    if (ownership.submission.status === 'finalized') {
      return NextResponse.json({ error: 'Submission is already finalized' }, { status: 409 });
    }

    // A section that failed outright (e.g. undetectable MCQ) has ZERO
    // submission_answers rows for it, so the needs_review row-count check
    // below would never see it — checked separately here so a submission
    // with an ungraded section can never get locked in as final.
    if (ownership.submission.mcq_status === 'needs_review' || ownership.submission.subjective_status === 'needs_review') {
      return NextResponse.json({ error: 'A section of this paper still needs review before finalizing' }, { status: 400 });
    }

    const { count, error: countErr } = await supabaseAdmin
      .from('submission_answers')
      .select('id', { count: 'exact', head: true })
      .eq('submission_id', submissionId)
      .eq('needs_review', true);

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }
    if ((count || 0) > 0) {
      return NextResponse.json({ error: `${count} answer(s) still need review before finalizing` }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('submissions')
      .update({ status: 'finalized', finalized_at: new Date().toISOString(), finalized_by: user.id })
      .eq('id', submissionId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const annotatedPdfPath = await regenerateAnnotatedPdfForSubmission(submissionId);
    if (annotatedPdfPath) updated.annotated_pdf_path = annotatedPdfPath;

    return NextResponse.json({ submission: updated });
  } catch (error: any) {
    console.error('Error finalizing submission:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
