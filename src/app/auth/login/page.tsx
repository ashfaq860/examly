// app/auth/login/page.tsx
'use client';
import { useState, useEffect } from 'react';
import AuthLayout from '@/components/AuthLayout';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const redirectIfLoggedIn = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          setChecking(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        const role = profile?.role;

        if (role === 'admin' || role === 'super_admin') {
          router.replace('/admin');
        } else if (role === 'teacher' || role === 'academy') {
          router.replace('/dashboard');
        } else {
          await supabase.auth.signOut();
          setChecking(false);
        }
      } catch (e) {
        console.error('Session check error:', e);
        setChecking(false);
      }
    };

    redirectIfLoggedIn();
  }, [router, supabase]);

  if (checking) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErr(error.message);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setErr('User ID not found');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profile?.role) {
        setErr('Unable to verify user role. Please contact support.');
        await supabase.auth.signOut();
        return;
      }

      handleRoleRedirect(profile.role);

    } catch (e) {
      console.error('Unexpected error:', e);
      setErr('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleRedirect = (role: string) => {
    const allowedRoles = ['teacher', 'admin', 'super_admin', 'academy'];
    if (!allowedRoles.includes(role)) {
      setErr('Access denied: Your role cannot access this portal.');
      supabase.auth.signOut();
      return;
    }

    Cookies.set('role', role, { expires: 7, path: '/' });

    if (role === 'admin' || role === 'super_admin') router.push('/admin');
    else router.push('/dashboard');
  };

  const handleGoogleLogin = async () => {
    try {
      setErr(null);
      setLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });

      if (error) setErr(error.message);
    } catch (e) {
      console.error('Google login failed:', e);
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

        <div className="mt-3 d-flex justify-content-between small">
          <Link href="/auth/forgot-password">Forgot password?</Link>
          <Link href="/auth/signup">Create account</Link>
        </div>

        <div className="text-center my-3 text-muted">OR</div>

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
      </form>
    </AuthLayout>
  );
}