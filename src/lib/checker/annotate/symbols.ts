// Shared tick/cross/circle symbol geometry for the annotated PDF's marking —
// ONE module both the annotated-PDF builder (annotatePdf.ts, via pdf-lib)
// and the review UI's live overlay (ScanViewer.tsx, via a plain browser
// <svg>) draw from, so what a teacher sees on screen and what's in the
// downloaded PDF are the exact same shape, size, and color, not two
// implementations that happen to look similar.
//
// Path convention: every path builder below returns SVG path data in a
// perfectly ordinary top-left-origin, Y-DOWN, size x size box — the same
// convention a browser <svg> already uses natively. pdf-lib's own
// drawLine/drawCircle/etc. are Y-UP (bottom-left origin), but drawSvgPath's
// own local coordinate system was confirmed empirically (a throwaway spike
// PDF, rasterized and visually inspected) to be Y-DOWN relative to its
// anchor point — i.e. the SAME convention as this module's paths, not
// pdf-lib's usual one. That's WHY a single path string works unmodified on
// both sides: only the ANCHOR differs, handled once by drawTick/drawCross/
// drawCircle below (see their `y: cy + size / 2` — shifting the anchor up
// by half the box height, since local y=0 is the TOP of the box under this
// convention).
import { PDFPage, PDFFont, LineCapStyle, rgb } from 'pdf-lib';

// ── Colour — ONE constant, reused by every mark this module draws (tick,
// cross, and the circled MCQ/section-subtotal numbers annotatePdf.ts draws
// around this module's drawCircle): Pakistani board examiners mark
// exclusively in red pen, regardless of verdict — a full-marks tick is
// still red, not green. annotatePdf.ts's own marks-number text and codes
// line reuse this same hex/rgb pair rather than a second, separately-
// maintained red. ──
export const BOARD_RED_HEX = '#c8342a';
export const BOARD_RED_RGB = rgb(200 / 255, 52 / 255, 42 / 255);

// The tick alone uses a distinct, slightly brighter fill red — supplied
// together with its exact vector path (see tickSvgPath below), not derived
// from BOARD_RED. Nothing else in this module uses it: the cross, circles,
// and every text label stay on BOARD_RED.
export const TICK_FILL_HEX = '#d41717';
export const TICK_FILL_RGB = rgb(0.83, 0.09, 0.09);

export const DEFAULT_OPACITY = 0.85; // semi-transparent so the student's handwriting stays readable underneath
export const CROSS_STROKE_WIDTH_RATIO = 0.16; // cross stays a stroked path (see crossSvgPath) — this is its stroke width as a fraction of `size`
export const CIRCLE_STROKE_WIDTH_RATIO = 0.05; // a bold but not overwhelming ring around a 1-2 digit number

// ── Size decision — everything here is in "percent of page height," the
// SAME unit submission_answers' own answer_top_pct/answer_bottom_pct
// already use. That's deliberate: it's the one unit both callers can work
// in without a lossy conversion — annotatePdf.ts has a real page height in
// PDF points to convert to/from, and ScanViewer.tsx never has physical
// units at all (just a rendered image), only percentages of it. ──
const FALLBACK_LINE_HEIGHT_PCT = 2; // ~a ruled line's height as a fraction of a typical exam page
export const LARGE_TICK_LINE_MULTIPLIER = 3; // "span of at least 3 written lines"
export const SMALL_TICK_LINE_MULTIPLIER = 1.5;
export const MIN_SYMBOL_SIZE_PCT = 1.5;
export const MAX_SYMBOL_SIZE_PCT = 12;

