-- Hand-applied — this project has no migrations pipeline (see
-- create_paper_checker_tables.sql's header comment for the same note).
--
-- Adds a TIGHT ink-only bounding box per subjective answer, distinct from
-- the existing answer_top/bottom/left/right_pct band (which stays the
-- coarser "answer area OR blank ruled-line area" fallback — see
-- annotatePdf.ts's resolveAnswerBox). Ticks/crosses center on the ink box
-- when the model reports one that's plausible (positive area, inside the
-- existing band); otherwise they fall back to the existing band's own
-- center, unchanged from before this migration.
ALTER TABLE public.submission_answers ADD COLUMN IF NOT EXISTS answer_ink_top_pct numeric;
ALTER TABLE public.submission_answers ADD COLUMN IF NOT EXISTS answer_ink_bottom_pct numeric;
ALTER TABLE public.submission_answers ADD COLUMN IF NOT EXISTS answer_ink_left_pct numeric;
ALTER TABLE public.submission_answers ADD COLUMN IF NOT EXISTS answer_ink_right_pct numeric;

-- One marks-side ('left'/'right') for the WHOLE paper, decided once by
-- majority answer language (see gradeSubjective.ts's
-- decideSubjectiveMarksSide) and persisted here so the annotated PDF and
-- the review page's live overlay always agree — never decided per answer
-- again, which is what let a mixed-language paper print some marks on the
-- left and some on the right within the same paper.
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS subjective_marks_side text
  CHECK (subjective_marks_side IN ('left', 'right'));
