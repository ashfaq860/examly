// Live grading-progress tracking (submissions.grading_stage/grading_label/
// grading_done/grading_total) — the ONE place stage->label mapping lives,
// so gradeOrchestrator.ts's progress writes and the review page's own
// strip rendering can never disagree about what a stage is called.
//
// No grading_status column exists alongside these — submissions.status
// already distinguishes processing/graded/failed; a second parallel status
// enum would risk the same drift mcq_status/subjective_status needed a
// dedicated fix for earlier in this project. These columns are purely
// "what's happening right now," read only while status === 'processing'.
//
// MCQ and subjective grading run CONCURRENTLY (Promise.allSettled in
// gradeOrchestrator.ts), sending all subjective questions in ONE batched
// Claude call (a deliberate earlier fix for slow grading) rather than one
// call per question — so there is no real per-question completion event to
// report. Progress here is real but coarse: one step per section the paper
// actually has, plus one for the final recompute+annotate pass. Never a
// fabricated per-question step.
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type GradingStage = 'mcq' | 'subjective' | 'finalizing';

export const GRADING_STAGE_LABELS: Record<GradingStage, string> = {
  mcq: 'Grading MCQ…',
  subjective: 'Grading subjective answers…',
  finalizing: 'Finalizing…',
};

/** One step per section the paper actually declares, plus one for
 *  finalizing — mirrors gradeOrchestrator.ts's own section-skip logic (a
 *  paper with no MCQ/subjective section never counts a step for it, same
 *  as it never counts that section toward `partialErrors`). */
export function computeGradingTotal(hasMcq: boolean, hasSubjective: boolean): number {
  return (hasMcq ? 1 : 0) + (hasSubjective ? 1 : 0) + 1;
}

/** The first real stage a fresh grading run enters — whichever section the
 *  paper actually has; a content-less paper (shouldn't normally happen)
 *  falls straight to 'finalizing'. */
export function firstGradingStage(hasMcq: boolean, hasSubjective: boolean): GradingStage {
  if (hasMcq) return 'mcq';
  if (hasSubjective) return 'subjective';
  return 'finalizing';
}

/** Initial write — called synchronously alongside reserveGradingSlot,
 *  before the HTTP response returns, so a review page opened the instant
 *  grading starts sees a real first label immediately instead of a blank
 *  gap until the first background step completes. */
export async function startGradingProgress(submissionId: string, hasMcq: boolean, hasSubjective: boolean): Promise<void> {
  const stage = firstGradingStage(hasMcq, hasSubjective);
  await supabaseAdmin
    .from('submissions')
    .update({
      grading_stage: stage,
      grading_label: GRADING_STAGE_LABELS[stage],
      grading_done: 0,
      grading_total: computeGradingTotal(hasMcq, hasSubjective),
      grading_updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId);
}

/** Advances progress by exactly one real, completed step. Goes through the
 *  advance_grading_progress Postgres function (see
 *  alter_checker_grading_progress.sql) rather than a client-side
 *  read-modify-write increment — MCQ and subjective grading run
 *  concurrently and could otherwise both read the same starting
 *  grading_done value and race. `label` overrides the base
 *  GRADING_STAGE_LABELS entry (e.g. "MCQ graded (10/10)" instead of the
 *  generic "Grading MCQ…") since the caller already knows the real outcome
 *  by the time it calls this — best-effort: a failure here is logged, never
 *  thrown, since a missed progress update must never fail grading itself. */
export async function advanceGradingProgress(submissionId: string, stage: GradingStage, label: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('advance_grading_progress', {
    p_submission_id: submissionId,
    p_stage: stage,
    p_label: label,
  });
  if (error) {
    console.error(`Failed to advance grading progress for submission ${submissionId} (stage ${stage}):`, error.message);
  }
}
