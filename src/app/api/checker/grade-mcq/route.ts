// app/api/checker/grade-mcq/route.ts
// Grades the MCQ section of a submission: detects the 4 registration
// squares on a scanned answer sheet, fits a homography from the UNIT
// SQUARE (0,0)-(1,0)-(0,1)-(1,1) to those 4 detected centroids, samples
// darkness at every bubble (whose position is stored as a fraction of the
// same registration-square frame — see LAYOUT_MAP_FRAME_V2 in
// types/checker.ts), decides the filled option, and writes
// submission_answers + submissions.mcq_score.
//
// Also persists enough per-bubble geometry (bubble_overlay, as fractions of
// the graded image's own width/height) plus which scan page was actually
// used (graded_scan_index) for the teacher-review screen to draw overlay
// circles without ever re-running CV client-side.
//
// ?debug=1 additionally renders a composite PNG (original scan + every
// sampled bubble position as a color-coded circle + the 4 detected
// registration centroids as crosses) to submission-scans/{id}/debug.png,
// returned as a signed URL — a permanent diagnostic feature for verifying
// alignment visually instead of guessing from detection results alone.
//
// Needs Node (sharp uses native bindings) — not the Edge runtime.
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { McqLayoutMapPayload, BubbleOption, BubbleOverlay, DetectedOption, LAYOUT_MAP_FRAME_V2 } from '@/types/checker';
import { recomputeSubmissionTotals, isAnswerCorrect } from '@/lib/checker/answers';
import { solveHomography, applyHomography, localScale, Point } from '@/lib/checker/geometry';
import { loadGrayscale, detectSquareBlobs, labelCorners, sampleDarkness, renderDebugComposite, GrayImage } from '@/lib/checker/imaging';
import { downloadScan, getSignedScanUrl, DEFAULT_SCAN_BUCKET } from '@/lib/checker/scanStorage';

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;
const OPTIONS: BubbleOption[] = ['A', 'B', 'C', 'D'];

// The v2 frame's declared (source) points are ALWAYS this fixed unit
// square, by construction — see LAYOUT_MAP_FRAME_V2's doc comment. This is
// what makes the homography fit well-conditioned regardless of the box's
// actual physical size/position on the page: the source side never
// involves whole-page scale at all.
const UNIT_SQUARE: Record<typeof CORNERS[number], Point> = {
  tl: { x: 0, y: 0 },
  tr: { x: 1, y: 0 },
  bl: { x: 0, y: 1 },
  br: { x: 1, y: 1 },
};

// Darkness-decision thresholds — first-pass constants, tune against real scans.
const DARKNESS_FLOOR = 0.22;   // below this, a bubble is considered unmarked
const AMBIGUOUS_RATIO = 0.75;  // second/top above this (both above floor) => MULTIPLE
const LOW_CONFIDENCE = 0.4;    // fill_confidence below this => flag for review anyway

async function markFailed(submissionId: string, message: string) {
  await supabaseAdmin
    .from('submissions')
    .update({ status: 'failed', processing_error: message })
    .eq('id', submissionId);
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
 *  a color-coded outlined circle, plus the 4 detected registration
 *  centroids as red crosses. Coordinates are already in the working
 *  image's own pixel space (same space renderDebugComposite() resizes its
 *  color copy to), so nothing needs re-scaling here. */
