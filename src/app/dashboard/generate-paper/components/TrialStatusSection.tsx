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

interface TrialStatusSectionProps {
  trialStatus: TrialStatus | null;
  isLoading: boolean;
}

export const TrialStatusSection: React.FC<TrialStatusSectionProps> = ({
  trialStatus,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="alert alert-info mb-4">
        <div className="spinner-border spinner-border-sm me-2" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        Loading your account information...
      </div>
    );
  }

  if (!trialStatus) return null;

  const TrialStatusBanner = ({ trialStatus }: { trialStatus: TrialStatus }) => {
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
                  <></>
                )}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (trialStatus.isTrial) {
      return (
        <div
          className={`card border-0 shadow-sm mb-4 ${
            trialStatus.daysRemaining <= 5
              ? "bg-warning bg-opacity-10"
              : "bg-info bg-opacity-10"
          }`}
        >
          <div className="card-body d-flex align-items-center">
            <i
              className={`bi bi-clock-history ${
                trialStatus.daysRemaining <= 5 ? "text-warning" : "text-info"
              } display-6 me-3`}
            ></i>
            <div>
              <h5 className="fw-bold mb-1">Free Trial</h5>
              <p className="mb-0">
                Unlimited papers for <strong>{trialStatus.daysRemaining}</strong>{" "}
                more day(s).
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="card border-0 shadow-sm mb-4 bg-danger bg-opacity-10">
        <div className="card-body d-flex align-items-center">
          <i className="bi bi-exclamation-triangle-fill text-danger display-6 me-3"></i>
          <div>
            <h5 className="fw-bold mb-1">Trial Ended</h5>
            <p className="mb-0">Please subscribe to continue generating papers.</p>
          </div>
        </div>
      </div>
    );
  };

  return <TrialStatusBanner trialStatus={trialStatus} />;
};