export const formatQuestionText = (text: string): string => {
  if (!text) return '';
  
  // Decode HTML entities
  const txt = document.createElement('textarea');
  txt.innerHTML = text;
  
  // Format for inline display
  const formatted = txt.value
    .replace(/<p>/gi, '<span>')
    .replace(/<\/p>/gi, '</span>')
    .replace(/<div>/gi, '<span>')
    .replace(/<\/div>/gi, '</span>')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\n/g, ' ')
    .trim();
  
  return formatted;
};

export const getTypeLabel = (type: string): string => {
  const typeMap: Record<string, string> = {
    'mcq': 'Multiple Choice Questions',
    'short': 'Short Questions',
    'long': 'Long Questions',
    'conceptual': 'Conceptual Questions',
    'numerical': 'Numerical Questions',
    'translate_urdu': 'Translation to Urdu',
    'translate_english': 'Translation to English',
    'idiom_phrases': 'Idioms and Phrases',
    'passage': 'Passage',
    'poetry_explanation': 'Poetry Explanation',
    'prose_explanation': 'Prose Explanation',
    'sentence_correction': 'Sentence Correction',
    'sentence_completion': 'Sentence Completion',
    'directindirect': 'Direct/Indirect Speech',
    'activepassive': 'Active/Passive Voice',
    'darkhwast_khat': 'Darkhwast Khat',
    'kahani_makalma': 'Kahani Makalma',
    'nasarkhulasa_markzikhyal': 'Nasr Khulasa Markz-e-Khayal'
  };
  return typeMap[type] || type.replace(/_/g, ' ').toUpperCase();
};