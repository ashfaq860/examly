-- Hand-applied — this project has no migrations pipeline (see
-- create_paper_checker_tables.sql's header comment for the same note).
--
-- Live grading-progress columns, so the review page can show a real "step X
-- of Y" strip instead of a silent screen while subjective grading (the
-- slow, LLM-driven part) runs. No grading_status column — submissions.status
-- already distinguishes processing/graded/failed; a second parallel status
-- enum would risk the exact kind of drift mcq_status/subjective_status
-- needed a dedicated fix for earlier in this project's history.
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS grading_stage text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS grading_label text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS grading_done integer NOT NULL DEFAULT 0;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS grading_total integer NOT NULL DEFAULT 0;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS grading_updated_at timestamptz;

-- MCQ and subjective grading run CONCURRENTLY (Promise.allSettled in
-- gradeOrchestrator.ts), so a client-side read-modify-write increment of
-- grading_done could race (both read the same starting value). This makes
-- the increment atomic at the database level instead.
CREATE OR REPLACE FUNCTION public.advance_grading_progress(
  p_submission_id uuid,
  p_stage text,
  p_label text
) RETURNS void AS $$
  UPDATE public.submissions
  SET grading_done = grading_done + 1,
      grading_stage = p_stage,
      grading_label = p_label,
      grading_updated_at = now()
  WHERE id = p_submission_id;
$$ LANGUAGE sql;
