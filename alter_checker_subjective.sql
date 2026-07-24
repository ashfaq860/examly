-- Phase 2 of the paper-checker system (subjective/short/long grading via
-- Claude vision, full-paper submission via camera/files/PDF).
-- Run this against the live Supabase database — this project has no
-- migrations pipeline, schema changes are applied by hand.
--
-- Adds:
--   - paper_layout_maps.page_count: expected printed page count, captured
--     at paper-save time (PaperLayoutRenderer.tsx). Used only to show a
--     non-blocking "N of M pages" mismatch warning on the upload UI — not
--     for precise per-page cropping (subjective grading sends the model
--     whole page images, not homography-cropped regions).
--   - submissions.page_count_mismatch: set by the grade orchestrator
--     (src/lib/checker/gradeSubjective.ts) when scan_urls.length doesn't
--     match the layout map's page_count.
--
-- No new columns needed on submission_answers — Phase 1's schema already
-- has everything subjective grading writes into (transcription,
-- transcription_lang, rubric_scores, ai_marks, ai_confidence,
-- ai_justification, region_crop_url, teacher_note). A blank answer reuses
-- the existing detected_option='BLANK' value rather than a new column.

ALTER TABLE public.paper_layout_maps
  ADD COLUMN IF NOT EXISTS page_count integer;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS page_count_mismatch boolean NOT NULL DEFAULT false;