// MCQ obtained-marks circle sizing (the review overlay's small badge and
// the PDF's own circle must be visually identical, not just similarly
// sized — both annotatePdf.ts and ScanViewer.tsx read this constant rather
// than each keeping their own copy). Sized to comfortably fit a two-line
// stacked fraction (see drawFraction below), not just one line of text —
// bumped up from the single-line-era value.
export const MCQ_SCORE_CIRCLE_PCT_OF_HEIGHT = 5.6;
// Each subjective section's own circled subtotal — same proportions as the
// MCQ circle, both annotatePdf.ts and the review overlay's
// SectionSubtotalBadge read this one constant.
export const SECTION_SUBTOTAL_CIRCLE_PCT_OF_HEIGHT = 5.3;
// Safety inset (%-of-page-WIDTH) kept from whichever page edge a
// margin-anchored mark sits against, so nothing clips off the page —
// shared by annotatePdf.ts's marks-text/section-circle placement and the
// review overlay's SectionSubtotalBadge.
export const MARGIN_INSET_PCT = 3;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Recovers a single line's height from a whole answer band (both as %-of-
 *  page-height) by assuming the band spans a WHOLE number of ruled lines
 *  close to the fallback spacing — keeps the estimate anchored to what was
 *  actually measured instead of either trusting the constant blindly or
 *  dividing by a made-up line count. A non-positive/unknown band falls
 *  back to the constant outright. */
export function estimateLineHeight(bandHeightPct: number): number {
  if (!(bandHeightPct > 0)) return FALLBACK_LINE_HEIGHT_PCT;
  const estimatedLines = Math.max(1, Math.round(bandHeightPct / FALLBACK_LINE_HEIGHT_PCT));
  return bandHeightPct / estimatedLines;
}

// Horizontal fallback (%-of-page-width) for rows with no answer_left_pct/
// answer_right_pct — legacy rows graded before that column existed, or a
// model response that omitted them. Shared so annotatePdf.ts and
// ScanViewer.tsx fall back to the exact same position, not just similar
// ones.
export const FALLBACK_X_PCT = 8;

export type SymbolKind = 'cross' | 'small-tick' | 'large-tick';

/** awarded === 0 -> cross; 0 < awarded < max -> small tick; awarded === max
 *  -> large tick. Only a zero-mark answer ever gets a cross — partial marks
 *  are always a (smaller) tick, never a cross, per spec. */
export function symbolFor(awarded: number, max: number): SymbolKind {
  if (awarded <= 0) return 'cross';
  if (awarded >= max) return 'large-tick';
  return 'small-tick';
}

/** Resolves a SymbolKind + the answer band's own height (%-of-page-height)
 *  into the symbol's size, ALSO %-of-page-height, already clamped to sane
 *  bounds. Callers convert to their own physical unit: annotatePdf.ts
 *  multiplies by the page's real height in PDF points; ScanViewer.tsx
 *  multiplies by the image's aspect ratio to get an equivalent %-of-WIDTH
 *  for the symbol's CSS box (see its own comment on why height% and
 *  width% aren't interchangeable without that conversion). */
export function symbolSize(kind: SymbolKind, bandHeightPct: number): number {
  if (kind === 'cross') return clamp(SMALL_TICK_LINE_MULTIPLIER * estimateLineHeight(bandHeightPct), MIN_SYMBOL_SIZE_PCT, MAX_SYMBOL_SIZE_PCT);
  const lineHeight = estimateLineHeight(bandHeightPct);
  const multiplier = kind === 'large-tick' ? LARGE_TICK_LINE_MULTIPLIER : SMALL_TICK_LINE_MULTIPLIER;
  return clamp(multiplier * lineHeight, MIN_SYMBOL_SIZE_PCT, MAX_SYMBOL_SIZE_PCT);
}

// Leaves a visible gap between a symbol's own lower edge and the next
// question's own top edge, as a fraction of the space between this
// symbol's center and that next top — 1.0 would let them just touch.
const NEIGHBOR_SAFETY_FRACTION = 0.85;
// Minimum vertical gap (%-of-page-height) kept between a symbol's ANCHOR
// and the next question's own top — a hard floor independent of
// NEIGHBOR_SAFETY_FRACTION, for the case below where the anchor itself has
// to be pulled back, not just shrunk. Must stay strictly greater than
// MIN_SYMBOL_SIZE_PCT / 2: when the anchor clamp activates, the symbol still
// gets drawn at at least the minimum size (never shrinks below it, even
// with "almost no room" — see the size-clamp branch below), so a gap any
// smaller than that half-size would let the minimum-size symbol's own edge
// poke back past nextTopPct regardless of how far the anchor was pulled.
const NEIGHBOR_MIN_GAP_PCT = MIN_SYMBOL_SIZE_PCT / 2 + 0.25;

