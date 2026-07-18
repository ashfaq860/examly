-- Bubble-alignment fix: switches the MCQ layout map's coordinate frame from
-- whole-page point-space to fractions of the registration-square-center
-- rectangle (see LAYOUT_MAP_FRAME_V2 in src/types/checker.ts for the full
-- rationale). Run this against the live Supabase database — this project
-- has no migrations pipeline, schema changes are applied by hand.
--
-- Adds:
--   - paper_layout_maps.frame: marks which coordinate-frame convention a
--     given row uses. grade-mcq now REJECTS any layout map whose frame
--     isn't 'reg-square-centers-v2' ("Layout map outdated — regenerate
--     this paper to enable checking.") rather than silently grading
--     against the old, less precise whole-page-relative coordinates.
--
-- Note: registration_marks is no longer written by the layout-map route
-- (the v2 frame makes it redundant — the 4 registration squares ARE the
-- unit square by construction) but the column itself is left in place;
-- it was already nullable, so old rows are unaffected.

ALTER TABLE public.paper_layout_maps
  ADD COLUMN IF NOT EXISTS frame text;
