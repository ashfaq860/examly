// src/app/dashboard/generate-paper/components/StepRenderer.tsx
import React from 'react';
import { ClassSelectionStep } from './steps/ClassSelectionStep';
import { SubjectSelectionStep } from './steps/SubjectSelectionStep';
import { ChapterSelectionStep } from './steps/ChapterSelectionStep';
import { PaperBuilderApp } from './PaperBuilderApp';
import { UseFormReturn } from 'react-hook-form';
import { PaperFormData } from '../schema/paperSchema';
import { Class, Subject, Chapter, Question } from '@/types/types';

interface StepRendererProps {
  step: number;
  setStep: (step: number) => void;
  form: UseFormReturn<PaperFormData>;
  classes: Class[];
  subjects: Subject[];
  chapters: Chapter[];
  selectedQuestions: Record<string, string[]>;
  previewQuestions: Record<string, Question[]>;
  isLoadingPreview: boolean;
  isDownloadingKey: boolean;
  onPreviewLoad: () => void;
  onGenerate: () => Promise<void>;
  onDownloadKey: () => Promise<void>;
}

export const StepRenderer: React.FC<StepRendererProps> = ({
  step,
  setStep,
  form,
  classes,
  subjects,
  chapters,
  selectedQuestions,
  previewQuestions,
  isLoadingPreview,
  isDownloadingKey,
  onPreviewLoad,
  onGenerate,
  onDownloadKey,
}) => {
  const {
    watch,
    setValue,
    register,
    formState: { errors },
    getValues,
    trigger,
  } = form;

  const watchedClassId = watch('classId');
  const watchedSubjectId = watch('subjectId');
  const watchedChapterOption = watch('chapterOption');
  const selectedChapters = watch('selectedChapters') || [];

  switch (step) {
    case 1:
      return (
        <ClassSelectionStep
          classes={classes}
          watchedClassId={watchedClassId}
          setValue={setValue}
          errors={errors}
          onNext={() => setStep(2)}
        />
      );
    
    case 2:
      return (
        <SubjectSelectionStep
          subjects={subjects}
          watchedSubjectId={watchedSubjectId}
          watchedClassId={watchedClassId}
          classes={classes}
          setValue={setValue}
          errors={errors}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      );
    
    case 3:
      return (
        <ChapterSelectionStep
          chapters={chapters}
          watchedSubjectId={watchedSubjectId}
          watchedChapterOption={watchedChapterOption}
          selectedChapters={selectedChapters}
          subjects={subjects}
          setValue={setValue}
          setStep={setStep}
          watch={watch}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      );
    
    case 4:
      return (
        <PaperBuilderApp
          watch={watch}
          setValue={setValue}
          register={register}
          errors={errors}
          getValues={getValues}
          trigger={trigger}
          subjects={subjects}
          classes={classes}
          chapters={chapters}
          watchedClassId={watchedClassId}
          watchedSubjectId={watchedSubjectId}
          watchedChapterOption={watchedChapterOption}
          selectedChapters={selectedChapters}
          selectedQuestions={selectedQuestions}
          previewQuestions={previewQuestions}
          isLoadingPreview={isLoadingPreview}
          isDownloadingKey={isDownloadingKey}
          onPreviewLoad={onPreviewLoad}
          onGenerate={onGenerate}
          onDownloadKey={onDownloadKey}
          onBack={() => setStep(3)}
        />
      );
    
    default:
      return null;
  }
};