/**
 * Shared server-side auth helpers for API route handlers.
 *
 * Usage:
 *   const { session, error } = await getSessionFromRequest();
 *   if (error) return error;
 *
 *   const { session, role, error } = await requireRole(['admin', 'super_admin']);
 *   if (error) return error;
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Internal: build a server Supabase client from the incoming request cookies
// ---------------------------------------------------------------------------
async function buildServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );
}

// ---------------------------------------------------------------------------
// getSessionFromRequest
// Returns the verified session or a 401 NextResponse.
// ---------------------------------------------------------------------------
export async function getSessionFromRequest(): Promise<
  | { session: Awaited<ReturnType<typeof buildServerClient>> extends infer C ? any : never; error: null }
  | { session: null; error: NextResponse }
> {
  const supabase = await buildServerClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { session, error: null };
}

// ---------------------------------------------------------------------------
// requireRole
// Returns the verified session + role, or a 401/403 NextResponse.
// ---------------------------------------------------------------------------
export async function requireRole(
  allowedRoles: string[]
): Promise<
  | { session: any; role: string; supabase: any; error: null }
  | { session: null; role: null; supabase: null; error: NextResponse }
> {
  const supabase = await buildServerClient();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return {
      session: null,
      role: null,
      supabase: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: roleData, error: rpcError } = await supabase.rpc(
    'get_user_role',
    { user_id: session.user.id }
  );

  if (rpcError) {
    return {
      session: null,
      role: null,
      supabase: null,
      error: NextResponse.json({ error: 'Failed to verify role' }, { status: 500 }),
    };
  }

  const role: string =
    typeof roleData === 'string'
      ? roleData
      : (roleData as any)?.role ?? '';

  if (!allowedRoles.includes(role)) {
    return {
      session: null,
      role: null,
      supabase: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { session, role, supabase, error: null };
}
