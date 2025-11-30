"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Menu,Sun,Moon } from "lucide-react"; // add this import at the top

const Header = ({
  sidebarOpen,
  setSidebarOpen,
  darkMode,
  setDarkMode,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (val: boolean) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}) => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>("");
  const supabase = createClientComponentClient();

  useEffect(() => {
  const fetchUser = async () => {
    console.log("🔍 Checking session for role fetch...");
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("⚠️ Session error:", sessionError);
      return;
    }

    if (session?.user) {
      setUser(session.user);
      console.log("✅ Session found, user ID:", session.user.id);

      try {
        console.log("🔍 Calling RPC: get_user_role");
        const { data: roleData, error: rpcError } = await supabase.rpc(
          "get_user_role",
          { user_id: session.user.id }
        );

        console.log("📋 RPC response:", { roleData, rpcError });

        if (!rpcError && roleData) {
          setRole(roleData);
          console.log("🎯 Role determined:", roleData);
        } else {
          console.warn("❌ No valid role found or RPC error:", rpcError);
        }
      } catch (error) {
        console.error("💥 Error in RPC call:", error);
      }
    } else {
      console.log("❌ No active session found");
    }
  };

  fetchUser();
}, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie =
      "role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push("/auth/login");
  };

  return (
    <header className="header-glass sticky-top shadow-sm">
      <div className="container-fluid d-flex justify-content-between align-items-center py-2 px-3">
        {/* Mobile Menu + Logo */}
        <div className="d-flex align-items-center">
          <button
            className="btn btn-link text-dark d-lg-none me-2"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ padding: "5px" }}
          >
            <Menu size={28} />          </button>
       <Link
  href="/academy"
  className="text-decoration-none fw-bold text-primary d-flex align-items-center flex-wrap"
  style={{ lineHeight: "1.2" }}
>
  <i className="bi bi-mortarboard me-2"></i>
  <span className="me-1">Examly:</span>
  <span className="d-none d-sm-inline">Paper Generation</span> {/* hidden on xs */}
  <span className="ms-1">DashBoard</span>
</Link>


        </div>

        {/* User Info */}
        <div className="d-flex align-items-center gap-3">
          <div className="text-muted small text-end d-none d-md-block">
           
            <div>
              <span>{user?.email}</span>
              <span className="mx-2">•</span>
              <span className="text-capitalize">{role || "user"}</span>
            </div>
          </div>

          {/* Dark mode toggle */}
         {/* <button
            className="btn btn-sm  shadow-sm"
            onClick={() => setDarkMode(!darkMode)}
          >
           {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
         */}
          {/* Logout */}
          <button
            onClick={handleLogout}
            className="btn btn-outline-danger btn-sm d-flex align-items-center shadow-sm rounded-pill px-3"
          >
            <i className="bi bi-box-arrow-right me-1"></i>
            <span className="d-sm-inline">Logout</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        .header-glass {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
        }
      `}</style>
    </header>
  );
};

export default Header;
