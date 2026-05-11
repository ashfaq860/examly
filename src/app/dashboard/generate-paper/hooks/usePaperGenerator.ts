// src/app/dashboard/generate-paper/hooks/usePaperGenerator.ts
import { useState, useCallback } from 'react';
import { PaperFormData } from '../schema/paperSchema';
import { Question } from '@/types/types';
import axios from 'axios';

interface GenerationProgress {
  percentage: number;
  message: string;
  isVisible: boolean;
  estimatedTimeRemaining: number;
  startTime: number;
}

interface GeneratePaperResult {
  success: boolean;
  paperId?: string;
  error?: string;
  downloadUrl?: string;
  duration?: number;
}

export const usePaperGenerator = (form: any) => {
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({
    percentage: 0,
    message: 'Starting generation...',
    isVisible: false,
    estimatedTimeRemaining: 0,
    startTime: 0
  });

  const generatePaper = useCallback(async (
    previewQuestions: Record<string, Question[]>
  ): Promise<GeneratePaperResult> => {
    try {
      // Show progress
      setGenerationProgress(prev => ({
        ...prev,
        isVisible: true,
        startTime: Date.now()
      }));

      const formValues = form.getValues() as PaperFormData;

      // Validate we have questions
      const totalQuestions = Object.values(previewQuestions).reduce(
        (sum, questions) => sum + questions.length, 0
      );

      if (totalQuestions === 0) {
        throw new Error('No questions selected for the paper');
      }

      // Update progress
      setGenerationProgress(prev => ({
        ...prev,
        percentage: 30,
        message: 'Formatting paper...'
      }));

      // Prepare paper data
      const paperData = {
        ...formValues,
        questions: previewQuestions,
        totalQuestions,
        generatedAt: new Date().toISOString(),
      };

      // Update progress
      setGenerationProgress(prev => ({
        ...prev,
        percentage: 60,
        message: 'Saving paper...'
      }));

      // Save paper to database
      const response = await axios.post('/api/papers/generate', paperData);

      // Update progress
      setGenerationProgress(prev => ({
        ...prev,
        percentage: 90,
        message: 'Finalizing...'
      }));

      // Simulate final processing
      await new Promise(resolve => setTimeout(resolve, 500));

      setGenerationProgress(prev => ({
        ...prev,
        percentage: 100,
        message: 'Paper generated successfully!',
        isVisible: false
      }));

      return {
        success: true,
        paperId: response.data.paperId,
        downloadUrl: response.data.downloadUrl
      };

    } catch (error) {
      console.error('Error generating paper:', error);
      
      setGenerationProgress(prev => ({
        ...prev,
        isVisible: false
      }));

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate paper'
      };
    }
  }, [form]);

  const resetProgress = useCallback(() => {
    setGenerationProgress({
      percentage: 0,
      message: 'Starting generation...',
      isVisible: false,
      estimatedTimeRemaining: 0,
      startTime: 0
    });
  }, []);

  return {
    generationProgress,
    generatePaper,
    resetProgress
  };
};