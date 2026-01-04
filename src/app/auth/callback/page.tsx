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
    const handleAuth = async () => {
      try {
        console.log('🔄 Checking Supabase session after OAuth redirect...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          toast.error('Login failed. Please try again.');
          router.replace('/auth/login');
          return;
        }

        const user = session.user;
        console.log('✅ Auth callback user:', user);

        // ✅ Call server-side API to handle profile + role
        const res = await fetch('/api/profile/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user }),
        });

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Profile setup failed');
          await supabase.auth.signOut();
          router.replace('/auth/login');
          return;
        }

        console.log('🎯 Role returned from API:', data.role);

        // Set cookie
        Cookies.set('role', data.role, { expires: 7, path: '/' });

        // Redirect based on role
        if (data.role === 'admin' || data.role === 'super_admin') {
          toast.success('Welcome back, Admin! 👑');
          router.replace('/admin');
        } else {
          toast.success('Welcome back, Teacher! 🎓');
          router.replace('/dashboard');
        }

      } catch (err) {
        console.error('💥 Auth callback error:', err);
        toast.error('Unexpected error during login.');
        router.replace('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    handleAuth();
  }, [router, supabase]);

  return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100">
      {loading ? (
        <>
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Completing sign-in… please wait</p>
        </>
      ) : (
        <p className="text-muted">Redirecting…</p>
      )}
    </div>
  );
}
