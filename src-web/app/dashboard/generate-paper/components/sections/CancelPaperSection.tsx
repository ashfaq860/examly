// src/app/dashboard/generate-paper/components/sections/CancelPaperSection.tsx
'use client';
import React, { useState } from 'react';

interface CancelPaperSectionProps {
  setStep: (step: number) => void;
  setValue: (field: string, value: any) => void;
}

export const CancelPaperSection: React.FC<CancelPaperSectionProps> = ({
  setStep,
  setValue
}) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCancel = () => {
    setShowConfirm(true);
  };

  const confirmCancel = () => {
    // Reset form values
    setValue('classId', '');
    setValue('subjectId', '');
    setValue('chapterOption', 'full_book');
    setValue('selectedChapters', []);
    setValue('title', '');
    setValue('dateOfPaper', new Date().toISOString().split('T')[0]);
    setValue('mcqCount', 0);
    setValue('shortCount', 0);
    setValue('longCount', 0);
    
    // Go back to step 1
    setStep(1);
  };

  const handleSaveAndExit = () => {
    alert('Paper would be saved and you would be redirected to dashboard.');
    // In a real implementation, you would save the paper first
    setStep(1);
  };

  return (
    <div className="card border-danger">
      <div className="card-header bg-danger text-white">
        <h5 className="mb-0">
          <i className="bi bi-x-circle me-2"></i>
          Cancel Paper
        </h5>
      </div>
      <div className="card-body">
        {!showConfirm ? (
          <>
            <div className="alert alert-warning mb-3">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>Warning:</strong> Canceling will discard all unsaved changes.
            </div>
            
            <div className="text-center">
              <button
                className="btn btn-danger btn-lg w-100 mb-3"
                onClick={handleCancel}
              >
                <i className="bi bi-trash me-2"></i>
                Cancel Paper
              </button>
              
              <button
                className="btn btn-outline-primary w-100"
                onClick={handleSaveAndExit}
              >
                <i className="bi bi-save me-2"></i>
                Save and Exit
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="alert alert-danger mb-3">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              <strong>Are you sure?</strong> This action cannot be undone.
            </div>
            
            <div className="text-center">
              <p>All unsaved changes will be lost.</p>
              
              <div className="d-grid gap-2">
                <button
                  className="btn btn-danger"
                  onClick={confirmCancel}
                >
                  Yes, Cancel Paper
                </button>
                
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setShowConfirm(false)}
                >
                  No, Go Back
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};