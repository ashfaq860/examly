-- Adds a father's-name field to students, shown alongside the student's own
-- name on the registration page and (once set) usable in submission
-- exports/messages.
-- Run this against the live Supabase database — this project has no
-- migrations pipeline, schema changes are applied by hand.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS father_name text;
