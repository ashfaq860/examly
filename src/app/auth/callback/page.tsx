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
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          console.error('❌ Failed to retrieve session:', error);
          toast.error('Login failed. Please try again.');
          router.replace('/auth/login');
          return;
        }

        const user = session.user;
        console.log('✅ Auth callback user:', user);

        // 1️⃣ Try to get role via RPC
        let { data: roleData, error: rpcError } = await supabase.rpc('get_user_role', { user_id: user.id });

        // 2️⃣ If no profile found → Create a new one
        if (!roleData) {
          console.log('🆕 First login detected! Creating profile...');

          await supabase.from('profiles').insert({
            id: user.id,
            email: user.email,
            role: 'teacher', // default role
            expires_at: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 year free trial
            created_at: new Date()
          });

          // fetch role again after insert
          const retry = await supabase.rpc('get_user_role', { user_id: user.id });
          roleData = retry.data;
        }

        if (!roleData) {
          toast.error('Unable to determine user role.');
          await supabase.auth.signOut();
          router.replace('/auth/login');
          return;
        }

        console.log('🎯 User role determined:', roleData);
        Cookies.set('role', roleData, { expires: 7, path: '/' });

        // Redirect by role
        if (roleData === 'admin' || roleData === 'super_admin') {
          toast.success('Welcome back, Admin! 👑');
          router.replace('/admin');
        } else if (roleData === 'teacher' || roleData === 'academy') {
          toast.success('Welcome back, Teacher! 🎓');
          router.replace('/dashboard');
        } else {
          toast.error('Access denied: Unsupported role.');
          await supabase.auth.signOut();
          router.replace('/auth/login');
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
