// src/lib/supabase/server.ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client using @supabase/ssr.
 * Standard user client that honors RLS constraints via cookie forwarding.
 */
export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies are read-only, ignore
          }
        },
      },
    }
  );
};

/**
 * Admin-level Supabase client using the Service Role Key.
 * Bypasses Row-Level Security entirely. Use ONLY on secure server contexts.
 */
export const createSupabaseAdminClient = async () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Ensure this is defined in your .env.local file
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
};