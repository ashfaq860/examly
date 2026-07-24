// src/lib/api-auth.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Internal: build a server client using @supabase/ssr.
// Reads cookies in the same format createBrowserClient writes them,
// fixing the PKCE verifier mismatch that caused AuthPKCECodeVerifierMissingError.
// ---------------------------------------------------------------------------
async function buildServerClient(): Promise<SupabaseClient> {
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
            // Read-only context (Server Component) — ignore
          }
        },
      },
    }
  );
}

type AuthSuccess = { user: User; supabase: SupabaseClient; error: null };
type AuthError   = { user: null; supabase: null; error: NextResponse };

type RoleSuccess = { user: User; role: string; supabase: SupabaseClient; error: null };
type RoleError   = { user: null; role: null; supabase: null; error: NextResponse };

// ---------------------------------------------------------------------------
// getSessionFromRequest
// Verifies the caller is authenticated via JWT. Returns User or 401.
// Uses getUser() — validates server-side without writing cookies.
// ---------------------------------------------------------------------------
export async function getSessionFromRequest(): Promise<AuthSuccess | AuthError> {
  const supabase = await buildServerClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      supabase: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { user, supabase, error: null };
}

// ---------------------------------------------------------------------------
// requireRole
// Verifies authentication AND role. Uses supabaseAdmin to bypass RLS.
// Returns User + role + client, or a 401/403 response.
// ---------------------------------------------------------------------------
export async function requireRole(allowedRoles: string[]): Promise<RoleSuccess | RoleError> {
  const supabase = await buildServerClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null, role: null, supabase: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // Use supabaseAdmin to fetch role — bypasses RLS, avoids false 403s
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.role) {
    return {
      user: null, role: null, supabase: null,
      error: NextResponse.json({ error: 'Failed to verify role' }, { status: 500 }),
    };
  }

  const role = profile.role as string;

  if (!allowedRoles.includes(role)) {
    return {
      user: null, role: null, supabase: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { user, role, supabase, error: null };
}