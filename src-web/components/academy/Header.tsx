// examly/src/components/academy/Header.tsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Menu, Moon, Sun, LogOut, User } from "lucide-react";
import { useUser } from '@/app/context/userContext';
import ReferralSection from '@/components/ReferralSection';

const Header = ({ setSidebarOpen, darkMode, setDarkMode }: any) => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const supabase = createClientComponentClient();
  const { trialStatus } = useUser();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) setUser(data.session.user);
    };
    load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <header className={`navbar sticky-top border-bottom px-3 py-2 ${darkMode ? 'bg-dark border-secondary' : 'bg-white shadow-sm'}`}>
      <div className="container-fluid d-flex align-items-center justify-content-between">
        
        {/* LEFT: Mobile Toggle & Referral */}
        <div className="d-flex align-items-center gap-3">
          <button className="btn btn-outline-secondary d-lg-none border-0 p-1" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <div className="d-none d-md-block">
             <ReferralSection referralCode={trialStatus?.referral_code || ''} />
          </div>
        </div>

        {/* RIGHT: Theme, User Info & Logout */}
        <div className="d-flex align-items-center gap-2 gap-md-3">
          
          {/* Theme Toggle */}
          <button 
            className={`btn btn-sm rounded-circle p-2 border-0 ${darkMode ? 'text-warning' : 'text-secondary'}`}
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* User Profile Info (Desktop) */}
          <div className="d-none d-sm-flex align-items-center gap-2 px-2 border-end me-2">
            <div className="text-end">
              <div className={`fw-bold small lh-1 ${darkMode ? 'text-white' : 'text-dark'}`}>
                {user?.email?.split('@')[0]}
              </div>
              <div className="text-muted" style={{ fontSize: '10px' }}>PRO MEMBER</div>
            </div>
            <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
              <User size={16} />
            </div>
          </div>

          {/* LOGOUT BUTTON (Always Visible) */}
          <button 
            className="btn btn-outline-danger btn-sm rounded-pill px-3 d-flex align-items-center gap-2 fw-medium"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span className="d-none d-md-inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;