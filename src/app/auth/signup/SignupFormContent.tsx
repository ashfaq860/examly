// app/auth/signup/SignupFormContent.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthLayout from '@/components/AuthLayout';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Cookies from 'js-cookie';

export default function SignupForm() {
  const search = useSearchParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const referralCodeFromUrl = search.get('ref') || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(referralCodeFromUrl);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ Redirect logged-in users
 /* useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: roleData, error: rpcError } = await supabase
          .rpc('get_user_role', { user_id: session.user.id });

        if (rpcError) return;

        const role = (roleData as any)?.role || roleData;
        Cookies.set('role', role, { expires: 7, path: '/' });

        if (role === 'admin' || role === 'super_admin') router.replace('/admin');
        else if (role === 'teacher' || role === 'academy') router.replace('/dashboard');
      } catch (err) {
        console.error('Error checking session:', err);
      }
    };
    checkUser();
  }, [router, supabase]);
*/
useEffect(() => {
  const checkUser = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('Session fetch error:', error.message);
        return;
      }
      const session = data?.session;
      if (!session?.user) return;

      // Fetch role
      const { data: roleData, error: rpcError } = await supabase
        .rpc('get_user_role', { user_id: session.user.id });

      if (rpcError) return;

      const role = (roleData as any)?.role || roleData;
      Cookies.set('role', role, { expires: 7, path: '/' });

      if (role === 'admin' || role === 'super_admin') router.replace('/admin');
      else if (role === 'teacher' || role === 'academy') router.replace('/dashboard');
    } catch (err) {
      console.error('Unexpected error checking session:', err);
    }
  };
  checkUser();
}, [router, supabase]);

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, referralCode }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = { error: 'Invalid server response' };
      }

      if (!res.ok) {
        console.error('Signup failed', data);
        toast.error(data.error || 'Signup failed. Try again.');
        return;
      }

      toast.success(data.message || 'Signup successful!');

      // Redirect to login after 2s
      setTimeout(() => router.push('/auth/login'), 2000);
    } catch (err: any) {
      console.error('Unexpected signup error', err);
      toast.error(err.message || 'Unexpected signup error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign Up" subtitle="Only PTB Syllabus">
      <form onSubmit={handleSignup}>
        {/* Full Name */}
        <div className="mb-3">
          <label className="form-label">Full Name</label>
          <input
            required
            type="text"
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full name"
          />
        </div>

        {/* Email */}
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input
            required
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
          />
        </div>

        {/* Referral Code (optional, hidden) */}
        <div className="mb-3 d-none">
          <label className="form-label">
            Referral Code <span className="text-muted">(optional)</span>
          </label>
          <input
            type="text"
            className="form-control"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            placeholder="Enter referral code"
          />
        </div>

        {/* Password */}
        <div className="mb-3">
          <label className="form-label">Password</label>
          <div className="position-relative">
            <input
              required
              minLength={6}
              type={showPassword ? 'text' : 'password'}
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
            <button
              type="button"
              className="position-absolute end-0 top-50 translate-middle-y me-3 border-0 bg-transparent"
              onClick={togglePasswordVisibility}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button className="btn btn-primary w-100 mb-3" disabled={loading}>
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>

        <div className="mt-3 text-center">
          <span className="text-muted">Already have an account? </span>
          <Link
            href="/auth/login"
            className="btn btn-sm"
            style={{ background: '#073E8C', color: 'white' }}
          >
            Sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
