-- Phase 1 of the paper-checker system (MCQ/OMR grading).
-- Run this against the live Supabase database — this project has no
-- migrations pipeline, schema changes are applied by hand.
--
-- Creates: students, submissions, submission_answers, paper_layout_maps.
-- Adds indexes, RLS (select-only — all writes go through the service-role
-- client from server API routes, same convention as every other table in
-- this project), and the private 'submission-scans' storage bucket.

-- ─────────────────────────────────────────────────────────────────────────
-- students
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  academy_id uuid,
  full_name text NOT NULL,
  roll_no text,
  class_name text,
  section text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_owner_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id),
  CONSTRAINT students_academy_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id)
);
CREATE INDEX IF NOT EXISTS idx_students_owner_id ON public.students(owner_id);
CREATE INDEX IF NOT EXISTS idx_students_academy_id ON public.students(academy_id);

-- ─────────────────────────────────────────────────────────────────────────
-- submissions
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL,
  student_id uuid,
  student_name_raw text,
  roll_no_raw text,
  uploaded_by uuid NOT NULL,
  scan_urls text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'uploaded'::text
    CHECK (status = ANY (ARRAY['uploaded'::text, 'processing'::text, 'graded'::text, 'in_review'::text, 'finalized'::text, 'failed'::text])),
  mcq_score numeric,
  subjective_score numeric,
  total_score numeric,
  max_score numeric,
  processing_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  finalized_at timestamp with time zone,
  finalized_by uuid,
  CONSTRAINT submissions_pkey PRIMARY KEY (id),
  CONSTRAINT submissions_paper_fkey FOREIGN KEY (paper_id) REFERENCES public.papers(id),
  CONSTRAINT submissions_student_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT submissions_uploader_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id),
  CONSTRAINT submissions_finalizer_fkey FOREIGN KEY (finalized_by) REFERENCES public.profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_submissions_paper_id ON public.submissions(paper_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_uploaded_by ON public.submissions(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);

-- ─────────────────────────────────────────────────────────────────────────
-- submission_answers
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.submission_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  question_id uuid NOT NULL,
  q_number text,
  answer_kind text NOT NULL CHECK (answer_kind = ANY (ARRAY['mcq'::text, 'subjective'::text])),
  detected_option text CHECK (detected_option = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'MULTIPLE'::text, 'BLANK'::text])),
  correct_option text,
  fill_confidence numeric,
  region_crop_url text,
  transcription text,
  transcription_lang text CHECK (transcription_lang = ANY (ARRAY['en'::text, 'ur'::text, 'mixed'::text])),
  rubric_scores jsonb,
  ai_marks numeric,
  ai_confidence numeric,
  ai_justification text,
  max_marks numeric NOT NULL,
  needs_review boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  final_marks numeric,
  teacher_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT submission_answers_pkey PRIMARY KEY (id),
  CONSTRAINT submission_answers_submission_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id),
  CONSTRAINT submission_answers_question_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id),
  CONSTRAINT submission_answers_reviewer_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_submission_answers_submission_id ON public.submission_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_answers_question_id ON public.submission_answers(question_id);

-- ─────────────────────────────────────────────────────────────────────────
-- paper_layout_maps
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paper_layout_maps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  page_size text NOT NULL DEFAULT 'A4'::text,
  mcq_bubbles jsonb,
  answer_regions jsonb,
  registration_marks jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT paper_layout_maps_pkey PRIMARY KEY (id),
  CONSTRAINT paper_layout_maps_paper_fkey FOREIGN KEY (paper_id) REFERENCES public.papers(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_paper_layout_maps_paper_version ON public.paper_layout_maps(paper_id, version);

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — select-only, ownership-scoped. All inserts/updates happen server-
-- side via supabaseAdmin (service role), which bypasses RLS, matching the
-- rest of this project (see profile/logo/route.ts, papers/delete/route.ts).
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_layout_maps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS students_select_owner ON public.students;
CREATE POLICY students_select_owner ON public.students
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS submissions_select_owner ON public.submissions;
CREATE POLICY submissions_select_owner ON public.submissions
  FOR SELECT USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.papers p WHERE p.id = submissions.paper_id AND p.created_by = auth.uid())
  );

DROP POLICY IF EXISTS submission_answers_select_owner ON public.submission_answers;
CREATE POLICY submission_answers_select_owner ON public.submission_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_answers.submission_id
        AND (
          s.uploaded_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.papers p WHERE p.id = s.paper_id AND p.created_by = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS paper_layout_maps_select_owner ON public.paper_layout_maps;
CREATE POLICY paper_layout_maps_select_owner ON public.paper_layout_maps
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.papers p WHERE p.id = paper_layout_maps.paper_id AND p.created_by = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Storage bucket for scanned answer sheets — private (student scan images
-- are sensitive), accessed only server-side via supabaseAdmin.
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('submission-scans', 'submission-scans', false)
ON CONFLICT (id) DO NOTHING;
