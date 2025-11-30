"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Menu } from "lucide-react";

const Header = ({ sidebarOpen, setSidebarOpen }: any) => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>("user");
  const supabase = createClientComponentClient();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) setUser(data.session.user);
    };
    load();
  }, []);

  return (
    <nav className="navbar navbar-light bg-white shadow-sm sticky-top px-1">
      {/* Left mobile toggle and logo */}
      <div className="d-flex align-items-center">
        <button
          className="btn d-lg-none me-2"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={26} />
        </button>

        <Link
          href="/dashboard"
          className="navbar-brand fw-bold text-primary d-flex align-items-center"
        >
          <i className="bi bi-mortarboard me-2"></i>
           <span className="ms-1">Examly: </span>
          <span className="d-none d-sm-inline"> Paper Generation</span>
          <span className="ms-1">Dashboard</span>
        </Link>
      </div>

      {/* Right side user info */}
      <div className="d-flex align-items-center">
        <div className="d-none d-md-block text-end me-3">
          <div className="small text-muted">{user?.email}</div>
          <div className="small text-muted text-capitalize">{role}</div>
        </div>

        <button
          className="btn btn-outline-danger btn-sm rounded-pill"
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/auth/login");
          }}
        >
          <i className="bi bi-box-arrow-right me-1"></i> Logout
        </button>
      </div>
    </nav>
  );
};

export default Header;
