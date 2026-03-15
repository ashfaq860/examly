'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, usePathname } from 'next/navigation';

export default function Header() {
  const [open, setOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  
  const supabase = createClientComponentClient();
  const router = useRouter();
  const pathname = usePathname();

  // 1. Navbar Elevation on Scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 2. Optimized Theme Handling
  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    setDarkMode(isDark);
    document.documentElement.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', String(newMode));
    document.documentElement.setAttribute('data-bs-theme', newMode ? 'dark' : 'light');
  };

  // 3. Auth & Role Handling
  useEffect(() => {
    const getUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const cachedRole = sessionStorage.getItem(`role_${session.user.id}`);
        if (cachedRole) setRole(cachedRole);
        else {
          const { data } = await supabase.rpc('get_user_role', { user_id: session.user.id });
          if (data) {
            setRole(data);
            sessionStorage.setItem(`role_${session.user.id}`, data);
          }
        }
      }
    };
    getUserData();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        setRole(null);
        sessionStorage.clear();
      }
    });
    return () => authListener.subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const isActive = (path) => pathname === path;

  return (
    <>
      <style jsx>{`
        .custom-navbar {
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-bottom: 1px solid transparent;
        }

        .navbar-elevated {
          background-color: var(--bs-body-bg-rgb, 255, 255, 255);
          background-color: rgba(var(--bs-body-bg-rgb), 0.85);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .nav-link {
          font-weight: 500;
          padding: 0.5rem 1rem !important;
          border-radius: 8px;
          transition: 0.2s;
        }

        .nav-link.active {
          color: #0d6efd !important;
          background: rgba(13, 110, 253, 0.08);
        }

        .theme-toggle {
          cursor: pointer;
          border-radius: 50%;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #dee2e6;
        }

        [data-bs-theme='dark'] .theme-toggle {
          border-color: #495057;
        }

        @media (max-width: 991px) {
          .navbar-collapse {
            background: var(--bs-body-bg);
            padding: 1rem;
            border-radius: 12px;
            margin-top: 1rem;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          }
        }
      `}</style>

      <nav className={`navbar navbar-expand-lg fixed-top custom-navbar ${scrolled ? 'navbar-elevated' : 'py-3'}`}>
        <div className="container">
          {/* Logo */}
          <Link className="navbar-brand d-flex align-items-center" href="/">
            <img src="/examly.jpg" alt="Logo" height="32" className="me-2 rounded shadow-sm" />
            <span className="fw-bold tracking-tight">Examly<small className="text-primary">.pk</small></span>
          </Link>

          {/* Mobile Actions */}
          <div className="d-flex align-items-center d-lg-none ms-auto me-2">
            <div className="theme-toggle me-2" onClick={toggleDarkMode}>
              {darkMode ? '🌙' : '☀️'}
            </div>
          </div>

          <button 
            className="navbar-toggler border-0 shadow-none" 
            type="button" 
            onClick={() => setOpen(!open)}
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className={`collapse navbar-collapse ${open ? 'show' : ''}`}>
            <ul className="navbar-nav mx-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <Link className={`nav-link ${isActive('/') ? 'active' : ''}`} href="/">Home</Link>
              </li>
              <li className="nav-item">
                <Link className={`nav-link ${isActive('/dashboard/generate-paper') ? 'active' : ''}`} href="/dashboard/generate-paper">Make Test</Link>
              </li>
              <li className="nav-item">
                <Link className={`nav-link ${isActive('/quiz') ? 'active' : ''}`} href="/quiz">Quiz</Link>
              </li>
              <li className="nav-item">
                <Link className={`nav-link ${isActive('/packages') ? 'active' : ''}`} href="/packages">Packages</Link>
              </li>
            </ul>

            <div className="d-flex align-items-center gap-3">
              {/* Desktop Theme Toggle */}
              <div className="theme-toggle d-none d-lg-flex" onClick={toggleDarkMode}>
                {darkMode ? '🌙' : '☀️'}
              </div>

              {user ? (
                <div className="dropdown">
                  <button 
                    className="btn btn-outline-primary btn-sm dropdown-toggle rounded-pill px-3" 
                    type="button" 
                    onClick={() => router.push(role === 'admin' ? '/admin' : '/dashboard')}
                  >
                    {user.email.split('@')[0]}
                  </button>
                  <button className="btn btn-link text-danger text-decoration-none btn-sm ms-2" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              ) : (
                <div className="d-flex gap-2">
                  <Link href="/auth/login" className="btn btn-link text-decoration-none fw-medium">Login</Link>
                  <Link href="/auth/signup" className="btn btn-primary rounded-pill px-4 shadow-sm">Sign Up</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      {/* Spacer to prevent content from going under the fixed header */}
      <div style={{ height: '75px' }}></div>
    </>
  );
}