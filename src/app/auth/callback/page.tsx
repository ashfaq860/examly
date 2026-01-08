// app/auth/callback/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subscription = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const user = session.user;

          // Call backend API to create profile + referral
          const res = await fetch('/api/auth/google-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              full_name: user.user_metadata?.name || '',
              email: user.email,
            }),
          });

          if (!res.ok) {
            const text = await res.text();
            console.error('Google callback failed:', res.status, text);
            toast.error('Profile setup failed. Please try again.');
            await supabase.auth.signOut();
            router.replace('/auth/login');
            return;
          }

          const data = await res.json();

          // Save role in cookies
          Cookies.set('role', data.role, { expires: 7, path: '/' });

          // Redirect based on role
          if (data.role === 'admin' || data.role === 'super_admin') {
            toast.success('Welcome back, Admin 👑');
            router.replace('/admin');
          } else {
            toast.success('Welcome back 🎓');
            router.replace('/dashboard');
          }

        } catch (err) {
          console.error('Auth callback error:', err);
          toast.error('Unexpected error during login.');
          router.replace('/auth/login');
        } finally {
          setLoading(false);
        }
      }
    });

    // Cleanup subscription on unmount
    return () => subscription.data?.unsubscribe();
  }, [router, supabase]);

  return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100">
      <div
        className="spinner-border text-primary mb-3"
        role="status"
        style={{ width: '3rem', height: '3rem' }}
      >
        <span className="visually-hidden">Loading...</span>
      </div>
      <p className="text-muted">Completing sign-in… please wait</p>
    </div>
  );
}
