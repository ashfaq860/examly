// app/api/checker/submissions/[id]/confirm-remaining/route.ts
// "Confirm all remaining as-is" — a teacher who agrees with every
// still-flagged AI grade can clear them all in one click instead of
// opening and re-confirming each row individually. Bulk-clears
// needs_review on every submission_answers row that still has it, WITHOUT
// touching final_marks/override_option — accepting the AI's current
// values as final is the entire point of this action, unlike
// PATCH /api/checker/answers/[id] which always changes the value too.
//
// Deliberately does nothing for a section that failed outright (e.g.
// undetectable MCQ, zero rows to act on) — there's nothing to confirm, and
// finalizeSubmissionTotals's recomputeSectionStatus correctly leaves that
// section's status at 'needs_review' regardless of this call; only a
// successful regrade can clear it.
// Requires the 'paper_checker' feature (admin/super_admin bypass).
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { verifySubmissionOwnership } from '@/lib/checker/ownership';
import { computeOverallStatus } from '@/lib/checker/answers';
import { finalizeSubmissionTotals } from '@/lib/checker/gradeSubjective';

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
    const submission = ownership.submission;

    if (submission.status === 'finalized') {
      return NextResponse.json({ error: 'Submission is already finalized — cannot edit answers' }, { status: 409 });
    }

    const { error: bulkUpdateErr } = await supabaseAdmin
      .from('submission_answers')
      .update({ needs_review: false, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('submission_id', submissionId)
      .eq('needs_review', true);
    if (bulkUpdateErr) {
      return NextResponse.json({ error: bulkUpdateErr.message }, { status: 500 });
    }

    const { data: paperRow, error: paperErr } = await supabaseAdmin
      .from('papers')
      .select('content')
      .eq('id', submission.paper_id)
      .maybeSingle();
    if (paperErr || !paperRow) {
      return NextResponse.json({ error: paperErr?.message || 'Paper not found' }, { status: 404 });
    }

    const totals = await finalizeSubmissionTotals(submissionId, paperRow.content, {
      mcqStatus: submission.mcq_status,
      subjectiveStatus: submission.subjective_status,
      mcqError: submission.mcq_error,
      subjectiveError: submission.subjective_error,
    });

    const { data: updatedSubmission, error: submissionUpdateErr } = await supabaseAdmin
      .from('submissions')
      .update({
        mcq_score: totals.mcqScore,
        subjective_score: totals.subjectiveScore,
        total_score: totals.totalScore,
        max_score: totals.maxScore,
        mcq_status: totals.mcqStatus,
        subjective_status: totals.subjectiveStatus,
        subjective_marks_side: totals.subjectiveMarksSide,
        status: computeOverallStatus(totals.mcqStatus, totals.subjectiveStatus, totals.anyNeedsReview),
      })
      .eq('id', submissionId)
      .select()
      .single();
    if (submissionUpdateErr) {
      return NextResponse.json({ error: submissionUpdateErr.message }, { status: 500 });
    }

    return NextResponse.json({ submission: updatedSubmission });
  } catch (error: any) {
    console.error('Error confirming remaining answers:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
