// src/app/dashboard/generate-paper/hooks/useQuestionLoader.ts
import { useState, useCallback, useRef } from 'react';
import { QuestionService } from '../services/questionService';
import { RuleBasedSelector } from '../services/ruleBasedSelector';

export const useQuestionLoader = (form: any, selectedQuestions: any, setPreviewQuestions: any) => {
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadPreviewQuestions = useCallback(async () => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoadingPreview(true);

    try {
      const formValues = form.getValues();
      const chapterIds = getChapterIdsToUse(form, formValues);
      
      if (chapterIds.length === 0) {
        setPreviewQuestions({});
        return;
      }

      let questions: Record<string, Question[]>;

      if (formValues.selectionMethod === 'manual') {
        questions = await QuestionService.loadManualQuestions(
          selectedQuestions,
          formValues.language
        );
      } else {
        questions = await RuleBasedSelector.selectQuestions(
          formValues,
          chapterIds,
          form.watch('subjectRules') || []
        );
      }

      setPreviewQuestions(questions);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading preview:', error);
      }
    } finally {
      setIsLoadingPreview(false);
    }
  }, [form, selectedQuestions, setPreviewQuestions]);

  return { isLoadingPreview, loadPreviewQuestions };
};