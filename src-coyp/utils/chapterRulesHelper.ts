// src/utils/chapterRulesHelper.ts
// Update this function to match the new question type keys
export function getQuestionTypesForSubject(subjectName: string): Array<{
  value: string;
  key: string;
  fieldPrefix: string;
  label: string;
  defaultMin: number;
  defaultMax: number;
}> {
  const baseTypes = [
    { value: 'mcq', key: 'mcq', fieldPrefix: 'mcq', label: 'MCQ', defaultMin: 3, defaultMax: 5 },
    { value: 'short', key: 'short', fieldPrefix: 'short', label: 'Short Answer', defaultMin: 2, defaultMax: 4 },
    { value: 'long', key: 'long', fieldPrefix: 'long', label: 'Long Answer', defaultMin: 1, defaultMax: 2 },
  ];

  if (subjectName.toLowerCase() === 'english') {
    return [
      ...baseTypes,
      { value: 'translate_urdu', key: 'translate_urdu', fieldPrefix: 'translateUrdu', label: 'Translate Urdu', defaultMin: 1, defaultMax: 2 },
      { value: 'translate_english', key: 'translate_english', fieldPrefix: 'translateEnglish', label: 'Translate English', defaultMin: 1, defaultMax: 2 },
      { value: 'idiom_phrases', key: 'idiom_phrases', fieldPrefix: 'idiomPhrases', label: 'Idiom/Phrases', defaultMin: 1, defaultMax: 2 },
      { value: 'passage', key: 'passage', fieldPrefix: 'passage', label: 'Passage', defaultMin: 1, defaultMax: 2 },
      { value: 'directindirect', key: 'directindirect', fieldPrefix: 'directInDirect', label: 'Direct/Indirect', defaultMin: 1, defaultMax: 2 },
      { value: 'activepassive', key: 'activepassive', fieldPrefix: 'activePassive', label: 'Active/Passive', defaultMin: 1, defaultMax: 2 }
    ];
  } else if (subjectName.toLowerCase() === 'urdu') {
    return [
      ...baseTypes,
      { value: 'poetry_explanation', key: 'poetry_explanation', fieldPrefix: 'poetryExplanation', label: 'Poetry Explanation', defaultMin: 1, defaultMax: 2 },
      { value: 'prose_explanation', key: 'prose_explanation', fieldPrefix: 'proseExplanation', label: 'Prose Explanation', defaultMin: 1, defaultMax: 2 },
      { value: 'sentence_correction', key: 'sentence_correction', fieldPrefix: 'sentenceCorrection', label: 'Sentence Correction', defaultMin: 1, defaultMax: 2 },
      { value: 'sentence_completion', key: 'sentence_completion', fieldPrefix: 'sentenceCompletion', label: 'Sentence Completion', defaultMin: 1, defaultMax: 2 },
      { value: 'darkhwast_khat', key: 'darkhwast_khat', fieldPrefix: 'darkhwastKhat', label: 'Darkhwast Khat', defaultMin: 1, defaultMax: 2 },
      { value: 'kahani_makalma', key: 'kahani_makalma', fieldPrefix: 'kahaniMakalma', label: 'Kahani Makalma', defaultMin: 1, defaultMax: 2 },
      { value: 'nasarkhulasa_markzikhyal', key: 'nasarkhulasa_markzikhyal', fieldPrefix: 'nasarkhulasaMarkziKhyal', label: 'Nasri Khulasa', defaultMin: 1, defaultMax: 2 }
    ];
  }
  
  return baseTypes;
}