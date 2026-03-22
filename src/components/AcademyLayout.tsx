"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { 
  LayoutDashboard, 
  FilePlus, 
  Archive, 
  Gem, 
  UserCircle, 
  Settings, 
  Sun, 
  Moon, 
  GraduationCap, 
  Zap,
  X,
  LogOut,
  ChevronRight
} from "lucide-react";
import Header from "@/components/academy/Header";
import { useUser } from "@/app/context/userContext";
import Footer from "@/components/Footer";
import ReferralSection from '@/components/ReferralSection';

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { trialStatus, isLoading } = useUser();
/*useEffect(() => {
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  document.addEventListener("contextmenu", handleContextMenu);

  // Clean up the event listener when the component unmounts
  return () => {
    document.removeEventListener("contextmenu", handleContextMenu);
  };
}, []);
*/
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getSession();
      console.log("Loaded user session:", data);
      if (data.session?.user) setUser(data.session.user);
    };
    loadUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const sidebarLinks = useMemo(() => [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/dashboard/generate-paper", icon: FilePlus, label: "Generate Paper" },
    { path: "/dashboard/saved-papers", icon: Archive, label: "Saved Papers" },
    { path: "/dashboard/packages", icon: Gem, label: "Premium Plans" },
    { path: "/dashboard/profile", icon: UserCircle, label: "Profile" },
    { path: "/dashboard/settings", icon: Settings, label: "Settings" },
  ], []);

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

  const renderTrialStatus = () => {
    if (isLoading) return <div className="spinner-border spinner-border-sm text-primary"></div>;
    return (
      <div className={`p-3 rounded-xl border transition-all duration-300 mb-3 ${
        darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-blue-50/50 border-blue-100'
      }`}>
        <div className="d-flex align-items-center mb-2">
           <div className="bg-primary rounded-lg p-2 me-3 d-flex align-items-center justify-content-center shadow-sm">
              <Zap size={14} className="text-white fill-white" />
           </div>
           <div>
             <p className="mb-0 fw-bold small" style={{ fontSize: '0.75rem' }}>PLAN STATUS</p>
             <p className={`mb-0 fw-semibold ${darkMode ? 'text-slate-300' : 'text-primary'}`} style={{ fontSize: '0.85rem' }}>
                {trialStatus?.subscriptionName || "Free Trial"}
             </p>
           </div>
        </div>
        <Link href="/dashboard/packages" className="btn btn-primary btn-sm w-100 rounded-3 fw-semibold py-2 transition-all hover-scale">
           Upgrade Plan
        </Link>
      </div>
    );
  };

  const UserProfileSection = () => (
    <div className={`mt-2 pt-3 border-top ${darkMode ? 'border-slate-800' : 'border-gray-100'}`}>
      <div className={`group d-flex align-items-center p-2 rounded-4 mb-2 transition-all cursor-pointer ${
        darkMode ? 'hover:bg-slate-900' : 'hover:bg-gray-50'
      }`}>
        <div className="position-relative">
            <div className={`rounded-circle p-1 border-2 border-primary border-opacity-25`}>
                <div className="bg-primary bg-opacity-10 rounded-circle p-2">
                    <UserCircle size={22} className="text-primary" />
                </div>
            </div>
            <span className="position-absolute bottom-0 end-0 p-1 bg-success border border-light rounded-circle"></span>
        </div>
        <div className="ms-3 overflow-hidden flex-grow-1">
          <p className="mb-0 fw-bold small text-truncate leading-tight">
            {user?.user_metadata?.full_name || "User Account"}
          </p>
          <p className="mb-0 text-muted extra-small text-truncate">
            {user?.email || "Guest"}
          </p>
        </div>
        <ChevronRight size={14} className="text-muted opacity-0 group-hover:opacity-100 transition-all" />
      </div>
      
      <button 
        onClick={handleLogout}
        className={`btn btn-link text-decoration-none w-100 d-flex align-items-center gap-3 px-3 py-2.5 rounded-3 text-danger transition-all border-0 ${
            darkMode ? 'hover:bg-red-950/30' : 'hover:bg-danger-soft'
        }`}
      >
        <LogOut size={18} />
        <span className="small fw-bold">Sign Out</span>
      </button>
    </div>
  );

  return (

    <div className={`min-vh-100 d-flex flex-column no-select transition-colors duration-300 ${darkMode ? "bg-dark text-light" : "bg-light text-dark"}`}>
     { <ReferralSection referralCode={trialStatus?.referral_code || ''} />
              }  
      <style jsx global>{`
        .sidebar-transition { transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .hover-scale:hover { transform: translateY(-1px); }
        .extra-small { font-size: 0.7rem; }
        .hover-bg-danger-soft:hover { background-color: rgba(220, 53, 69, 0.1); }
        .no-select { user-select: none; }
      `}</style>

      <div className="d-lg-none border-bottom sticky-top bg-white z-40">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>

      <div className="d-flex flex-grow-1">
        
        {/* DESKTOP SIDEBAR */}
        <aside className={`d-none d-lg-flex flex-column flex-shrink-0 p-4 border-end sticky-top vh-100 ${
          darkMode ? "bg-slate-950 border-slate-800" : "bg-white border-gray-200"
        }`} style={{ width: "280px" }}>
          
          <div className="d-flex align-items-center mb-2 ps-2">
            <div className="bg-primary p-2 rounded-3 me-3 shadow-sm">
              <GraduationCap size={22} className="text-white" />
            </div>
            <span className="fs-5 fw-bold tracking-tight">Examly<span className="text-primary">.pk</span></span>
          </div>

          <nav className="nav nav-pills flex-column mb-auto gap-2">
            {sidebarLinks.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`nav-link d-flex align-items-center px-3 py-2.5 rounded-3 transition-all ${
                    active 
                    ? "bg-primary text-white shadow-sm scale-[1.02]" 
                    : darkMode ? "text-slate-400 hover:bg-slate-900 hover:text-white" : "text-secondary hover:bg-light"
                  }`}
                >
                  <Icon size={19} className={`me-3 ${active ? "text-white" : "opacity-70"}`} />
                  <span className="fw-medium small">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto">
             {renderTrialStatus()}
             <button 
                onClick={() => setDarkMode(!darkMode)}
                className={`btn btn-link text-decoration-none w-100 d-flex align-items-center justify-content-center gap-2 p-2.5 rounded-3 border transition-all mb-2 ${
                  darkMode ? 'text-slate-300 border-slate-800 hover:bg-slate-900' : 'text-muted border-gray-100 hover:bg-light'
                }`}
             >
               {darkMode ? <Sun size={16} /> : <Moon size={16} />}
               <span className="small fw-semibold">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
             </button>
             
             <UserProfileSection />
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-grow-1 d-flex flex-column min-vh-100 overflow-hidden">
          <div className="p-0 p-lg-5 flex-grow-1">
            <div className="container-fluid max-w-7xl">
               {children}
            </div>
          </div>
          <Footer darkMode={darkMode} />
        </main>
      </div>

      {/* MOBILE DRAWER (Smoothed) */}
      <div 
        className={`fixed-top vh-100 w-100 z-50 transition-all duration-500 ${sidebarOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={() => setSidebarOpen(false)}
      >
        <div 
          className={`sidebar-transition h-100 position-absolute start-0 shadow-lg ${darkMode ? 'bg-dark text-light' : 'bg-white'}`}
          style={{ width: '280px', transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="d-flex align-items-center justify-content-between p-4 border-bottom">
            <div className="d-flex align-items-center">
                <GraduationCap size={24} className="text-primary me-2" />
                <h5 className="mb-0 fw-bold">Examly</h5>
            </div>
            <button className="btn p-2 rounded-circle hover:bg-light" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="p-3 d-flex flex-column h-100">
            <nav className="nav nav-pills flex-column gap-2 mb-auto">
              {sidebarLinks.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link key={item.path} href={item.path} 
                        className={`nav-link d-flex align-items-center py-3 px-3 rounded-3 transition-all ${active ? "bg-primary text-white shadow-sm" : darkMode ? "text-slate-300" : "text-dark"}`}
                        onClick={() => setSidebarOpen(false)}>
                    <Icon size={20} className="me-3" /> {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 pb-5">
             
              {renderTrialStatus()}
              <UserProfileSection />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}