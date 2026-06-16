// src/app/auth/session/page.tsx
// Client-side session handler for implicit OAuth flow.
// Supabase puts the access_token in the URL fragment (#access_token=...).
// This page reads it, lets the Supabase client establish the session,
// then fetches the role and redirects to the correct page.
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import Cookies from 'js-cookie';

const ALLOWED_ROLES = ['teacher', 'admin', 'super_admin', 'academy'] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

export default function AuthSessionPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Completing sign in…');

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const handle = async () => {
      try {
        // Give Supabase JS time to parse the fragment and set the session cookie
        await new Promise(resolve => setTimeout(resolve, 800));

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session?.user) {
          console.error('No session after OAuth:', error);
          router.replace('/auth/login?error=auth_failed');
          return;
        }

        setStatus('Verifying your account…');

        // Try API first (server-side, bypasses RLS)
        let role: string | null = null;
        try {
          const res = await fetch('/api/auth/get-role');
          if (res.ok) {
            const body = await res.json();
            role = body.role ?? null;
          }
        } catch {}

        // Fallback: direct client query
        if (!role) {
          const { data } = await supabase
            .from('profiles').select('role')
            .eq('id', session.user.id).maybeSingle();
          role = data?.role ?? null;
        }

        if (!role || !ALLOWED_ROLES.includes(role as UserRole)) {
          router.replace('/auth/login?error=unauthorized_role');
          return;
        }

        Cookies.set('role', role, { expires: 7, path: '/' });
        router.replace(role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard');

      } catch (err) {
        console.error('Session page error:', err);
        router.replace('/auth/login?error=auth_failed');
      }
    };

    handle();
  }, [router]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', minHeight: '100vh'
    }}>
      <div className="spinner-border text-primary mb-3" role="status" />
      <p className="text-muted">{status}</p>
    </div>
  );
}