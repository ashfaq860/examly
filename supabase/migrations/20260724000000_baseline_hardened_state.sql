-- Migration 0001: baseline snapshot of the security-hardening pass applied
-- directly via the Supabase SQL editor after the breach (this repo had no
-- migration history for it at all). This captures the DELTA that hardened
-- an already-existing schema — RLS + policies, SECURITY DEFINER helpers,
-- EXECUTE grants/revokes, storage bucket privacy, and the Free Trial
-- package row. It assumes the 25 base tables already exist (their CREATE
-- TABLE history was never tracked here either, and reconstructing it is a
-- separate, larger effort than this security pass covers). Running this
-- against a database that already has these objects (e.g. production) is
-- safe for the CREATE OR REPLACE FUNCTION and GRANT/REVOKE statements
-- (idempotent by nature) but the CREATE POLICY / ENABLE ROW LEVEL SECURITY
-- statements are NOT idempotent — they are meant for provisioning a fresh
-- environment (a new dev/staging project) from the same base schema, not
-- for re-running against prod.

-- ============================================================
-- 1. ROW LEVEL SECURITY + POLICIES
-- ============================================================

alter table public.academies enable row level security;
alter table public.academy_members enable row level security;
alter table public.chapter_question_rules enable row level security;
alter table public.chapters enable row level security;
alter table public.checker_grading_calls enable row level security;
alter table public.class_subjects enable row level security;
alter table public.classes enable row level security;
alter table public.packages enable row level security;
alter table public.paper_layout_maps enable row level security;
alter table public.paper_questions enable row level security;
alter table public.paper_templates enable row level security;
alter table public.papers enable row level security;
alter table public.payments enable row level security;
alter table public.profiles enable row level security;
alter table public.question_categories enable row level security;
alter table public.questions enable row level security;
alter table public.referrals enable row level security;
alter table public.results enable row level security;
alter table public.site_visits enable row level security;
alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.submission_answers enable row level security;
alter table public.submissions enable row level security;
alter table public.topics enable row level security;
alter table public.user_packages enable row level security;

create policy "Insert own academies" on public.academies
  as permissive for INSERT
  to public
  with check ((auth.uid() = owner_id));

create policy "Select own academies" on public.academies
  as permissive for SELECT
  to public
  using ((auth.uid() = owner_id));

create policy "Update own academies" on public.academies
  as permissive for UPDATE
  to public
  using ((auth.uid() = owner_id));

create policy "academy_members_admin_write" on public.academy_members
  as permissive for ALL
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "academy_members_read" on public.academy_members
  as permissive for SELECT
  to authenticated
  using (((user_id = auth.uid()) OR (academy_id IN ( SELECT my_academy_ids() AS my_academy_ids)) OR is_admin()));

create policy "chapter_question_rules_admin_write" on public.chapter_question_rules
  as permissive for ALL
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "chapter_question_rules_read" on public.chapter_question_rules
  as permissive for SELECT
  to authenticated
  using (true);

create policy "chapters_admin_write" on public.chapters
  as permissive for ALL
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "chapters_read" on public.chapters
  as permissive for SELECT
  to authenticated
  using (true);

create policy "cgc_admin_read" on public.checker_grading_calls
  as permissive for SELECT
  to authenticated
  using (is_admin());

create policy "class_subjects_admin_write" on public.class_subjects
  as permissive for ALL
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "class_subjects_read" on public.class_subjects
  as permissive for SELECT
  to authenticated
  using (true);

create policy "classes_admin_write" on public.classes
  as permissive for ALL
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "classes_read" on public.classes
  as permissive for SELECT
  to authenticated
  using (true);

create policy "Enable read access for all users" on public.packages
  as permissive for SELECT
  to authenticated
  using ((is_active = true));

create policy "read active packages" on public.packages
  as permissive for SELECT
  to authenticated
  using ((is_active = true));

create policy "paper_layout_maps_select_owner" on public.paper_layout_maps
  as permissive for SELECT
  to public
  using (owns_paper(paper_id));

