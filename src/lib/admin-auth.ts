// src/lib/admin-auth.ts
'use client';

import { createBrowserClient } from '@supabase/ssr';

// Single browser client instance — reuse across calls in the same session
function getBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Client-side: checks if the current user has admin access.
 * Redirects via router if provided and access is denied.
 */
export const checkAdminAccess = async (router?: any): Promise<boolean> => {
  try {
    const supabase = getBrowserClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/auth/login';
      return false;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !profile?.role) {
      console.error('Error fetching user role:', error);
      return false;
    }

    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      router?.push('/unauthorized');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking admin access:', error);
    return false;
  }
};

/**
 * Client-side: gets the current user's role from their profile.
 */
export const getUserRole = async (): Promise<string | null> => {
  try {
    const supabase = getBrowserClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !profile?.role) {
      console.error('Error fetching user role:', error);
      return null;
    }

    return profile.role;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
};

/**
 * Server-side admin check — import and call from Server Components or API routes.
 * Prefer using requireRole() from api-auth.ts in Route Handlers instead.
 */
export const checkAdminAccessServer = async (): Promise<boolean> => {
  // Dynamically import server-only modules to keep this file client-safe
  const { getCurrentSession } = await import('@/lib/session');
  const { supabaseAdmin } = await import('@/lib/supabaseAdmin');

  try {
    const user = await getCurrentSession();
    if (!user) return false;

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !profile?.role) return false;

    return profile.role === 'admin' || profile.role === 'super_admin';
  } catch (error) {
    console.error('Error checking admin access (server):', error);
    return false;
  }
};