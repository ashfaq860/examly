// src/components/Header.tsx
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
  const isNavigating = useRef(false);
  const menuHeightRef = useRef(0);

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

  // Handle link click with immediate navigation
  const handleLinkClick = (e) => {
    // For mobile, close menu immediately without animation
    if (window.innerWidth < 992) {
      isNavigating.current = true;
      const menuEl = menuRef.current;
      if (menuEl) {
        // Immediately hide menu without animation
        menuEl.style.transition = 'none';
        menuEl.style.height = '0';
        menuEl.style.opacity = '0';
        menuEl.style.overflow = 'hidden';
        
        // Reset after a tiny delay
        setTimeout(() => {
          menuEl.style.transition = '';
          menuEl.style.overflow = '';
        }, 50);
      }
    }
    setOpen(false);
  };

  // 🎬 Smooth Curtain Animation (mobile only)
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    // Store menu height for animation
    if (open && menuHeightRef.current === 0) {
      menuHeightRef.current = el.scrollHeight;
    }

    if (window.innerWidth >= 992) {
      // Desktop: menu always visible
      el.classList.remove('curtain-open', 'curtain-close');
      el.style.height = 'auto';
      el.style.opacity = '1';
      el.style.overflow = 'visible';
      isNavigating.current = false;
    } else {
      // Mobile: apply curtain animation only if not navigating
      if (isNavigating.current) {
        isNavigating.current = false;
        return;
      }

      if (open) {
        el.classList.add('curtain-open');
        el.classList.remove('curtain-close');
        el.style.height = `${menuHeightRef.current}px`;
        el.style.opacity = '1';
      } else {
        el.classList.add('curtain-close');
        el.classList.remove('curtain-open');
        el.style.height = '0';
        el.style.opacity = '0';
      }
    }
  }, [open]);

  // Reset menu height on window resize
  useEffect(() => {
    const handleResize = () => {
      menuHeightRef.current = 0;
      if (window.innerWidth >= 992) {
        setOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <style jsx>{`
        /* Curtain Animation (mobile only) */
        @media (max-width: 991px) {
          .curtain-container {
            overflow: hidden;
            transition: height 0.5s cubic-bezier(0.25, 1, 0.3, 1), opacity 0.4s ease;
            opacity: 0;
            height: 0;
          }

          .curtain-open {
            animation: curtainDrop 0.5s ease forwards;
          }

          .curtain-close {
            animation: curtainLift 0.4s ease forwards;
          }

          @keyframes curtainDrop {
            0% {
              height: 0;
              opacity: 0;
              transform: translateY(-10px);
            }
            60% {
              opacity: 0.7;
              transform: translateY(3px);
            }
            100% {
              height: var(--menuHeight, auto);
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes curtainLift {
            0% {
              opacity: 1;
            }
            100% {
              height: 0;
              opacity: 0;
            }
          }
        }
        
        ul.TopMenus li a {
          font-size: 16px;
          position: relative;
        }
        
        ul.TopMenus li a.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background-color: currentColor;
          border-radius: 1px;
        }
        
        /* Dark mode toggle button style */
        .dark-toggle-btn {
          background: none;
          border: 1px solid #ddd;
          border-radius: 20px;
          padding: 5px 12px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s;
        }
        
        .dark-toggle-btn:hover {
          background-color: #f0f0f0;
        }
        
        .dark .dark-toggle-btn {
          border-color: #555;
          color: #fff;
        }
        
        .dark .dark-toggle-btn:hover {
          background-color: #333;
        }
      `}</style>

      <header className="header-nav dark:bg-gray-900 transition-colors duration-300">
        <div className="container">
          <nav className="navbar navbar-expand-lg p-0">
            <Link
              className={`navbar-brand me-3 dark:text-white ${isLinkActive('/') ? 'active' : ''}`}
              href="/"
              onClick={handleLinkClick}
            >
              <img
                src="/examly.jpg"
                alt="Examly Logo"
                className="h-8 inline-block mr-2"
                height="50"
                width="160"
              />
            </Link>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="dark-toggle-btn me-3 d-lg-none"
              aria-label="Toggle dark mode"
            >
              {darkMode ? '🌙 Dark' : '☀️ Light'}
            </button>

            {/* Mobile Toggler */}
            <button
              className="navbar-toggler dark:text-white"
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation"
              aria-expanded={open}
            >
              <span className="navbar-toggler-icon"></span>
            </button>

            {/* 🌈 Smooth Curtain Drop Menu */}
            <div
              ref={menuRef}
              className="navbar-collapse curtain-container"
              style={{
                '--menuHeight': `${menuHeightRef.current}px`,
              }}
            >
              <ul className="navbar-nav ms-auto align-items-lg-center TopMenus">
                <li className="nav-item">
                  <Link
                    prefetch={true}
                    className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/') ? 'active' : ''}`}
                    href="/"
                    onClick={handleLinkClick}
                  >
                    Home
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    prefetch={true}
                    className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/dashboard/generate-paper') ? 'active' : ''}`}
                    href="/dashboard/generate-paper"
                    onClick={handleLinkClick}
                  >
                    Make Test
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    prefetch={true}
                    className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/quiz') ? 'active' : ''}`}
                    href="/quiz"
                    onClick={handleLinkClick}
                  >
                    Quiz
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    prefetch={true}
                    className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/how-examly-works') ? 'active' : ''}`}
                    href="/how-examly-works"
                    onClick={handleLinkClick}
                  >
                    How Examly<sub>.pk</sub> Works
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    prefetch={true}
                    className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/packages') ? 'active' : ''}`}
                    href="/packages"
                    onClick={handleLinkClick}
                  >
                    Packages
                  </Link>
                </li>

                {/* Dark Mode Toggle (Desktop) 
                <li className="nav-item d-none d-lg-block">
                  <button
                    onClick={toggleDarkMode}
                    className="dark-toggle-btn ms-2"
                    aria-label="Toggle dark mode"
                  >
                    {darkMode ? '🌙 Dark' : '☀️ Light'}
                  </button>
                </li>
*/}
                {/* Auth UI */}
                {user ? (
                  <>
                    <li className="nav-item">
                      <button
                        onClick={() => {
                          handleUserClick();
                          handleLinkClick();
                        }}
                        className={`nav-link btn btn-link dark:text-gray-300 pe-3 ${isUserLinkActive() ? 'active' : ''}`}
                      >
                        {user.email}
                      </button>
                    </li>
                    <li className="nav-item ms-2">
                      <button 
                        onClick={() => {
                          handleLogout();
                          handleLinkClick();
                        }} 
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
                        prefetch={true}
                        className={`nav-link dark:text-gray-300 pe-3 ${isLinkActive('/auth/login') ? 'active' : ''}`}
                        href="/auth/login"
                        onClick={handleLinkClick}
                      >
                        Login
                      </Link>
                    </li>
                    <li className="nav-item ms-2">
                      <Link
                        prefetch={true}
                        className={`btn btn-light btn-sm dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 ${
                          isLinkActive('/auth/signup') ? 'active' : ''
                        }`}
                        href="/auth/signup"
                        onClick={handleLinkClick}
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