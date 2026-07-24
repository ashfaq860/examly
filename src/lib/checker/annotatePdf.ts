// Builds a marked-up copy of a submission's scanned pages for the
// teacher/parent, styled to read like a real Pakistani board examiner's
// red-pen marking: a red curved tick (or a red cross for zero marks) near
// every subjective answer, a single bold obtained-marks number plus
// official board comment codes beneath it, a circled obtained-marks
// stacked fraction near the top of the MCQ page, and a matching circled
// stacked-fraction subtotal near each subjective section's own heading.
// Built as a FRESH pdf-lib document assembled from the already-normalized
// scan_urls JPEGs, rather than re-opening "the original PDF" — a
// submission may have started as camera/gallery photos with no source PDF
// at all, and scan_urls is the one shape every submission already
// converges on (same reasoning pdfRasterize.ts documents for itself).
// Embedding each image at its own pixel size also means this never assumes
// a fixed page size.
//
// MCQ per-bubble marks are ROW-ANCHORED: always at a fixed offset from that
// question's own option-D template position, transformed through the SAME
// alignment (src/lib/checker/omr/align.ts's fitAlignment, re-derived from
// the submission's persisted graded_fiducials — never re-detected) grading
// used to read the bubbles. Same board-red as every other mark on the page
// (a correct pick is a small check, a wrong one a small cross+marks — colour
// no longer distinguishes them, shape does, matching the rest of the
// monochrome red-pen scheme).
//
// Subjective marks (tick/cross shape, colour, sizing) all come from
// lib/checker/annotate/symbols.ts — the SAME module the review UI's live
// overlay (ScanViewer.tsx) draws from, so what a teacher sees on screen and
// what's in the downloaded PDF are pixel-for-pixel the same shape/colour.
// Each symbol CENTERS on resolveAnswerBox's resolved box: the model's TIGHT
// ink-only box when it reported a usable one, otherwise the coarser
// answer_top/bottom/left/right_pct band (which, for a blank answer, is
// already exactly "the blank ruled-line area belonging to this question").
// The awarded-marks text and comment codes sit on ONE side for the WHOLE
// paper (subjectiveMarksSide, decided once by gradeSubjective.ts's
// decideSubjectiveMarksSide and persisted on the submission) — never
// per-row anymore, so a mixed-language paper can't print some marks left
// and some right.
//
// English text only — pdf-lib's standard fonts can't shape Urdu Nastaliq
// (or ANY glyph outside WinAnsi — that includes ✓/✗ Unicode characters,
// which is why the legend below draws small vector symbols inline instead
// of embedding them as text), so every comment/label here is plain
// WinAnsi-safe English, and ticks/crosses/circles/fractions are always
// vector paths, never a font glyph (except the fraction's own numerator/
// denominator digits, drawn with the embedded font like every other label).
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { downloadScan, DEFAULT_SCAN_BUCKET } from '@/lib/checker/scanStorage';
import { fitAlignment, Corner, Alignment } from '@/lib/checker/omr/align';
import { BubbleLayoutV3, TemplatePoint } from '@/types/checker';
import { computeSectionSubtotalAnchors, decideSubjectiveMarksSide, MarksSide } from '@/lib/checker/gradeSubjective';
import {
  drawTick as drawSubjectiveTick,
  drawCross as drawSubjectiveCross,
  drawCircle,
  drawFraction,
  symbolFor,
  symbolSize,
  clampSymbolToNeighbor,
  resolveAnswerBox,
  AnswerBox,
  REASON_CODES,
  FALLBACK_X_PCT,
  BOARD_RED_RGB,
  MCQ_SCORE_CIRCLE_PCT_OF_HEIGHT,
  SECTION_SUBTOTAL_CIRCLE_PCT_OF_HEIGHT,
  MARGIN_INSET_PCT,
} from '@/lib/checker/annotate/symbols';

/** The ONE place the image-space (origin top-left) <-> pdf-lib (origin
 *  bottom-left) flip happens — every position fed to pdf-lib's drawX
 *  calls goes through this, never an inline `pageHeight - y`. */
