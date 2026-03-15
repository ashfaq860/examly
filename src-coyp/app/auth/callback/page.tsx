'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {

      if (event !== 'SIGNED_IN' || !session?.user) return;

      const user = session.user;

      try {
        // Call backend to create profile if needed
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
          toast.error('Profile setup failed');
          await supabase.auth.signOut();
          router.replace('/auth/login');
          return;
        }

        const data = await res.json();

        Cookies.set('role', data.role, { expires: 7, path: '/' });

        if (data.role === 'admin' || data.role === 'super_admin') {
          toast.success('Welcome back, Admin 👑');
          router.replace('/admin');
        } else {
          toast.success('Welcome back 🎓');
          router.replace('/dashboard');
        }

      } catch (err) {
        console.error(err);
        toast.error('Unexpected error');
        router.replace('/auth/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <div className="spinner-border text-primary" />
    </div>
  );
}
