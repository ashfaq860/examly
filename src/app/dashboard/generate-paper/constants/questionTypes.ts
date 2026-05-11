// src/app/dashboard/generate-paper/constants/questionTypes.ts
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
  { value: 'short', label: 'مختصر سوالات', fieldPrefix: 'short' },
  { value: 'long', label: 'تفصیلی جوابات', fieldPrefix: 'long' },
  { value: 'sentence_correction', label: 'جملوں کی درستگی', fieldPrefix: 'sentenceCorrection' },
  { value: 'sentence_completion', label: 'جملوں کی تکمیل', fieldPrefix: 'sentenceCompletion' },
];