function toPdfY(topRelativeY: number, pageHeight: number): number {
  return pageHeight - topRelativeY;
}

// ── MCQ marks — small, binary, vector-drawn; board-red like everything else. ──
function drawCheck(page: PDFPage, x: number, y: number, size: number, color = BOARD_RED_RGB) {
  page.drawLine({ start: { x, y: y + size * 0.42 }, end: { x: x + size * 0.36, y }, thickness: size * 0.15, color });
  page.drawLine({ start: { x: x + size * 0.36, y }, end: { x: x + size, y: y + size * 0.82 }, thickness: size * 0.15, color });
}

function drawCross(page: PDFPage, x: number, y: number, size: number, color = BOARD_RED_RGB) {
  const t = size * 0.15;
  page.drawLine({ start: { x, y }, end: { x: x + size, y: y + size }, thickness: t, color });
  page.drawLine({ start: { x, y: y + size }, end: { x: x + size, y } , thickness: t, color });
}

function drawSmallDeduction(page: PDFPage, font: PDFFont, x: number, y: number, marksLabel: string, comment: string | null) {
  drawCross(page, x, y, 14);
  page.drawText(marksLabel, { x: x + 20, y: y + 2, size: 10, font, color: BOARD_RED_RGB });
  if (comment) {
    const clipped = comment.length > 70 ? `${comment.slice(0, 67)}...` : comment;
    page.drawText(clipped, { x: x + 20, y: y - 11, size: 8.5, font, color: BOARD_RED_RGB });
  }
}

export interface AnnotateAnswerRow {
  answer_kind: 'mcq' | 'subjective';
  question_id: string;
  detected_option: string | null;
  override_option: string | null;
  correct_option: string | null;
  bubble_overlay: Record<'A' | 'B' | 'C' | 'D', { xFrac: number; yFrac: number; rFrac: number }> | null;
  final_marks: number | null;
  max_marks: number;
  page_index: number | null;
  answer_top_pct: number | null;
  answer_bottom_pct: number | null;
  answer_left_pct: number | null;
  answer_right_pct: number | null;
  /** Tight ink-only box (see symbols.ts's resolveAnswerBox) — null whenever
   *  there's no usable one (blank, model repeated the band, or failed the
   *  plausibility check gradeSubjective.ts's buildAnswerRow already ran).
   *  Always all-four-or-none. */
  answer_ink_top_pct: number | null;
  answer_ink_bottom_pct: number | null;
  answer_ink_left_pct: number | null;
  answer_ink_right_pct: number | null;
  transcription_lang: 'en' | 'ur' | 'mixed' | null;
  ai_justification: string | null;
  teacher_note: string | null;
  deduction_reason: string | null;
  reason_codes: string[] | null;
}

function mcqReason(row: AnnotateAnswerRow): string {
  const effective = row.override_option ?? row.detected_option;
  if (effective === 'BLANK') return 'Not attempted';
  if (effective === 'MULTIPLE') return 'Multiple bubbles marked';
  return 'Wrong answer';
}

/** The ONE place the MCQ obtained-marks circle's anchor position is
 *  computed — a fraction (top-left origin, same space bubble_overlay's own
 *  xFrac/yFrac already use) of the GRADED working image, independent of
 *  whatever resolution image it's ultimately drawn on. buildAnnotatedPdf
 *  converts this fraction into PDF points on its own embedded page size;
 *  the submissions API route (src/app/api/checker/submissions/route.ts)
 *  returns it as-is for the review overlay's own small badge to position
 *  with plain CSS percentages — same anchor, computed once, never two
 *  drifting implementations. Returns null (never a guess) if any of the
 *  alignment inputs are missing. */
export function computeMcqScoreAnchorFraction(
  gradedFiducials: Record<Corner, { cx: number; cy: number }> | null,
  layout: BubbleLayoutV3 | null,
  gradedImageWidth: number | null,
  gradedImageHeight: number | null,
): { xFrac: number; yFrac: number } | null {
  if (!gradedFiducials || !layout || !gradedImageWidth || !gradedImageHeight) return null;
  const alignment = fitAlignment(gradedFiducials, layout);
  if (!alignment) return null;
  const topRight = layout.fiducials[1];
  const px = alignment.transformPoint({ x: topRight.x - MCQ_SCORE_OFFSET_X_PT, y: topRight.y + MCQ_SCORE_OFFSET_Y_PT });
  return { xFrac: px.x / gradedImageWidth, yFrac: px.y / gradedImageHeight };
}

