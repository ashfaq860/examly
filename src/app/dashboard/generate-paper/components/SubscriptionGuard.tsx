// src/app/dashboard/generate-paper/components/SubscriptionGuard.tsx
import React from 'react';
import { useUser } from '@/app/context/userContext';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
  const { trialStatus, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2 text-muted">Checking subscription...</p>
      </div>
    );
  }

  const canGenerate = () => {
    if (!trialStatus) return false;
    if (trialStatus.hasActiveSubscription) return true;
    if (trialStatus.isTrial && 
        trialStatus.trialEndsAt &&
        trialStatus.trialEndsAt.getTime() > Date.now()) {
      return true;
    }
    return false;
  };

  if (!canGenerate()) {
    return (
      <div className="card mt-4 border-0 shadow-lg">
        <div className="card-body text-center py-5">
          <div className="mb-4">
            <i className="bi bi-stars display-1 text-primary"></i>
          </div>
          <h3 className="card-title h4 mb-3">Upgrade to Continue</h3>
          <p className="card-text text-muted mb-4 fs-5">
            {trialStatus?.isTrial 
              ? "Your free trial has ended. Subscribe to continue generating unlimited papers." 
              : "Your free trial has ended. Subscribe to continue generating unlimited papers."
            }
          </p>
          <div className="d-flex gap-3 justify-content-center">
            <button 
              className="btn btn-outline-secondary px-4"
              onClick={() => window.history.back()}
            >
              <i className="bi bi-arrow-left me-2"></i>
              Go Back
            </button>
            <button 
              className="btn btn-primary btn-lg px-5"
              onClick={() => window.location.href = '/dashboard/packages'}
            >
              <i className="bi bi-rocket-takeoff me-2"></i>
              View Plans
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Apply opacity to content if cannot generate
  return (
    <div style={{ 
      opacity: canGenerate() ? 1 : 0.6,
      pointerEvents: canGenerate() ? 'auto' : 'none'
    }}>
      {children}
    </div>
  );
};