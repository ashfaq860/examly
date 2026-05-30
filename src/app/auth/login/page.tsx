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
  // ✅ FIX: Gate the page render until we know session state
  const [sessionChecked, setSessionChecked] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // ✅ FIX: Use onAuthStateChange so we catch the session the instant
    // Supabase sets the cookie — including right after an OAuth callback.
    // getSession() can return null momentarily during the redirect chain.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // SIGNED_IN fires when the session is fully ready (including after OAuth)
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();

          const role = profileData?.role ?? 'teacher';

          Cookies.set('role', role, { expires: 7, path: '/' });

          if (role === 'admin' || role === 'super_admin') {
            router.replace('/admin');
          } else {
            router.replace('/dashboard');
          }
        } catch (e) {
          console.error('Role check error:', e);
        }
      } else if (event === 'INITIAL_SESSION' && !session) {
        // No session at all — show the login form
        setSessionChecked(true);
      } else if (event === 'INITIAL_SESSION' && session) {
        // Already logged in — will be handled by SIGNED_IN branch above
        // but set checked so the form doesn't flash
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase]);

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

      handleRoleRedirect(profileData.role ?? 'teacher');
    } catch (e) {
      console.error('Unexpected error:', e);
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

  const handleGoogleLogin = async () => {
    try {
      setErr(null);
      setLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // ✅ FIX: Skip browser cache — forces fresh OAuth flow
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) {
        setErr(error.message);
        setLoading(false);
      }
      // Don't setLoading(false) on success — page is navigating away
    } catch (e) {
      console.error('Google login failed:', e);
      setErr('Google login failed. Try again.');
      setLoading(false);
    }
  };

  // ✅ FIX: Show a spinner until we know there's no active session.
  // This prevents the login form from flashing during an OAuth redirect.
  if (!sessionChecked) {
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