// Central re-export so all components can import from '@/types/paper-builder'.
// Canonical definitions live in paperBuilderTypes.ts; additional types are defined here.
export type { PaperSection, PaperSettings, LanguageConfig, ChapterRangeRule, BoardPatternConfig } from './paperBuilderTypes';

export interface AdditionalQuestionType {
  name: string;
  label: string;
  count: number;
  attempt: number;
  marks: number;
  total: number;
}

export interface QuestionGroup {
  count: number;
  attempt: number;
  marks: number;
  total: number;
}

export interface BoardPatternDetails {
  mcq: QuestionGroup;
  short: QuestionGroup;
  long: QuestionGroup;
  totalMarks: number;
  timeMinutes: number;
  additionalTypes: AdditionalQuestionType[];
}
