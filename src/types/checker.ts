// Shared types for the paper-checker (OMR/MCQ grading) system — the
// contract between PaperLayoutRenderer's generation-time layout capture,
// the /api/papers/[id]/layout-map endpoint, /api/checker/grade-mcq, and the
// teacher-facing review UI under /dashboard/checker.

export type BubbleOption = 'A' | 'B' | 'C' | 'D';
export type DetectedOption = BubbleOption | 'MULTIPLE' | 'BLANK';

// v2 frame: every bubble center is stored as a FRACTION of the rectangle
// spanned by the 4 registration squares' own centers (tl->tr = width,
// tl->bl = height) — NOT a fraction/point-space of the whole physical
// page, which the v1 design used. That mattered because the grading
// homography is fit from only those same 4 points: v1 fit it from
// registration marks expressed in whole-page point-space (up to ~842pt for
// an A4 page) while the box they actually bound is a small sub-region of
// that, making the fit needlessly sensitive to small centroid-detection
// error. Under v2, the 4 registration squares ARE the unit square
// (0,0)-(1,0)-(0,1)-(1,1) by construction, so grade-mcq's homography is
// always fit from a maximally well-conditioned unit square, and every
// bubble fraction maps through it directly — no physical units, no
// whole-page scale, involved anywhere.
export const LAYOUT_MAP_FRAME_V2 = 'reg-square-centers-v2' as const;

export interface McqBubbleFrac {
  xFrac: number;
  yFrac: number;
  rFrac: number; // fraction of the frame's WIDTH (tl->tr distance)
}

export interface McqBubbleEntry {
  question_number: number;
  question_id: string;
  options: Record<BubbleOption, McqBubbleFrac>;
}

export interface McqLayoutMapPayload {
  frame: typeof LAYOUT_MAP_FRAME_V2;
  page_size: string; // 'A4' | 'legal'
  mcq_bubbles: McqBubbleEntry[];
  answer_regions?: unknown; // reserved, unused — subjective grading sends whole-page images instead, see gradeSubjective.ts
  /** Expected printed page count (one per rendered .paper-sheet), captured
   *  at paper-save time. Used only for the checker upload UI's non-blocking
   *  "N of M pages" mismatch warning. */
  page_count?: number;
}

// ── v3 frame: template-space (PDF point) bubble layout ─────────────────
// v2's fractions were always relative to WHATEVER 4 registration squares
// happened to be detected — which meant fiducial detection had nothing
// independent to validate a candidate arrangement against beyond generic
// shape filters (aspect ratio, fill ratio, corner darkness). A false
// positive elsewhere on the page (a logo, a heavy glyph) that happened to
// pass those filters could get picked over a real fiducial, silently
// producing a badly-warped homography — corrupting the score AND the
// annotation identically, since annotation reuses grading's already-
// computed positions rather than recomputing them.
//
// v3 persists the template's OWN fiducial rectangle and bubble positions
// in absolute PDF points (72pt/inch, origin top-left of the page) at
// generation time — see src/lib/checker/omr/units.ts for the mm<->pt
// conversion, and PaperLayoutRenderer.tsx's captureMcqLayoutMap for how
// it's captured from the rendered DOM. This gives fiducial detection
// (src/lib/checker/omr/align.ts) a real shape to validate candidates
// against (does this candidate quadrilateral's aspect ratio match the
// TEMPLATE's own fiducial rectangle, not just "are these 4 blobs a
// similar size") — a logo would have to coincidentally match the
// template's known rectangle SHAPE, not just size, to be mistaken for a
// real fiducial.
export const LAYOUT_MAP_FRAME_V3 = 'template-points-v3' as const;

/** A point in PDF points, origin at the TOP-LEFT of the page (note: pdf-lib
 *  itself uses a bottom-left origin — see annotatePdf.ts's toPdfY helper
 *  for the one place that flip happens, never done ad hoc elsewhere). */
export interface TemplatePoint {
  x: number;
  y: number;
}

export interface TemplateBubble {
  q: number; // printed question number
  question_id: string; // ties this bubble to questions.correct_option/marksEach — required, not derivable from q alone
  option: BubbleOption;
  x: number;
  y: number;
  r: number; // radius, PDF points
}

export interface BubbleLayoutV3 {
  frame: typeof LAYOUT_MAP_FRAME_V3;
  page_size: string;
  /** The page's own size in PDF points — 72pt/inch, e.g. A4 portrait is
   *  ~595 x 842pt, Legal is ~612 x 1008pt. */
  template: { width: number; height: number };
  /** The 4 real fiducial squares' TEMPLATE centers, in tl/tr/bl/br order —
   *  what detected candidates on a scan get validated and homography-fit
   *  against. */
  fiducials: [TemplatePoint, TemplatePoint, TemplatePoint, TemplatePoint];
  /** Named mcq_bubbles (not "bubbles") to match the actual
   *  paper_layout_maps column — v2's McqLayoutMapPayload already used this
   *  name; kept for both the wire payload and the stored row so there's no
   *  translation layer between "what the client posts" and "what's in the
   *  DB." */
  mcq_bubbles: TemplateBubble[];
  page_count?: number;
}

