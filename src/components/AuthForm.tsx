'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import 'bootstrap/dist/css/bootstrap.min.css';
import styles from "./Auth.module.css";

import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { role } }
        });
        if (error) throw error;
        toast.success('Check your email for confirmation.');
        router.push('/auth');
      } 
      else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Logged in successfully');
        router.push('/dashboard');
      }
      else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        });
        if (error) throw error;
        toast.success('Password reset email sent. Check your inbox.');
        setMode('login');
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    }
  };

  return (
    <>
      <Header />
      <main className={`${styles.authContainer} d-flex align-items-center justify-content-center`}>
        <div className={`${styles.authCard} p-4 shadow-lg rounded`}>
          <div className="mb-4 text-center">
            <h2 className="fw-bold">
              {mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Forgot Password' : 'Login'}
            </h2>
            <p className="text-muted">
              {mode === 'signup' 
                ? 'Access learning, paper generation & quizzes'
                : mode === 'forgot'
                ? 'Enter your email to reset your password'
                : 'Access learning, paper generation & quizzes'}
            </p>
          </div>

          {/* Tabs only for login/signup */}
          {mode !== 'forgot' && (
            <div className="mb-4 d-flex justify-content-center gap-2">
              <button
                onClick={() => setMode('login')}
                className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-outline-primary'}`}
              >
                Login
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`btn ${mode === 'signup' ? 'btn-primary' : 'btn-outline-primary'}`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="text-start">
            <div className="mb-3">
              <label className="form-label fw-semibold">Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                type="email"
                className="form-control"
                required
              />
            </div>

            {mode !== 'forgot' && (
              <div className="mb-3">
                <label className="form-label fw-semibold">Password</label>
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  type="password"
                  className="form-control"
                  required={mode !== 'forgot'}
                />
              </div>
            )}

            {mode === 'signup' && (
              <div className="mb-3">
                <label className="form-label fw-semibold">I am a:</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="form-select"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher / Academy</option>
                </select>
              </div>
            )}

            <button type="submit" className="btn btn-primary w-100 py-2 fw-semibold">
              {mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Link' : 'Login'}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-4 text-center">
            {mode === 'login' && (
              <>
                <p>
                  Don’t have an account?{' '}
                  <button onClick={() => setMode('signup')} className="btn btn-link p-0">
                    Sign up here
                  </button>
                </p>
                <p>
                  Forgot your password?{' '}
                  <button onClick={() => setMode('forgot')} className="btn btn-link p-0">
                    Reset here
                  </button>
                </p>
              </>
            )}
            {mode === 'signup' && (
              <p>
                Already have an account?{' '}
                <button onClick={() => setMode('login')} className="btn btn-link p-0">
                  Login here
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <p>
                Remembered your password?{' '}
                <button onClick={() => setMode('login')} className="btn btn-link p-0">
                  Back to login
                </button>
              </p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
