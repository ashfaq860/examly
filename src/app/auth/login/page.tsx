//app/auth/login/page.tsx
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
// Returns the correct OAuth callback URL for any environment.
// NEXT_PUBLIC_SITE_URL must be set in .env:
//   .env.local       → http://localhost:3000
//   .env.production  → https://www.examly.pk   (no trailing slash)
// Falls back to window.location.origin so dev works without the env var.
// ---------------------------------------------------------------------------
function getCallbackUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    window.location.origin;
  return `${base}/auth/callback`;
}

// ---------------------------------------------------------------------------
// Fetch the user's role via the server API route.
// Guards against HTML responses (404/500 pages) that would crash JSON.parse.
// ---------------------------------------------------------------------------
async function fetchRoleFromApi(): Promise<UserRole | null> {
  try {
    const res = await fetch('/api/auth/get-role', { method: 'GET' });

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      // API route not found or crashed — fall through to client fallback
      console.warn('[fetchRole] API returned non-JSON, status:', res.status);
      return null;
    }

    const body = await res.json();

    if (!res.ok || !body.role) return null;
    if (!isAllowedRole(body.role)) return null;

    return body.role as UserRole;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fallback: query profiles directly from the client when the API is unreachable.
// Uses .maybeSingle() — never throws on missing rows (fixes the original {} bug).
// ---------------------------------------------------------------------------
async function fetchRoleFromClient(
  supabase: ReturnType<typeof createClientComponentClient>,
  userId: string
): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle(); // ← key fix: returns null instead of error when no row found

  if (error || !data?.role) return null;
  if (!isAllowedRole(data.role)) return null;

  return data.role as UserRole;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const router = useRouter();
  const supabase = createClientComponentClient();

  // ---------------------------------------------------------------------------
  // Resolve role: try the API first, fall back to direct client query.
  // This means login works even if the API route has a path/config issue.
  // ---------------------------------------------------------------------------
  const resolveRole = useCallback(
    async (userId: string): Promise<UserRole | null> => {
      const apiRole = await fetchRoleFromApi();
      if (apiRole) return apiRole;

      // API unavailable — fall back to direct query
      console.warn('[resolveRole] Falling back to client-side profile query');
      return fetchRoleFromClient(supabase, userId);
    },
    [supabase]
  );

  // ---------------------------------------------------------------------------
  // On mount: silently redirect already-logged-in users.
  // Never calls setChecking(false) on redirect branches → no login form flash.
  // ---------------------------------------------------------------------------
  const redirectIfLoggedIn = useCallback(async () => {
    try {
      // Show error messages forwarded by the OAuth callback route
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

      const role = await resolveRole(session.user.id);

      if (!role) {
        await supabase.auth.signOut();
        setChecking(false);
        return;
      }

      // Keep checking=true — page stays blank while Next.js navigates
      Cookies.set('role', role, { expires: 7, path: '/' });
      router.replace(getRedirectPath(role));
    } catch (e) {
      console.error('Session check error:', e);
      setChecking(false);
    }
  }, [router, supabase, resolveRole]);

  useEffect(() => {
    redirectIfLoggedIn();
  }, [redirectIfLoggedIn]);

  if (checking) return null;

  // ---------------------------------------------------------------------------
  // Email / password login
  // ---------------------------------------------------------------------------
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setErr(signInError.message);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setErr('Login failed. Please try again.');
        return;
      }

      const role = await resolveRole(userId);

      if (!role) {
        setErr('Unable to verify your role. Please contact support.');
        await supabase.auth.signOut();
        return;
      }

      if (!isAllowedRole(role)) {
        setErr('Access denied: your account cannot access this portal.');
        await supabase.auth.signOut();
        return;
      }

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
  // Google OAuth — callback route handles session + profile creation
  // ---------------------------------------------------------------------------
  const handleGoogleLogin = async () => {
    try {
      setErr(null);
      setLoading(true);

      const callbackUrl = getCallbackUrl();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) {
        setErr(error.message);
        setLoading(false);
      }
      // No error → browser navigates to Google → leave loading=true
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