'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthLayout from '@/components/AuthLayout';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SignupPage() {
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate inputs
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
      // Proceed with signup - let Supabase handle email uniqueness
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { 
          data: { 
            role,
            name: name.trim(),
          } 
        },
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

      if (data.user) {
        // Don't try to create profile immediately - it will be handled by a trigger or webhook
        toast.success('Signup successful! Check your email for confirmation.');
        
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/auth/login');
        }, 3000);
      } else {
        toast.success('Signup successful! Check your email for confirmation.');
        setTimeout(() => {
          router.push('/auth/login');
        }, 3000);
      }
      
    } catch (err) {
      console.error('Unexpected error during signup:', err);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <AuthLayout title="Create account" subtitle="Start with a student or teacher account">
      <form onSubmit={handleSignup}>
        <div className="mb-3">
          <label className="form-label">Role</label>
          <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="student">Student</option>
            <option value="teacher">Teacher / Academy</option>
          </select>
        </div>

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
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                  <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                  <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                  <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        <button className="btn btn-primary w-100 mb-3" disabled={loading}>
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>

        <div className="mt-3 text-center">
          <span className="text-muted">Already have an account? </span>
          <Link href="/auth/login" className="text-primary">
            Sign in
          </Link>
        </div>
      </form>

      <style jsx>{`
        .password-input-container {
          position: relative;
        }
        .password-toggle-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #6c757d;
          padding: 0;
          cursor: pointer;
        }
        .password-toggle-btn:hover {
          color: #495057;
        }
        .form-label {
          margin-bottom: 0.5rem;
          font-weight: 500;
          display: block;
        }
        .form-control {
          display: block;
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 1rem;
          font-weight: 400;
          line-height: 1.5;
          color: #212529;
          background-color: #fff;
          background-clip: padding-box;
          border: 1px solid #ced4da;
          border-radius: 0.375rem;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }
        .form-control:focus {
          color: #212529;
          background-color: #fff;
          border-color: #86b7fe;
          outline: 0;
          box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
        }
        .form-select {
          display: block;
          width: 100%;
          padding: 0.5rem 2.25rem 0.5rem 0.75rem;
          font-size: 1rem;
          font-weight: 400;
          line-height: 1.5;
          color: #212529;
          background-color: #fff;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23343a40' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          background-size: 16px 12px;
          border: 1px solid #ced4da;
          border-radius: 0.375rem;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }
        .btn-primary {
          color: #fff;
          background-color: #0d6efd;
          border-color: #0d6efd;
          padding: 0.6rem 1rem;
          font-size: 1.1rem;
          border-radius: 0.5rem;
          transition: all 0.15s ease-in-out;
          font-weight: 500;
        }
        .btn-primary:hover:not(:disabled) {
          background-color: #0b5ed7;
          border-color: #0a58ca;
          transform: translateY(-1px);
        }
        .btn-primary:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .text-muted {
          color: #6c757d !important;
        }
        .text-primary {
          color: #0d6efd !important;
          text-decoration: none;
        }
        .text-primary:hover {
          text-decoration: underline;
        }
      `}</style>
    </AuthLayout>
  );
}