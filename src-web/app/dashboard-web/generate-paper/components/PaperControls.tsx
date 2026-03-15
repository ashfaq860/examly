'use client';
import React from 'react';
import { Question } from '@/types/types';

interface PaperControlsProps {
  onSubmit: (data: any) => Promise<void>;
  isLoading: boolean;
  isDownloadingKey: boolean;
  previewQuestions: Record<string, Question[]>;
  isEditMode: boolean;
  calculateTotalMarks: () => { total: number; [key: string]: number };
  watch: any;
  getValues: any;
  resetForm: () => void;
  prevStep: () => void;
  loadPreviewQuestions: () => Promise<void>;
  isLoadingPreview: boolean;
  getQuestionTypes: () => any[];
}

const PaperControls: React.FC<PaperControlsProps> = ({
  onSubmit,
  isLoading,
  isDownloadingKey,
  previewQuestions,
  isEditMode,
  calculateTotalMarks,
  watch,
  getValues,
  resetForm,
  prevStep,
  loadPreviewQuestions,
  isLoadingPreview,
  getQuestionTypes
}) => {
  const totalMarks = calculateTotalMarks();

  return (
    <div className="card mb-4 border-0 shadow-sm sticky-top" style={{ top: '50px', zIndex: '1' }}>
      <div className="card-header bg-primary text-white">
        <h3 className="h5 card-title mb-0">🎯 Paper Controls</h3>
      </div>
      <div className="card-body">
        {/* Real-time Marks Calculator */}
        <div className="mb-4 p-3 bg-light rounded">
          <h6 className="fw-bold text-primary mb-3">📊 Live Marks Calculator</h6>
          <div className="row g-3">
            {/* Marks calculation display */}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button 
            className="btn btn-success w-100 btn-lg mb-3" 
            type="submit" 
            disabled={isLoading || isLoadingPreview}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Generating PDF...
              </>
            ) : (
              <>
                <i className="bi bi-file-earmark-pdf me-2"></i>
                Generate Paper PDF
              </>
            )}
          </button>

          {/* Other buttons and controls */}
        </div>
      </div>
    </div>
  );
};

export default PaperControls;