-- Adds site visit tracking for the admin analytics dashboard.
-- Run this against the live Supabase database (SQL editor or CLI) — this
-- project has no migrations pipeline, schema changes are applied by hand.

CREATE TABLE IF NOT EXISTS public.site_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL,
  user_id uuid,
  path text NOT NULL,
  referrer text,
  user_agent text,
  device_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_visits_pkey PRIMARY KEY (id),
  CONSTRAINT site_visits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS site_visits_created_at_idx ON public.site_visits (created_at);
CREATE INDEX IF NOT EXISTS site_visits_visitor_id_idx ON public.site_visits (visitor_id);
CREATE INDEX IF NOT EXISTS site_visits_path_idx ON public.site_visits (path);

-- No policies: RLS is enabled with zero grants, so only the service_role
-- key (which bypasses RLS) can read/write this table. Visits are only ever
-- written by middleware (service role) and only ever read by the admin
-- analytics API route (service role).
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

-- Aggregates visit stats for the last N days into one JSON payload so the
-- admin analytics API can fetch everything with a single round trip instead
-- of pulling potentially large numbers of raw rows into the app server.
--
-- SECURITY: SECURITY DEFINER functions are callable directly via PostgREST
-- with the anon/authenticated key, bypassing any app-level check — so this
-- function enforces its own admin check on auth.uid(), mirroring the guard
-- added in create_get_user_role_function.sql.
CREATE OR REPLACE FUNCTION get_visit_stats(days_back integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;
