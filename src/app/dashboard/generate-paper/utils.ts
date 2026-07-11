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

// Kept in sync with QuestionForm.tsx's getAvailableQuestionTypes() Urdu
// branch — that form is the source of truth for which question_type values
// actually get created/stored. This list used to only have 8 of those 17
// types, so the manual-selection modal's "Question Type" dropdown could
// never offer Nasarkhulasa/markziKhyal/application/letter/story/mokalma/
// essay/passage/stanza_explanation — making those types impossible to
// browse manually even though board-pattern generation already used them.
export const urduTypes = [
  { value: 'mcq', label: 'MCQ (اردو)', fieldPrefix: 'mcq' },
  { value: 'poetry_explanation', label: 'اشعار کی تشریح', fieldPrefix: 'poetryExplanation' },
  { value: 'stanza_explanation', label: 'بند کی تشریح', fieldPrefix: 'stanzaExplanation' },
  { value: 'prose_explanation', label: 'نثرپاروں کی تشریح', fieldPrefix: 'proseExplanation' },
  { value: 'gazal', label: 'غزل', fieldPrefix: 'gazal' },
  { value: 'short', label: 'مختصر سوالات', fieldPrefix: 'short' },
  { value: 'long', label: 'تفصیلی جوابات', fieldPrefix: 'long' },
  { value: 'sentence_correction', label: 'جملوں کی درستگی', fieldPrefix: 'sentenceCorrection' },
  { value: 'sentence_completion', label: 'جملوں کی تکمیل', fieldPrefix: 'sentenceCompletion' },
  { value: 'passage', label: 'عبارت اور سوالات', fieldPrefix: 'passage' },
  { value: 'mokalma', label: 'مکالمہ', fieldPrefix: 'mokalma' },
  { value: 'Nasarkhulasa', label: 'نثر خلاصہ', fieldPrefix: 'nasarKhulasa' },
  { value: 'markziKhyal', label: 'مرکزی خیال', fieldPrefix: 'markziKhyal' },
  { value: 'application', label: 'درخواست', fieldPrefix: 'application' },
  { value: 'letter', label: 'خط', fieldPrefix: 'letter' },
  { value: 'essay', label: 'مضمون', fieldPrefix: 'essay' },
  { value: 'story', label: 'کہانی', fieldPrefix: 'story' },
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
