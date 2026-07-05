// src/components/Header.tsx
'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { User, LogOut } from 'lucide-react';

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [activeLink, setActiveLink] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef(null);

  useEffect(() => setActiveLink(pathname), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data: roleData } = await supabase.rpc('get_user_role', { user_id: session.user.id });
        if (roleData) setRole(roleData);
      } else {
        setUser(null);
        setRole(null);
      }
    };
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        supabase.rpc('get_user_role', { user_id: session.user.id }).then(({ data }) => {
          if (data) setRole(data);
        });
      } else {
        setUser(null);
        setRole(null);
      }
    });

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

  const handleMenuToggle = () => {
    if (isAnimating) return;
    if (window.innerWidth >= 992) { setOpen(false); return; }

    if (!open) {
      setIsAnimating(true);
      setOpen(true);
      if (menuRef.current) {
        menuRef.current.style.display = 'block';
        menuRef.current.offsetHeight;
      }
      setTimeout(() => setIsAnimating(false), 500);
    } else {
      setIsAnimating(true);
      if (menuRef.current) menuRef.current.classList.add('closing');
      setTimeout(() => {
        setOpen(false);
        setIsAnimating(false);
        if (menuRef.current) {
          menuRef.current.classList.remove('closing');
          menuRef.current.style.display = 'none';
        }
      }, 400);
    }
  };

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
        }, 350);
      } else {
        setOpen(false);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (window.innerWidth < 992 &&
          menuRef.current &&
          !menuRef.current.contains(event.target) &&
          !event.target.closest('.navbar-toggler') && open) {
        handleLinkClick();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

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
        /* ── Mobile menu curtain ── */
        @media (max-width: 991px) {
          .curtain-container {
            max-height: 0;
            opacity: 0;
            overflow-y: auto;
            transform: translateY(-12px);
            transition: max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                        opacity 0.4s ease,
                        transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            display: none;
            position: fixed;
            top: var(--header-h, 64px);
            left: 0;
            right: 0;
            z-index: 999;
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-top: 1px solid var(--border-subtle);
            border-bottom: 1px solid var(--border-subtle);
            box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
            padding: 0.5rem 1rem 1rem;
          }

          .dark .curtain-container {
            background: rgba(15, 23, 42, 0.97);
            border-bottom-color: rgba(255,255,255,0.08);
          }

          .curtain-container.open {
            max-height: calc(100vh - var(--header-h, 64px));
            opacity: 1;
            transform: translateY(0);
            display: block;
          }

          .curtain-container.closing {
            max-height: 0 !important;
            opacity: 0 !important;
            transform: translateY(-12px) !important;
            transition: all 0.35s ease-in !important;
          }

          .curtain-container .navbar-nav { padding: 0.5rem 0; gap: 2px; }

          .curtain-container .nav-item { margin: 0; }

          .curtain-container .nav-link {
            padding: 0.65rem 0.9rem !important;
            border-radius: var(--radius-md);
            font-size: 0.9rem;
            font-weight: 500;
            color: var(--text-secondary) !important;
            transition: all 0.2s ease;
            display: block;
            width: 100%;
          }

          .dark .curtain-container .nav-link { color: rgba(226,232,240,0.85) !important; }

          .curtain-container .nav-link:hover,
          .curtain-container .nav-link:active {
            background: var(--brand-primary-50);
            color: var(--brand-primary) !important;
            transform: translateX(3px);
          }

          .dark .curtain-container .nav-link:hover,
          .dark .curtain-container .nav-link:active {
            background: rgba(43, 167, 255, 0.08);
            color: var(--brand-primary-400) !important;
          }

          .curtain-container .nav-link.active {
            background: var(--brand-primary-50);
            color: var(--brand-primary) !important;
            font-weight: 600;
          }

          .dark .curtain-container .nav-link.active {
            background: rgba(43, 167, 255, 0.1);
            color: var(--brand-primary-400) !important;
          }

          .curtain-container .mobile-divider {
            height: 1px;
            background: var(--border-subtle);
            margin: 0.5rem 0.25rem;
          }

          .curtain-container .mobile-actions {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            padding-top: 0.5rem;
          }

          .curtain-container .mobile-actions .btn {
            width: 100%;
            padding: 0.6rem 1rem;
            font-size: 0.9rem;
          }
        }

        /* ── Desktop ── */
        @media (min-width: 992px) {
          .curtain-container {
            display: flex !important;
            max-height: none !important;
            opacity: 1 !important;
            transform: none !important;
            position: static;
            background: transparent;
            border: none;
            box-shadow: none;
            padding: 0;
          }

          .navbar-nav { flex-wrap: nowrap; }

          .navbar-nav .nav-item { flex-shrink: 0; }

          .navbar-nav .nav-link {
            padding: 0.42rem 0.85rem !important;
            border-radius: var(--radius-md);
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--text-secondary) !important;
            text-decoration: none !important;
            white-space: nowrap;
            transition: background 0.18s ease, color 0.18s ease;
          }

          .navbar-nav .nav-link:hover {
            background: var(--brand-primary-50);
            color: var(--brand-primary) !important;
            text-decoration: none !important;
          }

          .navbar-nav .nav-link.active {
            background: var(--brand-primary-50);
            color: var(--brand-primary) !important;
            font-weight: 600;
            text-decoration: none !important;
          }
        }

        /* ── Toggler ── */
        .navbar-toggler {
          padding: 6px 8px;
          border: 1.5px solid var(--border-subtle);
          border-radius: var(--radius-md);
          background: var(--surface);
          transition: all 0.2s ease;
          position: relative;
          z-index: 1001;
        }

        .navbar-toggler:hover {
          border-color: var(--brand-primary);
          background: var(--brand-primary-50);
        }

        .navbar-toggler:focus { box-shadow: none; outline: none; }

        .navbar-toggler .navbar-toggler-icon {
          transition: all 0.3s ease;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba(51,65,85,0.9)' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2.2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
          width: 20px; height: 20px;
        }

        .dark .navbar-toggler .navbar-toggler-icon {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba(226,232,240,0.9)' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2.2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
        }

        .navbar-toggler.open .navbar-toggler-icon {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba(51,65,85,0.9)' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2.2' d='M6 6L24 24M6 24L24 6'/%3e%3c/svg%3e");
          transform: rotate(90deg);
        }

        .dark .navbar-toggler.open .navbar-toggler-icon {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba(226,232,240,0.9)' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2.2' d='M6 6L24 24M6 24L24 6'/%3e%3c/svg%3e");
        }

        /* ── User account cluster ── */
        .user-cluster {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .user-chip {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          border: 1px solid var(--border-subtle);
          background: var(--surface-muted);
          border-radius: var(--radius-pill, 999px);
          padding: 0.3rem 0.85rem 0.3rem 0.4rem;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-secondary) !important;
          line-height: 1.2;
          transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
        }

        .user-chip:hover,
        .user-chip.active {
          background: var(--brand-primary-50);
          border-color: var(--brand-primary-400);
          color: var(--brand-primary) !important;
        }

        .user-chip-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--brand-primary-50);
          color: var(--brand-primary);
          flex-shrink: 0;
        }

        .user-chip.active .user-chip-avatar,
        .user-chip:hover .user-chip-avatar {
          background: #fff;
        }

        .user-email-text {
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .signout-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          background: var(--brand-danger);
          color: #fff;
          border: none;
          border-radius: var(--radius-pill, 999px);
          font-size: 0.82rem;
          font-weight: 600;
          padding: 0.42rem 0.95rem;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
        }

        .signout-btn:hover {
          background: #dc2626;
          box-shadow: var(--shadow-sm);
          color: #fff;
        }

        .signout-btn:active { transform: scale(0.97); }

        @media (max-width: 991px) {
          .user-cluster {
            width: 100%;
            justify-content: space-between;
          }

          .user-chip { flex: 1 1 auto; min-width: 0; }
        }

        /* ── Header scroll shadow ── */
        .header-nav { transition: box-shadow 0.3s ease, background 0.3s ease; }
        .header-nav.scrolled { box-shadow: var(--shadow-md); }
      `}</style>

      <header className={`header-nav ${(scrolled || open) ? 'scrolled' : ''}`} style={{ position: 'fixed', top: 0, width: '100%', zIndex: 1000 }}>
        <div className="container">
          <nav className="navbar navbar-expand-lg p-0" style={{ position: 'relative' }}>

            {/* Brand */}
            <Link
              className={`navbar-brand me-3 ${isLinkActive('/') ? 'active' : ''}`}
              href="/"
              onClick={handleLinkClick}
            >
              <img
                src="/examly.png"
                alt="Examly Logo"
                height="38"
                width="140"
                style={{ height: '38px', width: 'auto' }}
              />
            </Link>

            {/* Mobile toggler */}
            <button
              className={`navbar-toggler ${open ? 'open' : ''}`}
              type="button"
              onClick={handleMenuToggle}
              aria-label="Toggle navigation"
              aria-expanded={open}
              disabled={isAnimating}
            >
              <span className="navbar-toggler-icon"></span>
            </button>

            {/* Nav menu */}
            <div
              ref={menuRef}
              className={`navbar-collapse curtain-container ${open ? 'open' : ''}`}
            >
              <ul className="navbar-nav ms-auto align-items-lg-center" style={{ gap: '2px' }}>
                {[
                  { href: '/', label: 'Home' },
                  { href: '/dashboard/generate-paper', label: 'Make Test' },
                  { href: '/quiz', label: 'Quiz' },
                  { href: '/how-examly-works', label: 'How It Works' },
                  { href: '/packages', label: 'Packages' },
                ].map(({ href, label }) => (
                  <li key={href} className="nav-item">
                    <Link
                      prefetch={true}
                      className={`nav-link ${isLinkActive(href) ? 'active' : ''}`}
                      href={href}
                      onClick={handleLinkClick}
                    >
                      {label}
                    </Link>
                  </li>
                ))}

                {/* Desktop divider */}
                <li className="nav-item d-none d-lg-block" aria-hidden="true">
                  <span style={{ display: 'block', width: 1, height: 20, background: 'var(--border-medium)', margin: '0 8px', alignSelf: 'center' }} />
                </li>

                {/* Mobile divider */}
                <li className="nav-item d-lg-none"><div className="mobile-divider" /></li>

                {user ? (
                  <li className="nav-item w-100 w-lg-auto">
                    <div className="user-cluster">
                      <button
                        onClick={() => { handleUserClick(); handleLinkClick(); }}
                        className={`user-chip ${isUserLinkActive() ? 'active' : ''}`}
                        title={user.email}
                      >
                        <span className="user-chip-avatar">
                          <User size={14} strokeWidth={2.25} />
                        </span>
                        <span className="user-email-text">{user.email}</span>
                      </button>
                      <button
                        onClick={() => { handleLogout(); handleLinkClick(); }}
                        className="signout-btn"
                      >
                        <LogOut size={14} strokeWidth={2.25} />
                        Sign out
                      </button>
                    </div>
                  </li>
                ) : (
                  <li className="nav-item">
                    <div className="d-flex align-items-center gap-2 flex-column flex-lg-row">
                      <Link
                        prefetch={true}
                        className={`nav-link ${isLinkActive('/auth/login') ? 'active' : ''}`}
                        href="/auth/login"
                        onClick={handleLinkClick}
                      >
                        Login
                      </Link>
                      <Link
                        prefetch={true}
                        className="btn btn-gradient btn-sm w-100 w-lg-auto"
                        href="/auth/signup"
                        onClick={handleLinkClick}
                        style={{ padding: '0.4rem 1.1rem', fontSize: '0.85rem' }}
                      >
                        <span>Get Started</span>
                      </Link>
                    </div>
                  </li>
                )}
              </ul>
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}
