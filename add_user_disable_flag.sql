-- Adds an admin-controlled "disable account" flag.
-- Run this against the live Supabase database — this project has no
-- migrations pipeline, schema changes are applied by hand.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;
