// Based on your database schema
export type Class = {
  id: string;
  name: number;
  description?: string;
  created_at: string;
};

export type Subject = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
};

export type Chapter = {
  id: string;
  subject_id: string;
  name: string;
  created_at: string;
  chapterNo: number;
};

export type Question = {
  id: string;
  subject_id: string;
  chapter_id: string;
  question_text: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_option?: 'A' | 'B' | 'C' | 'D';
  difficulty: 'easy' | 'medium' | 'hard';
  question_type: 'mcq' | 'short' | 'long' | 'translate_urdu' | 'translate_english' | 'idiom_phrases' | 'passage' | 'directInDirect' | 'activePassive' | 'poetry_explanation' | 'prose_explanation' | 'sentence_correction' | 'sentence_completion';
  answer_text?: string;
};
export interface PaperGenerationRequest {
  title: string;
  subjectId: string;
  classId?: string;
  paperType?:'model' | 'custom';
  chapterOption?: 'full_book' | 'half_book' | 'single_chapter' | 'custom';
  selectedChapters?: string[];
  mcqCount: number;
  mcqDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  shortCount: number;
  shortDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  longCount: number;
  longDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  translateUrduCount?: number;
  translateUrduDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  translateUrduMarks?: number;
  translateUrduToAttempt?: number;
  translateEnglishCount?: number;
  translateEnglishDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  translateEnglishMarks?: number;
  translateEnglishToAttempt?: number;
  idiomPhrasesCount?: number;
  idiomPhrasesDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  idiomPhrasesMarks?: number;
  idiomPhrasesToAttempt?: number;
  passageCount?: number;
  passageDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  passageMarks?: number;
  passageToAttempt?: number;
  directInDirectCount?: number;
  directInDirectDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  directInDirectMarks?: number;
  directInDirectToAttempt?: number;
  activePassiveCount?: number;
  activePassiveDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  activePassiveMarks?: number;
  activePassiveToAttempt?: number;
  poetryExplanationCount?: number;
  poetryExplanationDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  poetryExplanationMarks?: number;
  poetryExplanationToAttempt?: number;
  proseExplanationCount?: number;
  proseExplanationDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  proseExplanationMarks?: number;
  proseExplanationToAttempt?: number;
  sentenceCorrectionCount?: number;
  sentenceCorrectionDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  sentenceCorrectionMarks?: number;
  sentenceCorrectionToAttempt?: number;
  sentenceCompletionCount?: number;
  sentenceCompletionDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  sentenceCompletionMarks?: number;
  sentenceCompletionToAttempt?: number;
  isTrial?: boolean;
  difficulty?: 'easy' | 'medium' | 'hard';
  language?:'english' | 'urdu'  | 'bilingual'
  mcqMarks: number;
  shortMarks: number;
  longMarks: number;
  timeMinutes: number;
  selectionMethod?: 'auto' | 'manual';

}
export type paperType = 'model' | 'custom';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'any';
export type QuestionType = 'mcq' | 'short' | 'long';
export type ChapterOption = 'full_book' | 'half_book' | 'single_chapter' | 'custom';
export type SelectionMethod = 'auto' | 'manual';
// In your types file, add:
export type QuestionSelectionOption = 'all' | 'mcq_only' | 'subjective_only' | 'short_only' | 'long_only'|'mcq_short';
/** templates configuration types */
// types/types.ts
export interface PaperTemplate {
  id: string;
  name: string;
  description: string;
  config: PaperTemplateConfig;
  createdBy: string;
  academyId?: string;
  isPublic: boolean;
  paperType: paperType;
  subjectId?: string;
  classId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaperTemplateConfig {
  title: string;
  paperType: paperType;
  classId: string;
  subjectId: string;
  chapterOption: ChapterOption;
  selectedChapters: string[];
  selectionMethod: SelectionMethod;
  mcqCount: number;
  mcqDifficulty: Difficulty;
  shortCount: number;
  shortDifficulty: Difficulty;
  longCount: number;
  longDifficulty: Difficulty;
  easyPercent: number;
  mediumPercent: number;
  hardPercent: number;
  timeMinutes: number;
  language: 'english' | 'urdu' | 'bilingual';
  includeAnswerKey: boolean;
  watermarkText: string;
  includeLogo: boolean;
  questionSource: 'book' | 'model_paper' | 'past_paper' | 'mixed';
}
export type MCQPlacement = 'same_page' | 'separate' | 'two_papers';