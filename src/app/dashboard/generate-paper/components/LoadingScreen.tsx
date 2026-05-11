// src/app/dashboard/generate-paper/components/LoadingScreen.tsx
import React from 'react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="container-fluid text-center py-5">
      <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
        <span className="visually-hidden">Loading...</span>
      </div>
      <p className="mt-3 text-muted fs-5">Loading...</p>
    </div>
  );
};