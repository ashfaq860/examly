// src/types/index.ts
export interface PaperGenerationRequest {
  title: string;
  subjectId: string;
  classId?: string;
  paperType?: 'model' | 'past' | 'chapter' | 'whole_book' | 'custom';
  chapterOption?: 'full_book' | 'half_book' | 'single_chapter' | 'custom';
  selectedChapters?: string[];
  mcqCount: number;
  mcqDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  shortCount: number;
  shortDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  longCount: number;
  longDifficulty?: 'easy' | 'medium' | 'hard' | 'any';
  isTrial?: boolean;
  difficulty?: 'easy' | 'medium' | 'hard';
}