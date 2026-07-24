-- Phase 4: template-space (PDF point) bubble layout + shared alignment.
-- Hand-applied — this project has no migrations pipeline (see
-- create_paper_checker_tables.sql's header comment for the same note).
--
-- Why: MCQ grading was picking the "4 largest dark blobs" as registration-
-- square fiducials with only generic shape filters — nothing that knew
-- what the REAL fiducial arrangement was supposed to look like, so a false
-- positive (e.g. a header logo) could get picked over a real fiducial and
-- produce a badly-warped homography. That corrupted both the score AND
-- the annotation identically, since annotation reuses whatever position
-- grading already computed rather than recomputing it. Persisting the
-- template layout in absolute PDF-point space (paper_layout_maps.frame =
-- 'template-points-v3') gives fiducial detection something concrete to
-- validate candidates against (does this candidate arrangement match the
-- template's own known fiducial rectangle SHAPE, not just size), and
-- gives annotation a stable point-space to draw from.

-- paper_layout_maps.mcq_bubbles and .frame already accept the new v3
-- payload shape (jsonb, no schema change needed — mcq_bubbles becomes a
-- FLAT TemplateBubble[] with x/y/r in PDF points, one row per
-- question+option, instead of v2's one-entry-per-question-with-4-fractions
-- shape). New columns: 'fiducials' (the template's own 4 fiducial points)
-- and 'template' (the page's own size in PDF points) — both needed to
-- validate detected candidates and fit the homography against.
ALTER TABLE public.paper_layout_maps ADD COLUMN IF NOT EXISTS fiducials jsonb;
ALTER TABLE public.paper_layout_maps ADD COLUMN IF NOT EXISTS template jsonb;

-- Per-submission: the 4 ACTUAL detected fiducial pixel points on the
-- winning scan page, persisted so annotatePdf.ts can re-derive the exact
-- same alignment (fitAlignment) grading used, without re-running blob
-- detection — detector and annotator can never disagree even in
-- principle, since they share the same stored transform inputs.
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS graded_fiducials jsonb;

-- The CV working-image dimensions (loadGrayscale's ~1600px-capped resize)
-- that graded_fiducials/bubble_overlay pixel positions are relative to —
-- annotatePdf.ts embeds the FULL-RESOLUTION original image, not this
-- working copy, so it needs these to convert a re-fitted alignment's
-- pixel output into a resolution-independent fraction first (same trick
-- bubble_overlay's own xFrac/yFrac already use).
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS graded_image_width integer;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS graded_image_height integer;

-- Subjective annotation placement: a vertical BAND (where the student's
-- handwriting actually is), not a single guessed point — plus the
-- question's own band so the annotator can sanity-check the answer band
-- doesn't land on the question line. Replaces y_pct (single point, which
-- is why marks landed ON the question text rather than in the answer
-- area).
ALTER TABLE public.submission_answers ADD COLUMN IF NOT EXISTS answer_top_pct numeric;
ALTER TABLE public.submission_answers ADD COLUMN IF NOT EXISTS answer_bottom_pct numeric;
ALTER TABLE public.submission_answers ADD COLUMN IF NOT EXISTS question_top_pct numeric;
