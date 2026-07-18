-- Phase 1.5 of the paper-checker system (teacher review UI).
-- Run this against the live Supabase database — this project has no
-- migrations pipeline, schema changes are applied by hand.
--
-- Adds:
--   - submission_answers.override_option: the teacher's manual correction,
--     kept separate from detected_option so the original CV read is never
--     lost. Everywhere that needs "what actually counts" uses
--     override_option ?? detected_option (see src/lib/checker/answers.ts).
--   - submission_answers.bubble_overlay: per-option bubble geometry (as
--     fractions of the graded image's width/height, not raw pixels) so the
--     review screen can draw overlay circles without re-running CV
--     client-side.
--   - submissions.graded_scan_index: which scan_urls[] entry was actually
--     used for MCQ grading, so the review screen knows which image to show.

ALTER TABLE public.submission_answers
  ADD COLUMN IF NOT EXISTS override_option text
    CHECK (override_option = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'BLANK'::text]));

ALTER TABLE public.submission_answers
  ADD COLUMN IF NOT EXISTS bubble_overlay jsonb;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS graded_scan_index integer;