export interface ClampedSymbol {
  /** The symbol's center, %-of-page-height — usually unchanged from the
   *  input `cyPct`, but see the overlap case below. */
  cyPct: number;
  sizePct: number;
}

/** `symbolSize()` can legitimately return up to a "3 written lines" tall
 *  symbol (a full-marks tick is meant to look substantial) — correctly
 *  centered on a SHORT answer's own band midpoint, a symbol that size can
 *  still geometrically reach past that answer's own top/bottom into
 *  whatever comes next on the page. Shrinking size alone isn't always
 *  enough though: the model's reported answer_top_pct/answer_bottom_pct is
 *  itself an estimate, and when it overshoots (the "answer area" it
 *  reported already overlaps or nearly reaches the next question), `cyPct`
 *  — the caller's band midpoint — can land AT OR PAST `nextTopPct` before
 *  this function ever runs; no amount of shrinking a symbol centered past
 *  the neighbor's own start line keeps it out of that neighbor's territory.
 *  So this clamps BOTH: first pulls the anchor back to a safe point no
 *  later than `nextTopPct - NEIGHBOR_MIN_GAP_PCT` (floored at the answer's
 *  own `ownTopPct`, so it never moves earlier than its own band), then
 *  shrinks `desiredSizePct` (never grows) against that now-safe center so
 *  the symbol's lower edge never passes most of the way to the next
 *  question's own top edge. `nextTopPct` is the next question's
 *  `answer_top_pct` (or `question_top_pct`, whichever the caller uses as
 *  "where the next thing starts") on the SAME page, or null if there isn't
 *  one (last question on a page, or the next one is on a different page) —
 *  with no neighbor, only the existing MIN/MAX_SYMBOL_SIZE_PCT bounds
 *  (applied by symbolSize already) apply, and the anchor passes through
 *  unchanged. */
export function clampSymbolToNeighbor(
  desiredSizePct: number,
  ownTopPct: number,
  cyPct: number,
  nextTopPct: number | null,
): ClampedSymbol {
  if (nextTopPct == null) return { cyPct, sizePct: desiredSizePct };
  const safeCyPct = Math.min(cyPct, Math.max(ownTopPct, nextTopPct - NEIGHBOR_MIN_GAP_PCT));
  const availableHalf = Math.max(MIN_SYMBOL_SIZE_PCT / 2, (nextTopPct - safeCyPct) * NEIGHBOR_SAFETY_FRACTION);
  const sizePct = Math.min(desiredSizePct, availableHalf * 2);
  return { cyPct: safeCyPct, sizePct };
}

// ── Answer box resolution — ink-first, region fallback ──────────────────

export interface AnswerBox {
  topPct: number;
  bottomPct: number;
  leftPct: number;
  rightPct: number;
}

// How far a reported ink box is allowed to sit outside its own region box
// before being treated as implausible (%-of-page) — the model's two boxes
// rarely nest EXACTLY even when both are individually reasonable, so a
// zero-tolerance containment check would reject good ink boxes too often.
const INK_CONTAINMENT_SLACK_PCT = 1.5;

/** Resolves the box a symbol should center on: the TIGHT ink box (just the
 *  visible handwritten strokes) when the model reported one that's
 *  actually usable — positive area, and not wildly outside the coarser
 *  `region` box (the existing answer_top/bottom/left/right_pct band,
 *  which for a blank answer is already exactly "the blank ruled-line area
 *  belonging to this question," and for an attempted one is a looser
 *  general-area estimate) — otherwise falls back to `region` itself,
 *  unchanged from the pre-ink-box behavior.
 *
 *  A blank answer never has a usable ink box: gradeSubjective.ts's
 *  buildAnswerRow only ever produces one for a genuinely attempted answer,
 *  and treats an ink box that merely repeats `region` (the model's own
 *  signal for "blank, or not confident") the same as having none at all —
 *  see its own doc comment. So an unattempted cross resolves to `region`'s
 *  own center through this SAME code path, with no separate blank-specific
 *  branch here. */
