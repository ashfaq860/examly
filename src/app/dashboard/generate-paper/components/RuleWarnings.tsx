// src/app/dashboard/generate-paper/components/RuleWarnings.tsx
import React, { useState } from 'react';

interface RuleWarningsProps {
  warnings: string[];
}

export const RuleWarnings: React.FC<RuleWarningsProps> = ({ warnings }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!warnings || warnings.length === 0 || !isVisible) return null;

  return (
    <div className="alert alert-warning alert-dismissible fade show mt-3 shadow-sm" role="alert">
      <div className="d-flex">
        <i className="bi bi-exclamation-triangle-fill me-3 fs-4"></i>
        <div>
          <strong className="fs-6">Chapter Rule Warnings:</strong>
          <ul className="mb-0 mt-2">
            {warnings.map((warning, index) => (
              <li key={index} className="small">{warning}</li>
            ))}
          </ul>
        </div>
      </div>
      <button 
        type="button" 
        className="btn-close" 
        onClick={() => setIsVisible(false)}
        aria-label="Close"
      ></button>
    </div>
  );
};