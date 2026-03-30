//app/auth/callback/page.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Cookies from 'js-cookie';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        try {
          const res = await fetch('/api/auth/google-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: session.user.id,
              email: session.user.email,
              full_name: session.user.user_metadata?.full_name,
            }),
          });

          const data = await res.json();
          Cookies.set('role', data.role, { expires: 7, path: '/' });
          
          // Redirect with full page reload to establish session properly
          window.location.href = data.role === 'admin' ? '/admin' : '/dashboard';
        } catch (err) {
          router.push('/auth/login?error=sync_failed');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  return <div>Loading...</div>;
}