export function resolveAnswerBox(region: AnswerBox, ink: AnswerBox | null): AnswerBox {
  if (!ink) return region;
  const hasArea = ink.bottomPct > ink.topPct && ink.rightPct > ink.leftPct;
  const withinRegion =
    ink.topPct >= region.topPct - INK_CONTAINMENT_SLACK_PCT &&
    ink.bottomPct <= region.bottomPct + INK_CONTAINMENT_SLACK_PCT &&
    ink.leftPct >= region.leftPct - INK_CONTAINMENT_SLACK_PCT &&
    ink.rightPct <= region.rightPct + INK_CONTAINMENT_SLACK_PCT;
  return hasArea && withinRegion ? ink : region;
}

// ── Pure path builders — top-left origin, Y-DOWN, [0,size] x [0,size] box ──

/** Every coordinate below is authored in a fixed 0-100 reference box, then
 *  scaled by size/100 — keeps the control-point numbers readable while
 *  still producing a path that scales exactly linearly with `size` (tested
 *  below), which is what lets one shape definition serve every symbol size
 *  from a tiny legend glyph to a full "3 written lines" tick. */
function scalePoints(points: [number, number][], size: number): [number, number][] {
  const s = size / 100;
  return points.map(([x, y]) => [x * s, y * s]);
}
function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

// A single, fixed hand-authored tick silhouette, supplied as exact vector
// data — unlike every other shape in this module, it is NOT authored in
// the shared 0-100 box and rescaled by `scalePoints`; it's authored
// directly in this fixed 0..48 box and must be used verbatim, never
// regenerated at the coordinate level. Size control happens externally
// instead: drawTick (pdf-lib) uses drawSvgPath's own `scale` option
// (scale = size / TICK_VIEWBOX_SIZE), and the browser overlay sets its
// <svg viewBox="0 0 48 48"> to this same constant and lets the CSS box
// around it determine the rendered size — the anchor math in drawTick
// (`x: cx - size/2, y: cy + size/2`) still centers correctly either way,
// since translate-then-scale composes the same regardless of whether the
// scaling happens in the path's own coordinates or via a separate factor.
export const TICK_VIEWBOX_SIZE = 48;

/** FILLED (not stroked) tick — the taper comes from the fill silhouette
 *  itself. Takes no size parameter (see TICK_VIEWBOX_SIZE's own comment on
 *  why) — always returns this exact path. */
export function tickSvgPath(): string {
  return 'M4,26 C7,25 10,28 15,36 C16,38 18,38 19,36 C26,20 34,10 46,2 C47,1.4 47.6,2.6 46.8,3.4 C36,14 27,27 21,41 C20,43.5 16.5,43.5 15,41 C11,34 7,30 3.6,28.4 C2.8,28 3.2,26.2 4,26 Z';
}

/** Two crossed diagonal strokes, inset slightly from the box edges. Two
 *  separate M...L segments in one path string — a stroke-only path doesn't
 *  need them connected. Stays a plain stroked path (unlike the tick, which
 *  is filled) — a cross has no natural "brush taper," a uniform stroke
 *  already reads clearly as a board-style zero mark. */
export function crossSvgPath(size: number): string {
  const inset = size * 0.08;
  const a = inset, b = size - inset;
  return `M ${fmt(a)} ${fmt(a)} L ${fmt(b)} ${fmt(b)} M ${fmt(b)} ${fmt(a)} L ${fmt(a)} ${fmt(b)}`;
}

