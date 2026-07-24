-- Hand-applied — this project has no migrations pipeline (see
-- create_paper_checker_tables.sql's header comment for the same note).
--
-- Adds the horizontal extent of a subjective answer's writing block
-- (answer_top_pct/answer_bottom_pct already exist — this adds the missing
-- left/right pair) and a short machine-readable deduction reason code, so
-- annotatePdf.ts can center the tick/cross symbol on the actual answer
-- block (both axes) instead of a fixed left margin, and print a compact
-- "IC"/"IR" code on the page instead of crowding the full free-text
-- deduction_reason onto it.
--
-- Note: submission_answers.transcription_lang (already exists, already
-- 'en'/'ur'/'mixed' via its own CHECK) is being put to use for the first
-- time here too — no schema change needed for it, just documented: it now
-- carries the STUDENT'S ANSWER script (used to decide which margin the
-- marks are written in — Urdu is right-to-left, so its marks go on the
-- left), not a dormant field.
ALTER TABLE public.submission_answers ADD COLUMN IF NOT EXISTS answer_left_pct numeric;
ALTER TABLE public.submission_answers ADD COLUMN IF NOT EXISTS answer_right_pct numeric;
ALTER TABLE public.submission_answers ADD COLUMN IF NOT EXISTS reason_code text;
