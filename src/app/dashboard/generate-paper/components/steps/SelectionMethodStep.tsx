'use client';
import React from 'react';

interface SelectionMethodStepProps {
  watchedSelectionMethod: string;
  setValue: (field: string, value: any) => void;
  setStep: (step: number) => void;
}

export const SelectionMethodStep: React.FC<SelectionMethodStepProps> = ({
  watchedSelectionMethod,
  setValue,
  setStep
}) => {
  return (
    <div className="step-transition">
      <div className="text-center mb-3">
        <h5 className="fw-bold mb-3">🎯 Selection Method</h5>
        <p className="text-muted d-none d-sm-inline">Choose how you want to select questions for your paper</p>
      </div>

      <div className="row row-cols-1 row-cols-md-2 g-4">
        <div className="col">
          <div 
            className={`card h-100 cursor-pointer p-4 transition-all ${
              watchedSelectionMethod === 'auto' ? 'border-primary bg-primary bg-opacity-10 shadow' : 'border-light'
            }`}
            onClick={() => {
              setValue('selectionMethod', 'auto');
              setTimeout(() => setStep(7), 400);
            }}
            style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
          >
            <div className="card-body text-center">
              <span className="display-6 mb-3">🤖</span>
              <h4 className="card-title fw-bold">Auto Generate</h4>
              <p className="card-text text-muted">
                System will automatically select questions randomly from ALL chapters based on your criteria. 
                Perfect for quick paper generation with balanced difficulty distribution.
              </p>
              <div className="mt-4">
                <span className="badge bg-primary px-3 py-2">
                  <i className="bi bi-lightning me-2"></i>
                  Fast & Automated
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="col">
          <div 
            className={`card h-100 cursor-pointer p-4 transition-all ${
              watchedSelectionMethod === 'manual' ? 'border-primary bg-primary bg-opacity-10 shadow' : 'border-light'
            }`}
            onClick={() => {
              setValue('selectionMethod', 'manual');
              setTimeout(() => setStep(6), 400);
            }}
            style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
          >
            <div className="card-body text-center">
              <span className="display-6 mb-3">✍️</span>
              <h4 className="card-title fw-bold">Manual Selection</h4>
              <p className="card-text text-muted">
                You will manually select each question from available pool. 
                Perfect for when you want full control over question selection.
              </p>
              <div className="mt-4">
                <span className="badge bg-success px-3 py-2">
                  <i className="bi bi-eye me-2"></i>
                  Full Control
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};