// How far right of a question's own option-D template position an MCQ
// mark is drawn — a fixed row-anchor, never dependent on which option was
// actually selected, so it's always in the same predictable spot per row.
const MCQ_ROW_MARGIN_PT = 14;
const MCQ_MARK_SIZE = 16;
// Marks-text: the gap kept between the answer's own left/right edge and the
// marks digit itself (%-of-page-width) — the page-edge safety inset itself
// is symbols.ts's shared MARGIN_INSET_PCT.
const SUBJECTIVE_MARKS_GAP_PCT = 1.5;
const SUBJECTIVE_MARKS_FONT_SIZE = 20; // bold, single obtained number — larger than an old "1/2" fraction
const SUBJECTIVE_CODES_FONT_SIZE = 10;
const LEGEND_SYMBOL_SIZE = 9;

// MCQ obtained-marks circle: the only template-known coordinates are the 4
// fiducials (which sit at the bubble-grid box's own corners), so this
// anchors a fixed pt-offset inside the box from the TOP-RIGHT fiducial —
// past where the centered "MCQ ANSWER SHEET" title text ends, into the
// box's own blank header-row corner. Best-effort by nature (no OCR'd header
// layout to measure against); a single named offset to nudge if it ever
// overlaps real content on a given template.
export const MCQ_SCORE_OFFSET_X_PT = 40; // left of the top-right fiducial
export const MCQ_SCORE_OFFSET_Y_PT = 20; // down into the box from the fiducial
// Circle diameter %-of-page-height lives in symbols.ts
// (MCQ_SCORE_CIRCLE_PCT_OF_HEIGHT) — the review overlay's own small badge
// needs the EXACT same number so the two can never drift apart in size,
// not just position. The label inside is drawn with symbols.ts's
// drawFraction, which derives its own font size from the circle size.

// Section subtotal circle: anchor row + offset come from
// gradeSubjective.ts's computeSectionSubtotalAnchors (the REGION's own top,
// not the ink box, so the anchor doesn't jitter with a particular
// student's handwriting extent) — same paper-wide marks side as the
// per-question marks. Circle size is symbols.ts's shared
// SECTION_SUBTOTAL_CIRCLE_PCT_OF_HEIGHT.

/** Downloads a submission's scan pages, draws grading marks on a fresh
 *  pdf-lib document built from them, and returns the serialized PDF bytes.
 *  Never throws for a single unplaceable row (missing position data) —
 *  it's simply skipped, since a missing mark beats failing the whole
 *  annotated copy. */
