// app/auth/login/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import AuthLayout from '@/components/AuthLayout';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type AllowedRole = 'teacher' | 'admin' | 'super_admin' | 'academy';

const ALLOWED_ROLES: AllowedRole[] = ['teacher', 'admin', 'super_admin', 'academy'];

// ✅ Single source of truth — same logic as callback/route.ts
function getRoleRedirectPath(role: string): string {
  if (role === 'admin' || role === 'super_admin') return '/admin';
  return '/dashboard';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();
  const supabase = createClientComponentClient();
  const redirecting = useRef(false);

  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          setCheckingSession(false);
          return;
        }

        if (redirecting.current) return;
        redirecting.current = true;

        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error || !profileData) {
          // Can't verify role — sign out and show login
          await supabase.auth.signOut();
          redirecting.current = false;
          setCheckingSession(false);
          return;
        }

        const role = profileData.role as string;

        if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
          await supabase.auth.signOut();
          redirecting.current = false;
          setCheckingSession(false);
          return;
        }

        Cookies.set('role', role, { expires: 7, path: '/' });
        // ✅ Uses shared helper — admin/super_admin → /admin, everyone else → /dashboard
        router.replace(getRoleRedirectPath(role));

      } catch (e) {
        console.error('Session check error:', e);
        setCheckingSession(false);
      }
    };

    checkExistingSession();
  }, []);

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

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profileData) {
        setErr('Unable to verify user role. Please contact support.');
        await supabase.auth.signOut();
        return;
      }

      const role = profileData.role as string;

      if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
        setErr('Access denied: Your role cannot access this portal.');
        await supabase.auth.signOut();
        return;
      }

      Cookies.set('role', role, { expires: 7, path: '/' });
      // ✅ Same helper — no divergence between email and Google login paths
      router.push(getRoleRedirectPath(role));

    } catch (e) {
      console.error('Unexpected error:', e);
      setErr('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setErr(null);
      setLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) {
        setErr(error.message);
        setLoading(false);
      }
    } catch (e) {
      console.error('Google login failed:', e);
      setErr('Google login failed. Try again.');
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <AuthLayout title="Welcome back" subtitle="">
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
        </div>
      </AuthLayout>
    );
  }

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