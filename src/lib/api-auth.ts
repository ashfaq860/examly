/**
 * Shared server-side auth helpers for API route handlers.
 *
 * IMPORTANT — cookie format compatibility:
 * The client side uses @supabase/auth-helpers-nextjs which stores the session
 * in a chunked cookie format (sb-<ref>-auth-token.0, .1, …).
 * @supabase/ssr uses a different single-cookie format and cannot read what
 * auth-helpers writes — causing getUser() to always return null (401).
 *
 * Solution: use createRouteHandlerClient from @supabase/auth-helpers-nextjs
 * (same library as the client) so the cookie format matches, but call
 * getUser() instead of getSession() to avoid the cookie-clearing bug where
 * getSession() tries to write a refreshed token and fails silently in a
 * Route Handler, clearing the auth cookie with Max-Age=0.
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Internal: build a route handler client using auth-helpers-nextjs.
// This reads cookies in the same chunked format the client writes them.
// ---------------------------------------------------------------------------
async function buildRouteHandlerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createRouteHandlerClient({ cookies: () => cookieStore });
}

type AuthSuccess = { user: User; error: null };
type AuthError   = { user: null; error: NextResponse };

type RoleSuccess = { user: User; role: string; supabase: SupabaseClient; error: null };
type RoleError   = { user: null; role: null; supabase: null; error: NextResponse };

// ---------------------------------------------------------------------------
// getSessionFromRequest
// Verifies the caller is authenticated. Returns the User or a 401 response.
// Uses getUser() — validates the JWT server-side without writing cookies.
// ---------------------------------------------------------------------------
export async function getSessionFromRequest(): Promise<AuthSuccess | AuthError> {
  const supabase = await buildRouteHandlerClient();

  // getUser() makes a network call to Supabase to verify the JWT.
  // Unlike getSession(), it does NOT attempt to refresh or write cookies,
  // so it is safe to call from any Route Handler.
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { user, error: null };
}

// ---------------------------------------------------------------------------
// requireRole
// Verifies the caller is authenticated AND has one of the allowed roles.
// Returns the User + role, or a 401/403 response.
// ---------------------------------------------------------------------------
export async function requireRole(allowedRoles: string[]): Promise<RoleSuccess | RoleError> {
  const supabase = await buildRouteHandlerClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null, role: null, supabase: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: roleData, error: rpcError } = await supabase.rpc(
    'get_user_role',
    { user_id: user.id }
  );

  if (rpcError) {
    return {
      user: null, role: null, supabase: null,
      error: NextResponse.json({ error: 'Failed to verify role' }, { status: 500 }),
    };
  }

  const role: string =
    typeof roleData === 'string'
      ? roleData
      : (roleData as { role: string } | null)?.role ?? '';

  if (!allowedRoles.includes(role)) {
    return {
      user: null, role: null, supabase: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { user, role, supabase, error: null };
}
