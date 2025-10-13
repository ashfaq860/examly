// src/app/auth/forgot-password/page.tsx
'use client';
import { useState } from 'react';
import AuthLayout from '@/components/AuthLayout';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/reset-password`
    });

    setLoading(false);
    if (error) setMsg(error.message);
    else setMsg('Password reset email sent — check your inbox.');
  };

  return (
    <AuthLayout title="Reset password" subtitle="We will send a link to your email">
      <form onSubmit={submit}>
        {msg && <div className="alert alert-info">{msg}</div>}
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input required type="email" className="form-control" value={email} onChange={(e)=>setEmail(e.target.value)} />
        </div>
        <button className="btn btn-primary w-100" disabled={loading}>{loading ? 'Sending…' : 'Send Reset Link'}</button>
        <div className="mt-3 small d-flex justify-content-between">
          <Link href="/auth/login">Back to login</Link>
          <Link href="/auth/signup">Create account</Link>
        </div>
      </form>
    </AuthLayout>
  );
}
