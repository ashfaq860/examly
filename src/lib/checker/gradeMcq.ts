// Grades the MCQ section of a submission — extracted from what was
// originally the whole body of /api/checker/grade-mcq/route.ts, so the new
// orchestrator (/api/checker/grade) can call it directly (no internal HTTP
// round-trip) for a submission that mixes MCQ and subjective questions.
// The route itself is now a thin wrapper around this (see grade-mcq/route.ts)
// so its ?debug=1 composite-image feature keeps working unchanged for
// direct MCQ-only debugging.
//
// Pure orchestration now — the actual CV work lives in
// src/lib/checker/omr/align.ts (fiducial detection + template<->scan
// alignment) and omr/read.ts (per-bubble darkness sampling + the
// BLANK/MULTIPLE/option decision). Both are ALSO what annotatePdf.ts uses
// to draw marks, sharing the exact same fitted alignment (persisted below
// as `graded_fiducials`) — detection and annotation can't independently
// disagree about where a bubble is, because they're not two
// implementations, just one shared one called twice.
//
// This function does NOT do auth, ownership, scan-quota consumption, or the
// submissions.status='processing' bump — the caller (route or orchestrator)
// does those once, since a mixed mcq+subjective submission must only
// consume one scan and flip to 'processing' once, not once per grading kind.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { BubbleLayoutV3, LAYOUT_MAP_FRAME_V3, BubbleOption, BubbleOverlay, DetectedOption } from '@/types/checker';
import { recomputeSubmissionTotals, isAnswerCorrect } from '@/lib/checker/answers';
import { loadGrayscale, renderDebugComposite, GrayImage } from '@/lib/checker/imaging';
import { detectFiducials, fitAlignment, Corner, Alignment } from '@/lib/checker/omr/align';
import { readBubbles, LOW_CONFIDENCE } from '@/lib/checker/omr/read';
import { downloadScan, getSignedScanUrl, DEFAULT_SCAN_BUCKET } from '@/lib/checker/scanStorage';
import { describeClaudeError, ErrorKind } from '@/lib/checker/claude';

export { LOW_CONFIDENCE }; // re-exported: gradeSubjective.ts shares this same confidence convention

const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];
const OPTIONS: BubbleOption[] = ['A', 'B', 'C', 'D'];

async function markFailed(submissionId: string, message: string) {
  await supabaseAdmin.from('submissions').update({ status: 'failed', processing_error: message }).eq('id', submissionId);
}

/** Builds question_id -> marksEach from the paper's stored PaperSection[] content. */
function buildMarksMap(content: any): Record<string, number> {
  const marks: Record<string, number> = {};
  if (!Array.isArray(content)) return marks;
  for (const section of content) {
    if (section?.type !== 'mcq' || !Array.isArray(section.questions)) continue;
    for (const q of section.questions) {
      if (q?.id) marks[q.id] = section.marksEach ?? 1;
    }
  }
  return marks;
}

/** Builds the debug-composite SVG overlay: every sampled bubble position as
 *  a color-coded outlined circle with its computed fill-ratio printed next
 *  to it, plus the 4 detected registration fiducials circled and labeled. */
