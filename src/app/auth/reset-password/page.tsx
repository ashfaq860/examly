// src/app/auth/reset-password/page.tsx
'use client';
import { useState, useEffect } from 'react';
import AuthLayout from '@/components/AuthLayout';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Supabase will set a session after clicking reset email link
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setReady(true);
      else {
        setMsg('Invalid or expired link — request another reset.');
      }
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMsg(error.message);
    else {
      setMsg('Password updated. Redirecting to login…');
      setTimeout(()=> router.push('/auth/login'), 1400);
    }
  };

  return (
    <AuthLayout title="Set new password" subtitle="Choose a strong password">
      {msg && <div className="alert alert-info">{msg}</div>}
      {!ready && !msg && <div className="text-center py-3">Validating link…</div>}
      {ready && (
        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="form-label">New password</label>
            <input required minLength={6} type="password" className="form-control" value={password} onChange={(e)=>setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary w-100">Set password</button>
        </form>
      )}
    </AuthLayout>
  );
}
