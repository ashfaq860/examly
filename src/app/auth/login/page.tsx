'use client';
import { useState, useEffect } from 'react';
import AuthLayout from '@/components/AuthLayout';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  // ✅ Redirect if already logged in (commented out intentionally)
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: roleData } = await supabase.rpc('get_user_role', { user_id: session.user.id });
        if (roleData === 'admin' || roleData === 'super_admin') router.replace('/admin');
        else if (roleData === 'teacher' || roleData === 'academy') router.replace('/dashboard');
      }
    };
    //checkUser();
  }, [router, supabase]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setErr('User ID not found');
        setLoading(false);
        return;
      }

      const { data: roleData, error: rpcError } = await supabase
        .rpc('get_user_role', { user_id: userId });

      if (rpcError || !roleData) {
        setErr('Unable to verify user role. Please contact support.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      handleRoleRedirect(roleData);
    } catch (catchError) {
      console.error('💥 Unexpected error:', catchError);
      setErr('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleRedirect = (role: string) => {
    const allowedRoles = ['teacher', 'admin', 'academy'];
    if (!allowedRoles.includes(role)) {
      setErr('Access denied: Your role cannot access this portal.');
      supabase.auth.signOut();
      return;
    }

    Cookies.set('role', role, { expires: 7, path: '/' });
    if (role === 'teacher' || role === 'academy') router.push('/dashboard');
    else if (role === 'admin') router.push('/admin');
  };

  // 🌟 NEW: Google Sign-In Function
  const handleGoogleLogin = async () => {
    try {
      setErr(null);
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`, // must be in your Supabase redirect URLs
        },
      });

      if (error) {
        console.error('Google login error:', error);
        setErr(error.message);
      } else {
        console.log('🔗 Redirecting to Google for authentication...');
      }
    } catch (err) {
      console.error('Google login failed:', err);
      setErr('Google login failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="">
      <form onSubmit={submit}>
        {err && <div className="alert alert-danger">{err}</div>}

        <div className="mb-3">
          <label className="form-label">Email</label>
          <input
            required
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Password</label>
          <input
            required
            type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="btn btn-primary w-100" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        {/* 🌟 NEW: Google Login Button */}
        <div className="text-center my-3 text-muted">or</div>
        <button
          type="button"
          className="btn btn-outline-danger w-100"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            alt="Google"
            width="20"
            height="20"
            className="me-2"
          />
          Continue with Google
        </button>

        <div className="mt-3 d-flex justify-content-between small">
          <Link href="/auth/forgot-password">Forgot password?</Link>
          <Link href="/auth/signup">Create account</Link>
        </div>
      </form>
    </AuthLayout>
  );
}
