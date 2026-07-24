-- Hand-applied — this project has no migrations pipeline (see
-- create_paper_checker_tables.sql's header comment for the same note).
--
-- Board-style annotation refinement: a wrong/partial subjective answer can
-- carry SEVERAL official board comment codes at once (e.g. ["IN","GR"]), not
-- just one — replaces the single reason_code column's role going forward.
-- reason_code (singular, alter_checker_subjective_marks_v2.sql) is left in
-- place, unused by new code — same convention as every other schema round
-- here: never drop/rename, old rows just show no codes until regraded.
ALTER TABLE public.submission_answers ADD COLUMN IF NOT EXISTS reason_codes text[];
