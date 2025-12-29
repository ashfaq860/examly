'use client';
import React from 'react';

interface SubscriptionModalProps {
  show: boolean;
  onClose: () => void;
  trialStatus: any;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  show,
  onClose,
  trialStatus,
}) => (
  <div className={`modal fade ${show ? "show d-block" : ""}`} tabIndex={-1}>
    <div className="modal-dialog modal-dialog-centered">
      <div className="modal-content shadow-lg border-0 rounded-4">
        <div className="modal-header border-0">
          <h5 className="modal-title fw-bold">
            {trialStatus?.message ? "Profile Update Required" : "Upgrade Required"}
          </h5>
          <button type="button" className="btn-close" onClick={onClose}></button>
        </div>
        <div className="modal-body text-center">
          <i className="bi bi-stars text-primary display-3 mb-3"></i>

          {trialStatus?.message ? (
            <p className="fs-5">{trialStatus.message}</p>
          ) : trialStatus?.isTrial ? (
            <p className="fs-5">Your free trial has ended.</p>
          ) : (
            <p className="fs-5">
              Your free trial has ended. Please subscribe to continue generating papers.
            </p>
          )}

          {!trialStatus?.message && (
            <div className="alert alert-info rounded-pill">
              🎁 Free Trial: <strong>30 days unlimited papers</strong>
            </div>
          )}
        </div>
        <div className="modal-footer border-0">
          <button
            type="button"
            className="btn btn-outline-secondary rounded-pill px-3"
            onClick={onClose}
          >
            Later
          </button>

          {trialStatus?.message ? (
            <button
              type="button"
              className="btn btn-warning rounded-pill px-4"
              onClick={() => {
                onClose();
                window.location.href = "/dashboard/settings";
              }}
            >
              Update Profile <i className="bi bi-arrow-right ms-2"></i>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary rounded-pill px-4"
              onClick={() => {
                onClose();
                window.location.href = "/dashboard/packages";
              }}
            >
              View Plans <i className="bi bi-arrow-right ms-2"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);