// src/app/auth/session/page.tsx
// Reads tokens from the sb-temp-session cookie set by /auth/callback,
// calls setSession() so Supabase JS stores them in its own chunked format,
// then redirects to the correct page.
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import Cookies from 'js-cookie';

// 1. Move the core logic into a component that reads the search parameters safely
function SessionHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Completing sign in…');

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const handle = async () => {
      try {
        // Read the temp session cookie via API route
        const res = await fetch('/api/auth/temp-session', { method: 'GET' });

        if (!res.ok) {
          console.error('No temp session found');
          router.replace('/auth/login?error=auth_failed');
          return;
        }

        const { access_token, refresh_token, role } = await res.json();

        setStatus('Establishing session…');

        // setSession() makes Supabase JS write the tokens in its own
        // chunked cookie format — this is the correct way to set the session
        const { data: { session }, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error || !session) {
          console.error('setSession error:', error);
          router.replace('/auth/login?error=auth_failed');
          return;
        }

        // Set role cookie client-side too (in case server cookie wasn't read)
        Cookies.set('role', role, { expires: 7, path: '/' });

        setStatus('Redirecting…');

        const to = searchParams.get('to') ?? (
          role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard'
        );

        router.replace(to);

      } catch (err) {
        console.error('Session page error:', err);
        router.replace('/auth/login?error=auth_failed');
      }
    };

    handle();
  }, [router, searchParams]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: '1rem',
    }}>
      <div className="spinner-border text-primary" role="status" />
      <p className="text-muted mb-0">{status}</p>
    </div>
  );
}

// 2. Wrap the handler component inside a Suspense boundary as required by Next.js 15
export default function AuthSessionPage() {
  return (
    <Suspense 
      fallback={
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: '1rem',
        }}>
          <div className="spinner-border text-primary" role="status" />
          <p className="text-muted mb-0">Loading setup...</p>
        </div>
      }
    >
      <SessionHandler />
    </Suspense>
  );
}