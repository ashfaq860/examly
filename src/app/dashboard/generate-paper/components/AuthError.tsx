// src/app/dashboard/generate-paper/components/AuthError.tsx
import React from 'react';

interface AuthErrorProps {
  error: string;
}

export const AuthError: React.FC<AuthErrorProps> = ({ error }) => {
  return (
    <div className="container-fluid py-5">
      <div className="alert alert-danger shadow-lg border-0" role="alert" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="text-center mb-4">
          <i className="bi bi-exclamation-triangle-fill display-1 text-danger"></i>
        </div>
        <h4 className="alert-heading text-center mb-3">Access Denied</h4>
        <p className="text-center mb-4">{error}</p>
        <hr />
        <div className="d-flex justify-content-between align-items-center">
          <p className="mb-0 text-muted small">
            Please log in with a teacher account to access this page.
          </p>
          <button 
            className="btn btn-danger px-4"
            onClick={() => window.location.href = '/auth/login'}
          >
            <i className="bi bi-box-arrow-in-right me-2"></i>
            Login
          </button>
        </div>
      </div>
    </div>
  );
};