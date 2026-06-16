// src/app/auth/session/page.tsx
// Fallback handler — if the callback couldn't exchange the code server-side,
// the client tries to recover the session from whatever Supabase stored.
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
        // onAuthStateChange fires when Supabase processes the fragment
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
              subscription.unsubscribe();
              setStatus('Verifying your account…');
              await resolveAndRedirect(session.user.id, supabase);
            }
          }
        );

        // Also check immediately in case session is already set
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          subscription.unsubscribe();
          setStatus('Verifying your account…');
          await resolveAndRedirect(session.user.id, supabase);
          return;
        }

        // After 5 seconds with no session, give up
        setTimeout(() => {
          subscription.unsubscribe();
          router.replace('/auth/login?error=auth_failed');
        }, 5000);

      } catch (err) {
        console.error('Session page error:', err);
        router.replace('/auth/login?error=auth_failed');
      }
    };

    handle();
  }, [router]);

  async function resolveAndRedirect(
    userId: string,
    supabase: ReturnType<typeof createSupabaseBrowserClient>
  ) {
    let role: string | null = null;

    try {
      const res = await fetch('/api/auth/get-role');
      if (res.ok) {
        const body = await res.json();
        role = body.role ?? null;
      }
    } catch {}

    if (!role) {
      const { data } = await supabase
        .from('profiles').select('role').eq('id', userId).maybeSingle();
      role = data?.role ?? null;
    }

    if (!role || !ALLOWED_ROLES.includes(role as UserRole)) {
      router.replace('/auth/login?error=unauthorized_role');
      return;
    }

    Cookies.set('role', role, { expires: 7, path: '/' });
    router.replace(role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard');
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', minHeight: '100vh',
      gap: '1rem'
    }}>
      <div className="spinner-border text-primary" role="status" />
      <p className="text-muted mb-0">{status}</p>
    </div>
  );
}