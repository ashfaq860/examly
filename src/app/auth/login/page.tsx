'use client';
import { useState, useEffect, useCallback } from 'react';
import AuthLayout from '@/components/AuthLayout';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const ALLOWED_ROLES = ['teacher', 'admin', 'super_admin', 'academy'] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

function isAllowedRole(role: string): role is UserRole {
  return ALLOWED_ROLES.includes(role as UserRole);
}

function getRedirectPath(role: UserRole): string {
  return role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard';
}

// ---------------------------------------------------------------------------
// Fetches the current user's role from our secure server-side API.
// The API uses supabaseAdmin (bypasses RLS) and reads the session from
// the HttpOnly cookie — no service key ever touches the browser.
// Returns the role string, or throws with a user-facing message on failure.
// ---------------------------------------------------------------------------
async function fetchRole(): Promise<UserRole> {
  const res = await fetch('/api/auth/get-role', { method: 'GET' });
  const body = await res.json();

  if (!res.ok || !body.role) {
    throw new Error(body.error ?? 'Unable to verify your role. Please contact support.');
  }

  if (!isAllowedRole(body.role)) {
    throw new Error('Access denied: your account cannot access this portal.');
  }

  return body.role as UserRole;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true); // true = silently verifying existing session

  const router = useRouter();
  const supabase = createClientComponentClient();

  // ---------------------------------------------------------------------------
  // On mount: if the user already has a valid session, redirect them immediately.
  // We never call setChecking(false) on redirect branches so the login form
  // never flashes for a user who is already logged in.
  // ---------------------------------------------------------------------------
  const redirectIfLoggedIn = useCallback(async () => {
    try {
      // Handle error params written by the OAuth callback route.
      const params = new URLSearchParams(window.location.search);
      const callbackError = params.get('error');
      if (callbackError) {
        const messages: Record<string, string> = {
          missing_code: 'OAuth flow was interrupted. Please try again.',
          auth_failed: 'Authentication failed. Please try again.',
          profile_creation_failed: 'Could not create your profile. Please contact support.',
          unauthorized_role: 'Your account does not have access to this portal.',
        };
        setErr(messages[callbackError] ?? `Login error: ${callbackError.replace(/_/g, ' ')}`);
        setChecking(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setChecking(false);
        return;
      }

      // Session exists — ask the server for the role.
      let role: UserRole;
      try {
        role = await fetchRole();
      } catch {
        // Profile missing or unauthorized — clear the session and show the form.
        await supabase.auth.signOut();
        setChecking(false);
        return;
      }

      // Keep checking=true so the page stays blank while Next.js navigates.
      Cookies.set('role', role, { expires: 7, path: '/' });
      router.replace(getRedirectPath(role));
    } catch (e) {
      console.error('Session check error:', e);
      setChecking(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    redirectIfLoggedIn();
  }, [redirectIfLoggedIn]);

  // Show nothing while we verify an existing session.
  if (checking) return null;

  // ---------------------------------------------------------------------------
  // Email / password login
  // ---------------------------------------------------------------------------
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      // Step 1: Authenticate credentials.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setErr(signInError.message);
        return;
      }

      // Step 2: Fetch role from the server API — bypasses RLS, handles missing
      // profiles automatically, never exposes the service key to the client.
      let role: UserRole;
      try {
        role = await fetchRole();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unable to verify your role. Please contact support.';
        setErr(message);
        await supabase.auth.signOut();
        return;
      }

      // Step 3: Persist role cookie and redirect.
      Cookies.set('role', role, { expires: 7, path: '/' });
      router.push(getRedirectPath(role));
    } catch (e) {
      console.error('Unexpected login error:', e);
      setErr('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Google OAuth login — the callback route handles everything after the redirect.
  // ---------------------------------------------------------------------------
  const handleGoogleLogin = async () => {
    try {
      setErr(null);
      setLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // Force the account picker so switching Google accounts always works.
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) {
        setErr(error.message);
        setLoading(false); // Reset only if we didn't navigate away.
      }
      // On success the browser leaves this page — leave loading=true so the
      // button stays disabled and there's no UI jank during the redirect.
    } catch (e) {
      console.error('Google login failed:', e);
      setErr('Google login failed. Please try again.');
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