export async function buildAnnotatedPdf(params: {
  scanUrls: string[];
  gradedScanIndex: number | null;
  /** The 4 fiducial pixel points grading detected (submissions.graded_fiducials)
   *  — re-fit into the SAME alignment grading used, not re-detected. */
  gradedFiducials: Record<Corner, { cx: number; cy: number }> | null;
  /** The CV working-image dimensions graded_fiducials/bubble_overlay are
   *  relative to (submissions.graded_image_width/height) — needed to turn
   *  the re-fitted alignment's pixel output into a resolution-independent
   *  fraction before applying it to the full-res embedded image. */
  gradedImageWidth: number | null;
  gradedImageHeight: number | null;
  /** The paper's template bubble layout (paper_layout_maps row) — supplies
   *  each MCQ question's option-D template position for row-anchoring, and
   *  the top-right fiducial for the score circle. MCQ rows fall back to
   *  their stored bubble_overlay position (old behavior) when this — or
   *  gradedFiducials/dimensions — isn't available. */
  layout: BubbleLayoutV3 | null;
  /** The paper's own PaperSection[] content — needed only for the
   *  section-subtotal grouping (computeSectionSubtotals). Subtotals are
   *  simply skipped (never a hard failure) when this isn't available. */
  paperContent: any;
  /** ONE marks-side for the whole paper (see gradeSubjective.ts's
   *  decideSubjectiveMarksSide) — the caller resolves this once (preferring
   *  the persisted submissions.subjective_marks_side, falling back to
   *  recomputing for rows predating that column) rather than this function
   *  deciding it per-row. */
  subjectiveMarksSide: MarksSide;
  answers: AnnotateAnswerRow[];
}): Promise<Uint8Array> {
  const { scanUrls, gradedScanIndex, gradedFiducials, gradedImageWidth, gradedImageHeight, layout, paperContent, subjectiveMarksSide, answers } = params;
  const onLeftMargin = subjectiveMarksSide === 'left';

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageBuffers = await Promise.all(scanUrls.map(url => downloadScan(url).catch(() => null)));

  const pages: (PDFPage | null)[] = [];
  const pageSizes: ({ width: number; height: number } | null)[] = [];
  for (const buf of pageBuffers) {
    if (!buf) { pages.push(null); pageSizes.push(null); continue; }
    let img;
    try {
      img = await pdfDoc.embedJpg(buf);
    } catch {
      try {
        img = await pdfDoc.embedPng(buf);
      } catch {
        pages.push(null);
        pageSizes.push(null);
        continue;
      }
    }
    const page = pdfDoc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    pages.push(page);
    pageSizes.push({ width: img.width, height: img.height });
  }

  const mcqPageIndex = gradedScanIndex != null && gradedScanIndex >= 0 ? gradedScanIndex : null;

  let mcqAlignment: Alignment | null = null;
  if (gradedFiducials && layout) {
    mcqAlignment = fitAlignment(gradedFiducials, layout);
  }

  /** Transforms a template-space point through the MCQ alignment into a
   *  resolution-independent fraction of the embedded page, then to pdf-lib
   *  points on `size` — the same three-step conversion every MCQ-page mark
   *  in this file needs (per-bubble marks, and the score circle). */
  function templatePointToPdf(pt: TemplatePoint, size: { width: number; height: number }): { x: number; y: number } | null {
    if (!mcqAlignment || !gradedImageWidth || !gradedImageHeight) return null;
    const px = mcqAlignment.transformPoint(pt);
    return {
      x: (px.x / gradedImageWidth) * size.width,
      y: toPdfY((px.y / gradedImageHeight) * size.height, size.height),
    };
  }

  function mcqRowAnchorPt(questionId: string): TemplatePoint | null {
    if (!layout) return null;
    const optionD = layout.mcq_bubbles.find(b => b.question_id === questionId && b.option === 'D');
    return optionD ? { x: optionD.x + MCQ_ROW_MARGIN_PT, y: optionD.y } : null;
  }

  // ── MCQ marks — unchanged pass, independent of subjective row order. ──
  for (const row of answers) {
    if (row.answer_kind !== 'mcq' || row.teacher_note === 'EXCESS_ATTEMPT') continue;
    if (mcqPageIndex == null) continue;
    const page = pages[mcqPageIndex];
    const size = pageSizes[mcqPageIndex];
    if (!page || !size) continue;

    let x: number | null = null;
    let y: number | null = null;

    const anchor = mcqRowAnchorPt(row.question_id);
    const anchored = anchor ? templatePointToPdf(anchor, size) : null;
    if (anchored) {
      x = anchored.x;
      y = anchored.y;
    } else if (row.bubble_overlay) {
      // Fallback for rows graded before this alignment data existed —
      // anchor at option D's own last-known overlay position instead.
      const rect = row.bubble_overlay.D;
      if (rect) {
        x = rect.xFrac * size.width;
        y = toPdfY(rect.yFrac * size.height, size.height);
      }
    }
    if (x == null || y == null) continue;

    const effective = row.override_option ?? row.detected_option;
    const isCorrect = effective != null && effective === row.correct_option;

    if (isCorrect) drawCheck(page, x - 6, y - 6, MCQ_MARK_SIZE);
    else drawSmallDeduction(page, font, x, y - 6, String(row.final_marks ?? 0), mcqReason(row));
  }

  // ── Subjective marks — resolved and SORTED first (by page, then region
  // top) so each symbol's clamp can see where the NEXT question on the
  // same page actually starts, before any drawing happens. Sort/neighbor
  // order is always based on the REGION band (answer_top_pct), never the
  // tighter ink box — print order follows the printed layout, not where a
  // particular student's ink happened to land. ──
  interface ResolvedSubjectiveRow { row: AnnotateAnswerRow; topPct: number; bottomPct: number }
  const resolvedSubjective: ResolvedSubjectiveRow[] = [];
  for (const row of answers) {
    if (row.answer_kind !== 'subjective' || row.teacher_note === 'EXCESS_ATTEMPT') continue;
    if (row.page_index == null) continue;
    // Vertical band: both edges when known; a small fixed margin below
    // whichever single edge is available otherwise; if neither is known
    // there's genuinely no location to draw at — skip rather than guess.
    let topPct: number, bottomPct: number;
    if (row.answer_top_pct != null && row.answer_bottom_pct != null) {
      topPct = row.answer_top_pct;
      bottomPct = row.answer_bottom_pct;
    } else if (row.answer_top_pct != null) {
      topPct = row.answer_top_pct;
      bottomPct = row.answer_top_pct + 4;
    } else {
      continue;
    }
    resolvedSubjective.push({ row, topPct, bottomPct });
  }
  resolvedSubjective.sort((a, b) => (a.row.page_index! - b.row.page_index!) || (a.topPct - b.topPct));

  for (let i = 0; i < resolvedSubjective.length; i++) {
    const { row, topPct, bottomPct } = resolvedSubjective[i];
    const page = pages[row.page_index!];
    const size = pageSizes[row.page_index!];
    if (!page || !size) continue;

    // Symbol SIZE comes from the region band's own height, unchanged — how
    // much space this question was allocated is a stable signal; a
    // particular student's ink extent shouldn't make the symbol itself
    // bigger or smaller.
    const bandHeightPct = Math.abs(bottomPct - topPct);

    // Symbol POSITION prefers the tight ink box (resolveAnswerBox falls
    // back to the region band when there's no usable ink box — including
    // every unattempted row, which never has one) — this is the actual fix
    // for a tick/cross drifting off the real writing.
    const region: AnswerBox = {
      topPct, bottomPct,
      leftPct: row.answer_left_pct ?? FALLBACK_X_PCT,
      rightPct: row.answer_right_pct ?? FALLBACK_X_PCT,
    };
    const ink: AnswerBox | null = row.answer_ink_top_pct != null && row.answer_ink_bottom_pct != null
      && row.answer_ink_left_pct != null && row.answer_ink_right_pct != null
      ? { topPct: row.answer_ink_top_pct, bottomPct: row.answer_ink_bottom_pct, leftPct: row.answer_ink_left_pct, rightPct: row.answer_ink_right_pct }
      : null;
    const resolved = resolveAnswerBox(region, ink);
    const rawCyPct = (resolved.topPct + resolved.bottomPct) / 2;
    const cxPt = ((resolved.leftPct + resolved.rightPct) / 2 / 100) * size.width;

    // Next question's own REGION top, on the SAME page, if any — the
    // missing piece that lets a large ("3 written lines") tick correctly
    // centered on a short answer still never reach into whatever comes
    // next. Floored at THIS question's own region top (never the ink box),
    // so the clamp can't push the anchor above where this question's own
    // writing area starts.
    const next = resolvedSubjective[i + 1];
    const nextTopPct = next && next.row.page_index === row.page_index ? next.topPct : null;

    const awarded = row.final_marks ?? 0;
    const kind = symbolFor(awarded, row.max_marks);
    const desiredSizePct = symbolSize(kind, bandHeightPct);
    const { cyPct, sizePct: clampedSizePct } = clampSymbolToNeighbor(desiredSizePct, topPct, rawCyPct, nextTopPct);
    const cyPdf = toPdfY((cyPct / 100) * size.height, size.height);
    const symbolPx = (clampedSizePct / 100) * size.height;
    if (kind === 'cross') drawSubjectiveCross(page, { cx: cxPt, cy: cyPdf, size: symbolPx });
    else drawSubjectiveTick(page, { cx: cxPt, cy: cyPdf, size: symbolPx });

    // Marks text — a single bold obtained number, always board-red (the
    // whole subjective scheme is monochrome red-pen, matching how board
    // examiners actually mark — even a full-marks tick is red, not green).
    // Anchored at the paper-wide margin side (subjectiveMarksSide, decided
    // ONCE for every row on this paper — never per-row anymore), just
    // outside the answer's own REGION edge (a stable reference column,
    // unlike the ink box's own extent which varies line to line), and
    // vertically centered on the SAME (already ink-preferring, clamped)
    // symbol center — not floating at the page's outer margin or the top
    // of the band.
    const marksLabel = String(awarded);
    const marksY = cyPdf - SUBJECTIVE_MARKS_FONT_SIZE * 0.35;
    const marksWidth = fontBold.widthOfTextAtSize(marksLabel, SUBJECTIVE_MARKS_FONT_SIZE);
    let marksX: number;
    if (onLeftMargin) {
      const edgePct = row.answer_left_pct ?? FALLBACK_X_PCT;
      const targetXPt = ((edgePct - SUBJECTIVE_MARKS_GAP_PCT) / 100) * size.width - marksWidth;
      marksX = Math.max(size.width * (MARGIN_INSET_PCT / 100), targetXPt);
    } else {
      const edgePct = row.answer_right_pct ?? (100 - FALLBACK_X_PCT);
      const targetXPt = ((edgePct + SUBJECTIVE_MARKS_GAP_PCT) / 100) * size.width;
      marksX = Math.min(size.width * (1 - MARGIN_INSET_PCT / 100) - marksWidth, targetXPt);
    }
    page.drawText(marksLabel, { x: marksX, y: marksY, size: SUBJECTIVE_MARKS_FONT_SIZE, font: fontBold, color: BOARD_RED_RGB });

    // Codes — one or more official board comment codes, bold red, directly
    // beneath the marks number.
    const codes = (row.reason_codes || []).filter(c => REASON_CODES[c]);
    if (codes.length > 0) {
      page.drawText(codes.join(', '), { x: marksX, y: marksY - SUBJECTIVE_MARKS_FONT_SIZE, size: SUBJECTIVE_CODES_FONT_SIZE, font: fontBold, color: BOARD_RED_RGB });
    }
  }

  // Circled MCQ obtained-marks total, anchored inside the box from its
  // top-right fiducial, drawn as a real stacked fraction (not inline
  // "N/N" text). Skipped entirely (never a guess) if there's no MCQ
  // section, or no alignment data to anchor against. Uses the SAME
  // computeMcqScoreAnchorFraction the submissions API route calls for the
  // review overlay's own badge — one implementation, not two.
  const mcqRows = answers.filter(a => a.answer_kind === 'mcq' && a.teacher_note !== 'EXCESS_ATTEMPT');
  if (mcqPageIndex != null && layout && mcqRows.length > 0) {
    const page = pages[mcqPageIndex];
    const size = pageSizes[mcqPageIndex];
    const anchorFrac = computeMcqScoreAnchorFraction(gradedFiducials, layout, gradedImageWidth, gradedImageHeight);
    if (page && size && anchorFrac) {
      const anchoredX = anchorFrac.xFrac * size.width;
      const anchoredY = toPdfY(anchorFrac.yFrac * size.height, size.height);
      const mcqAwarded = mcqRows.reduce((sum, r) => sum + (r.final_marks ?? 0), 0);
      const mcqMax = mcqRows.reduce((sum, r) => sum + r.max_marks, 0);
      const circleSize = (MCQ_SCORE_CIRCLE_PCT_OF_HEIGHT / 100) * size.height;
      drawCircle(page, { cx: anchoredX, cy: anchoredY, size: circleSize });
      drawFraction(page, { cx: anchoredX, cy: anchoredY, size: circleSize, numerator: String(mcqAwarded), denominator: String(mcqMax), font: fontBold });
    }
  }

  // Each subjective section's own circled subtotal, anchored just above
  // its first question's answer_top_pct (the printed heading always sits
  // directly above it), also a real stacked fraction. computeSectionSubtotalAnchors
  // (gradeSubjective.ts) picks the anchor row and offset — the SAME
  // function the submissions API route calls for the review overlay's own
  // matching badge, so the two positions can never drift apart.
  if (paperContent) {
    const anchors = computeSectionSubtotalAnchors(paperContent, answers);
    for (const anchor of anchors) {
      const page = pages[anchor.pageIndex];
      const size = pageSizes[anchor.pageIndex];
      if (!page || !size) continue;

      const yPdf = toPdfY((anchor.topPct / 100) * size.height, size.height);
      const circleSize = (SECTION_SUBTOTAL_CIRCLE_PCT_OF_HEIGHT / 100) * size.height;
      const cx = onLeftMargin
        ? size.width * (MARGIN_INSET_PCT / 100) + circleSize / 2
        : size.width * (1 - MARGIN_INSET_PCT / 100) - circleSize / 2;

      drawCircle(page, { cx, cy: yPdf, size: circleSize });
      drawFraction(page, { cx, cy: yPdf, size: circleSize, numerator: String(anchor.awarded), denominator: String(anchor.max), font: fontBold });
    }
  }

  // Small legend on the last page any subjective mark landed on — vector
  // symbols inline (never ✓/✗ as text glyphs; see this file's header
  // comment on why) followed by plain WinAnsi-safe English, listing only
  // the comment codes actually used ANYWHERE on this paper so it stays
  // compact rather than printing the entire 14-code table every time.
  const subjectiveAnswers = answers.filter(a => a.answer_kind === 'subjective' && a.page_index != null && a.teacher_note !== 'EXCESS_ATTEMPT');
  const lastSubjectivePageIndex = subjectiveAnswers.reduce((max, a) => Math.max(max, a.page_index!), -1);
  if (lastSubjectivePageIndex >= 0) {
    const page = pages[lastSubjectivePageIndex];
    const size = pageSizes[lastSubjectivePageIndex];
    if (page && size) {
      const usedCodes = Array.from(new Set(subjectiveAnswers.flatMap(a => a.reason_codes || []))).filter(c => REASON_CODES[c]);
      const legendY = 16;
      let cursorX = 16;
      const drawLegendItem = (kind: 'tick' | 'cross', label: string) => {
        const cy = legendY + LEGEND_SYMBOL_SIZE / 2;
        if (kind === 'tick') drawSubjectiveTick(page, { cx: cursorX + LEGEND_SYMBOL_SIZE / 2, cy, size: LEGEND_SYMBOL_SIZE, opacity: 1 });
        else drawSubjectiveCross(page, { cx: cursorX + LEGEND_SYMBOL_SIZE / 2, cy, size: LEGEND_SYMBOL_SIZE, opacity: 1 });
        cursorX += LEGEND_SYMBOL_SIZE + 4;
        page.drawText(label, { x: cursorX, y: legendY, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
        cursorX += font.widthOfTextAtSize(label, 8) + 14;
      };
      drawLegendItem('tick', 'correct');
      drawLegendItem('cross', 'no marks');
      for (const code of usedCodes) {
        const text = `${code} = ${REASON_CODES[code]}`;
        page.drawText(text, { x: cursorX, y: legendY, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
        cursorX += font.widthOfTextAtSize(text, 8) + 14;
      }
    }
  }

  return pdfDoc.save();
}

/** Fetches everything buildAnnotatedPdf needs for one submission, builds
 *  it, and uploads it next to the original scans. Called by the grade
 *  orchestrator and regenerateAnnotatedPdfForSubmission (below) as a
 *  best-effort tail step — a failure here is logged and swallowed, never
 *  fails grading/finalizing itself. */
export async function annotateAndStoreSubmission(
  submissionId: string,
  scanUrls: string[],
  gradedScanIndex: number | null,
  gradedFiducials: Record<Corner, { cx: number; cy: number }> | null,
  gradedImageWidth: number | null,
  gradedImageHeight: number | null,
  layout: BubbleLayoutV3 | null,
  paperContent: any,
  /** The persisted submissions.subjective_marks_side — null for a
   *  submission that hasn't gone through finalizeSubmissionTotals since
   *  this column was added, in which case it's recomputed here from the
   *  same rows this function already fetches (not a re-implementation, the
   *  same decideSubjectiveMarksSide gradeSubjective.ts's own persistence
   *  path calls). */
  subjectiveMarksSide: MarksSide | null,
): Promise<string | null> {
  if (!Array.isArray(scanUrls) || scanUrls.length === 0) return null;

  const { data: answers, error } = await supabaseAdmin
    .from('submission_answers')
    .select('answer_kind, question_id, detected_option, override_option, correct_option, bubble_overlay, final_marks, max_marks, page_index, answer_top_pct, answer_bottom_pct, answer_left_pct, answer_right_pct, answer_ink_top_pct, answer_ink_bottom_pct, answer_ink_left_pct, answer_ink_right_pct, transcription_lang, ai_justification, teacher_note, deduction_reason, reason_codes')
    .eq('submission_id', submissionId);
  if (error || !answers || answers.length === 0) return null;

  const resolvedMarksSide = subjectiveMarksSide ?? decideSubjectiveMarksSide(paperContent, answers);

  const bytes = await buildAnnotatedPdf({
    scanUrls,
    gradedScanIndex,
    gradedFiducials,
    gradedImageWidth,
    gradedImageHeight,
    layout,
    paperContent,
    subjectiveMarksSide: resolvedMarksSide,
    answers: answers as AnnotateAnswerRow[],
  });

  const path = `${submissionId}/annotated.pdf`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(DEFAULT_SCAN_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true });
  if (uploadErr) {
    console.error(`Failed to upload annotated PDF for submission ${submissionId}:`, uploadErr.message);
    return null;
  }
  return path;
}

/** Self-contained regenerate: fetches the submission's own scan/alignment
 *  data, its paper's latest layout map, AND the paper's content (for the
 *  section subtotals), then delegates to annotateAndStoreSubmission (which
 *  re-fetches submission_answers fresh, so it always reflects the CURRENT
 *  final_marks/overrides — a teacher override or "confirm all remaining"
 *  pass is picked up automatically, no need to pass rows in). Used by both
 *  gradeOrchestrator.ts (right after grading) and the finalize route
 *  (right after locking) — a single place fetches "everything this
 *  submission needs to be re-annotated" instead of each caller assembling
 *  it inline. Returns null (logs, never throws) on any failure —
 *  annotation is always best-effort, never a reason to fail the action
 *  that triggered it. */
export async function regenerateAnnotatedPdfForSubmission(submissionId: string): Promise<string | null> {
  try {
    const { data: submission, error: subErr } = await supabaseAdmin
      .from('submissions')
      .select('scan_urls, graded_scan_index, graded_fiducials, graded_image_width, graded_image_height, paper_id, subjective_marks_side')
      .eq('id', submissionId)
      .maybeSingle();
    if (subErr || !submission) return null;

    const scanUrls: string[] = Array.isArray(submission.scan_urls) ? submission.scan_urls : [];
    if (scanUrls.length === 0) return null;

    const [{ data: layoutMapRow }, { data: paper }] = await Promise.all([
      supabaseAdmin
        .from('paper_layout_maps')
        .select('*')
        .eq('paper_id', submission.paper_id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.from('papers').select('content').eq('id', submission.paper_id).maybeSingle(),
    ]);

    const path = await annotateAndStoreSubmission(
      submissionId,
      scanUrls,
      typeof submission.graded_scan_index === 'number' ? submission.graded_scan_index : null,
      submission.graded_fiducials ?? null,
      submission.graded_image_width ?? null,
      submission.graded_image_height ?? null,
      (layoutMapRow as BubbleLayoutV3) ?? null,
      paper?.content ?? null,
      (submission.subjective_marks_side as MarksSide | null) ?? null,
    );

    if (path) {
      await supabaseAdmin.from('submissions').update({ annotated_pdf_path: path }).eq('id', submissionId);
    }
    return path;
  } catch (e: any) {
    console.error(`Failed to regenerate annotated PDF for submission ${submissionId}:`, e.message || e);
    return null;
  }
}