function buildDebugSvg(
  width: number,
  height: number,
  answerRows: { detected_option: DetectedOption; override_option: string | null; correct_option: string | null; bubble_overlay: BubbleOverlay }[],
  detectedCorners: Record<typeof CORNERS[number], { cx: number; cy: number }>,
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

      let color = '#999999'; // neutral — not the effective pick, not part of a MULTIPLE flag
      if (isMultiple) {
        if (darkestTwo.includes(opt)) color = '#f5a623';
      } else if (opt === effective) {
        color = effective === row.correct_option ? '#2ecc71' : '#e74c3c';
      }

      parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${color}" stroke-width="2.5" />`);
    }
  }

  for (const corner of CORNERS) {
    const { cx, cy } = detectedCorners[corner];
    const s = 9;
    parts.push(`<line x1="${(cx - s).toFixed(1)}" y1="${(cy - s).toFixed(1)}" x2="${(cx + s).toFixed(1)}" y2="${(cy + s).toFixed(1)}" stroke="red" stroke-width="2.5" />`);
    parts.push(`<line x1="${(cx - s).toFixed(1)}" y1="${(cy + s).toFixed(1)}" x2="${(cx + s).toFixed(1)}" y2="${(cy - s).toFixed(1)}" stroke="red" stroke-width="2.5" />`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join('')}</svg>`;
}

export async function POST(req: NextRequest) {
  // TEMPORARY DIAGNOSTIC — timing breakdown per phase, to find where the
  // ~6-8s wall time actually goes (network round-trips to Supabase/Storage
  // vs. the CV work itself) before optimizing blindly. Remove once "make it
  // fast" is resolved.
  const timings: Record<string, number> = {};
  let tPrev = Date.now();
  const mark = (label: string) => { const now = Date.now(); timings[label] = now - tPrev; tPrev = now; };

  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;
    mark('auth');

    const debugMode = new URL(req.url).searchParams.get('debug') === '1';

    const body = await req.json();
    const submissionId: string | undefined = body?.submission_id;
    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submission_id' }, { status: 400 });
    }

    const { data: submission, error: subErr } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .maybeSingle();
    if (subErr || !submission) {
      return NextResponse.json({ error: subErr?.message || 'Submission not found' }, { status: 404 });
    }
    mark('submissionFetch');

    const { data: paper, error: paperErr } = await supabaseAdmin
      .from('papers')
      .select('id, content, created_by')
      .eq('id', submission.paper_id)
      .maybeSingle();
    if (paperErr || !paper) {
      return NextResponse.json({ error: paperErr?.message || 'Paper not found' }, { status: 404 });
    }
    mark('paperFetch');

    // Authorization: the person who uploaded the scan, the paper's owner, or an admin.
    if (submission.uploaded_by !== user.id && paper.created_by !== user.id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (submission.status === 'finalized') {
      return NextResponse.json({ error: 'Submission is already finalized' }, { status: 409 });
    }

    if (!Array.isArray(submission.scan_urls) || submission.scan_urls.length === 0) {
      return NextResponse.json({ error: 'Submission has no scan images' }, { status: 400 });
    }

    const { data: layoutMapRow, error: layoutErr } = await supabaseAdmin
      .from('paper_layout_maps')
      .select('*')
      .eq('paper_id', submission.paper_id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (layoutErr || !layoutMapRow) {
      const message = 'No MCQ layout map has been generated for this paper yet';
      await markFailed(submissionId, message);
      return NextResponse.json({ error: message }, { status: 400 });
    }
    mark('layoutMapFetch');

    const layoutMap = layoutMapRow as McqLayoutMapPayload;
    if (layoutMap.frame !== LAYOUT_MAP_FRAME_V2) {
      const message = 'Layout map outdated — regenerate this paper to enable checking.';
      await markFailed(submissionId, message);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const mcqBubbles = layoutMap.mcq_bubbles || [];
    if (mcqBubbles.length === 0) {
      const message = 'Stored layout map is incomplete (no MCQ bubbles)';
      await markFailed(submissionId, message);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const questionIds = mcqBubbles.map(b => b.question_id);
    // Questions lookup, the "processing" status bump, and downloading every
    // scan page are all independent of each other (none reads a value the
    // others produce) — running them concurrently instead of one-at-a-time
    // cuts several sequential Supabase/Storage round-trips down to the
    // slowest single one.
    const [questionsResult, , scanDownloads] = await Promise.all([
      supabaseAdmin.from('questions').select('id, correct_option').in('id', questionIds),
      supabaseAdmin.from('submissions').update({ status: 'processing', processing_error: null }).eq('id', submissionId),
      Promise.all(submission.scan_urls.map(async (scanUrl: string) => {
        try {
          return { scanUrl, buffer: await downloadScan(scanUrl) };
        } catch (e: any) {
          return { scanUrl, buffer: null as Buffer | null, error: e.message || String(e) };
        }
      })),
    ]);
    const { data: questionRows, error: qErr } = questionsResult;
    if (qErr) {
      await markFailed(submissionId, qErr.message);
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }
    const correctOptionMap: Record<string, string | null> = {};
    for (const q of questionRows || []) correctOptionMap[q.id] = q.correct_option;

    const marksMap = buildMarksMap(paper.content);
    mark('questionsStatusAndScanDownload');

    const srcPoints: Point[] = CORNERS.map(c => UNIT_SQUARE[c]);

    let gray: GrayImage | null = null;
    let homography: number[] | null = null;
    let gradedScanIndex = -1;
    let winningBuffer: Buffer | null = null;
    let winningCorners: Record<typeof CORNERS[number], { cx: number; cy: number }> | null = null;
    const attemptErrors: string[] = [];

    for (let i = 0; i < scanDownloads.length; i++) {
      const { scanUrl, buffer, error: downloadError } = scanDownloads[i];
      if (!buffer) {
        attemptErrors.push(`${scanUrl}: ${downloadError}`);
        continue;
      }
      try {
        const candidateGray = await loadGrayscale(buffer);
        const squares = detectSquareBlobs(candidateGray);
        const labeled = labelCorners(squares);
        if (!labeled) {
          // TEMPORARY DIAGNOSTIC — remove once root-caused. Prints every
          // shape-filtered candidate's actual position/size so we can see
          // WHY the quadrant-relative-to-mean split failed (a false-
          // positive candidate skewing the mean, two genuine corners
          // sitting suspiciously close together, etc.) instead of just
          // knowing that it did.
          // eslint-disable-next-line no-console
          console.log(`[GRADE-DEBUG] scan#${i} labelCorners FAILED — workingImage=${candidateGray.width}x${candidateGray.height}, ${squares.length} candidate(s):`);
          squares.forEach((s, idx) => {
            // eslint-disable-next-line no-console
            console.log(`[GRADE-DEBUG]   candidate#${idx} cx=${s.cx.toFixed(1)} cy=${s.cy.toFixed(1)} size=${s.size.toFixed(1)}`);
          });
          attemptErrors.push(`${scanUrl}: found ${squares.length} registration-square candidates, need 4 unambiguous quadrants`);
          continue;
        }
        const dstPoints: Point[] = CORNERS.map(corner => ({ x: labeled[corner].cx, y: labeled[corner].cy }));
        homography = solveHomography(srcPoints, dstPoints);
        gray = candidateGray;
        gradedScanIndex = i;
        winningBuffer = buffer;
        winningCorners = { tl: labeled.tl, tr: labeled.tr, bl: labeled.bl, br: labeled.br };
        break;
      } catch (e: any) {
        attemptErrors.push(`${scanUrl}: ${e.message || e}`);
      }
    }
    mark('detection');

    if (!gray || !homography || !winningCorners) {
      const message = `Could not detect registration marks on any scanned page: ${attemptErrors.join('; ')}`;
      await markFailed(submissionId, message);
      // eslint-disable-next-line no-console
      console.log('[GRADE-DEBUG] timings (failed before scoring)', JSON.stringify(timings));
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const answerRows = mcqBubbles.map(bubble => {
      const scores = OPTIONS.map(opt => {
        const rect = bubble.options[opt];
        const centerPt: Point = { x: rect.xFrac, y: rect.yFrac };
        const centerPx = applyHomography(homography!, centerPt);
        const radiusPx = localScale(homography!, centerPt) * rect.rFrac;
        const darkness = sampleDarkness(gray!, centerPx.x, centerPx.y, radiusPx);
        return { opt, darkness, centerPx, radiusPx };
      }).sort((a, b) => b.darkness - a.darkness);

      const [top, second] = scores;
      let detectedOption: DetectedOption;
      let fillConfidence: number;

      if (top.darkness < DARKNESS_FLOOR) {
        detectedOption = 'BLANK';
        fillConfidence = 0;
      } else if (second.darkness >= DARKNESS_FLOOR && second.darkness / top.darkness > AMBIGUOUS_RATIO) {
        detectedOption = 'MULTIPLE';
        fillConfidence = 1 - second.darkness / top.darkness;
      } else {
        detectedOption = top.opt;
        fillConfidence = 1 - second.darkness / top.darkness;
      }

      const needsReview = detectedOption === 'MULTIPLE' || detectedOption === 'BLANK' || fillConfidence < LOW_CONFIDENCE;
      const correctOption = correctOptionMap[bubble.question_id] ?? null;
      const maxMarks = marksMap[bubble.question_id] ?? 1;
      const isCorrect = isAnswerCorrect({ override_option: null, detected_option: detectedOption, correct_option: correctOption });

      const bubbleOverlay: BubbleOverlay = OPTIONS.reduce((acc, opt) => {
        const s = scores.find(x => x.opt === opt)!;
        acc[opt] = {
          xFrac: s.centerPx.x / gray!.width,
          yFrac: s.centerPx.y / gray!.height,
          rFrac: s.radiusPx / gray!.width,
          darkness: s.darkness,
        };
        return acc;
      }, {} as BubbleOverlay);

      return {
        submission_id: submissionId,
        question_id: bubble.question_id,
        q_number: String(bubble.question_number),
        answer_kind: 'mcq' as const,
        detected_option: detectedOption,
        correct_option: correctOption,
        override_option: null,
        fill_confidence: fillConfidence,
        bubble_overlay: bubbleOverlay,
        max_marks: maxMarks,
        needs_review: needsReview,
        final_marks: isCorrect ? maxMarks : 0,
      };
    });
    mark('scoring');

    await supabaseAdmin.from('submission_answers').delete().eq('submission_id', submissionId).eq('answer_kind', 'mcq');
    const { error: insertErr } = await supabaseAdmin.from('submission_answers').insert(answerRows);
    if (insertErr) {
      await markFailed(submissionId, insertErr.message);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    mark('answersWrite');

    const { mcqScore, maxScore, anyNeedsReview } = recomputeSubmissionTotals(answerRows);

    const { data: updatedSubmission, error: updateErr } = await supabaseAdmin
      .from('submissions')
      .update({
        mcq_score: mcqScore,
        total_score: mcqScore + (submission.subjective_score ?? 0),
        max_score: maxScore,
        status: anyNeedsReview ? 'in_review' : 'graded',
        processing_error: null,
        graded_scan_index: gradedScanIndex,
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    mark('submissionUpdate');

    let debugImageUrl: string | null = null;
    if (debugMode && winningBuffer) {
      try {
        const svg = buildDebugSvg(gray.width, gray.height, answerRows, winningCorners);
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
    mark('debugComposite');
    // eslint-disable-next-line no-console
    console.log('[GRADE-DEBUG] timings', JSON.stringify(timings));

    return NextResponse.json({
      submission: updatedSubmission,
      answers: answerRows,
      mcq_score: mcqScore,
      max_mcq_score: maxScore,
      needs_review: anyNeedsReview,
      ...(debugMode ? { debugImageUrl } : {}),
    });
  } catch (error: any) {
    console.error('Error grading MCQ submission:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
