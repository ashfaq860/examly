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
  const [isAnimating, setIsAnimating] = useState(false);
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

  // Handle menu toggle with smooth animation
  const handleMenuToggle = () => {
    if (isAnimating) return;
    
    if (window.innerWidth >= 992) {
      setOpen(false);
      return;
    }
    
    if (!open) {
      // Opening animation - slower on mobile
      setIsAnimating(true);
      setOpen(true);
      
      // Force reflow to ensure transition starts
      if (menuRef.current) {
        menuRef.current.style.display = 'block';
        menuRef.current.offsetHeight;
      }
      
      setTimeout(() => {
        setIsAnimating(false);
      }, 600); // Increased duration for mobile
    } else {
      // Closing animation - slower on mobile
      setIsAnimating(true);
      
      if (menuRef.current) {
        menuRef.current.classList.add('closing');
      }
      
      setTimeout(() => {
        setOpen(false);
        setIsAnimating(false);
        if (menuRef.current) {
          menuRef.current.classList.remove('closing');
          menuRef.current.style.display = 'none';
        }
      }, 500); // Increased duration for mobile
    }
  };

  // Handle link click - close menu smoothly
  const handleLinkClick = () => {
    if (window.innerWidth < 992) {
      if (menuRef.current) {
        menuRef.current.classList.add('closing');
        
        setTimeout(() => {
          setOpen(false);
          if (menuRef.current) {
            menuRef.current.classList.remove('closing');
            menuRef.current.style.display = 'none';
          }
        }, 400);
      } else {
        setOpen(false);
      }
    }
  };

  // Close menu when clicking outside (mobile only)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (window.innerWidth < 992 && 
          menuRef.current && 
          !menuRef.current.contains(event.target) &&
          !event.target.closest('.navbar-toggler') &&
          open) {
        handleLinkClick();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  // Close menu on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 992 && open) {
        setOpen(false);
        if (menuRef.current) {
          menuRef.current.style.display = '';
          menuRef.current.classList.remove('closing');
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open]);

  return (
    <>
      <style jsx>{`
        /* Smooth Curtain Animation with slower timing (mobile only) */
        @media (max-width: 991px) {
          .curtain-container {
            max-height: 0;
            opacity: 0;
            overflow: hidden;
            transform: translateY(-15px);
            transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); /* Slower, bouncier easing */
            display: none;
          }

          .curtain-container.open {
            max-height: 1200px; /* Large enough for menu */
            opacity: 1;
            transform: translateY(0);
            display: block;
            transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); /* Slower opening */
          }

          .curtain-container.closing {
            max-height: 0 !important;
            opacity: 0 !important;
            transform: translateY(-15px) !important;
            transition: all 0.5s cubic-bezier(0.36, 0, 0.66, -0.56) !important; /* Slower closing with bounce */
          }

          /* Enhanced hover effects for mobile menu items */
          .curtain-container .navbar-nav {
            padding: 1rem 0;
            opacity: 1;
            transition: opacity 0.3s ease;
          }

          .curtain-container.closing .navbar-nav {
            opacity: 0.8;
          }

          /* Mobile menu items styling */
          .curtain-container .navbar-nav .nav-item {
            margin: 4px 0;
            border-radius: 8px;
            transition: all 0.3s ease;
          }

          .curtain-container .navbar-nav .nav-link {
            padding: 12px 20px !important;
            border-radius: 8px;
            transition: all 0.3s ease;
            display: block;
            width: 100%;
            text-align: left;
            font-size: 16px;
            position: relative;
            color: #333;
            background: transparent;
          }

          .dark .curtain-container .navbar-nav .nav-link {
            color: #e5e7eb;
          }

          /* Hover effect for mobile menu items */
          .curtain-container .navbar-nav .nav-item:hover .nav-link,
          .curtain-container .navbar-nav .nav-item:active .nav-link,
          .curtain-container .navbar-nav .nav-item:focus-within .nav-link {
            background-color: rgba(59, 130, 246, 0.1);
            color: #2563eb;
            transform: translateX(5px);
          }

          .dark .curtain-container .navbar-nav .nav-item:hover .nav-link,
          .dark .curtain-container .navbar-nav .nav-item:active .nav-link,
          .dark .curtain-container .navbar-nav .nav-item:focus-within .nav-link {
            background-color: rgba(96, 165, 250, 0.2);
            color: #60a5fa;
          }

          /* Active link styling for mobile */
          .curtain-container .navbar-nav .nav-link.active {
            background-color: rgba(37, 99, 235, 0.15);
            color: #2563eb;
            font-weight: 600;
          }

          .dark .curtain-container .navbar-nav .nav-link.active {
            background-color: rgba(96, 165, 250, 0.25);
            color: #60a5fa;
          }

          /* Mobile button styling */
          .curtain-container .btn {
            padding: 10px 20px !important;
            border-radius: 8px;
            transition: all 0.3s ease;
            text-align: center;
            width: 100%;
            margin: 8px 0;
          }

          .curtain-container .btn:hover,
          .curtain-container .btn:active {
            transform: scale(0.98);
            opacity: 0.9;
          }

          /* Mobile auth button styling */
          .curtain-container .navbar-nav .btn-link {
            text-decoration: none;
            padding: 12px 20px !important;
            text-align: left;
          }

          .curtain-container .navbar-nav .btn-link:hover,
          .curtain-container .navbar-nav .btn-link:active {
            background-color: rgba(59, 130, 246, 0.1);
            text-decoration: none;
          }

          .dark .curtain-container .navbar-nav .btn-link:hover,
          .dark .curtain-container .navbar-nav .btn-link:active {
            background-color: rgba(96, 165, 250, 0.2);
          }
        }

        /* Desktop styles - keep original speed */
        @media (min-width: 992px) {
          .curtain-container {
            display: flex !important;
            max-height: none !important;
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }

          /* Desktop hover effects */
          .curtain-container .navbar-nav .nav-link {
            transition: all 0.2s ease;
            padding: 0.5rem 1rem;
            border-radius: 4px;
          }

          .curtain-container .navbar-nav .nav-link:hover {
            background-color: rgba(0, 0, 0, 0.05);
            color: #2563eb;
          }

          .dark .curtain-container .navbar-nav .nav-link:hover {
            background-color: rgba(255, 255, 255, 0.1);
            color: #60a5fa;
          }

          .curtain-container .navbar-nav .nav-link.active {
            color: #2563eb;
            font-weight: 600;
          }

          .dark .curtain-container .navbar-nav .nav-link.active {
            color: #60a5fa;
          }
        }
        
        /* Common active link underline for desktop */
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

        /* Mobile toggler animation */
        .navbar-toggler {
          transition: all 0.3s;
          position: relative;
          z-index: 1000;
        }

        .navbar-toggler:focus {
          box-shadow: none;
          outline: none;
        }

        .navbar-toggler .navbar-toggler-icon {
          transition: all 0.3s;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%280, 0, 0, 0.75%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
        }

        .dark .navbar-toggler .navbar-toggler-icon {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%28255, 255, 255, 0.75%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
        }

        .navbar-toggler.open .navbar-toggler-icon {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%280, 0, 0, 0.75%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M6 6L24 24M6 24L24 6'/%3e%3c/svg%3e");
          transform: rotate(180deg);
        }

        .dark .navbar-toggler.open .navbar-toggler-icon {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%28255, 255, 255, 0.75%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M6 6L24 24M6 24L24 6'/%3e%3c/svg%3e");
        }

        /* Animation for hamburger to X */
        @keyframes hamburgerToX {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(180deg);
          }
        }

        .navbar-toggler.open .navbar-toggler-icon {
          animation: hamburgerToX 0.3s ease forwards;
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

            {/* Dark Mode Toggle (Mobile) 
            <button
              onClick={toggleDarkMode}
              className="dark-toggle-btn me-3 d-lg-none"
              aria-label="Toggle dark mode"
            >
              {darkMode ? '🌙 Dark' : '☀️ Light'}
            </button>
*/}
            {/* Mobile Toggler with animation */}
            <button
              className={`navbar-toggler dark:text-white ${open ? 'open' : ''}`}
              type="button"
              onClick={handleMenuToggle}
              aria-label="Toggle navigation"
              aria-expanded={open}
              disabled={isAnimating}
            >
              <span className="navbar-toggler-icon"></span>
            </button>

            {/* Smooth Curtain Menu */}
            <div
              ref={menuRef}
              className={`navbar-collapse curtain-container ${open ? 'open' : ''}`}
            >
              <ul className="navbar-nav ms-auto align-items-lg-center TopMenus">
                <li className="nav-item">
                  <Link
                    prefetch={true}
                    className={`nav-link dark:text-gray-300 ${isLinkActive('/') ? 'active' : ''}`}
                    href="/"
                    onClick={handleLinkClick}
                  >
                    Home
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    prefetch={true}
                    className={`nav-link dark:text-gray-300 ${isLinkActive('/dashboard/generate-paper') ? 'active' : ''}`}
                    href="/dashboard/generate-paper"
                    onClick={handleLinkClick}
                  >
                    Make Test
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    prefetch={true}
                    className={`nav-link dark:text-gray-300 ${isLinkActive('/quiz') ? 'active' : ''}`}
                    href="/quiz"
                    onClick={handleLinkClick}
                  >
                    Quiz
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    prefetch={true}
                    className={`nav-link dark:text-gray-300 ${isLinkActive('/how-examly-works') ? 'active' : ''}`}
                    href="/how-examly-works"
                    onClick={handleLinkClick}
                  >
                    How Examly<sub>.pk</sub> Works
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    prefetch={true}
                    className={`nav-link dark:text-gray-300 ${isLinkActive('/packages') ? 'active' : ''}`}
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
                    <li className="nav-item ms-lg-2">
                      <button 
                        onClick={() => {
                          handleLogout();
                          handleLinkClick();
                        }} 
                        className="btn btn-danger btn-sm w-100 w-lg-auto"
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
                    <li className="nav-item ms-lg-2">
                      <Link
                        prefetch={true}
                        className={`btn btn-light btn-sm dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 w-100 w-lg-auto ${
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