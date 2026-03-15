// types/paper-builder.ts
export interface PaperSettings {
  fontFamily: string;
  fontSize: number;
  titleFontSize: number;
  headingFontFamily: string;
  headingFontSize: number;
  metaFontSize: number;
}

export interface LanguageConfig {
  direction: 'ltr' | 'rtl';
  fontFamily: string;
  fontSize: string;
  questionFontFamily: string;
}

export interface PaperSection {
  id: string;
  type: string;
  questions: any[];
  totalQuestions: number;
  attemptCount: number;
  marksEach: number;
  totalMarks: number;
  subject: string;
  language: string;
  layout: string;
  timestamp: string;
}

export interface BoardPatternDetails {
  mcq: QuestionTypeDetails;
  short: QuestionTypeDetails;
  long: QuestionTypeDetails;
  totalMarks: number;
  timeMinutes: number;
  additionalTypes: AdditionalQuestionType[];
}

export interface QuestionTypeDetails {
  count: number;
  attempt: number;
  marks: number;
  total: number;
}

export interface AdditionalQuestionType {
  name: string;
  label: string;
  count: number;
  attempt: number;
  marks: number;
  total: number;
}