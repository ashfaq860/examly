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
  answer_regions?: unknown; // reserved for a later (subjective) phase — always null for now
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
  max_marks: number;
  needs_review: boolean;
  final_marks: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  teacher_note: string | null;
  created_at: string;
}