function buildDebugSvg(
  width: number,
  height: number,
  answerRows: { detected_option: DetectedOption; override_option: string | null; correct_option: string | null; bubble_overlay: BubbleOverlay }[],
  detectedFiducials: Record<Corner, { cx: number; cy: number }>,
): string {
  const parts: string[] = [];

  for (const row of answerRows) {
    const effective = row.override_option ?? row.detected_option;
    const isMultiple = row.detected_option === 'MULTIPLE';
    const darkestTwo = isMultiple
      ? OPTIONS.slice().sort((a, b) => row.bubble_overlay[b].darkness - row.bubble_overlay[a].darkness).slice(0, 2)
      : [];

    for (const opt of OPTIONS) {
      const rect = row.bubble_overlay[opt];
      const cx = rect.xFrac * width;
      const cy = rect.yFrac * height;
      const r = rect.rFrac * width;

      let color = '#999999';
      if (isMultiple) {
        if (darkestTwo.includes(opt)) color = '#f5a623';
      } else if (opt === effective) {
        color = effective === row.correct_option ? '#2ecc71' : '#e74c3c';
      }

      parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${color}" stroke-width="2.5" />`);
      const pct = Math.round(rect.darkness * 100);
      parts.push(`<text x="${(cx + r + 3).toFixed(1)}" y="${(cy + 3).toFixed(1)}" font-size="9" fill="${color}">${pct}%</text>`);
    }
  }

  for (const corner of CORNERS) {
    const { cx, cy } = detectedFiducials[corner];
    parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="12" fill="none" stroke="red" stroke-width="2.5" />`);
    parts.push(`<text x="${(cx + 14).toFixed(1)}" y="${(cy - 8).toFixed(1)}" font-size="10" fill="red">${corner}</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join('')}</svg>`;
}

export interface GradeMcqResult {
  ok: boolean;
  error?: string;
  /** Machine-readable classification of `error` (see claude.ts's
   *  describeClaudeError) — MCQ grading never calls Claude itself, but
   *  scan download (Supabase Storage) can hit the exact same class of
   *  network failure, so this stays classifiable for the review UI's
   *  section-error banner. Undefined for a genuine CV/domain failure
   *  (e.g. no fiducials found) — not one of ErrorKind's specific buckets. */
  errorKind?: ErrorKind;
  status?: number;
  skipped?: boolean; // true when the paper simply has no MCQ section — not a failure
  answerRows?: any[];
  mcqScore?: number;
  maxScore?: number;
  anyNeedsReview?: boolean;
  gradedScanIndex?: number;
  /** The 4 detected fiducial pixel points on the winning scan — persisted
   *  on the submission so annotatePdf.ts can re-derive the EXACT same
   *  alignment via fitAlignment() without re-running detection. */
  gradedFiducials?: Record<Corner, { cx: number; cy: number }>;
  debugImageUrl?: string | null;
}

/** submission/paper/layoutMapRow are pre-fetched by the caller (route or
 *  orchestrator), since both already need them for their own auth/ownership
 *  checks — no point fetching twice. */
export async function gradeMcqForSubmission(params: {
  submissionId: string;
  submission: any;
  paper: any;
  layoutMapRow: any | null;
  debugMode?: boolean;
  /** When false (default), MCQ questions the teacher has already reviewed
   *  (submission_answers.reviewed_by set) are left untouched — not
   *  regraded, not deleted. true wipes and regrades everything, used by
   *  the regrade route's ?force=1. */
  force?: boolean;
  /** true when the orchestrator is running this alongside subjective
   *  grading (Promise.allSettled — see gradeOrchestrator.ts) and will do
   *  its OWN authoritative status write once both settle. Without this, the
   *  provisional `status` update below raced subjective grading: MCQ (fast,
   *  CV-only) would flip the row to 'graded'/'in_review' — with a
   *  total_score that's really just the MCQ score, since subjective hasn't
   *  written its own yet — while subjective grading (slow, LLM-driven) was
   *  still running, making the UI briefly report "Graded" with a partial
   *  score. Standalone callers (grade-mcq/route.ts's direct MCQ-only debug
   *  endpoint) still need this function to set the final status itself, so
   *  the gate defaults to false there. */
  skipStatusUpdate?: boolean;
}): Promise<GradeMcqResult> {
  const { submissionId, submission, paper, layoutMapRow, debugMode, force = false, skipStatusUpdate = false } = params;

  if (!layoutMapRow) {
    const message = 'No MCQ layout map has been generated for this paper yet';
    await markFailed(submissionId, message);
    return { ok: false, error: message, status: 400 };
  }

  const layoutMap = layoutMapRow as BubbleLayoutV3;
  if (layoutMap.frame !== LAYOUT_MAP_FRAME_V3) {
    const message = 'Layout map outdated — regenerate this paper to enable checking.';
    await markFailed(submissionId, message);
    return { ok: false, error: message, status: 400 };
  }

  const allBubbles = layoutMap.mcq_bubbles || [];
  if (allBubbles.length === 0) {
    // Not an error — this paper simply has no MCQ section (subjective-only).
    return { ok: true, skipped: true, answerRows: [], mcqScore: 0, maxScore: 0, anyNeedsReview: false };
  }

  let bubbles = allBubbles;
  if (!force) {
    const { data: reviewedRows } = await supabaseAdmin
      .from('submission_answers')
      .select('question_id')
      .eq('submission_id', submissionId)
      .eq('answer_kind', 'mcq')
      .not('reviewed_by', 'is', null);
    const protectedIds = new Set((reviewedRows || []).map(r => r.question_id));
    if (protectedIds.size > 0) {
      bubbles = allBubbles.filter(b => !protectedIds.has(b.question_id));
      if (bubbles.length === 0) {
        // Every MCQ question was already teacher-reviewed — nothing left to (re)grade.
        return { ok: true, skipped: true, answerRows: [], mcqScore: 0, maxScore: 0, anyNeedsReview: false };
      }
    }
  }

  if (!Array.isArray(submission.scan_urls) || submission.scan_urls.length === 0) {
    return { ok: false, error: 'Submission has no scan images', status: 400 };
  }

  const questionIds = [...new Set(bubbles.map(b => b.question_id))];
  const [questionsResult, scanDownloads] = await Promise.all([
    supabaseAdmin.from('questions').select('id, correct_option').in('id', questionIds),
    Promise.all(submission.scan_urls.map(async (scanUrl: string) => {
      try {
        return { scanUrl, buffer: await downloadScan(scanUrl), error: undefined as string | undefined, errorKind: undefined as ErrorKind | undefined };
      } catch (e: unknown) {
        const info = describeClaudeError(e);
        return { scanUrl, buffer: null as Buffer | null, error: info.summary, errorKind: info.kind as ErrorKind | undefined };
      }
    })),
  ]);
  const { data: questionRows, error: qErr } = questionsResult;
  if (qErr) {
    await markFailed(submissionId, qErr.message);
    return { ok: false, error: qErr.message, status: 500 };
  }
  const correctOptionMap: Record<string, string | null> = {};
  for (const q of questionRows || []) correctOptionMap[q.id] = q.correct_option;

  const marksMap = buildMarksMap(paper.content);

  let gray: GrayImage | null = null;
  let alignment: Alignment | null = null;
  let gradedScanIndex = -1;
  let winningBuffer: Buffer | null = null;
  let winningFiducials: Record<Corner, { cx: number; cy: number }> | null = null;
  const attemptErrors: string[] = [];
  // Classification of the FIRST download-related failure, if any — carried
  // through to the final ok:false return so a genuine network outage (as
  // opposed to a CV detection miss) is visible as errorKind:'network', not
  // just buried in the aggregated attemptErrors text.
  let firstDownloadErrorKind: ErrorKind | undefined;

  for (let i = 0; i < scanDownloads.length; i++) {
    const { scanUrl, buffer, error: downloadError, errorKind: downloadErrorKind } = scanDownloads[i];
    if (!buffer) {
      attemptErrors.push(`${scanUrl}: ${downloadError}`);
      if (firstDownloadErrorKind === undefined) firstDownloadErrorKind = downloadErrorKind;
      continue;
    }
    try {
      const candidateGray = await loadGrayscale(buffer);
      const fiducials = detectFiducials(candidateGray, layoutMap);
      if (!fiducials) {
        attemptErrors.push(`${scanUrl}: could not find 4 fiducials matching this paper's known registration-square arrangement`);
        continue;
      }
      const fit = fitAlignment(fiducials, layoutMap);
      if (!fit) {
        attemptErrors.push(`${scanUrl}: fiducials found but formed a degenerate (collinear) configuration`);
        continue;
      }
      gray = candidateGray;
      alignment = fit;
      gradedScanIndex = i;
      winningBuffer = buffer;
      winningFiducials = CORNERS.reduce((acc, c) => {
        acc[c] = { cx: fiducials[c].cx, cy: fiducials[c].cy };
        return acc;
      }, {} as Record<Corner, { cx: number; cy: number }>);
      break;
    } catch (e: any) {
      attemptErrors.push(`${scanUrl}: ${e.message || e}`);
    }
  }

  if (!gray || !alignment || !winningFiducials) {
    const message = `Could not detect registration marks on any scanned page: ${attemptErrors.join('; ')}`;
    await markFailed(submissionId, message);
    return { ok: false, error: message, errorKind: firstDownloadErrorKind, status: 422 };
  }

  const readings = readBubbles(gray, alignment, bubbles);

  const answerRows = readings.map(r => {
    const needsReview = r.detected_option === 'MULTIPLE' || r.detected_option === 'BLANK' || r.fill_confidence < LOW_CONFIDENCE;
    const correctOption = correctOptionMap[r.question_id] ?? null;
    const maxMarks = marksMap[r.question_id] ?? 1;
    const isCorrect = isAnswerCorrect({ override_option: null, detected_option: r.detected_option, correct_option: correctOption });

    const bubbleOverlay: BubbleOverlay = OPTIONS.reduce((acc, opt) => {
      const s = r.options[opt];
      acc[opt] = {
        xFrac: s.cx / gray!.width,
        yFrac: s.cy / gray!.height,
        rFrac: s.r / gray!.width,
        darkness: s.darkness,
      };
      return acc;
    }, {} as BubbleOverlay);

    return {
      submission_id: submissionId,
      question_id: r.question_id,
      q_number: String(r.q),
      answer_kind: 'mcq' as const,
      detected_option: r.detected_option,
      correct_option: correctOption,
      override_option: null,
      fill_confidence: r.fill_confidence,
      bubble_overlay: bubbleOverlay,
      max_marks: maxMarks,
      needs_review: needsReview,
      final_marks: isCorrect ? maxMarks : 0,
    };
  });

  // Without force, only non-reviewed existing mcq rows are cleared — a
  // teacher's own reviewed rows for OTHER questions in this same submission
  // are left in place (and never re-inserted, since `answerRows` above was
  // already filtered to exclude them).
  let deleteQuery = supabaseAdmin.from('submission_answers').delete().eq('submission_id', submissionId).eq('answer_kind', 'mcq');
  if (!force) deleteQuery = deleteQuery.is('reviewed_by', null);
  await deleteQuery;

  const { error: insertErr } = await supabaseAdmin.from('submission_answers').insert(answerRows);
  if (insertErr) {
    await markFailed(submissionId, insertErr.message);
    return { ok: false, error: insertErr.message, status: 500 };
  }

  // NOTE: these totals only cover the rows just (re)graded above — when
  // `force` is false and some questions were protected/skipped, this
  // undercounts vs. the submission's true total. Harmless: this function's
  // own submissions update is provisional (see doc comment above), and the
  // orchestrator always does one final recompute over ALL of a
  // submission's answer rows afterward regardless.
  const { mcqScore, maxScore, anyNeedsReview } = recomputeSubmissionTotals(answerRows as any);

  // Provisional — final when called standalone via the thin wrapper route;
  // superseded by the orchestrator's combined recompute when both mcq and
  // subjective ran for this submission. `status` is omitted entirely when
  // skipStatusUpdate is set — the orchestrator's own final update is the
  // only thing allowed to move the row out of 'processing' in that case
  // (see the param's own doc comment above).
  // Wrapped, same reasoning as gradeSubjective.ts's own provisional update:
  // grading itself already succeeded by this point (answerRows are
  // inserted) — a transient network blip on this specific write shouldn't
  // turn an otherwise-successful grade into a rejected promise. The
  // orchestrator's own final combined update is authoritative regardless.
  try {
    await supabaseAdmin
      .from('submissions')
      .update({
        mcq_score: mcqScore,
        total_score: mcqScore + (submission.subjective_score ?? 0),
        max_score: maxScore,
        ...(skipStatusUpdate ? {} : { status: anyNeedsReview ? 'in_review' : 'graded' }),
        processing_error: null,
        graded_scan_index: gradedScanIndex,
        graded_fiducials: winningFiducials,
        graded_image_width: gray.width,
        graded_image_height: gray.height,
      })
      .eq('id', submissionId);
  } catch (e: unknown) {
    console.error(`Provisional MCQ-score update failed for submission ${submissionId} (grading itself succeeded): ${describeClaudeError(e).summary}`, e);
  }

  let debugImageUrl: string | null = null;
  if (debugMode && winningBuffer) {
    try {
      const svg = buildDebugSvg(gray.width, gray.height, answerRows, winningFiducials);
      const debugBuffer = await renderDebugComposite(winningBuffer, svg);
      const debugPath = `${submissionId}/debug.png`;
      const { error: debugUploadErr } = await supabaseAdmin.storage
        .from(DEFAULT_SCAN_BUCKET)
        .upload(debugPath, debugBuffer, { contentType: 'image/png', upsert: true });
      if (!debugUploadErr) {
        debugImageUrl = await getSignedScanUrl(debugPath, 300);
      } else {
        console.error('Failed to upload debug composite:', debugUploadErr.message);
      }
    } catch (e: any) {
      console.error('Failed to render debug composite:', e.message || e);
    }
  }

  return { ok: true, answerRows, mcqScore, maxScore, anyNeedsReview, gradedScanIndex, gradedFiducials: winningFiducials, debugImageUrl };
}
