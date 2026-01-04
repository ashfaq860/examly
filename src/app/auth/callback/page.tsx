'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

export default function GoogleCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // Wait for Supabase to finish processing OAuth redirect
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          toast.error('Login failed. Please try again.');
          router.replace('/auth/login');
          return;
        }

        const user = session.user;

        // 1️⃣ Call API to create profile if not exists and get referral code
        const profileRes = await fetch('/api/auth/google-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            full_name: user.user_metadata?.name || '',
            email: user.email,
          }),
        });

        const profileData = await profileRes.json();

        if (!profileRes.ok) {
          toast.error(profileData.error || 'Profile setup failed');
          await supabase.auth.signOut();
          router.replace('/auth/login');
          return;
        }

        // 2️⃣ Fetch user role from Supabase RPC
        const { data: roleData, error: roleError } = await supabase
          .rpc('get_user_role', { user_id: user.id });

        if (roleError || !roleData) {
          toast.error('Unable to verify role. Please contact support.');
          await supabase.auth.signOut();
          router.replace('/auth/login');
          return;
        }

        const role: string = roleData;

        // 3️⃣ Save role cookie
        Cookies.set('role', role, { expires: 7, path: '/' });

        // 4️⃣ Redirect based on role
        if (role === 'admin') {
          toast.success('Welcome back, Admin! 👑');
          router.replace('/admin');
        } else {
          toast.success('Welcome back, Teacher! 🎓');
          router.replace('/dashboard');
        }

      } catch (err) {
        console.error('Google callback error:', err);
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
      <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      <p className="text-muted">Completing sign-in… please wait</p>
    </div>
  );
}
