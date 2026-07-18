// Pure scoring helpers shared between /api/checker/grade-mcq (initial
// auto-grading) and the teacher-override/finalize routes, so the "what's
// the effective answer" and "what does the submission's total look like"
// logic only lives in one place.
import { SubmissionAnswerRow } from '@/types/checker';

/** The option that actually counts: the teacher's manual correction if one
 *  was made, otherwise whatever the CV detected. */
export function effectiveOption(answer: Pick<SubmissionAnswerRow, 'override_option' | 'detected_option'>): string | null {
  return answer.override_option ?? answer.detected_option;
}

/** Whether an answer's effective option matches its stored correct_option. */
export function isAnswerCorrect(answer: Pick<SubmissionAnswerRow, 'override_option' | 'detected_option' | 'correct_option'>): boolean {
  const effective = effectiveOption(answer);
  return effective != null && effective === answer.correct_option;
}

export interface SubmissionTotals {
  mcqScore: number;
  maxScore: number;
  anyNeedsReview: boolean;
}

/** Recomputes a submission's MCQ totals from its current answer rows —
 *  used right after grading and again after every teacher override, so the
 *  two paths can never drift apart. */
export function recomputeSubmissionTotals(answers: Pick<SubmissionAnswerRow, 'max_marks' | 'needs_review' | 'override_option' | 'detected_option' | 'correct_option'>[]): SubmissionTotals {
  let mcqScore = 0;
  let maxScore = 0;
  let anyNeedsReview = false;

  for (const answer of answers) {
    maxScore += answer.max_marks;
    if (isAnswerCorrect(answer)) mcqScore += answer.max_marks;
    if (answer.needs_review) anyNeedsReview = true;
  }

  return { mcqScore, maxScore, anyNeedsReview };
}
