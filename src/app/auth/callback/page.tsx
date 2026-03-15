'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const isProcessing = useRef(false); // Prevents double-processing in Strict Mode

  useEffect(() => {
    const handleAuth = async () => {
      if (isProcessing.current) return;
      isProcessing.current = true;

      try {
        // 1. Ensure we actually have a session from the URL hash/code
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          console.error("No session found:", sessionError);
          router.replace('/auth/login');
          return;
        }

        const user = session.user;

        // 2. Sync with your backend
        const res = await fetch('/api/auth/google-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
            email: user.email,
          }),
        });

        if (!res.ok) {
          throw new Error('Backend sync failed');
        }

        const data = await res.json();

        // 3. Set cookie and redirect
        Cookies.set('role', data.role, { expires: 7, path: '/' });

        if (data.role === 'admin' || data.role === 'super_admin') {
          toast.success('Welcome back, Admin 👑');
          router.push('/admin');
        } else {
          toast.success('Welcome back 🎓');
          router.push('/dashboard');
        }

      } catch (err) {
        console.error('Auth Callback Error:', err);
        toast.error('Authentication failed. Please try again.');
        router.replace('/auth/login');
      }
    };

    handleAuth();
  }, [router, supabase]);

  return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
}