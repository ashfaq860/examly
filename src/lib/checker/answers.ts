// Pure scoring helpers shared between the grading engines (grade-mcq,
// grade-subjective) and the teacher-override/finalize routes, so the
// "what's the effective answer/marks" and "what does the submission's
// total look like" logic only lives in one place.
import { SubmissionAnswerRow, SectionStatus } from '@/types/checker';

/** The option that actually counts: the teacher's manual correction if one
 *  was made, otherwise whatever the CV detected. MCQ-only concept. */
export function effectiveOption(answer: Pick<SubmissionAnswerRow, 'override_option' | 'detected_option'>): string | null {
  return answer.override_option ?? answer.detected_option;
}

/** Whether an MCQ answer's effective option matches its stored correct_option. */
export function isAnswerCorrect(answer: Pick<SubmissionAnswerRow, 'override_option' | 'detected_option' | 'correct_option'>): boolean {
  const effective = effectiveOption(answer);
  return effective != null && effective === answer.correct_option;
}

/** Marks actually awarded for one answer row, regardless of kind. MCQ rows
 *  derive this from correctness (all-or-nothing per bubble); subjective
 *  rows carry their own marks directly (AI-graded or teacher-overridden) —
 *  there's no "correct option" concept for free-form answers. */
export function effectiveMarks(answer: Pick<SubmissionAnswerRow, 'answer_kind' | 'override_option' | 'detected_option' | 'correct_option' | 'max_marks' | 'final_marks'>): number {
  if (answer.answer_kind === 'subjective') return answer.final_marks ?? 0;
  return isAnswerCorrect(answer) ? answer.max_marks : 0;
}

export interface SubmissionTotals {
  mcqScore: number;
  subjectiveScore: number;
  totalScore: number;
  maxScore: number;
  anyNeedsReview: boolean;
}

/** Recomputes a submission's totals (both MCQ and subjective) from its
 *  current answer rows — used right after grading and again after every
 *  teacher override, so the two paths can never drift apart.
 *
 *  EXCESS_ATTEMPT rows (attempt-count enforcement in a choice section —
 *  see gradeSubjective.ts's resolveChoiceGroups) are excluded from
 *  maxScore entirely, not just scored as 0: the paper's true total only
 *  ever counted the required N of that group, so a question beyond N was
 *  never part of the denominator to begin with — including its max_marks
 *  would inflate the paper's total beyond what it was actually out of
 *  (e.g. a 5-question "attempt any 3" group worth 12 each should add 36 to
 *  the total, not 60). */
export function recomputeSubmissionTotals(answers: Pick<SubmissionAnswerRow, 'answer_kind' | 'max_marks' | 'needs_review' | 'override_option' | 'detected_option' | 'correct_option' | 'final_marks' | 'teacher_note'>[]): SubmissionTotals {
  let mcqScore = 0;
  let subjectiveScore = 0;
  let maxScore = 0;
  let anyNeedsReview = false;

  for (const answer of answers) {
    if (answer.teacher_note === 'EXCESS_ATTEMPT') continue;
    maxScore += answer.max_marks;
    if (answer.answer_kind === 'subjective') subjectiveScore += effectiveMarks(answer);
    else if (isAnswerCorrect(answer)) mcqScore += answer.max_marks;
    if (answer.needs_review) anyNeedsReview = true;
  }

  return { mcqScore, subjectiveScore, totalScore: mcqScore + subjectiveScore, maxScore, anyNeedsReview };
}

/** A submission's overall status must stay 'in_review' whenever EITHER
 *  section's own status is 'needs_review' — including a section that
 *  failed outright and so has zero rows for recomputeSubmissionTotals to
 *  see (e.g. undetectable MCQ). Every place that sets submissions.status
 *  after the initial grade (answer override, promote-excess, recapture)
 *  uses this instead of `anyNeedsReview` alone, so an override on the
 *  section that DID grade can never silently clear a review flag that
 *  belongs to the section that didn't. */
export function computeOverallStatus(
  mcqStatus: string | null | undefined,
  subjectiveStatus: string | null | undefined,
  anyNeedsReview: boolean,
): 'graded' | 'in_review' {
  if (mcqStatus === 'needs_review' || subjectiveStatus === 'needs_review' || anyNeedsReview) return 'in_review';
  return 'graded';
}

/** Recomputes ONE section's status (mcq_status or subjective_status) from
 *  its CURRENT answer rows — the piece that was missing entirely before
 *  this fix. `submissions.mcq_status`/`subjective_status` used to be
 *  written once at grade time (gradeOrchestrator.ts) and never touched
 *  again, so a section that started 'needs_review' stayed that way forever
 *  even after a teacher resolved every flagged row — the Finalize button's
 *  gate (and the server-side re-check in finalize/route.ts) reads exactly
 *  these two columns.
 *
 *  `hasOutrightError` (mcq_error/subjective_error being non-null) is
 *  checked BEFORE looking at any row: an outright-failed section (e.g.
 *  undetectable MCQ registration squares) has ZERO rows to resolve, so
 *  there is nothing a teacher's per-row override could ever clear — only a
 *  successful regrade can fix that, which goes through
 *  gradeOrchestrator.ts's own status write, not this function. `'skipped'`
 *  is likewise preserved outright: a section the paper simply doesn't
 *  declare is never re-derived from rows that will never exist. */
export function recomputeSectionStatus(
  rows: Pick<SubmissionAnswerRow, 'needs_review'>[],
  currentStatus: SectionStatus | null | undefined,
  hasOutrightError: boolean,
): SectionStatus {
  if (currentStatus === 'skipped') return 'skipped';
  if (hasOutrightError) return 'needs_review';
  return rows.some(r => r.needs_review) ? 'needs_review' : 'graded';
}
