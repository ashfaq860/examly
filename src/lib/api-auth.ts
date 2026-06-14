/**
 * Shared server-side auth helpers for API route handlers.
 *
 * Uses the @supabase/ssr cookie-aware server client. Prefer getUser() for
 * verified auth checks instead of trusting the cookie payload from getSession().
 */

import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { User, SupabaseClient } from '@supabase/supabase-js';

async function buildRouteHandlerClient(): Promise<SupabaseClient> {
  return createSupabaseRouteHandlerClient();
}

type AuthSuccess = { user: User; error: null };
type AuthError = { user: null; error: NextResponse };

type RoleSuccess = { user: User; role: string; supabase: SupabaseClient; error: null };
type RoleError = { user: null; role: null; supabase: null; error: NextResponse };

export async function getSessionFromRequest(): Promise<AuthSuccess | AuthError> {
  const supabase = await buildRouteHandlerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { user, error: null };
}

export async function requireRole(allowedRoles: string[]): Promise<RoleSuccess | RoleError> {
  const supabase = await buildRouteHandlerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      role: null,
      supabase: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: roleData, error: rpcError } = await supabase.rpc(
    'get_user_role',
    { user_id: user.id }
  );

  if (rpcError) {
    return {
      user: null,
      role: null,
      supabase: null,
      error: NextResponse.json({ error: 'Failed to verify role' }, { status: 500 }),
    };
  }

  const role: string =
    typeof roleData === 'string'
      ? roleData
      : (roleData as { role: string } | null)?.role ?? '';

  if (!allowedRoles.includes(role)) {
    return {
      user: null,
      role: null,
      supabase: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { user, role, supabase, error: null };
}
