//components/academyLayout.tsx
"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/app/context/userContext";
import Footer from "@/components/Footer";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { 
  Menu, Moon, Sun, LogOut, User, 
  LayoutDashboard, FilePlus, BookMarked, 
  Gem, UserCircle, Settings, Calendar
} from "lucide-react";
import ReferralSection from '@/components/ReferralSection';

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const { trialStatus, isLoading } = useUser();
  const supabase = createClientComponentClient();

  const sidebarLinks = useMemo(() => [
    { path: "/dashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
    { path: "/dashboard/generate-paper", icon: <FilePlus size={20} />, label: "Generate Paper" },
    { path: "/dashboard/saved-papers", icon: <BookMarked size={20} />, label: "Saved Papers" },
    { path: "/dashboard/packages", icon: <Gem size={20} />, label: "Premium Plans" },
    { path: "/dashboard/profile", icon: <UserCircle size={20} />, label: "My Profile" },
    { path: "/dashboard/settings", icon: <Settings size={20} />, label: "Settings" },
  ], []);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) setSessionUser(data.session.user);
    };
    load();
    const saved = localStorage.getItem("theme") || "light";
    setDarkMode(saved === "dark");
  }, [supabase.auth]);

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const isActive = (path: string) => path === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(path);

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const renderTrialStatus = () => {
    if (isLoading) return <div className="p-3 text-center opacity-50"><div className="spinner-border spinner-border-sm text-primary" /></div>;
    if (!trialStatus) return null;

    const { isTrial, daysRemaining, hasActiveSubscription, papersGenerated = 0, papersRemaining, subscriptionName, trialEndsAt, subscriptionEndDate } = trialStatus;
    const totalPapers = papersRemaining === "unlimited" ? 0 : (Number(papersGenerated) + Number(papersRemaining));
    const usagePercent = totalPapers > 0 ? (papersGenerated / totalPapers) * 100 : 0;
    const endDate = isTrial ? trialEndsAt : subscriptionEndDate;

    return (
      <div className={`status-widget rounded-4 border overflow-hidden transition-all mt-2 ${darkMode ? 'bg-dark-subtle border-secondary' : 'bg-white border-light shadow-sm'}`}>
        <div className={`p-3 border-bottom ${darkMode ? 'bg-black-50 border-secondary' : 'bg-light'}`}>
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span className={`badge rounded-pill ${hasActiveSubscription ? 'bg-success-subtle text-success border-success' : 'bg-warning-subtle text-warning border-warning'} border px-2 x-small`}>
              {subscriptionName || (isTrial ? "Trial Mode" : "Free Tier")}
            </span>
          </div>
          <h6 className="mb-0 fw-bold x-small text-uppercase tracking-wider">Plan Details</h6>
        </div>

        <div className="p-3">
          <div className="mb-3">
            <div className="d-flex justify-content-between x-small fw-bold mb-1">
              <span className="text-muted">CREDITS</span>
              <span className={darkMode ? 'text-white' : 'text-dark'}>
                {papersRemaining === "unlimited" ? '∞' : `${papersGenerated}/${totalPapers}`}
              </span>
            </div>
            <div className="progress rounded-pill" style={{ height: '6px', background: darkMode ? '#333' : '#eee' }}>
              <div className="progress-bar bg-primary rounded-pill transition-all" style={{ width: papersRemaining === "unlimited" ? '100%' : `${usagePercent}%` }}></div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 mb-2">
             <Calendar size={14} className="text-muted" />
             <span className="x-small text-muted">Ends: <span className="text-body fw-medium">{formatDate(endDate)}</span></span>
          </div>

          {!hasActiveSubscription && (
            <Link href="/dashboard/packages" className="btn btn-primary btn-sm w-100 mt-2 rounded-pill fw-bold">
              Upgrade
            </Link>
          )}
        </div>
      </div>
    );
  };

  const SidebarContent = () => (
    <div className="d-flex flex-column h-100 py-4 px-3">
      {/* 1. BRANDING */}
      <div className="mb-4 px-2">
        <Link href="/dashboard" className="text-decoration-none d-flex align-items-center mb-4">
          <div className="bg-primary p-2 rounded-3 me-2 text-white shadow-sm">
            <i className="bi bi-mortarboard-fill fs-4"></i>
          </div>
          <span className="fs-4 fw-bold text-primary tracking-tight">Examly<span className="text-muted fw-light">.pk</span></span>
        </Link>

        <div className={`p-3 rounded-4 border ${darkMode ? 'bg-secondary bg-opacity-10 border-secondary' : 'bg-light border-light'}`}>
          <div className="d-flex align-items-center gap-3">
            <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: '40px', height: '40px' }}>
              <User size={20} />
            </div>
            <div className="overflow-hidden">
              <div className={`fw-bold small text-truncate ${darkMode ? 'text-white' : 'text-dark'}`}>
                {sessionUser?.email?.split('@')[0]}
              </div>
              <div className="text-primary fw-bold" style={{ fontSize: '10px' }}>
                {trialStatus?.hasActiveSubscription ? 'PREMIUM' : 'FREE MEMBER'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. NAVIGATION & LOGOUT */}
      <nav className="nav flex-column gap-1">
        {sidebarLinks.map((item) => (
          <Link 
            key={item.path} 
            href={item.path} 
            className={`nav-link sidebar-link d-flex align-items-center gap-3 ${isActive(item.path) ? "active" : ""}`}
            onClick={() => setSidebarOpen(false)}
          >
            {item.icon}
            <span className="fw-medium">{item.label}</span>
          </Link>
        ))}
        
        {/* Logout integrated into nav for same hover effect */}
        <button 
          onClick={handleLogout}
          className="nav-link sidebar-link logout-link d-flex align-items-center gap-3 border-0 bg-transparent w-100 text-start"
        >
          <LogOut size={20} />
          <span className="fw-medium">Logout</span>
        </button>
      </nav>

      {/* 3. TRIAL STATUS & REFERRAL */}
      <div className="mt-4 flex-grow-1 overflow-y-auto">
        <Suspense fallback={<div className="placeholder col-12 rounded-4" style={{height: '80px'}}></div>}>
          {renderTrialStatus()}
        </Suspense>

        <div className="mt-3 px-1">
            <ReferralSection referralCode={trialStatus?.referral_code || ''} />
        </div>
      </div>

      {/* 4. FOOTER UTILITIES */}
      <div className="mt-auto pt-3 border-top d-flex align-items-center justify-content-between px-2">
        <button 
          className={`btn btn-sm rounded-circle p-2 border-0 ${darkMode ? 'text-warning' : 'text-secondary'}`}
          onClick={() => setDarkMode(!darkMode)}
          title="Toggle Theme"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <span className="x-small text-muted opacity-50">© 2026 Examly</span>
      </div>
    </div>
  );

  return (
    <div className={`app-wrapper ${darkMode ? "dark-theme" : "light-theme"}`}>
      <style jsx global>{`
        :root { --sidebar-width: 280px; }
        .sidebar-desktop { 
            width: var(--sidebar-width); height: 100vh; 
            position: fixed; left: 0; top: 0; z-index: 1050; 
            transition: transform 0.3s ease;
        }
        .main-canvas { 
            margin-left: var(--sidebar-width); 
            min-height: 100vh; display: flex; flex-direction: column; 
        }
        .nav-link.sidebar-link { 
            border-radius: 12px; padding: 12px 16px; 
            transition: all 0.2s ease-in-out; 
            color: ${darkMode ? '#a0a0a0' : '#6c757d'}; 
        }
        /* HOVER EFFECT REMAINS THE SAME */
        .nav-link.sidebar-link:hover { 
            background: ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(13, 110, 253, 0.05)'}; 
            color: #0d6efd; 
            transform: translateX(4px);
        }
        .nav-link.sidebar-link.active { 
            background: #0d6efd; color: white !important; 
            box-shadow: 0 4px 12px rgba(13, 110, 253, 0.25); 
        }
        .logout-link:hover { color: #dc3545 !important; }
        .x-small { font-size: 0.72rem; }
        @media (max-width: 992px) {
          .main-canvas { margin-left: 0; }
          .sidebar-desktop { transform: translateX(-100%); }
          .sidebar-desktop.show { transform: translateX(0); }

        }
          @media print {
  /* Hide all navigation and UI elements */
  .sidebar-desktop,
  .mobile-header,
  .offcanvas-backdrop,
  footer,
  .fixed-back-btn,
  .position-fixed,
  [class*="sticky"],
  nav,
  header:not(.paper-header) {
    display: none !important;
  }
  
  /* Reset body margins */

  /* Main content area */
  .main-canvas,
  .container-fluid,
  .flex-grow-1 {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }
}
      `}</style>

      {/* MOBILE VIEWPORT */}
      <div className={`mobile-header align-items-center justify-content-between p-3 border-bottom d-lg-none ${darkMode ? 'bg-dark border-secondary' : 'bg-white'}`}>
        <button className="btn p-0 border-0" onClick={() => setSidebarOpen(true)}>
          <Menu size={24} />
        </button>
        <span className="fw-bold text-primary">Examly.pk</span>
        <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
          <User size={16} />
        </div>
      </div>

      <aside className={`sidebar-desktop border-end ${sidebarOpen ? 'show' : ''} ${darkMode ? 'bg-dark border-secondary' : 'bg-white'}`}>
        <SidebarContent />
      </aside>

      {sidebarOpen && <div className="offcanvas-backdrop fade show d-lg-none" onClick={() => setSidebarOpen(false)}></div>}

      <main className="main-canvas">
        <div className={`flex-grow-1 p-3 p-lg-5 ${darkMode ? 'bg-black text-white' : 'bg-light text-dark'}`}>
          <div className="container-fluid">
            {children}
          </div>
        </div>
        <Footer darkMode={darkMode} />
      </main>
    </div>
  );
}