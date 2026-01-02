//auth/callback/page.tsx
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
        console.log('🔄 Handling Supabase OAuth callback...');

        // ✅ Use onAuthStateChange or getSession
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          toast.error('Login failed. Please try again.');
          router.replace('/auth/login');
          return;
        }

        const user = session.user;
        console.log('✅ OAuth callback user:', user);

        // Ensure profile exists
        await supabase
  .from('profiles')
  .upsert(
    {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.name ?? 'New User',
      role: 'teacher',
      login_method: 'google',
      trial_ends_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      trial_given: false,
    },
    { onConflict: 'id' }
  );

        // Get role via RPC
        const { data: roleData, error: rpcError } = await supabase.rpc('get_user_role', { user_id: user.id });

        if (rpcError || !roleData) {
          console.error('❌ Error fetching role:', rpcError);
          toast.error('Unable to determine user role.');
          await supabase.auth.signOut();
          router.replace('/auth/login');
          return;
        }

        console.log('🎯 User role:', roleData);

        // Set cookie
        Cookies.set('role', roleData, { expires: 7, path: '/' });

        // Redirect
        if (roleData === 'admin' || roleData === 'super_admin') {
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
