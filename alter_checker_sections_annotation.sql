-- Phase 3: section-driven grading status + annotated-PDF support.
-- Hand-applied — this project has no migrations pipeline (see
-- create_paper_checker_tables.sql's header comment for the same note).
--
-- Why: gradeOrchestrator.ts used to derive the whole submission's status
-- purely from submission_answers rows. When the MCQ section failed outright
-- (e.g. registration squares undetectable) it wrote ZERO mcq rows, so a
-- confidently-graded subjective section alone could flip the submission to
-- 'graded' with a misleadingly low combined fraction — the MCQ failure was
-- invisible. mcq_status/subjective_status (+ *_error, *_max) let each
-- section carry its own outcome independent of the other, so the UI can
-- show "Subjective 6/10 (MCQ not detected — review needed)" instead of a
-- blended "6/25".

ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS mcq_status text NOT NULL DEFAULT 'graded'
  CHECK (mcq_status IN ('graded','skipped','needs_review'));
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS subjective_status text NOT NULL DEFAULT 'graded'
  CHECK (subjective_status IN ('graded','skipped','needs_review'));
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS mcq_error text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS subjective_error text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS mcq_max numeric;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS subjective_max numeric;

-- Where the annotated (ticks + red deduction comments) copy of the scan
-- lives in the submission-scans bucket, alongside the original pages.
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS annotated_pdf_path text;

-- Per-answer position for placing a subjective annotation mark. MCQ rows
-- don't need these — bubble_overlay (alter_checker_review_overlay.sql)
-- already carries per-option pixel-fraction positions on the graded scan.
ALTER TABLE public.submission_answers ADD COLUMN IF NOT EXISTS page_index integer;
ALTER TABLE public.submission_answers ADD COLUMN IF NOT EXISTS y_pct numeric;

-- Short plain-English reason the model gave for lost marks, purpose-built
-- for the annotated PDF's red comment — kept separate from teacher_note
-- (which already carries sentinel values like 'EXCESS_ATTEMPT'/'AI grading
-- failed') and from ai_justification (a longer explanation for the review
-- UI, not sized for an on-page annotation).
ALTER TABLE public.submission_answers ADD COLUMN IF NOT EXISTS deduction_reason text;

-- Grading now runs as a background job after the HTTP response returns
-- (see grade/route.ts) — the submissions list live-updates via Realtime
-- instead of the client blocking on a spinner.
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
