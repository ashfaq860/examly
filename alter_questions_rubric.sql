-- Phase 2 of the paper-checker system (subjective/short/long grading via
-- Claude vision). Adds a cached grading rubric per question, generated once
-- (see src/lib/checker/rubric.ts's ensureRubric()) and reused by every
-- future submission that includes this question — never regenerated unless
-- the question itself is edited.
-- Run this against the live Supabase database — this project has no
-- migrations pipeline, schema changes are applied by hand.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS rubric jsonb;
