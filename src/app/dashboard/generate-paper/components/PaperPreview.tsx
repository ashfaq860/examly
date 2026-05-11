// src/app/dashboard/generate-paper/components/PaperPreview.tsx
'use client';
import React from 'react';
import { Question, Chapter, Subject, Class } from '@/types/types';
import { ReviewStep } from './steps/ReviewStep';

interface PaperPreviewProps {
  watch: any;
  getValues: any;
  previewQuestions: Record<string, Question[]>;
  chapters: Chapter[];
  subjects: Subject[];
  classes: Class[];
  getQuestionTypes: () => any[];
  isEditMode: boolean;
  setPreviewQuestions: (questions: any) => void;
  loadPreviewQuestions: () => Promise<void>;
}

export const PaperPreview: React.FC<PaperPreviewProps> = ({
  watch,
  getValues,
  previewQuestions,
  chapters,
  subjects,
  classes,
  getQuestionTypes,
  isEditMode,
  setPreviewQuestions,
  loadPreviewQuestions
}) => {
  // This component wraps the existing ReviewStep for consistency
  return (
    <div className="paper-preview-wrapper">
      <ReviewStep
        watch={watch}
        getValues={getValues}
        setStep={() => {}} // Empty function since we're not using step navigation
        onSubmit={() => Promise.resolve()} // Empty promise since we're not submitting
        isLoading={false}
        isLoadingPreview={false}
        isDownloadingKey={false}
        isAuthenticated={true}
        isEditMode={isEditMode}
        setIsEditMode={() => {}} // Empty function
        previewQuestions={previewQuestions}
        chapters={chapters}
        subjects={subjects}
        classes={classes}
        loadPreviewQuestions={loadPreviewQuestions}
        calculateTotalMarks={() => ({ total: 0 })}
        getQuestionTypes={getQuestionTypes}
        setPreviewQuestions={setPreviewQuestions}
        onDownloadKey={() => Promise.resolve()} // Empty promise
      />
    </div>
  );
};