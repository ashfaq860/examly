"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Header from "@/components/academy/Header";

export default function AcademyLayout({ children }: any) {
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => pathname?.startsWith(path);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") setDarkMode(true);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <div className={darkMode ? "bg-dark text-light" : "bg-light text-dark"}>
      {/* HEADER */}
      <Header
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* BOOTSTRAP OFFCANVAS SIDEBAR */}
      <div
        className={`offcanvas offcanvas-start ${sidebarOpen ? "show" : ""}`}
        style={{ visibility: sidebarOpen ? "visible" : "hidden" }}
        onClick={() => setSidebarOpen(false)}
      >
        <div
          className="offcanvas-header"
          onClick={(e) => e.stopPropagation()}
        >
          <h5 className="offcanvas-title fw-bold text-primary">
            <i className="bi bi-mortarboard me-2"></i> Dashboard
          </h5>
          <button className="btn-close" onClick={() => setSidebarOpen(false)} />
        </div>

        <div
          className="offcanvas-body"
          onClick={(e) => e.stopPropagation()}
        >
          <ul className="nav nav-pills flex-column">
            {[
              { path: "/dashboard", icon: "bi-speedometer2", label: "Dashboard" },
              { path: "/dashboard/generate-paper", icon: "bi-file-earmark-text", label: "Generate Paper" },
              { path: "/dashboard/profile", icon: "bi-person", label: "Profile" },
              { path: "/dashboard/settings", icon: "bi-gear", label: "Settings" },
              { path: "/dashboard/packages", icon: "bi-box-seam", label: "Best Packages" },
            ].map((item) => (
              <li key={item.path} className="mb-2">
                <Link
                  href={item.path}
                  className={`nav-link d-flex align-items-center ${
                    isActive(item.path) ? "active" : ""
                  }`}
                >
                  <i className={`bi ${item.icon} me-2`}></i> {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="container-fluid mt-3">
        <div className="row">
          {/* Desktop Sidebar */}
          <div className="col-lg-2 d-none d-lg-block border-end">
            <ul className="nav nav-pills flex-column">
              {[
                { path: "/dashboard", icon: "bi-speedometer2", label: "Dashboard" },
                { path: "/dashboard/generate-paper", icon: "bi-file-earmark-text", label: "Generate Paper" },
                { path: "/dashboard/profile", icon: "bi-person", label: "Profile" },
                { path: "/dashboard/settings", icon: "bi-gear", label: "Settings" },
                { path: "/dashboard/packages", icon: "bi-box-seam", label: "Best Packages" },
              ].map((item) => (
                <li key={item.path} className="mb-2">
                  <Link
                    href={item.path}
                    className={`nav-link d-flex align-items-center ${
                      isActive(item.path) ? "active" : ""
                    }`}
                  >
                    <i className={`bi ${item.icon} me-2`}></i> {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Main */}
          <div className="col-lg-10">
            <div className="p-3">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
