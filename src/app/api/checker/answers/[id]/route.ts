// app/api/checker/answers/[id]/route.ts
// Teacher override for a single submission_answer row: sets the manually-
// corrected option (kept separate from detected_option so the original CV
// read is never lost), recomputes that row's final_marks, clears
// needs_review, stamps reviewed_by/reviewed_at, and recomputes the parent
// submission's totals. Requires the 'paper_checker' feature (admin/
// super_admin bypass).
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { verifySubmissionOwnership } from '@/lib/checker/ownership';
import { isAnswerCorrect, recomputeSubmissionTotals } from '@/lib/checker/answers';

const VALID_OPTIONS = ['A', 'B', 'C', 'D', 'BLANK'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const gate = await requireFeatureOrAdmin(supabaseAdmin, user.id, 'paper_checker');
    if (gate) return gate;

    const { id: answerId } = await params;
    const body = await req.json();
    const overrideOption = body?.override_option;
    if (!VALID_OPTIONS.includes(overrideOption)) {
      return NextResponse.json({ error: `override_option must be one of ${VALID_OPTIONS.join(', ')}` }, { status: 400 });
    }

    const { data: answer, error: answerErr } = await supabaseAdmin
      .from('submission_answers')
      .select('*')
      .eq('id', answerId)
      .maybeSingle();
    if (answerErr || !answer) {
      return NextResponse.json({ error: answerErr?.message || 'Answer not found' }, { status: 404 });
    }

    const ownership = await verifySubmissionOwnership(answer.submission_id, user.id);
    if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });

    if (ownership.submission.status === 'finalized') {
      return NextResponse.json({ error: 'Submission is already finalized — cannot edit answers' }, { status: 409 });
    }

    const isCorrect = isAnswerCorrect({ override_option: overrideOption, detected_option: answer.detected_option, correct_option: answer.correct_option });
    const finalMarks = isCorrect ? answer.max_marks : 0;

    const { data: updatedAnswer, error: updateErr } = await supabaseAdmin
      .from('submission_answers')
      .update({
        override_option: overrideOption,
        final_marks: finalMarks,
        needs_review: false,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', answerId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const { data: allAnswers, error: allAnswersErr } = await supabaseAdmin
      .from('submission_answers')
      .select('max_marks, needs_review, override_option, detected_option, correct_option')
      .eq('submission_id', answer.submission_id);
    if (allAnswersErr) {
      return NextResponse.json({ error: allAnswersErr.message }, { status: 500 });
    }

    const { mcqScore, maxScore, anyNeedsReview } = recomputeSubmissionTotals(allAnswers || []);
    const submission = ownership.submission;

    const { data: updatedSubmission, error: submissionUpdateErr } = await supabaseAdmin
      .from('submissions')
      .update({
        mcq_score: mcqScore,
        total_score: mcqScore + (submission.subjective_score ?? 0),
        max_score: maxScore,
        status: anyNeedsReview ? 'in_review' : 'graded',
      })
      .eq('id', answer.submission_id)
      .select()
      .single();

    if (submissionUpdateErr) {
      return NextResponse.json({ error: submissionUpdateErr.message }, { status: 500 });
    }

    return NextResponse.json({ answer: updatedAnswer, submission: updatedSubmission });
  } catch (error: any) {
    console.error('Error overriding answer:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
