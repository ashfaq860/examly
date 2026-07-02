// src/components/AdminLayout.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  LayoutDashboard, Users, ShoppingBag, Settings,
  Layers, Grid, BookOpen, FilePlus, Book,
  ChevronRight, Menu, X, LogOut,
  ShieldCheck, Sparkles
} from 'lucide-react';

const supabase = createSupabaseBrowserClient();

export default function AdminLayout({ children, activeTab }: { children: React.ReactNode; activeTab?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showSidebar, setShowSidebar] = useState(false);
  const [openParents, setOpenParents] = useState<string[]>([]);
  const [scrolled, setScrolled] = useState(false);

  const navItems = [
    { id: '', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'users', label: 'User Management', icon: <Users size={18} /> },
    { id: 'orders', label: 'Order Management', icon: <ShoppingBag size={18} /> },
    {
      id: 'management',
      label: 'System Setup',
      icon: <Settings size={18} />,
      subItems: [
        { id: 'management/classes', label: 'Classes', icon: <Layers size={15} /> },
        { id: 'management/subjects', label: 'Subjects', icon: <Grid size={15} /> },
        { id: 'management/chapters', label: 'Chapters', icon: <BookOpen size={15} /> },
        { id: 'management/topics', label: 'Topics', icon: <FilePlus size={15} /> },
        { id: 'management/question-categories', label: 'Question categories', icon: <Book size={15} /> },
        { id: 'management/questions', label: 'Question Bank', icon: <Book size={15} /> }
      ]
    },
    { id: 'subject-rules', label: 'Question Rules', icon: <ShieldCheck size={18} /> },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const isItemActive = (id: string) => {
    if (id === '') return pathname === '/admin';
    return pathname?.startsWith(`/admin/${id}`);
  };

  useEffect(() => {
    const activeParents: string[] = [];
    navItems.forEach(item => {
      if (item.subItems && item.subItems.some(si => isItemActive(si.id))) {
        activeParents.push(item.id);
      }
    });
    setOpenParents(prev => Array.from(new Set([...prev, ...activeParents])));
    setShowSidebar(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // lock body scroll while the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = showSidebar ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showSidebar]);

  const toggleParent = (parentId: string) => {
    setOpenParents(prev =>
      prev.includes(parentId) ? prev.filter(id => id !== parentId) : [...prev, parentId]
    );
  };

  // Full crumb trail for the header bar: Dashboard > [Group] > Current page.
  // Groups (e.g. "System Setup") have no page of their own, so they render
  // as plain text rather than a link.
  const crumbTrail = (() => {
    const trail: { label: string; href?: string }[] = [{ label: 'Dashboard', href: '/admin' }];

    for (const item of navItems) {
      if (item.subItems) {
        const sub = item.subItems.find(si => isItemActive(si.id));
        if (sub) {
          trail.push({ label: item.label });
          trail.push({ label: sub.label, href: `/admin/${sub.id}` });
          return trail;
        }
      } else if (isItemActive(item.id) && item.id !== '') {
        trail.push({ label: item.label, href: `/admin/${item.id}` });
        return trail;
      }
    }
    return trail;
  })();

  return (
    <div className="adm-shell">
      {/* ───────── Header ───────── */}
      <header className={`adm-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="adm-header-left">
          <button
            className="adm-menu-btn"
            onClick={() => setShowSidebar(s => !s)}
            aria-label={showSidebar ? 'Close menu' : 'Open menu'}
            aria-expanded={showSidebar}
          >
            {showSidebar ? <X size={19} /> : <Menu size={19} />}
          </button>
          <Link href="/admin" className="adm-brand">
            <span className="adm-brand-mark">E</span>
            <span className="adm-brand-text">
              Examly<span className="adm-brand-sub">Admin</span>
            </span>
          </Link>
          <span className="adm-crumb-divider" aria-hidden="true" />
          <nav aria-label="breadcrumb" className="adm-crumb">
            {crumbTrail.map((crumb, idx) => (
              <span key={`${crumb.label}-${idx}`} className="adm-crumb-seg">
                {idx > 0 && <span className="adm-crumb-sep" aria-hidden="true">/</span>}
                {crumb.href && idx < crumbTrail.length - 1 ? (
                  <Link href={crumb.href} className="adm-crumb-link">{crumb.label}</Link>
                ) : (
                  <span aria-current={idx === crumbTrail.length - 1 ? 'page' : undefined}>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>

        <div className="adm-header-right">
          <span className="adm-status-pill">
            <Sparkles size={13} />
            Live
          </span>
          <button className="adm-logout-btn" onClick={handleLogout}>
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      <div className="adm-body">
        {/* ───────── Sidebar ───────── */}
        <aside className={`adm-sidebar ${showSidebar ? 'is-open' : ''}`}>
          <div className="adm-sidebar-spine" aria-hidden="true" />
          <nav className="adm-nav">
            <div className="adm-nav-label">Main menu</div>
            {navItems.map(item => (
              <div key={item.id || 'dashboard'} className="adm-nav-group">
                {item.subItems ? (
                  <>
                    <button
                      type="button"
                      className={`adm-nav-link adm-nav-parent ${openParents.includes(item.id) ? 'is-expanded' : ''} ${item.subItems.some(si => isItemActive(si.id)) ? 'is-active' : ''}`}
                      onClick={() => toggleParent(item.id)}
                      aria-expanded={openParents.includes(item.id)}
                    >
                      <span className="adm-nav-icon">{item.icon}</span>
                      <span className="adm-nav-text">{item.label}</span>
                      <ChevronRight className="adm-nav-arrow" size={14} />
                    </button>
                    <div
                      className={`adm-subnav ${openParents.includes(item.id) ? 'is-open' : ''}`}
                      style={{ '--count': item.subItems.length } as React.CSSProperties}
                    >
                      <div className="adm-subnav-inner">
                        {item.subItems.map(subItem => (
                          <Link
                            key={subItem.id}
                            href={`/admin/${subItem.id}`}
                            className={`adm-subnav-link ${isItemActive(subItem.id) ? 'is-active' : ''}`}
                          >
                            <span className="adm-subnav-dot" />
                            {subItem.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <Link
                    href={`/admin/${item.id}`}
                    className={`adm-nav-link ${isItemActive(item.id) ? 'is-active' : ''}`}
                  >
                    <span className="adm-nav-icon">{item.icon}</span>
                    <span className="adm-nav-text">{item.label}</span>
                  </Link>
                )}
              </div>
            ))}
          </nav>

          <div className="adm-sidebar-foot">
            <div className="adm-sidebar-foot-card">
              <span className="adm-sidebar-foot-label">Bilingual engine</span>
              <span className="adm-sidebar-foot-value">EN / UR</span>
            </div>
          </div>
        </aside>

        {showSidebar && (
          <button
            className="adm-overlay"
            aria-label="Close menu"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* ───────── Content ───────── */}
        <main className="adm-content">
          <div className="adm-content-inner">
            {children}
          </div>
        </main>
      </div>

      <style jsx global>{`
        :root {
          --adm-sidebar-w: 264px;
          --adm-header-h: 64px;
          --adm-navy: #101935;
          --adm-navy-soft: #1a2647;
          --adm-accent: #2f4fe0;
          --adm-accent-soft: #eef1ff;
          --adm-bg: #f5f6fb;
          --adm-surface: #ffffff;
          --adm-border: #e6e8f1;
          --adm-text: #15192b;
          --adm-muted: #686f8c;
          --adm-danger: #c8473a;
          --adm-danger-soft: #fdeeec;
          --adm-radius-lg: 16px;
          --adm-radius-md: 11px;
          --adm-radius-sm: 8px;
          --adm-font-ui: 'Lexend', 'Inter', system-ui, -apple-system, sans-serif;
          --adm-font-mono: 'JetBrains Mono', ui-monospace, monospace;
          --adm-shadow-sm: 0 1px 2px rgba(16, 25, 53, .04), 0 1px 1px rgba(16, 25, 53, .03);
          --adm-shadow-md: 0 6px 20px rgba(16, 25, 53, .08), 0 2px 6px rgba(16, 25, 53, .05);
          --adm-shadow-lg: 0 16px 40px rgba(16, 25, 53, .14);
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: .001ms !important; transition-duration: .001ms !important; }
        }

        html, body { background: var(--adm-bg); }
        body { color: var(--adm-text); font-family: var(--adm-font-ui); -webkit-font-smoothing: antialiased; }

        .adm-shell { min-height: 100vh; background: var(--adm-bg); }

        /* ───────── Header ───────── */
        .adm-header {
          position: fixed; top: 0; left: 0; right: 0; z-index: 1100;
          height: var(--adm-header-h);
          background: rgba(255, 255, 255, .92);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--adm-border);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 16px 0 14px;
          transition: box-shadow .2s ease, background .2s ease;
        }
        .adm-header.is-scrolled { box-shadow: var(--adm-shadow-sm); }

        .adm-header-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .adm-header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

        .adm-menu-btn {
          display: none; align-items: center; justify-content: center;
          width: 38px; height: 38px; border-radius: var(--adm-radius-sm);
          border: 1.5px solid var(--adm-border); background: var(--adm-surface);
          color: var(--adm-navy); cursor: pointer; flex-shrink: 0;
          transition: border-color .15s, color .15s, background .15s;
        }
        .adm-menu-btn:hover { border-color: var(--adm-accent); color: var(--adm-accent); background: var(--adm-accent-soft); }

        .adm-brand { display: flex; align-items: center; gap: 9px; text-decoration: none; flex-shrink: 0; }
        .adm-brand-mark {
          width: 30px; height: 30px; border-radius: 9px;
          background: linear-gradient(155deg, var(--adm-navy) 0%, var(--adm-accent) 130%);
          color: #fff; font-family: var(--adm-font-mono); font-weight: 700; font-size: .92rem;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 6px rgba(47, 79, 224, .35);
          flex-shrink: 0;
        }
        .adm-brand-text {
          font-weight: 700; font-size: 1.02rem; letter-spacing: -.01em; color: var(--adm-navy);
          white-space: nowrap;
        }
        .adm-brand-sub {
          font-weight: 500; color: var(--adm-muted); font-size: .82rem; margin-left: 5px;
          padding-left: 8px; border-left: 1px solid var(--adm-border);
        }

        .adm-crumb-divider { width: 1px; height: 18px; background: var(--adm-border); flex-shrink: 0; }
        .adm-crumb {
          font-size: .82rem; color: var(--adm-muted); font-weight: 500;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          display: flex; align-items: center;
        }
        .adm-crumb-seg { display: inline-flex; align-items: center; }
        .adm-crumb-sep { margin: 0 6px; color: var(--adm-border); }
        .adm-crumb-link { color: var(--adm-muted); text-decoration: none; transition: color .15s; }
        .adm-crumb-link:hover { color: var(--adm-accent); }

        .adm-status-pill {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: .72rem; font-weight: 650; letter-spacing: .03em;
          color: #1d8a52; background: #e9f9ef; border: 1px solid #c9eed9;
          padding: 5px 10px; border-radius: 99px;
        }

        .adm-logout-btn {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: .82rem; font-weight: 650; color: var(--adm-navy);
          background: var(--adm-bg); border: 1.5px solid var(--adm-border);
          padding: 7px 14px; border-radius: 99px; cursor: pointer;
          transition: all .15s; font-family: var(--adm-font-ui);
        }
        .adm-logout-btn:hover { background: var(--adm-danger-soft); border-color: #f3cac4; color: var(--adm-danger); }
        .adm-logout-btn span { display: inline; }

        /* ───────── Body / layout grid ───────── */
        .adm-body { display: flex; padding-top: var(--adm-header-h); min-height: 100vh; }

        /* ───────── Sidebar ───────── */
        .adm-sidebar {
          width: var(--adm-sidebar-w); flex-shrink: 0;
          background: var(--adm-surface);
          border-right: 1px solid var(--adm-border);
          position: fixed; top: var(--adm-header-h); left: 0; bottom: 0;
          display: flex; flex-direction: column;
          overflow: hidden;
          z-index: 1090;
        }
        .adm-sidebar-spine {
          position: absolute; top: 0; left: 0; bottom: 0; width: 3px;
          background: linear-gradient(180deg, var(--adm-accent), var(--adm-navy) 70%);
        }

        .adm-nav { flex: 1; overflow-y: auto; padding: 18px 14px 8px; }
        .adm-nav-label {
          font-size: .68rem; text-transform: uppercase; letter-spacing: .09em;
          color: var(--adm-muted); font-weight: 700; margin: 0 10px 10px;
        }
        .adm-nav-group { margin-bottom: 2px; }

        .adm-nav-link {
          display: flex; align-items: center; width: 100%; gap: 11px;
          padding: 9px 11px; border-radius: var(--adm-radius-sm);
          color: var(--adm-text); font-weight: 550; font-size: .87rem;
          background: transparent; border: none; text-decoration: none;
          cursor: pointer; transition: background .15s, color .15s;
          font-family: var(--adm-font-ui); text-align: left;
        }
        .adm-nav-link:hover { background: var(--adm-bg); color: var(--adm-accent); }
        .adm-nav-link.is-active { background: var(--adm-accent-soft); color: var(--adm-accent); font-weight: 650; }

        .adm-nav-icon { display: flex; align-items: center; opacity: .75; flex-shrink: 0; }
        .adm-nav-link.is-active .adm-nav-icon { opacity: 1; }
        .adm-nav-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .adm-nav-arrow { transition: transform .2s ease; flex-shrink: 0; opacity: .6; }
        .adm-nav-parent.is-expanded .adm-nav-arrow { transform: rotate(90deg); }

        .adm-subnav {
          display: grid; grid-template-rows: 0fr; overflow: hidden;
          transition: grid-template-rows .22s ease;
        }
        .adm-subnav.is-open { grid-template-rows: 1fr; }
        .adm-subnav-inner { min-height: 0; padding-left: 16px; margin-top: 2px; }

        .adm-subnav-link {
          display: flex; align-items: center; gap: 9px;
          padding: 7px 11px; font-size: .81rem; color: var(--adm-muted);
          text-decoration: none; border-radius: var(--adm-radius-sm);
          transition: color .15s, background .15s;
        }
        .adm-subnav-dot {
          width: 5px; height: 5px; border-radius: 50%; background: var(--adm-border);
          flex-shrink: 0; transition: background .15s;
        }
        .adm-subnav-link:hover { color: var(--adm-accent); background: var(--adm-bg); }
        .adm-subnav-link:hover .adm-subnav-dot { background: var(--adm-accent); }
        .adm-subnav-link.is-active { color: var(--adm-accent); font-weight: 650; }
        .adm-subnav-link.is-active .adm-subnav-dot { background: var(--adm-accent); }

        .adm-sidebar-foot { padding: 12px 16px 18px; border-top: 1px solid var(--adm-border); flex-shrink: 0; }
        .adm-sidebar-foot-card {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--adm-navy); border-radius: var(--adm-radius-md);
          padding: 11px 13px;
        }
        .adm-sidebar-foot-label { font-size: .72rem; color: #aab3d6; font-weight: 550; }
        .adm-sidebar-foot-value {
          font-family: var(--adm-font-mono); font-size: .76rem; font-weight: 700;
          color: #fff; background: rgba(255,255,255,.12); padding: 2px 8px; border-radius: 6px;
        }

        .adm-overlay {
          display: none; position: fixed; inset: var(--adm-header-h) 0 0 0;
          background: rgba(15, 20, 40, .45); backdrop-filter: blur(2px);
          border: none; z-index: 1080; cursor: pointer;
        }

        /* ───────── Content ───────── */
        .adm-content { flex: 1; min-width: 0; margin-left: var(--adm-sidebar-w); }
        .adm-content-inner { max-width: 1480px; }

        /* ───────── Responsive ───────── */
        @media (max-width: 991px) {
          .adm-menu-btn { display: flex; }
          .adm-brand-sub { display: none; }
          .adm-crumb-divider, .adm-crumb { display: none; }

          .adm-sidebar {
            transform: translateX(-100%);
            transition: transform .25s ease;
            box-shadow: var(--adm-shadow-lg);
            width: min(82vw, 300px);
          }
          .adm-sidebar.is-open { transform: translateX(0); }

          .adm-overlay { display: block; }

          .adm-content { margin-left: 0; }
        }

        @media (max-width: 560px) {
          .adm-header { padding: 0 10px; }
          .adm-logout-btn span { display: none; }
          .adm-logout-btn { padding: 9px; }
          .adm-status-pill { display: none; }
          .adm-brand-text { font-size: .94rem; }
        }
      `}</style>
    </div>
  );
}