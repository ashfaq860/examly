// PaperTypeStep.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { Subject, Class } from '@/types/types';
// Import the sub-components
import { InitialPaperTypeStep } from './InitialPaperTypeStep';
import { CombinedLayoutAndSettingsStep } from './CombinedLayoutAndSettingsStep';

interface PaperTypeStepProps {
  watch: any;
  setValue: (field: string, value: any) => void;
  register: any;
  errors: any;
  setStep: (step: number) => void;
  setSelectedQuestions: (questions: Record<string, string[]>) => void;
  setQuestionsCache: (cache: any) => void;
  setLastPreviewLoad: (load: any) => void;
  setPreviewQuestions: (questions: any) => void;
  subjects: Subject[];
  classes: Class[];
  getQuestionTypes: () => any[];
  paperTypeStep: number;
  setPaperTypeStep: (step: number) => void;
}

export const PaperTypeStep: React.FC<PaperTypeStepProps> = ({
  watch,
  setValue,
  register,
  errors,
  setStep,
  setSelectedQuestions,
  setQuestionsCache,
  setLastPreviewLoad,
  setPreviewQuestions,
  subjects,
  classes,
  getQuestionTypes,
  paperTypeStep,
  setPaperTypeStep
}) => {
  const [currentClass, setCurrentClass] = useState<Class | null>(null);
  const [currentSubject, setCurrentSubject] = useState<Subject | null>(null);

  // Update current class and subject when they change
  useEffect(() => {
    const classId = watch("classId");
    const subjectId = watch("subjectId");
    if (classId && classes.length > 0) {
      const foundClass = classes.find(c => c.id === classId);
      setCurrentClass(foundClass || null);
    }
    
    if (subjectId && subjects.length > 0) {
      const foundSubject = subjects.find(s => s.id === subjectId);
      setCurrentSubject(foundSubject || null);
    }
  }, [watch("classId"), watch("subjectId"), classes, subjects]);

  // Helper function to get subject-specific subjective limits
  const getSubjectiveMaxForLayout = (layoutValue: string): number => {
    const specialSubjects = ['urdu', 'english', 'islamiyat', 'tarjuma tul quran', 'pakistan study', 'islamic study'];
    const currentSubjectName = currentSubject?.name?.toLowerCase() || '';
    const isSpecialSubject = specialSubjects.includes(currentSubjectName);
    
    let baseMax = 0;
    
    switch (layoutValue) {
      case "separate":
        baseMax = 30;
        break;
      case "same_page":
        baseMax = 15;
        break;
      case "two_papers":
        baseMax = 10;
        break;
      case "three_papers":
        baseMax = 15;
        break;
      default:
        baseMax = 15;
    }
    
    if (layoutValue === "three_papers") {
      return 15;
    }
    
    return isSpecialSubject ? baseMax + 5 : baseMax;
  };

  // Helper function to set default values for all question types
  const setDefaultQuestionTypeValues = () => {
    const questionTypes = getQuestionTypes();
    
    questionTypes.forEach(type => {
      if (type.value === 'mcq') {
        setValue(`${type.fieldPrefix}Count`, 5);
        setValue(`${type.fieldPrefix}ToAttempt`, 5);
        setValue(`${type.fieldPrefix}Marks`, 1);
      } else if (type.value === 'short') {
        setValue(`${type.fieldPrefix}Count`, 5);
        setValue(`${type.fieldPrefix}ToAttempt`, 5);
        setValue(`${type.fieldPrefix}Marks`, 2);
      } else if (type.value === 'long') {
        setValue(`${type.fieldPrefix}Count`, 2);
        setValue(`${type.fieldPrefix}ToAttempt`, 2);
        setValue(`${type.fieldPrefix}Marks`, 5);
      } else {
        setValue(`${type.fieldPrefix}Count`, 0);
        setValue(`${type.fieldPrefix}ToAttempt`, 0);
        setValue(`${type.fieldPrefix}Marks`, 1);
      }
    });
  };

  // Updated getModelPaperDetails function
  const getModelPaperDetails = () => {
    const subjectName = currentSubject?.name?.toLowerCase() || '';
    const className = currentClass?.name || '';
    
    const baseDetails = {
      mcq: {
        count: subjectName === 'english' ? 16 : subjectName==='urdu'? 15 : subjectName==='computer'? 10 : 12, 
        attempt: subjectName === 'english' ? 16 : subjectName==='urdu'? 15 : subjectName==='computer'? 10 : 12, 
        marks: 1, 
        total: subjectName === 'english' ? 16 : subjectName==='urdu'? 15 : subjectName==='computer'? 10 : 12 
      },
      short: { count: 0, attempt: 0, marks: 2, total: 0 },
      long: { count: subjectName === 'urdu' ? 1 : 3, attempt: subjectName === 'urdu' ? 1 : 2, marks: subjectName === 'urdu' ? 5 : 8, total: subjectName === 'urdu' ? 5 : 16 },
      totalMarks: 0,
      timeMinutes: 145,
      additionalTypes: [] as Array<{name: string, label: string, count: number, attempt: number, marks: number, total: number}>
    };

    if (subjectName.toLocaleLowerCase() === 'urdu' || subjectName.toLocaleLowerCase() === 'english') {
      baseDetails.short = { count: 8, attempt: 5, marks: 2, total: 10 };
    } else if (subjectName === "computer") {
      baseDetails.short = { count: 18, attempt: 12, marks: 2, total: 24 };
    } else {
      baseDetails.short = { count: 24, attempt: 16, marks: 2, total: 32 };
    }

    baseDetails.totalMarks = baseDetails.mcq.total + baseDetails.short.total + baseDetails.long.total;

    // Add subject-specific question types
    if (subjectName.toLocaleLowerCase() === 'urdu') {
      baseDetails.additionalTypes.push(
        { 
          name: 'poetry_explanation', 
          label: 'Poetry Explanation',
          count: 8, 
          attempt: 5, 
          marks: 2, 
          total: 10 
        },
        { 
          name: 'prose_explanation', 
          label: 'Prose Explanation',
          count:2,
          attempt: 1,  
          marks: 10, 
          total: 10 
        }
      );

      if (className === 10) {
        baseDetails.additionalTypes.push(
          { 
            name: 'passage', 
            label: 'Passage',
            count: 1, 
            attempt: 1, 
            marks: 10, 
            total: 10 
          }
        );
      } else if (className === 9) {
        baseDetails.additionalTypes.push(
            { 
            name: 'Nasarkhulasa_markziKhyal', 
            label: 'Nasarkhulasa/Markzi Khyal',
            count:2, 
            attempt: 1, 
            marks: 5, 
            total: 5 
          },
            { 
            name: 'darkhwast_khat', 
            label: 'Darkhwast/Khat',
            count: 1, 
            attempt: 1, 
            marks: 10, 
            total: 10 
          },
            { 
            name: 'kahani_makalma', 
            label: 'Kahani/Makalma',
            count: 2, 
            attempt: 1, 
            marks: 5, 
            total:5
          },{ 
            name: 'sentence_correction', 
            label: 'Sentence Correction',
            count: 4, 
            attempt: 3, 
            marks: 1, 
            total:3 
          },
          { 
            name: 'sentence_completion', 
            label: 'Sentence Completion',
            count: 3, 
            attempt: 2, 
            marks: 1, 
            total: 2 
          }
        );
      }
    } else if (subjectName === 'english' || subjectName === 'English') {
      if (className !== 10) {
        baseDetails.additionalTypes.push(
          { 
            name: 'translate_urdu', 
            label: 'Translate to Urdu',
            count: 3, 
            attempt: 2, 
            marks: 4, 
            total: 8 
          }
        );
      } else {
        baseDetails.additionalTypes.push(
          { 
            name: 'translate_urdu', 
            label: 'Translate to Urdu',
            count: 1, 
            attempt: 1, 
            marks: 8, 
            total: 8 
          }
        );
      }

      baseDetails.additionalTypes.push(
        { 
          name: 'translate_english', 
          label: 'Translate to English',
          count: 1, 
          attempt: 1, 
          marks: 5, 
          total: 5 
        },
        { 
          name: 'idiom_phrases', 
          label: 'Idiom & Phrases',
          count: 8, 
          attempt: 5, 
          marks: 1, 
          total: 5 
        }
      );

      if (className !== 10) {
        baseDetails.additionalTypes.push(
          { 
            name: 'passage', 
            label: 'Passage',
            count: 1, 
            attempt: 1, 
            marks: 10, 
            total: 10 
          },
          { 
            name: 'activePassive', 
            label: 'Active/Passive',
            count: 6, 
            attempt: 5, 
            marks: 1, 
            total: 5 
          }
        );
      } else if (className === 10) {
        baseDetails.additionalTypes.push(
          { 
            name: 'directInDirect', 
            label: 'Direct/Indirect',
            count: 6, 
            attempt: 5, 
            marks: 1, 
            total: 5 
          }
        );
      }
    }

    const additionalMarks = baseDetails.additionalTypes.reduce((sum, type) => sum + type.total, 0);
    baseDetails.totalMarks += additionalMarks;
    return baseDetails;
  };

  // Render different sub-steps
  if (paperTypeStep === 0) {
    return (
      <InitialPaperTypeStep
        watch={watch}
        setValue={setValue}
        setSelectedQuestions={setSelectedQuestions}
        setQuestionsCache={setQuestionsCache}
        setLastPreviewLoad={setLastPreviewLoad}
        setPreviewQuestions={setPreviewQuestions}
        subjects={subjects}
        classes={classes}
        getQuestionTypes={getQuestionTypes}
        currentSubject={currentSubject}
        currentClass={currentClass}
        getModelPaperDetails={getModelPaperDetails}
        setDefaultQuestionTypeValues={setDefaultQuestionTypeValues}
        setPaperTypeStep={setPaperTypeStep}
        setStep={setStep}
      />
    );
  } else if (paperTypeStep === 1) {
    return (
    <CombinedLayoutAndSettingsStep
      watch={watch}
      setValue={setValue}
      register={register}
      errors={errors}
      setStep={setStep}
      subjects={subjects}
      getQuestionTypes={getQuestionTypes}
      getSubjectiveMaxForLayout={getSubjectiveMaxForLayout}
      setPaperTypeStep={setPaperTypeStep}
    />
  );
  }

  return null;
};