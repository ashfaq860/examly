-- Adds a WhatsApp contact number to students, so a submission's result can
-- be sent to the parent/student via a wa.me deep link from the review
-- screen (src/app/dashboard/checker/[paperId]/review/[submissionId]/page.tsx).
-- Stored in the same local format as profiles.cellno ("03XXXXXXXXX", 11
-- digits) for consistency with the existing phone-number convention in this
-- app; converted to international format (92XXXXXXXXXX) only at send time.
-- Run this against the live Supabase database — this project has no
-- migrations pipeline, schema changes are applied by hand.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS whatsapp_number text;
