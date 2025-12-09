'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, usePathname } from 'next/navigation';

export default function Header() {
  const [open, setOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [activeLink, setActiveLink] = useState('');
  const supabase = createClientComponentClient();
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef(null);

  useEffect(() => setActiveLink(pathname), [pathname]);

  // 🌙 Dark mode handling
  useEffect(() => {
    const storedMode = localStorage.getItem('darkMode');
    if (storedMode !== null) setDarkMode(storedMode === 'true');
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches)
      setDarkMode(true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode ? 'true' : 'false');
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  // 👤 User & role
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data: roleData } = await supabase.rpc('get_user_role', {
          user_id: session.user.id,
        });
        if (roleData) setRole(roleData);
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
            .then(({ data }) => {
              if (data) setRole(data);
            });
        } else {
          setUser(null);
          setRole(null);
        }
      }
    );

    return () => authListener.subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
  };

  const handleUserClick = () => {
    if (!role) return;
    if (role === 'admin' || role === 'super_admin') router.push('/admin');
    else if (role === 'teacher' || role === 'academy') router.push('/dashboard');
  };

  const isLinkActive = (href) =>
    href === '/' ? activeLink === '/' : activeLink.startsWith(href);

  const isUserLinkActive = () => {
    if (!role) return false;
    if ((role === 'admin' || role === 'super_admin') && activeLink.startsWith('/admin')) return true;
    if ((role === 'teacher' || role === 'academy') && activeLink.startsWith('/dashboard')) return true;
    return false;
  };

  // 🎬 Smooth Curtain Animation (mobile only)
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    if (window.innerWidth >= 992) {
      // Desktop: menu always visible, reset animation
      el.classList.remove('curtain-open', 'curtain-close');
      el.style.height = 'auto';
      el.style.opacity = '1';
    } else {
      // Mobile: apply curtain animation
      if (open) {
        el.classList.add('curtain-open');
        el.classList.remove('curtain-close');
      } else {
        el.classList.add('curtain-close');
        el.classList.remove('curtain-open');
      }
    }
  }, [open]);

  return (
    <>
      <style jsx>{`
        /* Curtain Animation (mobile only) */
        @media (max-width: 991px) {
          .curtain-container {
            overflow: hidden;
            transition: height 1.3s cubic-bezier(0.25, 1, 0.3, 1), opacity 1s ease;
            opacity: 0;
            height: 0;
          }

          .curtain-open {
            animation: curtainDrop 1.3s ease forwards;
          }

          .curtain-close {
            animation: curtainLift 0.9s ease forwards;
          }

          @keyframes curtainDrop {
            0% {
              height: 0;
              opacity: 0;
              transform: translateY(-10px);
            }
            60% {
              height: var(--menuHeight);
              opacity: 0.7;
              transform: translateY(3px);
            }
            100% {
              height: var(--menuHeight);
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes curtainLift {
            0% {
              height: var(--menuHeight);
              opacity: 1;
            }
            100% {
              height: 0;
              opacity: 0;
            }
          }
        }
          ul.TopMenus li a{ fontSize:16px;}
      `}</style>

      <header className="header-nav dark:bg-gray-900 transition-colors duration-300">
        <div className="container">
          <nav className="navbar navbar-expand-lg p-0">
            <Link
              className={`navbar-brand me-3 dark:text-white ${isLinkActive('/') ? 'active' : ''}`}
              href="/"
            >
              <img
                src="/examly.jpg"
                alt="Examly Logo"
                className="h-8 inline-block mr-2"
                height="50"
                width="160"
              />
            </Link>

            {/* Mobile Toggler */}
            <button
              className="navbar-toggler dark:text-white"
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon"></span>
            </button>

            {/* 🌈 Smooth Curtain Drop Menu */}
            <div
              ref={menuRef}
              className="navbar-collapse curtain-container"
              style={{
                '--menuHeight': menuRef.current?.scrollHeight + 'px',
              }}
            >
              <ul className="navbar-nav ms-auto align-items-lg-center TopMenus">
                <li className="nav-item">
                  <Link
                    className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/') ? 'active' : ''}`}
                    href="/"
                    onClick={() => setOpen(false)}
                  >
                    Home
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/dashboard/generate-paper') ? 'active' : ''}`}
                    href="/dashboard/generate-paper"
                    onClick={() => setOpen(false)}
                  >
                   Make Test
                  </Link>
                </li>
                  <li className="nav-item">
                  <Link
                    className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/quiz') ? 'active' : ''}`}
                    href="/quiz"
                    onClick={() => setOpen(false)}
                  >
                    Quiz
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/how-examly-works') ? 'active' : ''}`}
                    href="/how-examly-works"
                    onClick={() => setOpen(false)}
                  >
                    How Examly<sub>.pk</sub> Works
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/packages') ? 'active' : ''}`}
                    href="/packages"
                    onClick={() => setOpen(false)}
                  >
                    Packages
                  </Link>
                </li>

                {/* Auth UI */}
                {user ? (
                  <>
                    <li className="nav-item">
                      <button
                        onClick={() => {
                          handleUserClick();
                          setOpen(false);
                        }}
                        className={`nav-link btn btn-link dark:text-gray-300 pe-3 ${isUserLinkActive() ? 'active' : ''}`}
                      >
                        {user.email}
                      </button>
                    </li>
                    <li className="nav-item ms-2">
                      <button onClick={handleLogout} className="btn btn-danger btn-sm">
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
                        onClick={() => setOpen(false)}
                      >
                        Login
                      </Link>
                    </li>
                    <li className="nav-item ms-2">
                      <Link
                        className={`btn btn-light btn-sm dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 ${
                          isLinkActive('/auth/signup') ? 'active' : ''
                        }`}
                        href="/auth/signup"
                        onClick={() => setOpen(false)}
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
    </>
  );
}