create policy "paper_questions_own" on public.paper_questions
  as permissive for ALL
  to authenticated
  using ((is_admin() OR owns_paper(paper_id)))
  with check ((is_admin() OR owns_paper(paper_id)));

create policy "paper_templates_read" on public.paper_templates
  as permissive for SELECT
  to authenticated
  using ((is_public OR (created_by = auth.uid()) OR is_admin()));

create policy "paper_templates_write" on public.paper_templates
  as permissive for ALL
  to authenticated
  using (((created_by = auth.uid()) OR is_admin()))
  with check (((created_by = auth.uid()) OR is_admin()));

create policy "Admins can read all papers" on public.papers
  as permissive for SELECT
  to public
  using ((auth.uid() IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))));

create policy "own papers" on public.papers
  as permissive for ALL
  to authenticated
  using ((created_by = auth.uid()))
  with check ((created_by = auth.uid()));

create policy "papers_select_owner" on public.papers
  as permissive for SELECT
  to public
  using ((created_by = auth.uid()));

create policy "own payments read" on public.payments
  as permissive for SELECT
  to authenticated
  using ((user_id = auth.uid()));

create policy "Authenticated users can read own role" on public.profiles
  as permissive for SELECT
  to authenticated
  using ((auth.uid() = id));

create policy "Enable read for users based on id" on public.profiles
  as permissive for SELECT
  to public
  using ((auth.uid() = id));

create policy "Enable update for users based on id" on public.profiles
  as permissive for UPDATE
  to public
  using ((auth.uid() = id));

create policy "Users can select own profile" on public.profiles
  as permissive for SELECT
  to authenticated
  using ((auth.uid() = id));

create policy "Users can update own profile" on public.profiles
  as permissive for UPDATE
  to authenticated
  using ((auth.uid() = id))
  with check ((auth.uid() = id));

create policy "profiles_admin_all" on public.profiles
  as permissive for ALL
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "profiles_insert_self" on public.profiles
  as permissive for INSERT
  to authenticated
  with check (((id = auth.uid()) AND (role = 'teacher'::text)));

create policy "question_categories_admin_write" on public.question_categories
  as permissive for ALL
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "question_categories_read" on public.question_categories
  as permissive for SELECT
  to authenticated
  using (true);

create policy "admin write" on public.questions
  as permissive for ALL
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));

create policy "read for authenticated" on public.questions
  as permissive for SELECT
  to authenticated
  using (true);

create policy "referrals_read" on public.referrals
  as permissive for SELECT
  to authenticated
  using (((referrer_id = auth.uid()) OR (referred_user_id = auth.uid()) OR is_admin()));

create policy "results_own" on public.results
  as permissive for ALL
  to authenticated
  using (((user_id = auth.uid()) OR is_admin()))
  with check (((user_id = auth.uid()) OR is_admin()));

create policy "sv_admin_read" on public.site_visits
  as permissive for SELECT
  to authenticated
  using (is_admin());

create policy "sv_insert" on public.site_visits
  as permissive for INSERT
  to anon, authenticated
  with check (true);

create policy "students_select_owner" on public.students
  as permissive for SELECT
  to public
  using ((owner_id = auth.uid()));

create policy "subjects_admin_write" on public.subjects
  as permissive for ALL
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "subjects_read" on public.subjects
  as permissive for SELECT
  to authenticated
  using (true);

create policy "submission_answers_select_owner" on public.submission_answers
  as permissive for SELECT
  to public
  using (owns_submission(submission_id));

create policy "submissions_select_owner" on public.submissions
  as permissive for SELECT
  to public
  using (((uploaded_by = auth.uid()) OR owns_paper(paper_id)));

create policy "topics_admin_write" on public.topics
  as permissive for ALL
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "topics_read" on public.topics
  as permissive for SELECT
  to authenticated
  using (true);

create policy "Users can view own packages" on public.user_packages
  as permissive for SELECT
  to authenticated
  using ((auth.uid() = user_id));

