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
  /** Physical page size for the generated sheet(s). Defaults to 'a4'. */
  pageSize?: 'a4' | 'legal';
  /** Blank ruled lines under short/long questions for students to write answers.
   *  Only applied on single-paper-per-sheet layouts (separate/same_page) — the
   *  2/3/4-papers-per-page layouts use fixed-height slots with no room to spare. */
  showAnswerLines?: boolean;
  /** Number of ruled answer lines under a short-type question. Defaults to 4. */
  answerLinesShort?: number;
  /** Number of ruled answer lines under a long-type question. Defaults to 5. */
  answerLinesLong?: number;
  /** Height (mm) of each ruled answer line's writing space. Defaults to 6. */
  answerLineGapMm?: number;
  /** Standalone OMR answer-bubble sheet for MCQs — one row per question
   *  number, each with horizontal (A)(B)(C)(D) bubbles to shade, sitting
   *  right after the paper header and before the MCQ questions start. Only
   *  applied on single-paper-per-sheet layouts (separate/same_page), same
   *  reasoning as showAnswerLines — the 2/3/4-papers-per-page mini-slots
   *  have no room. */
  showMcqBubbleSheet?: boolean;
  /** How each MCQ row is laid out. Toggled as a single on/off switch in
   *  Paper Style ("Bordered Table"). 'bordered' = Q.No sits in its own
   *  bordered column beside the question, with a divider line between
   *  every question (used by default for Board Pattern papers, matching a
   *  standard printed answer sheet). 'simple' = default, Q.No inline with
   *  the question in a plain row, no table. 'table' is a legacy value
   *  (same two-column table, no visible border lines) kept only so old
   *  saved papers that stored it keep rendering the same way; the UI no
   *  longer exposes it. Defaults to 'simple' when unset. */
  mcqLayoutStyle?: 'bordered' | 'table' | 'simple';
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