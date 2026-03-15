import React from 'react';
import { useUser } from '@/app/context/userContext';

const SubscriptionStatus: React.FC = () => {
  const { trialStatus, isLoading } = useUser();

  const getDisplayData = () => {
    if (!trialStatus) {
      return {
        type: 'Free',
        status: 'inactive',
        endDate: '',
        papersLeft: 0,
        isTrial: false,
        trialDaysLeft: 0,
        totalPapersInPlan: 0,
      };
    }

    // Active subscription takes priority
    if (trialStatus.hasActiveSubscription) {
      const isUnlimited =
        trialStatus.subscriptionType !== 'paper_pack' || trialStatus.papersRemaining === 'unlimited';
      return {
        type: trialStatus.subscriptionName || 'Premium',
        status: 'active',
        endDate: trialStatus.subscriptionEndDate
          ? trialStatus.subscriptionEndDate.toLocaleDateString()
          : '',
        papersLeft: isUnlimited ? 'Unlimited' : trialStatus.papersRemaining,
        isTrial: false,
        trialDaysLeft: 0,
        totalPapersInPlan: isUnlimited
          ? Infinity
          : (trialStatus.papersRemaining || 0) + (trialStatus.papersGenerated || 0),
      };
    }

    // Trial info
    if (trialStatus.isTrial) {
      const isExpired =
        (trialStatus.trialEndsAt && new Date() > trialStatus.trialEndsAt) ||
        (trialStatus.papersRemaining !== 'unlimited' && trialStatus.papersRemaining <= 0);

      const papersLeft =
        trialStatus.papersRemaining === 'unlimited' ? 'Unlimited' : trialStatus.papersRemaining;

      return {
        type: 'Trial',
        status: isExpired ? 'expired' : 'trial',
        endDate: trialStatus.trialEndsAt
          ? trialStatus.trialEndsAt.toLocaleDateString()
          : '',
        papersLeft,
        isTrial: true,
        trialDaysLeft: trialStatus.daysRemaining,
        totalPapersInPlan: trialStatus.papersRemaining === 'unlimited' ? Infinity : 5,
      };
    }

    // Default: free plan
    return {
      type: 'Free',
      status: 'inactive',
      endDate: '',
      papersLeft: 0,
      isTrial: false,
      trialDaysLeft: 0,
      totalPapersInPlan: 0,
    };
  };

  const displayData = getDisplayData();

  if (isLoading) {
    return (
      <div className="alert alert-info mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <strong>Loading subscription status...</strong>
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  const renderPapersText = () => {
    if (displayData.papersLeft === 'Unlimited' || displayData.totalPapersInPlan === Infinity) {
      return 'Unlimited papers';
    }
    if (displayData.isTrial) {
      return `${displayData.papersLeft} of ${displayData.totalPapersInPlan} papers remaining`;
    }
    return `${displayData.papersLeft} papers remaining`;
  };

  switch (displayData.status) {
    case 'active':
      return (
        <div className="alert alert-success mb-4">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>{displayData.type} Plan - Active</strong>
              <div className="small">
                {renderPapersText()}
                {displayData.endDate && ` (renews ${displayData.endDate})`}
              </div>
            </div>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => (window.location.href = '/dashboard/packages')}
            >
              Manage
            </button>
          </div>
        </div>
      );

    case 'trial':
      return (
        <div className="alert alert-warning mb-4">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>Free Trial Active</strong>
              <div className="small">{displayData.trialDaysLeft} days remaining</div>
              <div className="small">{renderPapersText()}</div>
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => (window.location.href = '/dashboard/packages')}
            >
              Upgrade Now
            </button>
          </div>
        </div>
      );

    case 'expired':
      return (
        <div className="alert alert-danger mb-4">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>{displayData.type} Plan - Expired</strong>
              <div className="small">
                {displayData.endDate
                  ? `Expired on ${displayData.endDate}`
                  : 'Your plan has expired'}
              </div>
              <div className="small">Please subscribe to continue</div>
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => (window.location.href = '/dashboard/packages')}
            >
              Subscribe Now
            </button>
          </div>
        </div>
      );

    default:
      return (
        <div className="alert alert-secondary mb-4">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>Free Plan</strong>
              <div className="small">Upgrade to access more features</div>
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => (window.location.href = '/dashboard/packages')}
            >
              View Plans
            </button>
          </div>
        </div>
      );
  }
};

export default SubscriptionStatus;
