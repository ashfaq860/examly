-- Hand-applied — this project has no migrations pipeline (see
-- create_paper_checker_tables.sql's header comment for the same note).
--
-- Per-CALL cost telemetry (not per-submission columns) — a single
-- submission can involve several Claude calls (rubric generation, a batch
-- grading call, an occasional Sonnet escalation for a low-confidence/
-- partial-credit question), each with its own model/token/cost profile.
-- One row per call lets the admin dashboard aggregate by paper or by day
-- so a cost regression is visible immediately, not just grep-able from
-- server logs after the fact — see lib/checker/gradingTelemetry.ts, which
-- writes here from the single choke point every Claude call already goes
-- through (callClaudeJson, lib/checker/claude.ts).
CREATE TABLE IF NOT EXISTS public.checker_grading_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable: rubric-generation calls happen once per QUESTION (amortized
  -- across a whole class), not tied to any one submission.
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  paper_id uuid NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  call_kind text NOT NULL CHECK (call_kind IN ('batch', 'per_question', 'rubric', 'escalation')),
  model text NOT NULL,
  image_count integer NOT NULL DEFAULT 0,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cache_creation_input_tokens integer NOT NULL DEFAULT 0,
  cache_read_input_tokens integer NOT NULL DEFAULT 0,
  -- Best-effort, from named/adjustable constants in gradingTelemetry.ts —
  -- verify against Anthropic's current pricing page before relying on this
  -- for real budgeting; isolated to one place specifically so it's a
  -- one-line fix if a rate is wrong.
  estimated_cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checker_grading_calls_paper_created_idx ON public.checker_grading_calls (paper_id, created_at);
CREATE INDEX IF NOT EXISTS checker_grading_calls_submission_idx ON public.checker_grading_calls (submission_id);