// ── Review UI overlay data ──────────────────────────────────────────────
// Per-option bubble position/darkness on the specific scanned image that
// was actually graded (submissions.graded_scan_index), expressed as
// fractions of that image's width/height rather than raw pixels — the
// review screen can then position overlay circles with plain CSS
// percentages regardless of the resolution of whatever copy of the image
// (original vs. grade-mcq's downsized working copy) it ends up rendering,
// since both share the same aspect ratio.
export interface BubbleOverlayRect {
  xFrac: number;
  yFrac: number;
  rFrac: number;
  darkness: number;
}

export type BubbleOverlay = Record<BubbleOption, BubbleOverlayRect>;

// Shape of a submission_answers row, as used by the shared scoring helpers
// (src/lib/checker/answers.ts) and the review UI. Loosely typed elsewhere
// (API routes just use `any`, matching this codebase's existing convention
// of not generating strict Supabase row types) — this is only for the
// handful of places where the extra precision actually pays for itself.
export interface RubricScoreCriterion {
  point: string;
  marks_awarded: number;
  max_marks: number;
}

export interface RubricScores {
  criteria: RubricScoreCriterion[];
  mistakes: string[];
}

export interface SubmissionAnswerRow {
  id: string;
  submission_id: string;
  question_id: string;
  q_number: string | null;
  answer_kind: 'mcq' | 'subjective';
  detected_option: DetectedOption | null;
  correct_option: string | null;
  override_option: DetectedOption | null;
  fill_confidence: number | null;
  bubble_overlay: BubbleOverlay | null;
  // Subjective-only fields — null on 'mcq' rows.
  transcription: string | null;
  /** The SCRIPT the student's answer is written in — 'mixed' is accepted by
   *  the column's own CHECK constraint but never produced by the current
   *  grading prompt (which only ever reports 'en'/'ur'/null). Drives which
   *  margin annotatePdf.ts/ScanViewer.tsx write the awarded-marks text in:
   *  Urdu reads right-to-left, so its natural marking margin is the LEFT,
   *  opposite of English's RIGHT. null = unattempted/unknown, which follows
   *  the paper's default (right). */
  transcription_lang: 'en' | 'ur' | 'mixed' | null;
  rubric_scores: RubricScores | null;
  ai_marks: number | null;
  ai_confidence: number | null;
  ai_justification: string | null;
  region_crop_url: string | null;
  max_marks: number;
  needs_review: boolean;
  final_marks: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  teacher_note: string | null;
  created_at: string;
  // Annotation placement (subjective only) — see annotatePdf.ts. A BAND
  // (top+bottom), not a single guessed point — a single point tended to
  // land marks on the question line rather than in the student's actual
  // answer area. question_top_pct is the question text's OWN top position,
  // used only as a sanity check that the answer band doesn't overlap it.
  page_index: number | null;
  answer_top_pct: number | null;
  answer_bottom_pct: number | null;
  /** Horizontal extent of the student's writing block, 0-100 from the LEFT
   *  edge of the page — paired with answer_top_pct/answer_bottom_pct so a
   *  mark can be centered on the answer on BOTH axes, not just vertically. */
  answer_left_pct: number | null;
  answer_right_pct: number | null;
  /** Tight ink-only box (see lib/checker/annotate/symbols.ts's
   *  resolveAnswerBox) — null whenever there's no usable one (blank, the
   *  model repeated the band verbatim, or it failed the plausibility
   *  check). Always all-four-or-none. */
  answer_ink_top_pct: number | null;
  answer_ink_bottom_pct: number | null;
  answer_ink_left_pct: number | null;
  answer_ink_right_pct: number | null;
  question_top_pct: number | null;
  deduction_reason: string | null;
  /** Short machine-readable official board comment codes (see
   *  lib/checker/annotate/symbols.ts's REASON_CODES — UN/IR/IN/EX/WRF/RP/
   *  IS/GR/SP/P/WO/WT/WF/OA) printed compactly on the annotated page
   *  beneath the marks when awarded < max — a wrong/partial answer can
   *  carry several at once. The fuller free-text explanation for the
   *  review UI stays in deduction_reason, unchanged; this is deliberately
   *  NOT crowded onto the page. Defensively filtered server-side to only
   *  known REASON_CODES keys. */
  reason_codes: string[] | null;
}

// ── Section-driven grading status (submissions.mcq_status/subjective_status) ──
// 'skipped' = the paper simply doesn't have this section (not an error).
// 'needs_review' = either the section graded but some answers need a human
// look, OR the section failed outright (e.g. MCQ registration squares
// undetectable) — in the failed case `awarded` is null and `error` is set,
// so the UI can show "not detected" instead of implying a real 0.
export type SectionStatus = 'graded' | 'skipped' | 'needs_review';

/** Machine-readable classification of `error` below — see
 *  lib/checker/claude.ts's describeClaudeError, the one place that turns a
 *  raw caught error (an opaque "TypeError: fetch failed"/"Connection
 *  error.") into a real, actionable cause. Kept as a plain string union
 *  here (not re-imported from claude.ts) so this shared types module never
 *  needs to import from a server-only lib file (claude.ts pulls in the
 *  Anthropic SDK) — the two are kept in sync by hand, it's a small closed set. */
export type SectionErrorKind = 'network' | 'timeout' | 'billing' | 'auth' | 'bad_request' | 'unknown';

export interface SectionOutcome {
  status: SectionStatus;
  awarded: number | null;
  max: number;
  error: string | null;
  /** Present when `error` came from a classifiable API/network failure —
   *  lets the review UI show a distinct, actionable message for e.g. a
   *  billing failure instead of the raw API error text. */
  errorKind?: SectionErrorKind;
}
