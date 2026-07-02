// src/app/auth/login/page.tsx
'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import AuthLayout from '@/components/AuthLayout';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client'; 

const ALLOWED_ROLES = ['teacher', 'admin', 'super_admin', 'academy'] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

function isAllowedRole(role: string): role is UserRole {
  return ALLOWED_ROLES.includes(role as UserRole);
}

function getRedirectPath(role: UserRole): string {
  return role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard';
}

function getCallbackUrl(): string {
  // Always fallback safely to the active window location to avoid apex vs www mismatches
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/auth/callback`;
}

async function fetchRoleFromApi(): Promise<UserRole | null> {
  try {
    const res = await fetch('/api/auth/get-role', { method: 'GET' });
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return null;
    const body = await res.json();
    if (!res.ok || !body.role) return null;
    if (!isAllowedRole(body.role)) return null;
    return body.role as UserRole;
  } catch {
    return null;
  }
}

async function fetchRoleFromClient(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  userId: string
): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
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

  // Initialize client instance
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const resolveRole = useCallback(
    async (userId: string): Promise<UserRole | null> => {
      const apiRole = await fetchRoleFromApi();
      if (apiRole) return apiRole;
      return fetchRoleFromClient(supabase, userId);
    },
    [supabase]
  );

  const redirectIfLoggedIn = useCallback(async () => {
    try {
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
      if (!session?.user) { setChecking(false); return; }

      const role = await resolveRole(session.user.id);
      if (!role) { await supabase.auth.signOut(); setChecking(false); return; }

      Cookies.set('role', role, { expires: 7, path: '/' });
      router.replace(getRedirectPath(role));
    } catch (e) {
      console.error('Session check error:', e);
      setChecking(false);
    }
  }, [router, supabase, resolveRole]);

  useEffect(() => { redirectIfLoggedIn(); }, [redirectIfLoggedIn]);

  if (checking) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setErr(signInError.message); return; }

      const userId = data.user?.id;
      if (!userId) { setErr('Login failed. Please try again.'); return; }

      const role = await resolveRole(userId);
      if (!role) {
        setErr('Unable to verify your role. Please contact support.');
        await supabase.auth.signOut();
        return;
      }

      Cookies.set('role', role, { expires: 7, path: '/' });
      router.push(getRedirectPath(role));
    } catch (e) {
      console.error('Unexpected login error:', e);
      setErr('An unexpected error occurred. Please try again.');
    } finally {
      loading && setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setErr(null);
      setLoading(true);

      // Explicitly trigger standard PKCE handling
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getCallbackUrl(),
          queryParams: { 
            prompt: 'select_account',
            access_type: 'offline' // Ensures a secure refresh token gets issued for new users
          },
        },
      });

      if (error) { 
        setErr(error.message); 
        setLoading(false); 
      }
    } catch (e) {
      console.error('Google login failed:', e);
      setErr('Google login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="" mode="login">
      <form onSubmit={submit}>
        {err && <div className="alert alert-danger">{err}</div>}

        <div className="mb-3">
          <label className="form-label">Email</label>
          <input required type="email" className="form-control"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="mb-3">
          <label className="form-label">Password</label>
          <input required type="password" className="form-control"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <button className="btn btn-primary w-100" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="mt-3 d-flex justify-content-between" style={{ fontSize: '0.8rem' }}>
          <Link href="/auth/forgot-password">Forgot password?</Link>
          <Link href="/auth/signup">Create account →</Link>
        </div>

        <div className="text-center my-3 text-muted">OR</div>

        <button type="button" className="btn btn-outline-danger w-100"
          onClick={handleGoogleLogin} disabled={loading}>
          <img src="https://www.svgrepo.com/show/475656/google-color.svg"
            alt="Google" width="20" height="20" className="me-2" />
          Continue with Google
        </button>
      </form>
    </AuthLayout>
  );
}
