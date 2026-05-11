// src/app/dashboard/generate-paper/components/StepIndicator.tsx
import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
  onStepChange: (step: number) => void;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ 
  currentStep, 
  onStepChange 
}) => {
  const steps = [
    { number: 1, label: 'Class', icon: 'bi-mortarboard' },
    { number: 2, label: 'Subject', icon: 'bi-book' },
    { number: 3, label: 'Chapters', icon: 'bi-collection' },
    { number: 4, label: 'Build Paper', icon: 'bi-file-earmark-text' },
  ];

  const getStepLabel = (step: number) => {
    switch(step) {
      case 2: return 'Back to Class Selection';
      case 3: return 'Back to Subject Selection';
      case 4: return 'Back to Chapter Selection';
      default: return 'Back';
    }
  };

  return (
    <div className="d-flex justify-content-between align-items-center mb-4">
      {currentStep > 1 && (
        <button 
          className="btn btn-outline-primary btn-sm" 
          onClick={() => onStepChange(currentStep - 1)}
        >
          <span className="d-inline d-sm-none">
            <ArrowLeft className="me-2" size={20} />
            Back
          </span>
          <span className="d-none d-sm-inline">
            <ArrowLeft className="me-2" size={20} />
            {getStepLabel(currentStep)}
          </span>
        </button>
      )}

      <div className="ms-auto">
        <div className="d-flex gap-2">
          {steps.map((step) => (
            <React.Fragment key={step.number}>
              <div
                className={`d-flex align-items-center ${
                  step.number < currentStep ? 'text-success' :
                  step.number === currentStep ? 'text-primary' : 'text-muted'
                }`}
              >
                <div className="text-center">
                  <div 
                    className={`rounded-circle d-flex align-items-center justify-content-center mx-auto mb-1
                      ${step.number === currentStep ? 'bg-primary text-white' : 
                        step.number < currentStep ? 'bg-success text-white' : 'bg-light'}`}
                    style={{ width: '32px', height: '32px' }}
                  >
                    <i className={`bi ${step.icon}`}></i>
                  </div>
                  <small className="d-none d-md-block">{step.label}</small>
                </div>
              </div>
              {step.number < 4 && (
                <i className="bi bi-chevron-right mx-2 text-muted d-flex align-items-center"></i>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};