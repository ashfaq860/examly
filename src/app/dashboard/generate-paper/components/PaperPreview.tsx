'use client';
import React from 'react';
import { Class, Subject, Chapter, Question } from '@/types/types';

interface PaperPreviewProps {
  previewQuestions: Record<string, Question[]>;
  isEditMode: boolean;
  setIsEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  isLoadingPreview: boolean;
  loadPreviewQuestions: () => Promise<void>;
  draggedQuestion: { id: string; type: string } | null;
  handleDragStart: (questionId: string, questionType: string) => void;
  handleDrop: (targetType: string) => void;
  calculateTotalMarks: () => { total: number; [key: string]: number };
  classes: Class[];
  subjects: Subject[];
  chapters: Chapter[];
  watch: any;
  getQuestionTypes: () => any[];
}

const PaperPreview: React.FC<PaperPreviewProps> = ({
  previewQuestions,
  isEditMode,
  setIsEditMode,
  isLoadingPreview,
  loadPreviewQuestions,
  draggedQuestion,
  handleDragStart,
  handleDrop,
  calculateTotalMarks,
  classes,
  subjects,
  chapters,
  watch,
  getQuestionTypes
}) => {
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="card mb-4 border-0 shadow-sm">
      <div className="card-header bg-primary text-white">
        {/* Header content */}
      </div>
      
      <div className="card-body p-0">
        {isLoadingPreview ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary mb-3" style={{width: '3rem', height: '3rem'}}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <h5>Loading Questions...</h5>
            <p className="text-muted">Preparing your paper preview</p>
          </div>
        ) : (
          <div className="paper-preview">
            {/* PDF-like preview content */}
            {/* This would contain the detailed paper preview structure */}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaperPreview;