// Core "grade one submission" orchestration — runs MCQ and subjective
// grading, then does one authoritative combined recompute. Extracted out
// of /api/checker/grade/route.ts so /api/checker/submissions/[id]/regrade
// can re-run the exact same logic without duplicating it (the routes only
// differ in what happens BEFORE this runs: grade checks preconditions on a
// fresh submission, regrade additionally wipes prior answers first).
//
// The two grading kinds are run via Promise.allSettled so one kind's
// failure — or an unexpected throw, not just the {ok:false} results both
// functions normally return — can never block or delay the other. Each
// section then gets its OWN status independent of the other:
//   - 'skipped'      — the paper doesn't declare this section at all (not
//                       an error; e.g. a subjective-only paper's MCQ side).
//   - 'graded'        — the section graded cleanly.
//   - 'needs_review'  — either some answers in a graded section need a
//                       human look, OR the section failed outright (no
//                       registration squares detected, etc.) — in the
//                       failed case `awarded` is null and `error` is set,
//                       so a UI can render "MCQ not detected" instead of a
//                       fabricated 0 silently folded into the total.
// A submission's overall status is only 'failed' when BOTH sections fail
// outright — nothing could be graded at all. One section failing while the
// other succeeds is 'needs_review', never silently 'graded': the previous
// version derived status purely from submission_answers rows, so a section
// that failed before writing any rows (e.g. undetectable MCQ) was
// invisible to that check and the submission could still end up 'graded'
// with a misleadingly low combined fraction.
import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { consumeScan } from '@/lib/entitlements';
import { gradeMcqForSubmission, GradeMcqResult } from '@/lib/checker/gradeMcq';
import { gradeSubjectiveForSubmission, finalizeSubmissionTotals, computePaperMaxScore, FinalizedTotals, GradeSubjectiveResult } from '@/lib/checker/gradeSubjective';
import { regenerateAnnotatedPdfForSubmission } from '@/lib/checker/annotatePdf';
import { computeOverallStatus } from '@/lib/checker/answers';
import { advanceGradingProgress, GRADING_STAGE_LABELS } from '@/lib/checker/gradingProgress';
import { describeClaudeError, ErrorKind } from '@/lib/checker/claude';
import { SectionOutcome } from '@/types/checker';

export interface OrchestrationResult {
  ok: boolean;
  error?: string;
  status?: number;
  submission?: any;
  totals?: FinalizedTotals;
  mcqOutcome?: SectionOutcome;
  subjectiveOutcome?: SectionOutcome;
  pageCountMismatch?: boolean;
  partialErrors?: string[];
  debugImageUrl?: string | null;
  annotatedPdfPath?: string | null;
}

function resolveSectionOutcome(
  result: { ok: boolean; skipped?: boolean; error?: string; errorKind?: ErrorKind; anyNeedsReview?: boolean },
  awarded: number,
  declaredMax: number,
): SectionOutcome {
  if (result.skipped) return { status: 'skipped', awarded: 0, max: declaredMax, error: null };
  if (!result.ok) return { status: 'needs_review', awarded: null, max: declaredMax, error: result.error || 'Grading failed', errorKind: result.errorKind };
  // ok:true can still carry an error/errorKind (see gradeSubjectiveForSubmission's
  // batchFailure handling) — a batch call that failed but was fully
  // recovered by the per-question fallback has nothing worth surfacing
  // (anyNeedsReview stays false), so the error is only attached when
  // something ACTUALLY ended up needing review.
  return {
    status: result.anyNeedsReview ? 'needs_review' : 'graded',
    awarded, max: declaredMax,
    error: result.anyNeedsReview ? (result.error ?? null) : null,
    errorKind: result.anyNeedsReview ? result.errorKind : undefined,
  };
}

/** Turns a Promise.allSettled rejection reason into the same {ok:false,
 *  error, errorKind} shape both grading functions already return for their
 *  own HANDLED failures — an unexpected throw (a bug, a transient Supabase
 *  error) gets the exact same real-cause classification as every other
 *  caught error in the pipeline, instead of a bare `.message`. */
function resultFromRejection<T extends { ok: boolean; error?: string; errorKind?: ErrorKind }>(reason: unknown): T {
  const info = describeClaudeError(reason);
  return { ok: false, error: info.summary, errorKind: info.kind } as T;
}

/** Consumes one scan-quota unit and flips the submission to 'processing' —
 *  split out from runGradeOrchestration itself so the calling route can
 *  await this SYNCHRONOUSLY (still returning an immediate 403 with
 *  scan_quota_exhausted, same as before) while the rest of grading — the
 *  slow part, several Claude calls plus CV work — runs afterward in the
 *  background (see startGradingInBackground below), so the HTTP response
 *  doesn't wait on it. */
export async function reserveGradingSlot(submissionId: string, userId: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const scanOk = await consumeScan(supabaseAdmin, userId);
  if (!scanOk) return { ok: false, error: 'scan_quota_exhausted', status: 403 };

  await supabaseAdmin.from('submissions').update({ status: 'processing', processing_error: null }).eq('id', submissionId);
  return { ok: true };
}

export interface RunGradeOrchestrationParams {
  submissionId: string;
  submission: any;
  paper: any;
  layoutMapRow: any;
  userId: string;
  debugMode?: boolean;
  /** true (regrade's ?force=1) wipes and regrades every answer, including
   *  ones a teacher already reviewed. Default false protects reviewed rows. */
  force?: boolean;
}

export async function runGradeOrchestration(params: RunGradeOrchestrationParams): Promise<OrchestrationResult> {
  const { submissionId, submission, paper, layoutMapRow, force = false, debugMode } = params;

  // MCQ grading now runs FIRST, awaited, before subjective starts — a
  // deliberate change from the previous concurrent (Promise.allSettled)
  // design. MCQ is pure CV (no network call), so this costs negligible
  // latency; what it buys is real, scan-specific evidence
  // (mcqResult.gradedScanIndex — the page fiducial detection actually
  // locked onto) that gradeSubjectiveForSubmission uses to exclude the MCQ
  // bubble-sheet page from its own image payload (see its own doc comment
  // and the cost-reduction round's plan) — something no amount of
  // concurrency could provide, since subjective would otherwise have to
  // start before MCQ's own detection has run. `.catch(resultFromRejection)`
  // preserves the exact same "never let an unexpected throw escape this
  // function" guarantee Promise.allSettled used to provide.
  const mcqResult: GradeMcqResult = await gradeMcqForSubmission({ submissionId, submission, paper, layoutMapRow, debugMode, force, skipStatusUpdate: true })
    .then(async result => {
      if (!result.skipped) {
        const label = result.ok ? `MCQ graded (${result.mcqScore ?? 0}/${result.maxScore ?? 0})` : 'MCQ grading failed';
        await advanceGradingProgress(submissionId, 'mcq', label);
      }
      return result;
    })
    .catch((reason: unknown) => resultFromRejection<GradeMcqResult>(reason));

  const subjectiveResult: GradeSubjectiveResult = await gradeSubjectiveForSubmission({
    submissionId, submission, paper, force, skipStatusUpdate: true,
    layoutMapRow,
    mcqGradedScanIndex: mcqResult.gradedScanIndex ?? null,
  })
    .then(async result => {
      if (!result.skipped) {
        const label = result.ok ? `Subjective graded (${result.subjectiveScore ?? 0}/${result.maxScore ?? 0})` : 'Subjective grading failed';
        await advanceGradingProgress(submissionId, 'subjective', label);
      }
      return result;
    })
    .catch((reason: unknown) => resultFromRejection<GradeSubjectiveResult>(reason));

  const partialErrors: string[] = [];
  if (!mcqResult.ok) partialErrors.push(`MCQ: ${mcqResult.error}`);
  if (!subjectiveResult.ok) partialErrors.push(`Subjective: ${subjectiveResult.error}`);

  // Only when NEITHER section could be graded at all does the whole
  // submission fail — this is unchanged from before; what's new is
  // everything below, for the case where exactly one side failed.
  if (!mcqResult.ok && !subjectiveResult.ok) {
    const message = partialErrors.join('; ') || 'Grading failed';
    await supabaseAdmin.from('submissions').update({ status: 'failed', processing_error: message }).eq('id', submissionId);
    return { ok: false, error: message, status: mcqResult.status || subjectiveResult.status || 500 };
  }

  // Both grading calls have settled — the remaining work (authoritative
  // recompute + annotate) is the LAST counted step (see gradingProgress.ts's
  // computeGradingTotal, which always reserves one for this).
  await advanceGradingProgress(submissionId, 'finalizing', GRADING_STAGE_LABELS.finalizing);

  const pageCountMismatch = layoutMapRow?.page_count != null
    ? submission.scan_urls.length !== layoutMapRow.page_count
    : false;

  const totals = await finalizeSubmissionTotals(submissionId, paper.content);
  const paperMax = computePaperMaxScore(paper.content);
  const mcqOutcome = resolveSectionOutcome(mcqResult, totals.mcqScore, paperMax.mcqMax);
  const subjectiveOutcome = resolveSectionOutcome(subjectiveResult, totals.subjectiveScore, paperMax.subjectiveMax);

  const status = computeOverallStatus(mcqOutcome.status, subjectiveOutcome.status, totals.anyNeedsReview);

  // Wrapped: unlike the two grading functions' own PROVISIONAL updates,
  // this one is authoritative, so a failure here is a real ok:false result
  // (not silently swallowed) — but classifying it with describeClaudeError
  // gives a real cause at the point of failure, rather than falling
  // through to startGradingInBackground's own generic catch-all one level
  // up (which would still catch a THROWN error, just with a less specific
  // message).
  let updatedSubmission: any;
  try {
    const { data, error: updateErr } = await supabaseAdmin
      .from('submissions')
      .update({
        mcq_score: totals.mcqScore,
        subjective_score: totals.subjectiveScore,
        total_score: totals.totalScore,
        max_score: totals.maxScore,
        status,
        mcq_status: mcqOutcome.status,
        subjective_status: subjectiveOutcome.status,
        mcq_error: mcqOutcome.error,
        subjective_error: subjectiveOutcome.error,
        mcq_error_kind: mcqOutcome.errorKind ?? null,
        subjective_error_kind: subjectiveOutcome.errorKind ?? null,
        mcq_max: mcqOutcome.max,
        subjective_max: subjectiveOutcome.max,
        subjective_marks_side: totals.subjectiveMarksSide,
        processing_error: partialErrors.length > 0 ? partialErrors.join('; ') : null,
        page_count_mismatch: pageCountMismatch,
        ...(mcqResult.gradedScanIndex != null && mcqResult.gradedScanIndex >= 0 ? { graded_scan_index: mcqResult.gradedScanIndex } : {}),
        // graded_fiducials/graded_image_width/graded_image_height are NOT
        // repeated here — gradeMcqForSubmission already wrote them directly
        // (awaited above, before this update runs), and this partial
        // .update() leaves untouched columns as-is, so they're already on
        // the row by the time the .select() below reads it back.
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (updateErr) return { ok: false, error: updateErr.message, status: 500 };
    updatedSubmission = data;
  } catch (e: unknown) {
    const info = describeClaudeError(e);
    return { ok: false, error: `Failed to save grading results: ${info.summary}`, status: 500 };
  }

  // Best-effort: an annotation failure must never fail grading itself —
  // the teacher/parent just won't get a marked-up copy this time.
  // regenerateAnnotatedPdfForSubmission is self-contained (fetches the
  // submission's own scan/alignment data and its paper's layout map fresh
  // from `submissionId` alone, then re-fetches current submission_answers)
  // — the same shared helper the finalize route uses, so "what does this
  // submission need to be re-annotated" lives in exactly one place instead
  // of being assembled inline at every call site.
  const annotatedPdfPath = await regenerateAnnotatedPdfForSubmission(submissionId);
  if (annotatedPdfPath) {
    updatedSubmission.annotated_pdf_path = annotatedPdfPath;
  }

  return {
    ok: true,
    submission: updatedSubmission,
    totals,
    mcqOutcome,
    subjectiveOutcome,
    pageCountMismatch,
    partialErrors: partialErrors.length > 0 ? partialErrors : undefined,
    debugImageUrl: mcqResult.debugImageUrl ?? null,
    annotatedPdfPath,
  };
}

/** Starts grading via Next's after() so the HTTP response can return
 *  immediately after reserveGradingSlot, while the actual work — several
 *  Claude calls plus CV — keeps running afterward. after() (not a bare
 *  un-awaited promise) is required here specifically because this app
 *  deploys to Vercel (see vercel.json): a Vercel serverless function's
 *  execution is frozen right after its response is sent unless the
 *  pending work is registered via waitUntil/after(), so a plain
 *  fire-and-forget call would get cut off almost immediately in
 *  production even though it happens to keep running on a persistent
 *  local `next dev`/`next start` Node process.
 *
 *  Also closes a real gap a bare `.catch(console.error)` would have: an
 *  exception from OUTSIDE runGradeOrchestration's own handled {ok:false}
 *  paths (a bug, a transient Supabase error, the invocation's own
 *  maxDuration being hit) would otherwise leave the row stuck at
 *  status:'processing' forever with no visible failure and no Retry
 *  button. This always lands it on 'failed' with the error message
 *  instead — every possible outcome of a background grade attempt is now
 *  either a real result or a retryable 'failed', never a silent stall. */
export function startGradingInBackground(params: RunGradeOrchestrationParams): void {
  after(() => runGradeOrchestration(params).catch(async (err: any) => {
    const message = err?.message || String(err);
    console.error(`Background grading failed for submission ${params.submissionId}:`, message);
    try {
      await supabaseAdmin.from('submissions').update({ status: 'failed', processing_error: message }).eq('id', params.submissionId);
    } catch { /* best-effort — the console.error above is the fallback trace */ }
  }));
}
