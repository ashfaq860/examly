// src/components/AcademyLayout.tsx
"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  LayoutDashboard, FilePlus, Archive, Gem, UserCircle,
  Settings, Sun, Moon, GraduationCap, Zap, X, LogOut, ChevronRight,
  ClipboardCheck, Lock, Users,
} from "lucide-react";
import Header from "@/components/academy/Header";
import { useUser } from "@/app/context/userContext";
import { useEntitlements } from "@/hooks/useEntitlements";
import { UpgradeModal } from "@/components/UpgradeModal";
import Footer from "@/components/Footer";
import ReferralSection from "@/components/ReferralSection";
import BreadcrumbAuto from "@/components/BreadcrumbAuto";

const supabase = createSupabaseBrowserClient();
let cachedUser: any = null;

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(cachedUser);
  const { trialStatus, isLoading } = useUser();
  const { hasFeature } = useEntitlements();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const hasFetchedUser = useRef(false);

  useEffect(() => {
    if (cachedUser || hasFetchedUser.current) return;
    hasFetchedUser.current = true;
    const loadUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        cachedUser = data.session.user;
        setUser(data.session.user);
      }
    };
    loadUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      cachedUser = session?.user ?? null;
      setUser(cachedUser);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const disableContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", disableContextMenu);
    return () => document.removeEventListener("contextmenu", disableContextMenu);
  }, []);

  const handleLogout = async () => {
    cachedUser = null;
    hasFetchedUser.current = false;
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  type SidebarLink = { path: string; icon: typeof LayoutDashboard; label: string; locked?: boolean };

  const sidebarLinks = useMemo<SidebarLink[]>(() => {
    const links: SidebarLink[] = [
      { path: "/dashboard",                icon: LayoutDashboard, label: "Dashboard" },
      { path: "/dashboard/generate-paper", icon: FilePlus,        label: "Generate Paper" },
      { path: "/dashboard/saved-papers",   icon: Archive,         label: "Saved Papers" },
      { path: "/dashboard/checker",        icon: ClipboardCheck,  label: "Paper Checker", locked: !hasFeature('paper_checker') },
    ];
    // Only academy owners manage seats — role alone doesn't guarantee an
    // owned academies row, but the link just routes to a page that 403s
    // gracefully for anyone else, same defense-in-depth as the checker gate.
    if (trialStatus?.role === 'academy') {
      links.push({ path: "/dashboard/academy/members", icon: Users, label: "Academy Members" });
    }
    links.push(
      { path: "/dashboard/packages",       icon: Gem,             label: "Premium Plans" },
      { path: "/dashboard/profile",        icon: UserCircle,      label: "Profile" },
      { path: "/dashboard/settings",       icon: Settings,        label: "Settings" },
    );
    return links;
  }, [hasFeature, trialStatus?.role]);

  const isActive = (path: string) =>
    path === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(path);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") setDarkMode(true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const PlanStatus = () => {
    if (isLoading) return (
      <div className="p-3 mb-3" style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="spinner-border spinner-border-sm text-primary" />
      </div>
    );

    return (
      <div
        className="mb-3 p-3"
        style={{
          background: darkMode ? 'rgba(30,41,59,0.8)' : 'linear-gradient(135deg, #eff6ff 0%, #f0fdfa 100%)',
          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'var(--border-subtle)'}`,
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(7,62,140,0.25)',
            }}
          >
            <Zap size={14} color="#fff" fill="#fff" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: darkMode ? '#94a3b8' : '#64748b' }}>
              Current Plan
            </p>
            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: darkMode ? '#e2e8f0' : 'var(--brand-primary)' }}>
              {trialStatus?.subscriptionName || "Free Trial"}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/packages"
          style={{
            display: 'block', textAlign: 'center', padding: '0.45rem 0.75rem',
            background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
            color: '#fff', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.8rem',
            textDecoration: 'none', transition: 'opacity 0.2s, transform 0.2s',
          }}
        >
          Upgrade Plan
        </Link>
      </div>
    );
  };

  const UserProfile = () => (
    <div style={{ borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'var(--border-subtle)'}`, paddingTop: '0.75rem', marginTop: '0.25rem' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.6rem',
          borderRadius: 'var(--radius-md)', marginBottom: 4,
          background: darkMode ? 'rgba(255,255,255,0.03)' : 'transparent',
        }}
      >
        <div
          style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--brand-primary-50) 0%, var(--brand-accent-50) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--border-subtle)',
          }}
        >
          <UserCircle size={18} style={{ color: 'var(--brand-primary)' }} />
        </div>
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: darkMode ? '#e2e8f0' : 'var(--text-main)' }}>
            {user?.user_metadata?.full_name || "User Account"}
          </p>
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email || "Guest"}
          </p>
        </div>
      </div>

      <button
        onClick={handleLogout}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '0.5rem 0.75rem', border: 'none', borderRadius: 'var(--radius-md)',
          background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600,
          fontSize: '0.82rem', transition: 'background 0.15s ease',
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <LogOut size={15} />
        <span>Sign Out</span>
      </button>
    </div>
  );

  const SidebarNav = () => (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {sidebarLinks.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);

        if (item.locked) {
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => setShowUpgrade(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '0.6rem 0.85rem', border: 'none',
                borderRadius: 'var(--radius-md)', background: 'transparent',
                fontSize: '0.87rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                color: darkMode ? 'rgba(226,232,240,0.5)' : 'var(--text-faint)',
              }}
            >
              <Icon size={17} style={{ opacity: 0.55, flexShrink: 0 }} />
              <span>{item.label}</span>
              <Lock size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />
            </button>
          );
        }

        return (
          <Link
            key={item.path}
            href={item.path}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '0.6rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontSize: '0.87rem', fontWeight: active ? 600 : 500,
              transition: 'all 0.15s ease',
              background: active
                ? 'linear-gradient(135deg, var(--brand-primary) 0%, #0a51b5 100%)'
                : 'transparent',
              color: active ? '#fff' : darkMode ? 'rgba(226,232,240,0.7)' : 'var(--text-muted)',
              boxShadow: active ? '0 2px 8px rgba(7,62,140,0.25)' : 'none',
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'var(--brand-primary-50)';
                e.currentTarget.style.color = darkMode ? '#e2e8f0' : 'var(--brand-primary)';
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = darkMode ? 'rgba(226,232,240,0.7)' : 'var(--text-muted)';
              }
            }}
          >
            <Icon size={17} style={{ opacity: active ? 1 : 0.7, flexShrink: 0 }} />
            <span>{item.label}</span>
            {active && (
              <ChevronRight size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />
            )}
          </Link>
        );
      })}
    </nav>
  );

  const darkThemeToggle = (
    <button
      onClick={() => setDarkMode(!darkMode)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        width: '100%', padding: '0.5rem', marginBottom: 8,
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'var(--border-subtle)'}`,
        borderRadius: 'var(--radius-md)', background: 'transparent',
        color: darkMode ? '#94a3b8' : 'var(--text-muted)', cursor: 'pointer',
        fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s ease',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'var(--surface-soft)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {darkMode ? <Sun size={14} /> : <Moon size={14} />}
      <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>
    </button>
  );

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        background: darkMode ? '#0f172a' : 'var(--surface-muted)',
        color: darkMode ? '#e2e8f0' : 'var(--text-main)',
        userSelect: 'none',
      }}
    >
      <ReferralSection referralCode={trialStatus?.referral_code || ""} />

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} reason="subscription_required" />

      <style jsx global>{`
        .sidebar-slide { transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1); }

        /* Hide sidebar scrollbar while keeping it scrollable */
        .al-sidebar-desktop::-webkit-scrollbar { display: none; }
        .al-sidebar-desktop { scrollbar-width: none; -ms-overflow-style: none; }

        /* ── Print: hide all dashboard chrome, let the paper fill the page ── */
        @media print {
          .al-sidebar-desktop,
          .al-sidebar-mobile,
          .al-mobile-topbar,
          .al-footer-wrap { display: none !important; }

          /* The outer flex row becomes block so hidden sidebar takes no space */
          .al-body-row { display: block !important; }

          /* Main content: remove clip + padding that restrict the paper */
          .al-main {
            overflow: visible !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            display: block !important;
          }
          .al-content-pad {
            padding: 0 !important;
            flex: none !important;
            display: block !important;
          }
          .al-content-inner {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Mobile top bar */}
      <div
        className="al-mobile-topbar d-lg-none"
        style={{
          position: 'sticky', top: 0, zIndex: 1040,
          background: darkMode ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
          borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'var(--border-subtle)'}`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />
      </div>

      <div className="al-body-row" style={{ display: 'flex', flex: 1 }}>

        {/* Desktop sidebar */}
        <aside
          className="al-sidebar-desktop d-none d-lg-flex flex-column flex-shrink-0"
          style={{
            width: 256, position: 'sticky', top: 0, height: '100vh',
            padding: '1.25rem 1rem',
            background: darkMode ? '#111827' : '#ffffff',
            borderRight: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'var(--border-subtle)'}`,
            boxShadow: darkMode ? 'none' : '1px 0 0 rgba(15,23,42,0.04)',
            overflowY: 'auto',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem', padding: '0 0.25rem' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(7,62,140,0.3)',
            }}>
              <GraduationCap size={18} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em', color: darkMode ? '#e2e8f0' : 'var(--text-main)' }}>
              Examly<span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>.pk</span>
            </span>
          </div>

          {/* Nav section label */}
          <p style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', margin: '0 0.25rem 0.5rem', padding: '0 0.5rem' }}>
            Navigation
          </p>

          <div style={{ flex: 1 }}>
            <SidebarNav />
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            <PlanStatus />
            {darkThemeToggle}
            <UserProfile />
          </div>
        </aside>

        {/* Main content */}
        <main className="al-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <div className="al-content-pad" style={{ flex: 1, padding: '1.5rem 1.25rem 1.25rem' }}>
            <div className="al-content-inner" style={{ maxWidth: '82rem', margin: '0 auto' }}>
              <BreadcrumbAuto />
              {children}
            </div>
          </div>
          <div className="al-footer-wrap">
            <Footer darkMode={darkMode} />
          </div>
        </main>
      </div>

      {/* Mobile drawer overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1050,
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className="sidebar-slide al-sidebar-mobile d-lg-none"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 272, zIndex: 1060,
          background: darkMode ? '#111827' : '#ffffff',
          boxShadow: 'var(--shadow-xl)',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1rem 0.75rem',
          borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'var(--border-subtle)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GraduationCap size={15} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: darkMode ? '#e2e8f0' : 'var(--text-main)' }}>
              Examly<span style={{ color: 'var(--brand-primary)' }}>.pk</span>
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              width: 30, height: 30, border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)', background: 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, padding: '1rem' }}>
          <SidebarNav />
        </div>

        <div style={{ padding: '1rem', borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'var(--border-subtle)'}` }}>
          <PlanStatus />
          {darkThemeToggle}
          <UserProfile />
        </div>
      </aside>
    </div>
  );
}
