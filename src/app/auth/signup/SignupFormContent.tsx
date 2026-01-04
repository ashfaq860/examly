// app/auth/signup/SignupFormContent.tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthLayout from '@/components/AuthLayout';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

export default function SignupForm() {
  const search = useSearchParams();
  const router = useRouter();

  const referralCodeFromUrl = search.get('ref') || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(referralCodeFromUrl);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
      setLoading(false);
      return;
    }

    toast.success(data.message || 'Signup successful!');
    setTimeout(() => router.push('/auth/login'), 2000);
  } catch (err: any) {
    console.error('Unexpected signup error', err);
    toast.error(err.message || 'Unexpected signup error');
  } finally {
    setLoading(false);
  }
};


  return (
    <AuthLayout title="SignUp" subtitle="Only PTB Syllabus">
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

        {/* Referral Code */}
        <div className="mb-3">
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
          <div className="password-input-container position-relative">
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
              className="password-toggle-btn position-absolute end-0 top-50 translate-middle-y me-3 border-0 bg-transparent"
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
          <Link href="/auth/login" style={{ background: '#073E8C', color: 'white' }}>
            Sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
