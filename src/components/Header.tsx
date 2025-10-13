// src/components/Header.tsx
'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, usePathname } from 'next/navigation';

export default function Header() {
  const [open, setOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [activeLink, setActiveLink] = useState('');
  const supabase = createClientComponentClient();
  const router = useRouter();
  const pathname = usePathname();

  // ✅ Set active link based on current path
  useEffect(() => {
    setActiveLink(pathname);
  }, [pathname]);

  // ✅ Dark mode
  useEffect(() => {
    const storedMode = localStorage.getItem('darkMode');
    if (storedMode !== null) {
      setDarkMode(storedMode === 'true');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);
  const toggleDarkMode = () => setDarkMode(!darkMode);

  // ✅ Fetch user + role
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);

        // get role from RPC
        const { data: roleData, error } = await supabase.rpc('get_user_role', {
          user_id: session.user.id,
        });
        if (!error && roleData) {
          setRole(roleData);
        }
      } else {
        setUser(null);
        setRole(null);
      }
    };
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          supabase
            .rpc('get_user_role', { user_id: session.user.id })
            .then(({ data, error }) => {
              if (!error && data) setRole(data);
            });
        } else {
          setUser(null);
          setRole(null);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
  };

  const handleUserClick = () => {
    if (!role) return;
    if (role === 'admin' || role === 'super_admin') {
      router.push('/admin');
    } else if (role === 'teacher' || role === 'academy') {
      router.push('/dashboard');
    }
  };

  // Check if a link is active
  const isLinkActive = (href: string) => {
    if (href === '/') {
      return activeLink === '/';
    }
    return activeLink.startsWith(href);
  };

  // Check if user link is active (admin or dashboard)
  const isUserLinkActive = () => {
    if (!role) return false;
    if ((role === 'admin' || role === 'super_admin') && activeLink.startsWith('/admin')) {
      return true;
    }
    if ((role === 'teacher' || role === 'academy') && activeLink.startsWith('/dashboard')) {
      return true;
    }
    return false;
  };

  return (
    <header className="header-nav dark:bg-gray-900 transition-colors duration-300">
      <div className="container">
        <nav className="navbar navbar-expand-lg p-0">
          <Link 
            className={`navbar-brand me-3 dark:text-white ${isLinkActive('/') ? 'active' : ''}`} 
            href="/"
          >
            Examly
          </Link>

          {/* Dark Mode Toggle */}
          <button 
            onClick={toggleDarkMode}
            className="me-3 p-2 rounded-full focus:outline-none hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
            aria-label="Toggle dark mode"
          >
            {darkMode ? (
              <i className="bi bi-sun-fill text-yellow-400"></i>
            ) : (
              <i className="bi bi-moon-fill text-gray-700"></i>
            )}
          </button>

          <button
            className="navbar-toggler dark:text-white"
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className={`collapse navbar-collapse ${open ? 'show' : ''}`}>
            <ul className="navbar-nav ms-auto align-items-lg-center">
              <li className="nav-item">
                <Link 
                  className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/quiz') ? 'active' : ''}`} 
                  href="/quiz"
                 
                >
                 Quizz
                </Link>
              </li>
              <li className="nav-item">
                <Link 
                  className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/how') ? 'active' : ''}`} 
                  href="#how"
                  onClick={() => setActiveLink('#how')}
                >
                  How it works
                </Link>
              </li>
              <li className="nav-item">
                <Link 
                  className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/pricing') ? 'active' : ''}`} 
                  href="#pricing"
                  onClick={() => setActiveLink('#pricing')}
                >
                  Packages
                </Link>
              </li>

              {/* ✅ Auth UI */}
              {user ? (
                <>
                  <li className="nav-item">
                    <button 
                      onClick={handleUserClick}
                      className={`nav-link btn btn-link dark:text-gray-300 pe-3 ${isUserLinkActive() ? 'active' : ''}`}
                    >
                      {user.email}
                    </button>
                  </li>
                  <li className="nav-item ms-2">
                    <button 
                      onClick={handleLogout} 
                      className="btn btn-danger btn-sm"
                    >
                      Logout
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li className="nav-item">
                    <Link 
                      className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/auth/login') ? 'active' : ''}`} 
                      href="/auth/login"
                    >
                      Login
                    </Link>
                  </li>
                  <li className="nav-item ms-2">
                    <Link 
                      className={`btn btn-light btn-sm dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 ${isLinkActive('/auth/signup') ? 'active' : ''}`} 
                      href="/auth/signup"
                    >
                      Sign Up
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </nav>
      </div>

      
    </header>
  );
}
