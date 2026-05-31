// app/auth/login/page.tsx
'use client';
import { useState } from 'react';
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
  const router = useRouter();
  const supabase = createClientComponentClient();

  // ✅ FIX: useEffect removed entirely.
  //
  // The callback route (/auth/callback) already handles the redirect after
  // Google OAuth and sets the role cookie before redirecting to /dashboard
  // or /admin. Having a useEffect here that also checks the session and
  // calls get_user_role creates a race condition for new users:
  //
  //   1. Callback inserts the new profile row (async DB write).
  //   2. Callback redirects → Next.js briefly renders this login page.
  //   3. useEffect fires and calls get_user_role RPC immediately.
  //   4. The DB write from step 1 may not be visible yet → RPC returns null.
  //   5. The null-role branch calls signOut() → user is kicked back to login.
  //
  // On the second attempt the profile row already exists, so the RPC
  // succeeds and the user gets in. That's the "needs two attempts" symptom.
  //
  // If you need to protect /dashboard and /admin from unauthenticated access,
  // use Next.js middleware (middleware.ts) to check the session server-side
  // before every request — that's the correct place for it.

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

      const { data: roleData, error: rpcError } = await supabase.rpc('get_user_role', { user_id: userId });
      if (rpcError || !roleData) {
        setErr('Unable to verify user role. Please contact support.');
        await supabase.auth.signOut();
        return;
      }

      const role = (roleData as any)?.role || roleData;
      handleRoleRedirect(role);

    } catch (err) {
      console.error('Unexpected error:', err);
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
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });

      if (error) setErr(error.message);
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