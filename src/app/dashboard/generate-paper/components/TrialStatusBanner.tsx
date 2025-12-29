'use client';
import React from 'react';

interface TrialStatus {
  isTrial: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
  hasActiveSubscription: boolean;
  papersGenerated: number;
  papersRemaining: number | "unlimited";
  subscriptionName?: string;
  subscriptionType?: "paper_pack" | "subscription";
  subscriptionEndDate?: Date;
  message?: string;
}

interface TrialStatusBannerProps {
  trialStatus: TrialStatus | null;
}

const TrialStatusBanner: React.FC<TrialStatusBannerProps> = ({ trialStatus }) => {
  if (!trialStatus) return null;

  // If there's a message that requires action (e.g., profile update)
  if (trialStatus.message) {
    return (
      <div className="card border-0 shadow-sm mb-4 bg-warning bg-opacity-10">
        <div className="card-body d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <i className="bi bi-exclamation-triangle-fill text-warning display-6 me-3"></i>
            <div>
              <h5 className="fw-bold mb-1">Action Required</h5>
              <p className="mb-0">{trialStatus.message}</p>
            </div>
          </div>
          <a
            href="/dashboard/settings"
            className="btn btn-warning rounded-pill px-3 fw-semibold"
          >
            Update Now <i className="bi bi-arrow-right ms-1"></i>
          </a>
        </div>
      </div>
    );
  }

  // Active subscription
  if (trialStatus.hasActiveSubscription) {
    return (
      <div className="card border-0 shadow-sm mb-4 bg-success bg-opacity-10">
        <div className="card-body d-flex align-items-center">
          <i className="bi bi-check-circle-fill text-success display-6 me-3"></i>
          <div>
            <h5 className="fw-bold mb-1">Active Subscription</h5>
            <p className="mb-0">
              You are on <strong>{trialStatus.subscriptionName}</strong> plan.{" "}
              {trialStatus.subscriptionType === "paper_pack" ? (
                <>{trialStatus.papersRemaining} paper(s) left in your pack.</>
              ) : (
                <>Subscription active until {trialStatus.subscriptionEndDate?.toLocaleDateString()}.</>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Free trial
  if (trialStatus.isTrial) {
    const isWarning = trialStatus.daysRemaining <= 5;
    
    return (
      <div
        className={`card border-0 shadow-sm mb-4 ${
          isWarning
            ? "bg-warning bg-opacity-10"
            : "bg-info bg-opacity-10"
        }`}
      >
        <div className="card-body d-flex align-items-center">
          <i
            className={`bi bi-clock-history ${
              isWarning ? "text-warning" : "text-info"
            } display-6 me-3`}
          ></i>
          <div>
            <h5 className="fw-bold mb-1">Free Trial</h5>
            <p className="mb-0">
              {trialStatus.daysRemaining <= 0 ? (
                <span>Your trial has ended.</span>
              ) : (
                <span>
                  Unlimited papers for <strong>{trialStatus.daysRemaining}</strong>{" "}
                  more day(s).
                </span>
              )}
            </p>
          </div>
          
          {isWarning && trialStatus.daysRemaining > 0 && (
            <a
              href="/dashboard/packages"
              className="btn btn-warning ms-auto rounded-pill px-3 fw-semibold"
            >
              Upgrade Now <i className="bi bi-arrow-right ms-1"></i>
            </a>
          )}
        </div>
      </div>
    );
  }

  // Trial ended, no subscription
  return (
    <div className="card border-0 shadow-sm mb-4 bg-danger bg-opacity-10">
      <div className="card-body d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center">
          <i className="bi bi-exclamation-triangle-fill text-danger display-6 me-3"></i>
          <div>
            <h5 className="fw-bold mb-1">Trial Ended</h5>
            <p className="mb-0">Please subscribe to continue generating papers.</p>
          </div>
        </div>
        <a
          href="/dashboard/packages"
          className="btn btn-danger rounded-pill px-3 fw-semibold"
        >
          View Plans <i className="bi bi-arrow-right ms-1"></i>
        </a>
      </div>
    </div>
  );
};

export default TrialStatusBanner;