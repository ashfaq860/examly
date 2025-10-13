"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Header from "@/components/academy/Header";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useUser } from "@/app/context/userContext";

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { trialStatus, isLoading } = useUser();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (
      savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const isActive = (path: string) => pathname?.startsWith(path);

  const message = trialStatus?.message || null;
  const hasActiveSubscription = trialStatus?.hasActiveSubscription ?? false;
  const subscriptionName = trialStatus?.subscriptionName || "Premium";
  const subscriptionEndDate = trialStatus?.subscriptionEndDate;

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "N/A";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      className={`d-flex ${darkMode ? "bg-dark text-light" : "bg-light text-dark"}`}
      style={{ minHeight: "100vh" }}
    >
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="d-lg-none position-fixed w-100 h-100"
          style={{
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 1040,
            top: 0,
            left: 0,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`sidebar position-fixed position-lg-static top-0 start-0 h-100 d-flex flex-column flex-shrink-0 p-3 shadow-sm ${
          sidebarOpen ? "translate-x-0" : "-translate-x-100"
        }`}
        style={{
          width: "260px",
          zIndex: 1050,
          backgroundColor: darkMode ? "#212529" : "#fff",
          transition: "transform 0.3s ease-in-out",
        }}
      >
        {/* Sidebar Header */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Link
            href="/dashboard"
            className="text-decoration-none fs-5 fw-bold text-primary"
            onClick={() => setSidebarOpen(false)}
          >
            <i className="bi bi-mortarboard me-2"></i> Dashboard
          </Link>
          <button
            className="btn btn-close d-lg-none"
            onClick={() => setSidebarOpen(false)}
          />
        </div>

        <hr />

        {/* Sidebar Nav */}
        <ul className="nav nav-pills flex-column gap-2">
          {[
            { path: "/dashboard", icon: "bi-speedometer2", label: "Dashboard" },
            { path: "/dashboard/generate-paper", icon: "bi-file-earmark-text", label: "Generate Paper" },
            { path: "/dashboard/profile", icon: "bi-person", label: "Profile" },
            { path: "/dashboard/settings", icon: "bi-gear", label: "Settings" },
            { path: "/dashboard/packages", icon: "bi-box-seam", label: "Best Packages" },
          ].map((item) => (
            <li key={item.path}>
              <Link
                href={item.path}
                className={`nav-link d-flex align-items-center ${
                  isActive(item.path) ? "active" : "text-secondary"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <i className={`bi ${item.icon} me-2`}></i> {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <hr />

        {/* Subscription Status (your existing alerts fit here) */}
        <div className="mt-auto">{/* subscription alert goes here */}</div>
      </div>

      {/* Main Content */}
      <div className="flex-grow-1 d-flex flex-column" style={{ marginLeft: "260px" }}>
        <Header
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
        <main className="flex-grow-1 p-3">{children}</main>
      </div>

      <style jsx>{`
        @media (max-width: 991.98px) {
          .sidebar {
            transform: translateX(-100%);
            position: fixed !important;
            margin-left: 0 !important;
          }
          .sidebar.translate-x-0 {
            transform: translateX(0);
          }
          .flex-grow-1 {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
