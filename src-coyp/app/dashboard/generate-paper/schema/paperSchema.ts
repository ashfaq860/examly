// src/app/dashboard/generate-paper/schema/paperSchema.ts
import * as z from 'zod';

export const paperSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  paperType: z.enum(['model', 'custom']),
  source_type: z.enum(['all', 'model_paper', 'past_paper', 'book']),
  classId: z.string().min(1, 'Class is required'),
  subjectId: z.string().min(1, 'Subject is required'),
  chapterOption: z.enum(['full_book', 'half_book', 'single_chapter', 'custom']),
  selectedChapters: z.array(z.string()).optional(),
  selectionMethod: z.enum(['auto', 'manual']),
  mcqCount: z.number().min(0),
  mcqDifficulty: z.enum(['easy', 'medium', 'hard', 'any']),
  shortCount: z.number().min(0),
  shortDifficulty: z.enum(['easy', 'medium', 'hard', 'any']),
  longCount: z.number().min(0),
  longDifficulty: z.enum(['easy', 'medium', 'hard', 'any']),
  easyPercent: z.number().min(0).max(100),
  mediumPercent: z.number().min(0).max(100),
  hardPercent: z.number().min(0).max(100),
  timeMinutes: z.number().min(1),
  mcqTimeMinutes: z.number().min(1).optional(),
  subjectiveTimeMinutes: z.number().min(1).optional(),
  language: z.enum(['english', 'urdu', 'bilingual']),
  mcqMarks: z.number().min(0),
  shortMarks: z.number().min(1),
  longMarks: z.number().min(1),
  mcqPlacement: z.enum(['same_page', 'separate', 'two_papers']),
  mcqToAttempt: z.number().min(0).optional(),
  shortToAttempt: z.number().min(0).optional(),
  longToAttempt: z.number().min(0).optional(),
  shuffleQuestions: z.boolean().default(true),
  dateOfPaper: z.string().optional(),
}).refine((data) => {
  if (data.mcqPlacement === 'separate') {
    return data.mcqTimeMinutes !== undefined && data.subjectiveTimeMinutes !== undefined;
  }
  return true;
}, {
  message: "Both objective and subjective time are required when MCQ placement is separate",
  path: ["mcqTimeMinutes"]
});

export type PaperFormData = z.infer<typeof paperSchema>;

export const defaultFormValues: Partial<PaperFormData> = {
  paperType: 'model',
  chapterOption: 'full_book',
  selectionMethod: 'auto',
  mcqCount: 10,
  mcqDifficulty: 'any',
  shortCount: 5,
  shortDifficulty: 'any',
  longCount: 3,
  longDifficulty: 'any',
  easyPercent: 33,
  mediumPercent: 33,
  hardPercent: 34,
  timeMinutes: 60,
  mcqTimeMinutes: 15,
  subjectiveTimeMinutes: 30,
  language: 'english',
  mcqMarks: 1,
  shortMarks: 2,
  longMarks: 5,
  mcqPlacement: 'separate',
  source_type: 'all',
  shuffleQuestions: true,
  dateOfPaper: new Date().toISOString().split('T')[0],
};