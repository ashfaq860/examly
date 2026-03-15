// src/utils/chapterRangeRulesHelper.ts
import { ChapterRangeRule } from '@/types/types';
import { Question } from '@/types/types';

export interface ChapterRangeConfig {
  subjectId: string;
  classId: string;
  selectedChapters: Array<{ id: string; chapterNo: number }>;
  questionTypes: Array<{ key: string; label: string }>;
  rules: ChapterRangeRule[];
}

export interface QuestionDistribution {
  chapterId: string;
  chapterNo: number;
  questions: Record<string, number>; // questionType -> count
}

export interface RangeAllocation {
  rangeKey: string;
  chapterStart: number;
  chapterEnd: number;
  questionType: string;
  ruleMode: 'total' | 'per_chapter';
  min: number;
  max: number | null;
  allocatedChapters: string[];
  questionsPerChapter: Record<string, number>; // chapterId -> count
}

/**
 * Get applicable rules for selected chapters
 */
export function getApplicableRules(
  selectedChapters: Array<{ id: string; chapterNo: number }>,
  rules: ChapterRangeRule[]
): ChapterRangeRule[] {
  const selectedChapterNumbers = selectedChapters.map(c => c.chapterNo);
  
  return rules.filter(rule => {
    // Check if any selected chapter falls within this rule's range
    return selectedChapterNumbers.some(chapterNo => 
      chapterNo >= rule.chapter_start && chapterNo <= rule.chapter_end
    );
  });
}

/**
 * Calculate question distribution based on range rules
 */
export function calculateQuestionDistribution(
  config: ChapterRangeConfig
): QuestionDistribution[] {
  const { selectedChapters, rules, questionTypes } = config;
  
  // Initialize distribution
  const distribution: QuestionDistribution[] = selectedChapters.map(chapter => ({
    chapterId: chapter.id,
    chapterNo: chapter.chapterNo,
    questions: {}
  }));
  
  // Get applicable rules
  const applicableRules = getApplicableRules(selectedChapters, rules);
  
  // Process each question type
  questionTypes.forEach(questionType => {
    const typeRules = applicableRules.filter(rule => rule.question_type === questionType.key);
    
    if (typeRules.length === 0) {
      // No rules for this question type
      return;
    }
    
    // For each rule, allocate questions
    typeRules.forEach(rule => {
      allocateQuestionsForRule(rule, distribution, selectedChapters);
    });
  });
  
  return distribution;
}

/**
 * Allocate questions for a specific rule
 */
function allocateQuestionsForRule(
  rule: ChapterRangeRule,
  distribution: QuestionDistribution[],
  chapters: Array<{ id: string; chapterNo: number }>
): void {
  const { chapter_start, chapter_end, question_type, rule_mode, min_questions, max_questions } = rule;
  
  // Find chapters within this range
  const chaptersInRange = chapters.filter(ch => 
    ch.chapterNo >= chapter_start && ch.chapterNo <= chapter_end
  );
  
  if (chaptersInRange.length === 0) return;
  
  // Determine how many questions to allocate
  const targetQuestions = max_questions !== null 
    ? Math.floor(Math.random() * (max_questions - min_questions + 1)) + min_questions
    : min_questions;
  
  if (rule_mode === 'total') {
    // Total for range: distribute questions across all chapters in range
    allocateTotalMode(targetQuestions, question_type, chaptersInRange, distribution);
  } else {
    // Per chapter: allocate to each chapter individually
    allocatePerChapterMode(targetQuestions, question_type, chaptersInRange, distribution);
  }
}

/**
 * Allocate questions in "total" mode
 */
function allocateTotalMode(
  totalQuestions: number,
  questionType: string,
  chaptersInRange: Array<{ id: string; chapterNo: number }>,
  distribution: QuestionDistribution[]
): void {
  // Simple distribution: try to give at least 1 question to as many chapters as possible
  const chaptersCount = chaptersInRange.length;
  const basePerChapter = Math.floor(totalQuestions / chaptersCount);
  const remainder = totalQuestions % chaptersCount;
  
  chaptersInRange.forEach((chapter, index) => {
    const questionsForChapter = basePerChapter + (index < remainder ? 1 : 0);
    
    if (questionsForChapter > 0) {
      const chapterDist = distribution.find(d => d.chapterId === chapter.id);
      if (chapterDist) {
        chapterDist.questions[questionType] = (chapterDist.questions[questionType] || 0) + questionsForChapter;
      }
    }
  });
}

/**
 * Allocate questions in "per chapter" mode
 */
function allocatePerChapterMode(
  questionsPerChapter: number,
  questionType: string,
  chaptersInRange: Array<{ id: string; chapterNo: number }>,
  distribution: QuestionDistribution[]
): void {
  chaptersInRange.forEach(chapter => {
    const chapterDist = distribution.find(d => d.chapterId === chapter.id);
    if (chapterDist && questionsPerChapter > 0) {
      chapterDist.questions[questionType] = (chapterDist.questions[questionType] || 0) + questionsPerChapter;
    }
  });
}

/**
 * Fetch chapter range rules
 */
export async function fetchChapterRangeRules(
  subjectId: string,
  classId?: string
): Promise<ChapterRangeRule[]> {
  try {
    const url = `/api/chapter-range-rules?subjectId=${subjectId}${classId ? `&classId=${classId}` : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn('Failed to fetch chapter range rules');
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching chapter range rules:', error);
    return [];
  }
}

/**
 * Generate questions based on range rules
 */
export async function generateQuestionsByRangeRules(
  config: {
    subjectId: string;
    classId: string;
    chapterIds: string[];
    language: string;
    source_type: string;
    randomSeed: number;
  },
  distribution: QuestionDistribution[],
  formValues: any
): Promise<Record<string, Question[]>> {
  const result: Record<string, Question[]> = {};
  
  // For each chapter in distribution
  for (const chapterDist of distribution) {
    for (const [questionType, count] of Object.entries(chapterDist.questions)) {
      if (count > 0) {
        const questions = await fetchQuestionsForChapterAndType({
          ...config,
          chapterId: chapterDist.chapterId,
          questionType,
          count
        });
        
        if (!result[questionType]) {
          result[questionType] = [];
        }
        
        result[questionType].push(...questions);
      }
    }
  }
  
  return result;
}

/**
 * Fetch questions for specific chapter and type
 */
async function fetchQuestionsForChapterAndType(params: {
  subjectId: string;
  classId: string;
  chapterId: string;
  questionType: string;
  count: number;
  language: string;
  source_type: string;
  randomSeed: number;
}): Promise<Question[]> {
  try {
    const response = await fetch('/api/questions', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const data = await response.json();
    return data.slice(0, params.count); // Simple limit
  } catch (error) {
    console.error(`Error fetching ${params.questionType} questions:`, error);
    return [];
  }
}