// Utilities for generate-paper feature
import axios from 'axios';
import { Subject, Chapter, Question } from '@/types/types';

// Simple API cache
const apiCache = new Map<string, { data: any; timestamp: number }>();
export const CACHE_DURATION = 5 * 60 * 1000;

export const cachedGet = async (url: string) => {
  const cached = apiCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  const response = await axios.get(url);
  apiCache.set(url, { data: response.data, timestamp: Date.now() });
  return response.data;
};

// Subject helpers
export const isEnglishSubject = (subjects: Subject[], subjectId: string) => {
  const subject = subjects.find(s => s.id === subjectId);
  return subject?.name.toLowerCase() === 'english';
};

export const isUrduSubject = (subjects: Subject[], subjectId: string) => {
  const subject = subjects.find(s => s.id === subjectId);
  return subject?.name.toLowerCase() === 'urdu';
};

// question type definitions
export const defaultTypes = [
  { value: 'mcq', label: 'Multiple Choice', fieldPrefix: 'mcq' },
  { value: 'short', label: 'Short Answer', fieldPrefix: 'short' },
  { value: 'long', label: 'Long Answer', fieldPrefix: 'long' },
];

export const englishTypes = [
  { value: 'mcq', label: 'Multiple Choice', fieldPrefix: 'mcq' },
  { value: 'short', label: 'Short Answer', fieldPrefix: 'short' },
  { value: 'translate_urdu', label: 'Translate into Urdu', fieldPrefix: 'translateUrdu' },
  { value: 'long', label: 'Long Answer', fieldPrefix: 'long' },
  { value: 'idiom_phrases', label: 'Idiom/Phrases', fieldPrefix: 'idiomPhrases' },
  { value: 'translate_english', label: 'Translate into English', fieldPrefix: 'translateEnglish' },
  { value: 'passage', label: 'Passage and Questions', fieldPrefix: 'passage' },
  { value: 'directInDirect', label: 'Direct In Direct', fieldPrefix: 'directInDirect' },
  { value: 'activePassive', label: 'Active Voice / Passive Voice', fieldPrefix: 'activePassive' },
];

export const urduTypes = [
  { value: 'mcq', label: 'MCQ (اردو)', fieldPrefix: 'mcq' },
  { value: 'poetry_explanation', label: 'اشعار کی تشریح', fieldPrefix: 'poetryExplanation' },
  { value: 'prose_explanation', label: 'نثرپاروں کی تشریح', fieldPrefix: 'proseExplanation' },
  { value: 'gazal', label: 'غزل', fieldPrefix: 'gazal' },
  { value: 'short', label: 'مختصر سوالات', fieldPrefix: 'short' },
  { value: 'long', label: 'تفصیلی جوابات', fieldPrefix: 'long' },
  { value: 'sentence_correction', label: 'جملوں کی درستگی', fieldPrefix: 'sentenceCorrection' },
  { value: 'sentence_completion', label: 'جملوں کی تکمیل', fieldPrefix: 'sentenceCompletion' },
];

// debounce hook exported separately if needed
import { useState, useEffect } from 'react';
export const useDebounce = (value: any, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};
