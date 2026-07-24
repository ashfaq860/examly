-- Hand-applied — this project has no migrations pipeline (see
-- create_paper_checker_tables.sql's header comment for the same note).
--
-- A machine-readable classification of WHY a section's grading failed
-- (see lib/checker/claude.ts's describeClaudeError / ErrorKind), alongside
-- the existing mcq_error/subjective_error text columns (which stay as the
-- human-readable detail message, now enriched with the underlying network
-- error code where available). Lets the review UI show a distinct,
-- actionable message for a billing failure ("AI grading unavailable — API
-- credits exhausted") instead of the raw API error text, without having to
-- regex the message string client-side.
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS mcq_error_kind text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS subjective_error_kind text;
