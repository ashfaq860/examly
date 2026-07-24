-- DOWN migration for 20260724000000_baseline_hardened_state.sql.
--
-- *** DO NOT RUN THIS AGAINST PRODUCTION. ***
-- This reverses the post-breach hardening pass — dropping it would put
-- every one of these 25 tables back to (or close to) the exact
-- unauthenticated-write-everywhere state that let the breach happen. It
-- exists only so a fresh/disposable environment provisioned from this
-- migration can be torn back down cleanly (e.g. in CI, or to re-run the up
-- migration during local iteration), and to satisfy the "every migration
-- has a down" convention for this repo going forward.
--
-- Most of the objects touched here (is_admin, my_academy_ids, owns_paper,
-- owns_submission, can_add_member, get_active_package, has_feature,
-- protect_profile_columns, grant_trial, and every policy) did not exist
-- before this hardening pass — they were added by it — so "down" for those
-- means DROP, not revert-to-something-earlier. get_user_role() and
-- handle_mobile_verified_rewards() did exist before in a different form;
-- this down migration removes the current definition but cannot restore
-- whatever prior version existed, since that version was never captured
-- either (see the migration's own header note on scope).

-- ============================================================
-- Reverse of 5. Free Trial package row
-- ============================================================
delete from public.packages where name = 'Free Trial';

-- ============================================================
-- Reverse of 4. EXECUTE grants — drop the functions entirely below,
-- which removes their grants along with them. Nothing to do here on its
-- own.
-- ============================================================

-- ============================================================
-- Reverse of 3. Functions
-- ============================================================
drop function if exists public.protect_profile_columns() cascade;
drop function if exists public.handle_mobile_verified_rewards() cascade;
drop function if exists public.grant_trial(uuid);
drop function if exists public.get_user_trial_status(uuid);
drop function if exists public.get_visit_stats(integer);
drop function if exists public.increment_papers_generated(uuid);
drop function if exists public.consume_scan(uuid);
drop function if exists public.get_active_package(uuid);
drop function if exists public.get_active_package();
drop function if exists public.has_feature(uuid, text);
drop function if exists public.has_feature(text);
drop function if exists public.can_add_member(uuid);
drop function if exists public.owns_submission(uuid);
drop function if exists public.owns_paper(uuid);
drop function if exists public.my_academy_ids();
drop function if exists public.get_user_role();
drop function if exists public.is_admin();

-- ============================================================
-- Reverse of 2. Storage: restore prior bucket visibility and drop the
-- owner-scoped policies (profile_logo/submission-scans privacy is
-- unchanged by the up migration, so left alone here too).
-- ============================================================
drop policy if exists "generated_papers_own_read" on storage.objects;
drop policy if exists "generated_papers_own_write" on storage.objects;
drop policy if exists "key_own_read" on storage.objects;
drop policy if exists "key_own_write" on storage.objects;
drop policy if exists "own generated papers" on storage.objects;
drop policy if exists "own keys" on storage.objects;
drop policy if exists "profile_logo_own_write" on storage.objects;

update storage.buckets set public = true where id = 'generated-papers';
update storage.buckets set public = true where id = 'key';

-- ============================================================
-- Reverse of 1. RLS + policies — drop every policy, then disable RLS.
-- Table-by-table, in the same order the up migration enabled it.
-- ============================================================
drop policy if exists "Insert own academies" on public.academies;
drop policy if exists "Select own academies" on public.academies;
drop policy if exists "Update own academies" on public.academies;
drop policy if exists "academy_members_admin_write" on public.academy_members;
drop policy if exists "academy_members_read" on public.academy_members;
drop policy if exists "chapter_question_rules_admin_write" on public.chapter_question_rules;
drop policy if exists "chapter_question_rules_read" on public.chapter_question_rules;
drop policy if exists "chapters_admin_write" on public.chapters;
drop policy if exists "chapters_read" on public.chapters;
drop policy if exists "cgc_admin_read" on public.checker_grading_calls;
drop policy if exists "class_subjects_admin_write" on public.class_subjects;
drop policy if exists "class_subjects_read" on public.class_subjects;
drop policy if exists "classes_admin_write" on public.classes;
drop policy if exists "classes_read" on public.classes;
drop policy if exists "Enable read access for all users" on public.packages;
drop policy if exists "read active packages" on public.packages;
drop policy if exists "paper_layout_maps_select_owner" on public.paper_layout_maps;
drop policy if exists "paper_questions_own" on public.paper_questions;
drop policy if exists "paper_templates_read" on public.paper_templates;
drop policy if exists "paper_templates_write" on public.paper_templates;
drop policy if exists "Admins can read all papers" on public.papers;
drop policy if exists "own papers" on public.papers;
drop policy if exists "papers_select_owner" on public.papers;
drop policy if exists "own payments read" on public.payments;
drop policy if exists "Authenticated users can read own role" on public.profiles;
drop policy if exists "Enable read for users based on id" on public.profiles;
drop policy if exists "Enable update for users based on id" on public.profiles;
drop policy if exists "Users can select own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "question_categories_admin_write" on public.question_categories;
drop policy if exists "question_categories_read" on public.question_categories;
drop policy if exists "admin write" on public.questions;
drop policy if exists "read for authenticated" on public.questions;
drop policy if exists "referrals_read" on public.referrals;
drop policy if exists "results_own" on public.results;
drop policy if exists "sv_admin_read" on public.site_visits;
drop policy if exists "sv_insert" on public.site_visits;
drop policy if exists "students_select_owner" on public.students;
drop policy if exists "subjects_admin_write" on public.subjects;
drop policy if exists "subjects_read" on public.subjects;
drop policy if exists "submission_answers_select_owner" on public.submission_answers;
drop policy if exists "submissions_select_owner" on public.submissions;
drop policy if exists "topics_admin_write" on public.topics;
drop policy if exists "topics_read" on public.topics;
drop policy if exists "Users can view own packages" on public.user_packages;

alter table public.academies disable row level security;
alter table public.academy_members disable row level security;
alter table public.chapter_question_rules disable row level security;
alter table public.chapters disable row level security;
alter table public.checker_grading_calls disable row level security;
alter table public.class_subjects disable row level security;
alter table public.classes disable row level security;
alter table public.packages disable row level security;
alter table public.paper_layout_maps disable row level security;
alter table public.paper_questions disable row level security;
alter table public.paper_templates disable row level security;
alter table public.papers disable row level security;
alter table public.payments disable row level security;
alter table public.profiles disable row level security;
alter table public.question_categories disable row level security;
alter table public.questions disable row level security;
alter table public.referrals disable row level security;
alter table public.results disable row level security;
alter table public.site_visits disable row level security;
alter table public.students disable row level security;
alter table public.subjects disable row level security;
alter table public.submission_answers disable row level security;
alter table public.submissions disable row level security;
alter table public.topics disable row level security;
alter table public.user_packages disable row level security;
