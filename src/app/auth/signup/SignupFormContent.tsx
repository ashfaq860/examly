'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthLayout from '@/components/AuthLayout';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import toast from 'react-hot-toast';
<<<<<<< HEAD
import { Eye, EyeOff } from 'lucide-react';
=======

>>>>>>> 5dbed70be6becb5c69bbd608588aab3eb562aa75
export default function SignupForm() {
  const search = useSearchParams();
  const preRole = search?.get('role') ?? 'student';
  const [role, setRole] = useState(preRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setRole(preRole);
  }, [preRole]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!name.trim()) {
      toast.error('Please enter your name');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role, name: name.trim() } },
      });

      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          toast.error('Email already exists. Please login or use a different email.');
        } else {
          toast.error(error.message);
        }
        setLoading(false);
        return;
      }

      toast.success('Signup successful! Check your email for confirmation.');
      setTimeout(() => router.push('/auth/login'), 3000);
    } catch (err) {
      console.error('Unexpected error during signup:', err);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
<<<<<<< HEAD
    <AuthLayout title="SignUp" subtitle="Only PTB Syllabus">
=======
    <AuthLayout title="Create account" subtitle="Start with a student or teacher account">
>>>>>>> 5dbed70be6becb5c69bbd608588aab3eb562aa75
      <form onSubmit={handleSignup}>
        {/* Role */}
        <div className="mb-3">
          <label className="form-label">Role</label>
          <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="student">Student</option>
            <option value="teacher">Teacher / Academy</option>
          </select>
        </div>

        {/* Name */}
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

        {/* Password */}
<<<<<<< HEAD
      {/* Password */}
{/* Password */}
{/* Password */}
<div className="mb-3">
  <label className="form-label">Password</label>
  <div className="password-input-container">
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
      className="password-toggle-btn"
      onClick={togglePasswordVisibility}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </div>
</div>
=======
        <div className="mb-3">
          <label className="form-label">Password</label>
          <div className="password-input-container">
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
              className="password-toggle-btn"
              onClick={togglePasswordVisibility}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

>>>>>>> 5dbed70be6becb5c69bbd608588aab3eb562aa75
        <button className="btn btn-primary w-100 mb-3" disabled={loading}>
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>

        <div className="mt-3 text-center">
          <span className="text-muted">Already have an account? </span>
<<<<<<< HEAD
          <Link href="/auth/login"  style={{'background':"#073E8C !important",'color':"white !important"}}>
=======
          <Link href="/auth/login" className="text-primary">
>>>>>>> 5dbed70be6becb5c69bbd608588aab3eb562aa75
            Sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
