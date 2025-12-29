'use client';
import React from 'react';

interface StepProgressProps {
  step: number;
}

export const StepProgress: React.FC<StepProgressProps> = ({ step }) => {
  const steps = [
    { step: 1, label: 'Select Class', icon: '🎓' },
    { step: 2, label: 'Select Subject', icon: '📚' },
    { step: 3, label: 'Select Chapters', icon: '📖' },
    { step: 4, label: 'Select Paper Type', icon: '📝' },
    { step: 5, label: 'Select Method', icon: '🤖' },
    { step: 6, label: 'Question Selection', icon: '✍️' },
    { step: 7, label: 'Review', icon: '👁️' }
  ];

  const stepLabels = [
    'Selecting Class',
    'Choosing Subject',
    'Setting Chapter Coverage',
    'Configuring Paper Type',
    'Selection Method',
    'Manual Question Selection',
    'Final Review & Generation'
  ];

  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between align-items-center mb-3 progress-scroll">
        {steps.map((item, index) => (
          <div key={item.step} className="d-flex flex-column align-items-center position-relative me-4">
            <span>{index+1}</span>
            {index > 0 && (
              <div 
                className={`position-absolute top-50 start-0 w-100 h-2 ${
                  step > item.step ? 'bg-primary' : 'bg-light'
                }`}
                style={{ zIndex: 1, transform: 'translateY(-50%)' }}
              ></div>
            )}

            <div 
              className={`rounded-circle d-flex align-items-center justify-content-center position-relative ${
                step >= item.step ? 'bg-primary text-white' : 'bg-light text-muted'
              }`}
              style={{ 
                width: '50px', 
                height: '50px', 
                zIndex: 2,
                transition: 'all 0.3s ease'
              }}
            >
              {step > item.step ? (
                <i className="bi bi-check-lg fs-6"></i>
              ) : (
                <span className="fs-5">{item.icon}</span>
              )}
            </div>
            
            <small className={`mt-2 fw-semibold ${step >= item.step ? 'text-primary' : 'text-muted'}`}>
              {item.label}
            </small>
          </div>
        ))}
      </div>

      <div className="text-center">
        <small className="text-muted">
          Step {step} of 7 - {stepLabels[step - 1]}
        </small>
      </div>
    </div>
  );
};