/** A stroke-only, deliberately slightly-irregular oval — a real hand-drawn
 *  circle around a number is never a perfect ellipse. Four cubic-bezier
 *  quadrants with asymmetric radii (not a uniform rx/ry) plus a short
 *  overshoot past the starting point (no closing Z — the path is left
 *  "open" a few degrees past where it started, the way a pen stroke
 *  rarely meets its own start exactly) produce that look while staying a
 *  fully deterministic, testable function of `size` alone. Used for both
 *  the MCQ obtained-marks circle and each subjective section's subtotal
 *  circle (Fix 3/Fix 4) — same shape, annotatePdf.ts just varies the
 *  anchor point and the number drawn inside it. */
export function circleSvgPath(size: number): string {
  const cx = size * 0.5;
  const cy = size * 0.5;
  const k = 0.552; // standard cubic-bezier ellipse approximation constant
  // Per-quadrant radius wobble (rx, ry) — fixed, not random, so the shape
  // is 100% reproducible, just visibly not a perfect ellipse.
  const quadrants: [number, number][] = [
    [size * 0.49, size * 0.44], // right -> bottom
    [size * 0.45, size * 0.47], // bottom -> left
    [size * 0.47, size * 0.41], // left -> top
    [size * 0.43, size * 0.46], // top -> right (and a bit past)
  ];
  const angles = [0, 90, 180, 270, 360 + 12]; // the final +12deg is the pen's overshoot past its own start
  const pt = (angleDeg: number, rx: number, ry: number): [number, number] => {
    const rad = (angleDeg * Math.PI) / 180;
    return [cx + rx * Math.cos(rad), cy + ry * Math.sin(rad)];
  };

  const segments: string[] = [];
  let [startX, startY] = pt(angles[0], quadrants[0][0], quadrants[0][1]);
  segments.push(`M ${fmt(startX)} ${fmt(startY)}`);
  for (let i = 0; i < angles.length - 1; i++) {
    const [rx, ry] = quadrants[i % quadrants.length];
    const a0 = angles[i];
    const a1 = angles[i + 1];
    const [x0, y0] = pt(a0, rx, ry);
    const [x1, y1] = pt(a1, rx, ry);
    const kx = k * rx * ((a1 - a0) / 90);
    const ky = k * ry * ((a1 - a0) / 90);
    // Control points along the ellipse's own tangent direction at each end.
    const c0x = x0 - kx * Math.sin((a0 * Math.PI) / 180);
    const c0y = y0 + ky * Math.cos((a0 * Math.PI) / 180);
    const c1x = x1 + kx * Math.sin((a1 * Math.PI) / 180);
    const c1y = y1 - ky * Math.cos((a1 * Math.PI) / 180);
    segments.push(`C ${fmt(c0x)} ${fmt(c0y)} ${fmt(c1x)} ${fmt(c1y)} ${fmt(x1)} ${fmt(y1)}`);
  }
  return segments.join(' ');
}

// ── pdf-lib draw wrappers ───────────────────────────────────────────────

interface DrawSymbolOptions {
  cx: number;
  cy: number;
  size: number;
  opacity?: number;
}

export function drawTick(page: PDFPage, { cx, cy, size, opacity = DEFAULT_OPACITY }: DrawSymbolOptions): void {
  page.drawSvgPath(tickSvgPath(), {
    x: cx - size / 2,
    y: cy + size / 2,
    scale: size / TICK_VIEWBOX_SIZE,
    color: TICK_FILL_RGB,
    opacity,
  });
}

export function drawCross(page: PDFPage, { cx, cy, size, opacity = DEFAULT_OPACITY }: DrawSymbolOptions): void {
  page.drawSvgPath(crossSvgPath(size), {
    x: cx - size / 2,
    y: cy + size / 2,
    borderColor: BOARD_RED_RGB,
    borderWidth: Math.max(1, size * CROSS_STROKE_WIDTH_RATIO),
    borderOpacity: opacity,
    borderLineCap: LineCapStyle.Round,
  });
}

interface DrawCircleOptions {
  cx: number;
  cy: number;
  /** Diameter, not radius — matches drawTick/drawCross's own `size` (full
   *  box side length) so all three share one mental model. */
  size: number;
  opacity?: number;
}

