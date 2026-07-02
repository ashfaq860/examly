export interface PaperSection {
  id: string;
  type: string;
  instructions?: string;
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

export interface PaperSettings {
  fontFamily: string;
  fontSize: number;
  lineHeight?: number;
  titleFontFamily?: string;
  titleFontSize: number;
  headingFontFamily: string;
  headingFontSize: number;
  metaFontSize: number;
  headerLayout?: string;
  mcqFontSize?: number;
  mcqLineHeight?: number;
  logoWidth?: number;
  logoHeight?: number;
  showWatermark?: boolean;
  watermarkWidth?: number;
  watermarkHeight?: number;
  watermarkOpacity?: number;
}

export interface LanguageConfig {
  direction: 'ltr' | 'rtl';
  fontFamily: string;
  fontSize: string;
  questionFontFamily: string;
}

export interface ChapterRangeRule {
  id: string;
  subject_id: string;
  class_id: string;
  chapter_start: number;
  chapter_end: number;
  question_type: string;
  rule_mode: 'total' | 'per_chapter';
  min_questions: number;
  max_questions: number | null;
}

export interface BoardPatternConfig {
  subjectId: string;
  classId: string;
  language: 'english' | 'urdu' | 'bilingual';
  sections: {
    type: string;
    count: number;
    marks: number;
    attemptCount: number;
  }[];
  rules: ChapterRangeRule[];
}