-- ============================================================
-- 2. STORAGE: bucket privacy + storage.objects policies
-- ============================================================

update storage.buckets set public = false where id = 'generated-papers';
update storage.buckets set public = false where id = 'key';
update storage.buckets set public = true where id = 'profile_logo';
update storage.buckets set public = false where id = 'submission-scans';

create policy "generated_papers_own_read" on storage.objects
  as permissive for SELECT
  to authenticated
  using (((bucket_id = 'generated-papers'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "generated_papers_own_write" on storage.objects
  as permissive for INSERT
  to authenticated
  with check (((bucket_id = 'generated-papers'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "key_own_read" on storage.objects
  as permissive for SELECT
  to authenticated
  using (((bucket_id = 'key'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "key_own_write" on storage.objects
  as permissive for INSERT
  to authenticated
  with check (((bucket_id = 'key'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "own generated papers" on storage.objects
  as permissive for SELECT
  to authenticated
  using (((bucket_id = 'generated-papers'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "own keys" on storage.objects
  as permissive for SELECT
  to authenticated
  using (((bucket_id = 'key'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "profile_logo_own_write" on storage.objects
  as permissive for ALL
  to authenticated
  using (((bucket_id = 'profile_logo'::text) AND (name ~~ ((auth.uid())::text || '-%'::text))))
  with check (((bucket_id = 'profile_logo'::text) AND (name ~~ ((auth.uid())::text || '-%'::text))));

-- ============================================================
-- 3. SECURITY DEFINER HELPER FUNCTIONS + all other live functions
-- (verbatim CREATE OR REPLACE — reproduced exactly from production
-- via pg_get_functiondef, so behavior cannot drift from what is
-- actually deployed)
-- ============================================================

-- can_add_member (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.can_add_member(p_academy_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current_members integer;
  v_seats integer;
begin
  select count(*) into v_current_members
  from academy_members
  where academy_id = p_academy_id;

  select p.seats into v_seats
  from academies a
  join user_packages up
    on up.user_id = a.owner_id
   and up.is_active = true
   and (up.expires_at is null or up.expires_at > now())
  join packages p on p.id = up.package_id
  where a.id = p_academy_id
  order by p.seats desc
  limit 1;

  if v_seats is null then
    return false;  -- no active package on the academy owner
  end if;

  return v_current_members < v_seats;
end;
$function$;

-- consume_scan (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.consume_scan(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_up_id uuid;
begin
  select user_package_id into v_up_id
  from get_active_package(p_user_id)
  where 'paper_checker' = any(features)
    and (scans_remaining is null or scans_remaining > 0);

  if v_up_id is null then
    return false;  -- no checker access or quota exhausted
  end if;

  update user_packages
  set scans_remaining = scans_remaining - 1
  where id = v_up_id
    and scans_remaining is not null;

  return true;
end;
$function$;

-- get_active_package (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_active_package()
 RETURNS TABLE(user_package_id uuid, package_id uuid, features text[], papers_remaining integer, scans_remaining integer, via_academy uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public.get_active_package(auth.uid());
$function$;

-- get_active_package (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_active_package(p_user_id uuid)
 RETURNS TABLE(user_package_id uuid, package_id uuid, features text[], papers_remaining integer, scans_remaining integer, via_academy uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Personal package first
  select up.id, up.package_id, p.features, up.papers_remaining, up.scans_remaining,
         null::uuid
  from user_packages up
  join packages p on p.id = up.package_id
  where up.user_id = p_user_id
    and up.is_active = true
    and (up.expires_at is null or up.expires_at > now())
  union all
  -- Academy owner's package, inherited via membership
  select up.id, up.package_id, p.features, up.papers_remaining, up.scans_remaining,
         am.academy_id
  from academy_members am
  join academies a on a.id = am.academy_id
  join user_packages up on up.user_id = a.owner_id
  join packages p on p.id = up.package_id
  where am.user_id = p_user_id
    and am.member_role <> 'owner'          -- owner already covered above
    and up.is_active = true
    and (up.expires_at is null or up.expires_at > now())
  limit 1;
$function$;

-- get_user_role (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role
  from public.profiles
  where id = auth.uid();
$function$;

-- get_user_trial_status (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_user_trial_status(user_id uuid)
 RETURNS TABLE(istrial boolean, trialendsat timestamp without time zone, daysremaining integer, hasactivesubscription boolean, papersgenerated integer, papersremaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  profile_record profiles%ROWTYPE;
  default_trial_end timestamp;
BEGIN
  -- Set default trial end (7 days from now)
  default_trial_end := NOW() + INTERVAL '7 days';
  
  -- Get user profile
  SELECT * INTO profile_record 
  FROM profiles 
  WHERE id = user_id;
  
  -- If no profile found, return default values
  IF NOT FOUND THEN
    isTrial := false;
    trialEndsAt := NULL;
    daysRemaining := 0;
    hasActiveSubscription := false;
    papersGenerated := 0;
    papersRemaining := 0;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Handle null trial_ends_at by setting a default
  IF profile_record.trial_ends_at IS NULL THEN
    -- Update the profile with default trial period
    UPDATE profiles 
    SET trial_ends_at = default_trial_end
    WHERE id = user_id
    RETURNING trial_ends_at INTO profile_record.trial_ends_at;
  END IF;
  
  -- Calculate trial status
  isTrial := profile_record.trial_ends_at > NOW();
  trialEndsAt := profile_record.trial_ends_at;
  daysRemaining := CASE 
    WHEN profile_record.trial_ends_at IS NOT NULL THEN 
      GREATEST(0, EXTRACT(DAY FROM profile_record.trial_ends_at - NOW()))
    ELSE 0
  END;
  
  hasActiveSubscription := COALESCE(profile_record.subscription_status, 'inactive') = 'active';
  papersGenerated := COALESCE(profile_record.papers_generated, 0);
  papersRemaining := CASE 
    WHEN isTrial THEN 
      GREATEST(0, 5 - papersGenerated)
    ELSE 0
  END;
  
  RETURN NEXT;
END;
$function$;

-- get_visit_stats (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_visit_stats(days_back integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller_role text;
  start_date timestamptz := now() - (days_back || ' days')::interval;
  result jsonb;
BEGIN
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' AND caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'total_visits', (
      SELECT count(*) FROM site_visits WHERE created_at >= start_date
    ),
    'unique_visitors', (
      SELECT count(DISTINCT visitor_id) FROM site_visits WHERE created_at >= start_date
    ),
    'daily', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'visits', visits, 'unique_visitors', uniques) ORDER BY day), '[]'::jsonb)
      FROM (
        SELECT to_char(created_at, 'YYYY-MM-DD') AS day,
               count(*) AS visits,
               count(DISTINCT visitor_id) AS uniques
        FROM site_visits
        WHERE created_at >= start_date
        GROUP BY to_char(created_at, 'YYYY-MM-DD')
      ) daily_stats
    ),
    'top_pages', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('path', path, 'visits', visits) ORDER BY visits DESC), '[]'::jsonb)
      FROM (
        SELECT path, count(*) AS visits
        FROM site_visits
        WHERE created_at >= start_date
        GROUP BY path
        ORDER BY count(*) DESC
        LIMIT 10
      ) pages
    ),
    'top_referrers', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('referrer', referrer_host, 'visits', visits) ORDER BY visits DESC), '[]'::jsonb)
      FROM (
        SELECT
          CASE
            WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
            ELSE regexp_replace(referrer, '^https?://([^/]+).*$', '\1')
          END AS referrer_host,
          count(*) AS visits
        FROM site_visits
        WHERE created_at >= start_date
        GROUP BY referrer_host
        ORDER BY count(*) DESC
        LIMIT 10
      ) refs
    ),
    'device_breakdown', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('device_type', device_type, 'visits', visits)), '[]'::jsonb)
      FROM (
        SELECT coalesce(device_type, 'desktop') AS device_type, count(*) AS visits
        FROM site_visits
        WHERE created_at >= start_date
        GROUP BY coalesce(device_type, 'desktop')
      ) devices
    )
  ) INTO result;

  RETURN result;
END;
$function$;

-- grant_trial (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.grant_trial(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pkg packages%ROWTYPE;
BEGIN
  IF EXISTS (SELECT 1 FROM user_packages
             WHERE user_id = p_user AND is_trial = true) THEN RETURN; END IF;

  SELECT * INTO pkg FROM packages WHERE name = 'Free Trial' AND is_active LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO user_packages (user_id, package_id, papers_remaining, scans_remaining,
                             scans_period_ends_at, expires_at, is_trial, is_active)
  VALUES (p_user, pkg.id, pkg.paper_quantity, pkg.scan_quantity,
          now() + interval '1 month',
          now() + (pkg.duration_days || ' days')::interval, true, true);
END $function$;

-- handle_mobile_verified_rewards (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.handle_mobile_verified_rewards()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  referrer_id uuid;
  referrer_has_subscription boolean;
BEGIN
  PERFORM set_config('app.trusted_write', 'on', true);

  IF OLD.cellno IS NOT NULL OR NEW.cellno IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.trial_given = false THEN
    UPDATE profiles
       SET trial_given = true,
           subscription_status = 'active',
           trial_ends_at = now() + interval '180 days'
     WHERE id = NEW.id;
  END IF;

  IF NEW.referred_by_code IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO referrer_id FROM profiles
   WHERE referral_code = NEW.referred_by_code LIMIT 1;

  IF referrer_id IS NULL OR referrer_id = NEW.id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM referrals
              WHERE referred_user_id = NEW.id AND reward_given = true) THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_packages up
      JOIN packages p ON p.id = up.package_id
     WHERE up.user_id = referrer_id AND up.is_active = true
       AND p.type = 'subscription'
  ) INTO referrer_has_subscription;

  IF referrer_has_subscription THEN
    UPDATE user_packages
       SET expires_at = COALESCE(expires_at, now()) + interval '30 days'
     WHERE user_id = referrer_id AND is_active = true;
  ELSE
    UPDATE profiles
       SET trial_given = true,
           subscription_status = 'active',
           trial_ends_at = COALESCE(trial_ends_at, now()) + interval '30 days'
     WHERE id = referrer_id;
  END IF;

  INSERT INTO referrals (referrer_id, referred_user_id, reward_given, rewarded_at)
  VALUES (referrer_id, NEW.id, true, now())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $function$;

-- has_feature (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_feature(p_feature text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_feature(auth.uid(), p_feature);
$function$;

-- has_feature (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_feature(p_user_id uuid, p_feature text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from get_active_package(p_user_id)
    where p_feature = any(features)
  );
$function$;

-- increment_papers_generated (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.increment_papers_generated(user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE profiles 
  SET papers_generated = COALESCE(papers_generated, 0) + 1,
      updated_at = NOW()
  WHERE id = user_id;
END;
$function$;

-- is_admin (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE id = auth.uid() AND role IN ('admin','super_admin'));
$function$;

-- my_academy_ids (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.my_academy_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT academy_id FROM public.academy_members WHERE user_id = auth.uid();
$function$;

-- owns_paper (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.owns_paper(check_paper_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.papers p
    WHERE p.id = check_paper_id AND p.created_by = auth.uid()
  );
$function$;

-- owns_submission (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.owns_submission(check_submission_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = check_submission_id
      AND (s.uploaded_by = auth.uid() OR public.owns_paper(s.paper_id))
  );
$function$;

-- protect_profile_columns (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(current_setting('app.trusted_write', true),'') = 'on'
     OR auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'teacher' THEN
      RAISE EXCEPTION 'Cannot self-assign role';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role                IS DISTINCT FROM OLD.role
     OR NEW.allowed_papers      IS DISTINCT FROM OLD.allowed_papers
     OR NEW.trial_given         IS DISTINCT FROM OLD.trial_given
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.trial_ends_at       IS DISTINCT FROM OLD.trial_ends_at
     OR (NEW.cellno IS DISTINCT FROM OLD.cellno AND OLD.cellno IS NOT NULL)
  THEN
    RAISE EXCEPTION 'Not permitted to modify entitlement or role fields';
  END IF;
  RETURN NEW;
END $function$;

-- ============================================================
-- 4. EXECUTE grants/revokes
-- Per the hardening spec: only these are callable from
-- anon/authenticated — everything else revoked to postgres/service_role only.
-- ============================================================

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;

revoke all on function public.get_user_role() from public;
grant execute on function public.get_user_role() to authenticated;
grant execute on function public.get_user_role() to service_role;

revoke all on function public.my_academy_ids() from public;
grant execute on function public.my_academy_ids() to authenticated;
grant execute on function public.my_academy_ids() to service_role;

revoke all on function public.owns_paper(uuid) from public;
grant execute on function public.owns_paper(uuid) to authenticated;
grant execute on function public.owns_paper(uuid) to service_role;

revoke all on function public.owns_submission(uuid) from public;
grant execute on function public.owns_submission(uuid) to authenticated;
grant execute on function public.owns_submission(uuid) to service_role;

revoke all on function public.can_add_member(uuid) from public;
grant execute on function public.can_add_member(uuid) to authenticated;
grant execute on function public.can_add_member(uuid) to service_role;

revoke all on function public.has_feature(text) from public;
grant execute on function public.has_feature(text) to authenticated;
grant execute on function public.has_feature(text) to service_role;

revoke all on function public.get_active_package() from public;
grant execute on function public.get_active_package() to authenticated;
grant execute on function public.get_active_package() to service_role;

revoke all on function public.consume_scan(uuid) from public, anon, authenticated;
grant execute on function public.consume_scan(uuid) to service_role;

revoke all on function public.increment_papers_generated(uuid) from public, anon, authenticated;
grant execute on function public.increment_papers_generated(uuid) to service_role;

revoke all on function public.get_visit_stats(integer) from public, anon, authenticated;
grant execute on function public.get_visit_stats(integer) to service_role;

revoke all on function public.get_user_trial_status(uuid) from public, anon, authenticated;
grant execute on function public.get_user_trial_status(uuid) to service_role;

revoke all on function public.get_user_papers_by_class(uuid) from public, anon, authenticated;
grant execute on function public.get_user_papers_by_class(uuid) to service_role;

revoke all on function public.get_user_papers_by_subject(uuid) from public, anon, authenticated;
grant execute on function public.get_user_papers_by_subject(uuid) to service_role;

revoke all on function public.get_user_questions_by_class(uuid) from public, anon, authenticated;
grant execute on function public.get_user_questions_by_class(uuid) to service_role;

revoke all on function public.get_user_questions_by_subject(uuid) from public, anon, authenticated;
grant execute on function public.get_user_questions_by_subject(uuid) to service_role;

revoke all on function public.grant_trial(uuid) from public, anon, authenticated;
grant execute on function public.grant_trial(uuid) to service_role;

revoke all on function public.has_feature(uuid, text) from public, anon, authenticated;
grant execute on function public.has_feature(uuid, text) to service_role;

revoke all on function public.get_active_package(uuid) from public, anon, authenticated;
grant execute on function public.get_active_package(uuid) to service_role;

-- ============================================================
-- 5. Free Trial package row (idempotent — already present in prod,
-- included so a fresh environment gets it too)
-- ============================================================

insert into public.packages (name, type, paper_quantity, duration_days, price, description, is_active, features, seats, scan_quantity, scan_reset_period)
select 'Free Trial', 'subscription', 50, 180, 0.00, null, true, ARRAY['paper_generation', 'paper_checker']::text[], 1, 2, 'monthly'
where not exists (select 1 from public.packages where name = 'Free Trial');
