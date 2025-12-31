// examly/src/components/AcademyLayout.tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Header from "@/components/academy/Header";
import { useUser } from "@/app/context/userContext";
import  Footer from "@/components/Footer"
export default function AcademyLayout({ children }: any) {
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { trialStatus, isLoading } = useUser();

  // FIXED ACTIVE STATE
  const isActive = (path: string) => {
    if (path === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(path);
  };

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") setDarkMode(true);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Helper function to format date
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "N/A";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Invalid Date";
    
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Helper function to calculate days until date
  const getDaysUntil = (date: Date | string | null | undefined): string => {
    if (!date) return "";
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) return "";
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return " (Today)";
    if (diffDays === 1) return " (Tomorrow)";
    if (diffDays > 0) return ` (in ${diffDays} days)`;
    if (diffDays === -1) return " (Yesterday)";
    if (diffDays < 0) return ` (${Math.abs(diffDays)} days ago)`;
    return "";
  };

  // Helper function to render trial status
  const renderTrialStatus = () => {
    if (isLoading) {
      return (
        <div className="text-center">
          <div className="spinner-border spinner-border-sm text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <small className="text-muted d-block mt-1">Loading plan status...</small>
        </div>
      );
    }

    if (!trialStatus) {
      return (
        <div className="text-center">
          <small className="text-muted">Status not available</small>
        </div>
      );
    }

    const {
      isTrial,
      daysRemaining,
      hasActiveSubscription,
      papersGenerated,
      papersRemaining,
      subscriptionName,
      subscriptionType,
      trialEndsAt,
      subscriptionEndDate,
      message
    } = trialStatus;

    // If there's a message from the API, show it
    if (message) {
      return (
        <div className="text-center">
          <small className={`text-${darkMode ? 'warning' : 'primary'} fw-bold`}>
            {message}
          </small>
        </div>
      );
    }

    // Trial user (not subscribed)
    if (isTrial && !hasActiveSubscription) {
      const trialEndFormatted = formatDate(trialEndsAt);
      const daysUntilTrialEnd = getDaysUntil(trialEndsAt);
      
      return (
        <div className="text-center">
          <div className="mb-2">
            <span className="badge bg-warning text-dark fs-6">
              <i className="bi bi-clock-history me-1"></i> Trial Active
            </span>
          </div>
          
          <div className="mb-1">
            <small className="text-muted d-block">Days remaining:</small>
            <span className="fw-bold text-warning">{daysRemaining}</span>
          </div>
          
          <div className="mb-1">
            <small className="text-muted d-block">Papers available:</small>
            <span className="fw-bold text-success">Unlimited</span>
          </div>
          
          <div className="mt-2 pt-2 border-top border-secondary">
            <small className="text-muted d-block">Trial ends on:</small>
            <div className="fw-bold text-danger">
              {trialEndFormatted}
              <br />
              <small className="fst-italic">{daysUntilTrialEnd}</small>
            </div>
          </div>
          
          <div className="mt-2">
            <Link href="/dashboard/packages" className="text-decoration-none">
              <small className="text-primary d-block">
                <i className="bi bi-rocket-takeoff me-1"></i> Upgrade to continue
              </small>
            </Link>
          </div>
        </div>
      );
    }

    // Subscribed user with subscription (monthly/yearly)
    if (hasActiveSubscription && subscriptionType === 'subscription') {
      const subscriptionEndFormatted = formatDate(subscriptionEndDate);
      const daysUntilRenewal = getDaysUntil(subscriptionEndDate);
      
      return (
        <div className="text-center">
          <div className="mb-2">
            <span className="badge bg-success fs-6">
              <i className="bi bi-patch-check-fill me-1"></i> {subscriptionName || 'Pro Plan'}
            </span>
          </div>
          
          <div className="mb-1">
            <small className="text-muted d-block">Papers generated:</small>
            <span className="fw-bold">{papersGenerated}</span>
          </div>
          
          <div className="mb-1">
            <small className="text-muted d-block">Paper access:</small>
            <span className="fw-bold text-success">
              {papersRemaining === 'unlimited' ? 'Unlimited' : `${papersRemaining} remaining`}
            </span>
          </div>
          
          <div className="mt-2 pt-2 border-top border-success">
            <small className="text-muted d-block">Plan renews on:</small>
            <div className="fw-bold text-primary">
              {subscriptionEndFormatted}
              <br />
              <small className="fst-italic">{daysUntilRenewal}</small>
            </div>
          </div>
          
          <div className="mt-2">
            <small className="text-success d-block">
              <i className="bi bi-shield-check me-1"></i> Active subscription
            </small>
          </div>
        </div>
      );
    }

    // Paper pack (one-time purchase)
    if (hasActiveSubscription && subscriptionType === 'paper_pack') {
      const papersUsed = papersGenerated || 0;
      const papersRemainingNum = papersRemaining === 'unlimited' ? Infinity : (papersRemaining as number);
      const totalPapers = papersUsed + (papersRemainingNum === Infinity ? 0 : papersRemainingNum);
      
      return (
        <div className="text-center">
          <div className="mb-2">
            <span className="badge bg-info text-dark fs-6">
              <i className="bi bi-box-seam me-1"></i> {subscriptionName || 'Paper Pack'}
            </span>
          </div>
          
          <div className="mb-1">
            <small className="text-muted d-block">Paper usage:</small>
            <span className="fw-bold">
              {papersUsed} / {papersRemaining === 'unlimited' ? '∞' : totalPapers} used
            </span>
          </div>
          
          <div className="mb-1">
            <small className="text-muted d-block">Remaining papers:</small>
            <span className="fw-bold text-info">
              {papersRemaining === 'unlimited' ? 'Unlimited' : papersRemaining}
            </span>
          </div>
          
          <div className="mt-2 pt-2 border-top border-info">
            <small className="text-muted d-block">Access type:</small>
            <div className="fw-bold text-success">
              <i className="bi bi-infinity me-1"></i> Lifetime Access
            </div>
          </div>
          
          <div className="mt-2">
            <small className="text-muted d-block">
              <i className="bi bi-calendar-check me-1"></i> No expiration date
            </small>
          </div>
        </div>
      );
    }

    // Free user (no trial, no subscription)
    return (
      <div className="text-center">
        <div className="mb-2">
          <span className="badge bg-secondary fs-6">
            <i className="bi bi-person me-1"></i> Free Plan
          </span>
        </div>
        
        <div className="mb-1">
          <small className="text-muted d-block">Papers available:</small>
          <span className="fw-bold">
            {papersRemaining === 'unlimited' ? 'Unlimited' : papersRemaining}
          </span>
        </div>
        
        <div className="mb-1">
          <small className="text-muted d-block">Papers generated:</small>
          <span className="fw-bold">{papersGenerated || 0}</span>
        </div>
        
        <div className="mt-2 pt-2 border-top border-secondary">
          <small className="text-muted d-block">Plan status:</small>
          <div className="fw-bold text-warning">
            No active plan
          </div>
        </div>
        
        <div className="mt-2">
          <Link href="/dashboard/packages" className="text-decoration-none">
            <button className="btn btn-sm btn-primary w-100">
              <i className="bi bi-lightning-charge me-1"></i> Upgrade Now
            </button>
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className={darkMode ? "bg-dark text-light" : "bg-light text-dark"}>
      {/* === Hover Styling Injected === */}
      <style>{`
        .sidebar-link:hover {
          background-color: #0d6efd !important;
          color: #fff !important;
        }
        .sidebar-link:hover i {
          color: #fff !important;
        }
        .trial-status-card {
          background-color: ${darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'};
          border-radius: 10px;
          padding: 15px;
          margin: 15px 0;
          border: 1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
        }
        .status-date {
          font-size: 0.85rem;
          color: ${darkMode ? '#ff6b6b' : '#dc3545'};
        }
        .status-renewal {
          font-size: 0.85rem;
          color: ${darkMode ? '#4dabf7' : '#0d6efd'};
        }
      `}</style>

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
              { path: "/dashboard", icon: "bi-speedometer", label: "Dashboard" },
              { path: "/dashboard/generate-paper", icon: "bi-file-earmark-text", label: "Generate Paper" },
              { path: "/dashboard/profile", icon: "bi-person", label: "Profile" },
              { path: "/dashboard/settings", icon: "bi-gear", label: "Settings" },
              { path: "/dashboard/packages", icon: "bi-box-seam", label: "Best Packages" },
              { path: "/dashboard/generated-papers", icon: "bi-box-seam", label: "Your Papers" },
            ].map((item) => (
              <li key={item.path} className="mb-2">
                <Link
                  href={item.path}
                  className={`nav-link sidebar-link d-flex align-items-center ${
                    isActive(item.path) ? "active" : ""
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <i className={`bi ${item.icon} me-2`}></i> {item.label}
                </Link>
              </li>
            ))}
          </ul>
          
          {/* Trial Status Section - Mobile */}
          <div className="mt-4 pt-3 border-top">
            <div className="trial-status-card">
              <div className="mb-3 text-center">
                <small className="text-muted fw-bold d-flex align-items-center justify-content-center">
                  <i className="bi bi-card-checklist me-2"></i> Your Plan Status
                </small>
              </div>
              {renderTrialStatus()}
            </div>
          </div>
        </div>

        <div className="offcanvas-footer p-3 border-top">
          <div className="text-center">
            <small className="text-muted">
             <footer className="text-center py-2 text-muted small">
  ©2026 Examly.pk. All rights reserved.
</footer>
            </small>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="container-fluid mt-3">
        <div className="row">
          {/* Desktop Sidebar */}
          <div className="col-lg-2 d-none d-lg-block border-end">
            <ul className="nav nav-pills flex-column">
              {[
                { path: "/dashboard", icon: "bi-speedometer", label: "Dashboard" },
                { path: "/dashboard/generate-paper", icon: "bi-file-earmark-text", label: "Generate Paper" },
                { path: "/dashboard/profile", icon: "bi-person", label: "Profile" },
                { path: "/dashboard/settings", icon: "bi-gear", label: "Settings" },
                { path: "/dashboard/packages", icon: "bi-box-seam", label: "Best Packages" },
                { path: "/dashboard/generated-papers", icon: "bi-box-seam", label: "Generated Papers" },
              ].map((item) => (
                <li key={item.path} className="mb-2">
                  <Link
                    href={item.path}
                    className={`nav-link sidebar-link d-flex align-items-center ${
                      isActive(item.path) ? "active" : ""
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <i className={`bi ${item.icon} me-2`}></i> {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            
            {/* Trial Status Section - Desktop */}
            <div className="mt-4 pt-3 border-top">
              <div className="trial-status-card">
                <div className="mb-3 text-center">
                  <small className="text-muted fw-bold d-flex align-items-center justify-content-center">
                    <i className="bi bi-card-checklist me-2"></i> Your Plan Status
                  </small>
                </div>
                {renderTrialStatus()}
              </div>
            </div>
            
          
          </div>
         

          {/* Main */}
          <div className="col-lg-10 p-0">
            <div className="p-2 p-md-3">{children}</div>
          </div>
           <Footer darkMode={darkMode} />
        </div>
      </div>
    </div>

  );

}