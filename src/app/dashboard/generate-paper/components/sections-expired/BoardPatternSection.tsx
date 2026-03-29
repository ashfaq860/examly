// src/app/dashboard/generate-paper/components/sections/BoardPatternSection.tsx
'use client';
import React, { useState } from 'react';
import { Subject, Class, Chapter } from '@/types/types';

interface BoardPatternSectionProps {
  watchedSubjectId: string;
  watchedClassId: string;
  subjects: Subject[];
  classes: Class[];
  chapters: Chapter[];
  setValue: (field: string, value: any) => void;
  loadPreviewQuestions: () => Promise<void>;
  getQuestionTypes: () => any[];
}

export const BoardPatternSection: React.FC<BoardPatternSectionProps> = ({
  watchedSubjectId,
  watchedClassId,
  subjects,
  classes,
  chapters,
  setValue,
  loadPreviewQuestions,
  getQuestionTypes
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateBoardPattern = async () => {
    try {
      setIsGenerating(true);
      
      // Get full book chapters
      const subjectChapters = chapters.filter(ch => 
        ch.subject_id === watchedSubjectId && ch.class_id === watchedClassId
      );
      
      if (subjectChapters.length === 0) {
        alert('No chapters found for the selected subject.');
        return;
      }

      const chapterIds = subjectChapters.map(ch => ch.id);
      
      // Set paper type to model
      setValue('paperType', 'model');
      setValue('chapterOption', 'full_book');
      setValue('selectedChapters', chapterIds);
      setValue('selectionMethod', 'auto');
      
      // Get subject and class info
      const subject = subjects.find(s => s.id === watchedSubjectId);
      const currentClass = classes.find(c => c.id === watchedClassId);
      const subjectName = subject?.name.toLowerCase() || '';
      const className = currentClass?.name || '';
      
      // Set subject-specific pattern
      if (subjectName.includes('urdu')) {
        setValue('language', 'urdu');
        setValue('mcqPlacement', 'separate');
        setValue('mcqCount', 15);
        setValue('mcqToAttempt', 15);
        setValue('mcqMarks', 1);
        setValue('shortCount', 8);
        setValue('shortToAttempt', 5);
        setValue('shortMarks', 2);
        setValue('longCount', 1);
        setValue('longToAttempt', 1);
        setValue('longMarks', 5);
        
        // Additional Urdu-specific types
        const questionTypes = getQuestionTypes();
        const poetryType = questionTypes.find(t => t.value === 'poetry_explanation');
        const proseType = questionTypes.find(t => t.value === 'prose_explanation');
        
        if (poetryType) {
          setValue(`${poetryType.fieldPrefix}Count`, 8);
          setValue(`${poetryType.fieldPrefix}ToAttempt`, 5);
          setValue(`${poetryType.fieldPrefix}Marks`, 2);
        }
        
        if (proseType) {
          setValue(`${proseType.fieldPrefix}Count`, 2);
          setValue(`${proseType.fieldPrefix}ToAttempt`, 1);
          setValue(`${proseType.fieldPrefix}Marks`, 10);
        }
      } 
      else if (subjectName.includes('english')) {
        setValue('language', 'english');
        setValue('mcqPlacement', 'separate');
        setValue('mcqCount', 16);
        setValue('mcqToAttempt', 16);
        setValue('mcqMarks', 1);
        setValue('shortCount', 8);
        setValue('shortToAttempt', 5);
        setValue('shortMarks', 2);
        setValue('longCount', 3);
        setValue('longToAttempt', 2);
        setValue('longMarks', 8);
        
        // Additional English-specific types
        const questionTypes = getQuestionTypes();
        const translateUrdu = questionTypes.find(t => t.value === 'translate_urdu');
        const idiomPhrases = questionTypes.find(t => t.value === 'idiom_phrases');
        
        if (translateUrdu) {
          setValue(`${translateUrdu.fieldPrefix}Count`, className === '10' ? 1 : 3);
          setValue(`${translateUrdu.fieldPrefix}ToAttempt`, 1);
          setValue(`${translateUrdu.fieldPrefix}Marks`, className === '10' ? 8 : 4);
        }
        
        if (idiomPhrases) {
          setValue(`${idiomPhrases.fieldPrefix}Count`, 8);
          setValue(`${idiomPhrases.fieldPrefix}ToAttempt`, 5);
          setValue(`${idiomPhrases.fieldPrefix}Marks`, 1);
        }
      } 
      else {
        // Default pattern for other subjects
        setValue('language', 'bilingual');
        setValue('mcqPlacement', 'separate');
        setValue('mcqCount', 12);
        setValue('mcqToAttempt', 12);
        setValue('mcqMarks', 1);
        setValue('shortCount', 24);
        setValue('shortToAttempt', 16);
        setValue('shortMarks', 2);
        setValue('longCount', 3);
        setValue('longToAttempt', 2);
        setValue('longMarks', 8);
      }
      
      // Set time
      setValue('timeMinutes', 145);
      setValue('mcqTimeMinutes', 15);
      setValue('subjectiveTimeMinutes', 130);
      
      // Auto-generate questions
      setTimeout(async () => {
        await loadPreviewQuestions();
        alert('Board pattern questions generated successfully!');
      }, 1000);
      
    } catch (error) {
      console.error('Error generating board pattern:', error);
      alert('Failed to generate board pattern. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="card border-primary border-2">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0">
          <i className="bi bi-book me-2"></i>
          Board Pattern
        </h5>
      </div>
      <div className="card-body">
        <div className="alert alert-info mb-3">
          <i className="bi bi-info-circle me-2"></i>
          <strong>Board Pattern Features:</strong>
          <ul className="mb-0 mt-1 small">
            <li>Automatically selects questions from full book</li>
            <li>Follows official board rules and distribution</li>
            <li>Subject-specific question types</li>
            <li>Proper time allocation</li>
            <li>Official marking scheme</li>
          </ul>
        </div>
        
        <div className="text-center">
          <button
            className="btn btn-primary btn-lg w-100"
            onClick={handleGenerateBoardPattern}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Generating Board Pattern...
              </>
            ) : (
              <>
                <i className="bi bi-lightning me-2"></i>
                Generate Board Pattern
              </>
            )}
          </button>
          
          <div className="mt-3">
            <small className="text-muted">
              This will automatically select questions according to board rules from the full book.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};