export function drawCircle(page: PDFPage, { cx, cy, size, opacity = 1 }: DrawCircleOptions): void {
  page.drawSvgPath(circleSvgPath(size), {
    x: cx - size / 2,
    y: cy + size / 2,
    borderColor: BOARD_RED_RGB,
    borderWidth: Math.max(1, size * CIRCLE_STROKE_WIDTH_RATIO),
    borderOpacity: opacity,
    borderLineCap: LineCapStyle.Round,
  });
}

// ── Stacked fraction (e.g. "13" over a rule over "20") — drawn inside the
// MCQ score circle and every section-subtotal circle instead of plain
// inline "13/20" text, matching how a board examiner actually writes a
// fraction by hand. Ratios are all %-of-`size` (the circle's own
// diameter), the same "0-100 box, then scale" convention as the path
// builders above — a browser <svg> renderer (ScanViewer.tsx) reads these
// same three constants for its own text/line placement, centering each
// line natively via textAnchor="middle" rather than needing pdf-lib's
// widthOfTextAtSize measurement (which only drawFraction below needs). ──
export const FRACTION_FONT_SIZE_PCT = 32; // each line's font size
export const FRACTION_LINE_GAP_PCT = 5; // vertical gap between the rule and each line
export const FRACTION_RULE_PADDING_PCT = 14; // how far the rule extends past the wider line, each side
const FRACTION_RULE_STROKE_WIDTH_RATIO = 0.035;

interface DrawFractionOptions {
  cx: number;
  cy: number;
  /** The fraction's own bounding box side length (typically the circle's
   *  diameter it's meant to sit inside) — same mental model as
   *  drawCircle's `size`. */
  size: number;
  numerator: string;
  denominator: string;
  font: PDFFont;
  opacity?: number;
}

export function drawFraction(page: PDFPage, { cx, cy, size, numerator, denominator, font, opacity = 1 }: DrawFractionOptions): void {
  const fontSize = size * (FRACTION_FONT_SIZE_PCT / 100);
  const gap = size * (FRACTION_LINE_GAP_PCT / 100);
  const numeratorWidth = font.widthOfTextAtSize(numerator, fontSize);
  const denominatorWidth = font.widthOfTextAtSize(denominator, fontSize);
  const ruleHalfWidth = Math.max(numeratorWidth, denominatorWidth) / 2 + size * (FRACTION_RULE_PADDING_PCT / 100);

  page.drawText(numerator, { x: cx - numeratorWidth / 2, y: cy + gap + fontSize * 0.15, size: fontSize, font, color: BOARD_RED_RGB, opacity });
  page.drawLine({
    start: { x: cx - ruleHalfWidth, y: cy },
    end: { x: cx + ruleHalfWidth, y: cy },
    thickness: Math.max(1, size * FRACTION_RULE_STROKE_WIDTH_RATIO),
    color: BOARD_RED_RGB,
    opacity,
  });
  page.drawText(denominator, { x: cx - denominatorWidth / 2, y: cy - gap - fontSize * 0.95, size: fontSize, font, color: BOARD_RED_RGB, opacity });
}

// ── Reason codes — the official board comment-code set. Single source of
// truth for the short on-page code, the grading prompt's own valid-code
// list (see gradeSubjective.ts's JSON_ITEM_SHAPE, built from
// Object.entries(REASON_CODES) rather than a hardcoded copy), and the
// review UI's full-word expansion. ──
export const REASON_CODES: Record<string, string> = {
  UN: 'Un-Necessary',
  IR: 'Irrelevant',
  IN: 'Incomplete',
  EX: 'Extra',
  WRF: 'Wrong Formula',
  RP: 'Re-Produced',
  IS: 'Insufficient',
  GR: 'Grammar Error',
  SP: 'Spelling Error',
  P: 'Punctuation',
  WO: 'Wrong Word Order',
  WT: 'Wrong Tense',
  WF: 'Wrong Form',
  OA: 'Over Attempt',
};
