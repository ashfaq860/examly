// src/lib/questionRules.ts
import { Question, Chapter, Subject } from '@/types/types';
import axios from 'axios';

// Update ChapterRule interface to match new structure
export interface ChapterRangeRule {
  id: string;
  subject_id: string;
  class_id?: string;
  chapter_start: number;
  chapter_end: number;
  question_type: string;
  rule_mode: 'total' | 'per_chapter';
  min_questions: number;
  max_questions: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// Keep old interface for backward compatibility but mark as deprecated
export interface ChapterRule {
  id: string;
  subject_id: string;
  chapter_id: string;
  class_subject_id?: string;
  
  // Standard question types
  mcq_min: number;
  mcq_max?: number;
  short_min: number;
  short_max?: number;
  long_min: number;
  long_max?: number;
  
  // Special question types
  translate_urdu_min?: number;
  translate_urdu_max?: number;
  translate_english_min?: number;
  translate_english_max?: number;
  idiom_phrases_min?: number;
  idiom_phrases_max?: number;
  passage_min?: number;
  passage_max?: number;
  poetry_explanation_min?: number;
  poetry_explanation_max?: number;
  prose_explanation_min?: number;
  prose_explanation_max?: number;
  sentence_correction_min?: number;
  sentence_correction_max?: number;
  sentence_completion_min?: number;
  sentence_completion_max?: number;
  directInDirect_min?: number;
  directInDirect_max?: number;
  activePassive_min?: number;
  activePassive_max?: number;
  darkhwast_khat_min?: number;
  darkhwast_khat_max?: number;
  kahani_makalma_min?: number;
  kahani_makalma_max?: number;
  Nasarkhulasa_markziKhyal_min?: number;
  Nasarkhulasa_markziKhyal_max?: number;
  
  chapters?: Chapter;
  subjects?: Subject;
}

export interface QuestionGenerationConfig {
  subjectId: string;
  classId: string;
  chapterIds: string[];
  language: string;
  source_type: string;
  difficulty?: string;
  randomSeed: number;
  fallbackEnabled?: boolean;
  fallbackPriority?: 'same_subject' | 'any_subject';
}

// New class for handling chapter range rules
export class ChapterRangeRuleEngine {
  private rules: ChapterRangeRule[] = [];
  
  constructor(rules: ChapterRangeRule[]) {
    this.rules = rules;
  }
  
  // Get rules applicable for specific chapters
  getRulesForChapters(chapterNumbers: number[], questionType?: string) {
    let filteredRules = this.rules.filter(rule => {
      // Check if rule applies to any of the chapter numbers
      return chapterNumbers.some(chapterNo => 
        chapterNo >= rule.chapter_start && chapterNo <= rule.chapter_end
      );
    });
    
    if (questionType) {
      filteredRules = filteredRules.filter(rule => rule.question_type === questionType);
    }
    
    return filteredRules;
  }
  
  // Calculate question requirements for chapters
  calculateRequirementsForChapters(
    chapters: Array<{ id: string; chapterNo: number }>,
    questionTypes: string[]
  ): Record<string, { min: number; max?: number; mode: 'total' | 'per_chapter' }[]> {
    const requirements: Record<string, any[]> = {};
    
    questionTypes.forEach(qType => {
      requirements[qType] = [];
      const chapterNumbers = chapters.map(c => c.chapterNo);
      const applicableRules = this.getRulesForChapters(chapterNumbers, qType);
      
      applicableRules.forEach(rule => {
        requirements[qType].push({
          min: rule.min_questions,
          max: rule.max_questions,
          mode: rule.rule_mode,
          chapterStart: rule.chapter_start,
          chapterEnd: rule.chapter_end,
          chaptersInRange: chapters.filter(c => 
            c.chapterNo >= rule.chapter_start && c.chapterNo <= rule.chapter_end
          )
        });
      });
    });
    
    return requirements;
  }
  
  // Distribute questions based on range rules
// In @/lib/questionRules.ts, ensure the distributeQuestions method is properly implemented:
// Here's an improved version of the distributeQuestions method:

distributeQuestions(
  chapters: Array<{ id: string; chapterNo: number }>,
  questionTypes: string[],
  formCounts: Record<string, number>
): Record<string, Record<string, number>> {
  const distribution: Record<string, Record<string, number>> = {};
  
  // Initialize distribution structure
  chapters.forEach(chapter => {
    distribution[chapter.id] = {};
    questionTypes.forEach(qType => {
      distribution[chapter.id][qType] = 0;
    });
  });
  
  // Group chapters by their numbers for easier rule matching
  const chaptersByNumber = new Map<number, string>();
  chapters.forEach(chapter => {
    chaptersByNumber.set(chapter.chapterNo, chapter.id);
  });
  
  // Process each question type
  questionTypes.forEach(qType => {
    const totalNeeded = formCounts[qType] || 0;
    if (totalNeeded <= 0) return;
    
    // Get all rules for this question type
    const applicableRules = this.rules.filter(rule => 
      rule.question_type === qType
    );
    
    if (applicableRules.length === 0) {
      // No rules, distribute evenly
      this.distributeEvenly(chapters, qType, totalNeeded, distribution);
      return;
    }
    
    // Calculate which chapters are covered by rules
    const coveredChapters = new Set<string>();
    applicableRules.forEach(rule => {
      for (let chapterNo = rule.chapter_start; chapterNo <= rule.chapter_end; chapterNo++) {
        const chapterId = chaptersByNumber.get(chapterNo);
        if (chapterId) {
          coveredChapters.add(chapterId);
        }
      }
    });
    
    // If not all chapters are covered by rules, handle uncovered ones first
    const uncoveredChapters = chapters.filter(ch => !coveredChapters.has(ch.id));
    if (uncoveredChapters.length > 0) {
      const questionsForUncovered = Math.min(
        Math.floor(totalNeeded * 0.3), // Allocate 30% to uncovered chapters
        uncoveredChapters.length * 2 // Maximum 2 per uncovered chapter
      );
      
      if (questionsForUncovered > 0) {
        this.distributeEvenly(uncoveredChapters, qType, questionsForUncovered, distribution);
      }
    }
    
    // Process covered chapters with rules
    const coveredChaptersList = chapters.filter(ch => coveredChapters.has(ch.id));
    const remainingQuestions = totalNeeded - this.getTotalAllocated(qType, distribution);
    
    if (remainingQuestions > 0 && coveredChaptersList.length > 0) {
      this.applyRangeRulesToCoveredChapters(
        applicableRules,
        coveredChaptersList,
        chaptersByNumber,
        qType,
        remainingQuestions,
        distribution
      );
    }
    
    // If still missing questions, distribute remaining evenly
    const finalAllocated = this.getTotalAllocated(qType, distribution);
    if (finalAllocated < totalNeeded) {
      const finalRemaining = totalNeeded - finalAllocated;
      this.distributeEvenly(chapters, qType, finalRemaining, distribution);
    }
  });
  
  return distribution;
}

private getTotalAllocated(
  questionType: string,
  distribution: Record<string, Record<string, number>>
): number {
  return Object.values(distribution).reduce(
    (sum, chapterDist) => sum + (chapterDist[questionType] || 0),
    0
  );
}

private applyRangeRulesToCoveredChapters(
  rules: ChapterRangeRule[],
  coveredChapters: Array<{ id: string; chapterNo: number }>,
  chaptersByNumber: Map<number, string>,
  questionType: string,
  totalQuestions: number,
  distribution: Record<string, Record<string, number>>
): void {
  // Sort rules by specificity (smaller ranges first)
  const sortedRules = [...rules].sort((a, b) => {
    const rangeSizeA = a.chapter_end - a.chapter_start;
    const rangeSizeB = b.chapter_end - b.chapter_start;
    return rangeSizeA - rangeSizeB;
  });
  
  let remaining = totalQuestions;
  
  // Apply rules in order
  sortedRules.forEach(rule => {
    if (remaining <= 0) return;
    
    // Get chapters that fall within this rule's range
    const chaptersInRuleRange = coveredChapters.filter(ch => 
      ch.chapterNo >= rule.chapter_start && ch.chapterNo <= rule.chapter_end
    );
    
    if (chaptersInRuleRange.length === 0) return;
    
    // Calculate allocation based on rule
    let allocationForRule = 0;
    
    if (rule.rule_mode === 'total') {
      // Allocate based on total min/max for the entire range
      const ruleMax = rule.max_questions || Infinity;
      allocationForRule = Math.min(
        Math.max(rule.min_questions, Math.floor(remaining / 2)),
        ruleMax,
        remaining
      );
      
      if (allocationForRule > 0) {
        this.distributeEvenly(chaptersInRuleRange, questionType, allocationForRule, distribution);
        remaining -= allocationForRule;
      }
    } else { // per_chapter mode
      // Allocate per chapter
      const perChapterAllocation = Math.min(
        rule.min_questions,
        Math.floor(remaining / chaptersInRuleRange.length)
      );
      
      if (perChapterAllocation > 0) {
        const totalAllocation = perChapterAllocation * chaptersInRuleRange.length;
        if (totalAllocation <= remaining) {
          chaptersInRuleRange.forEach(chapter => {
            distribution[chapter.id][questionType] += perChapterAllocation;
          });
          remaining -= totalAllocation;
        }
      }
    }
  });
}

private distributeEvenly(
  chapters: Array<{ id: string; chapterNo: number }>,
  questionType: string,
  totalNeeded: number,
  distribution: Record<string, Record<string, number>>
) {
  const perChapter = Math.max(1, Math.floor(totalNeeded / chapters.length));
  let remaining = totalNeeded;
  
  // Shuffle chapters for random distribution
  const shuffledChapters = [...chapters].sort(() => Math.random() - 0.5);
  
  shuffledChapters.forEach(chapter => {
    if (remaining > 0) {
      const toAdd = Math.min(perChapter, remaining);
      distribution[chapter.id][questionType] += toAdd;
      remaining -= toAdd;
    }
  });
  
  // Distribute any remaining
  if (remaining > 0) {
    shuffledChapters.forEach(chapter => {
      if (remaining > 0) {
        distribution[chapter.id][questionType] += 1;
        remaining -= 1;
      }
    });
  }
}

private applyRangeRules(
  rules: ChapterRangeRule[],
  chapters: Array<{ id: string; chapterNo: number }>,
  questionType: string,
  totalNeeded: number,
  distribution: Record<string, Record<string, number>>
) {
  // Sort rules by priority (smaller ranges first, then by min questions)
  const sortedRules = [...rules].sort((a, b) => {
    const rangeSizeA = a.chapter_end - a.chapter_start;
    const rangeSizeB = b.chapter_end - b.chapter_start;
    if (rangeSizeA !== rangeSizeB) {
      return rangeSizeA - rangeSizeB; // Smaller ranges first
    }
    return b.min_questions - a.min_questions; // Higher min questions first
  });
  
  let remaining = totalNeeded;
  
  // First pass: allocate minimum requirements
  sortedRules.forEach(rule => {
    if (remaining <= 0) return;
    
    const chaptersInRange = chapters.filter(c => 
      c.chapterNo >= rule.chapter_start && c.chapterNo <= rule.chapter_end
    );
    
    if (chaptersInRange.length === 0) return;
    
    if (rule.rule_mode === 'total') {
      // Allocate min questions total across the range
      const toAllocate = Math.min(rule.min_questions, remaining);
      if (toAllocate > 0) {
        this.distributeTotalMode(chaptersInRange, questionType, toAllocate, distribution);
        remaining -= toAllocate;
      }
    } else {
      // Allocate min questions per chapter
      const toAllocatePerChapter = Math.min(rule.min_questions, remaining);
      if (toAllocatePerChapter > 0) {
        this.distributePerChapterMode(chaptersInRange, questionType, toAllocatePerChapter, distribution);
        remaining -= toAllocatePerChapter * chaptersInRange.length;
      }
    }
  });
  
  // Second pass: allocate additional questions up to max (if any)
  if (remaining > 0) {
    sortedRules.forEach(rule => {
      if (remaining <= 0) return;
      
      const chaptersInRange = chapters.filter(c => 
        c.chapterNo >= rule.chapter_start && c.chapterNo <= rule.chapter_end
      );
      
      if (chaptersInRange.length === 0) return;
      
      const alreadyAllocated = chaptersInRange.reduce(
        (sum, chapter) => sum + distribution[chapter.id][questionType], 0
      );
      
      const ruleMax = rule.max_questions || Infinity;
      const availableForRule = ruleMax - alreadyAllocated;
      
      if (availableForRule > 0) {
        const toAllocate = Math.min(availableForRule, remaining);
        if (toAllocate > 0) {
          if (rule.rule_mode === 'total') {
            this.distributeTotalMode(chaptersInRange, questionType, toAllocate, distribution);
          } else {
            const perChapter = Math.floor(toAllocate / chaptersInRange.length);
            if (perChapter > 0) {
              this.distributePerChapterMode(chaptersInRange, questionType, perChapter, distribution);
              const allocated = perChapter * chaptersInRange.length;
              remaining -= allocated;
              
              // Distribute any remainder
              if (remaining > 0 && toAllocate > allocated) {
                const extra = Math.min(remaining, toAllocate - allocated);
                this.distributeTotalMode(chaptersInRange, questionType, extra, distribution);
                remaining -= extra;
              }
            }
          }
          remaining -= toAllocate;
        }
      }
    });
  }
  
  // If still have questions after applying all rules, distribute evenly among all chapters
  if (remaining > 0) {
    this.distributeEvenly(chapters, questionType, remaining, distribution);
  }
}
  private distributeEvenly(
    chapters: Array<{ id: string; chapterNo: number }>,
    questionType: string,
    totalNeeded: number,
    distribution: Record<string, Record<string, number>>
  ) {
    const perChapter = Math.max(1, Math.floor(totalNeeded / chapters.length));
    let remaining = totalNeeded;
    
    chapters.forEach(chapter => {
      if (remaining > 0) {
        const toAdd = Math.min(perChapter, remaining);
        distribution[chapter.id][questionType] += toAdd;
        remaining -= toAdd;
      }
    });
    
    // Distribute any remaining
    if (remaining > 0) {
      chapters.forEach(chapter => {
        if (remaining > 0) {
          distribution[chapter.id][questionType] += 1;
          remaining -= 1;
        }
      });
    }
  }
  
  private applyRangeRules(
    rules: ChapterRangeRule[],
    chapters: Array<{ id: string; chapterNo: number }>,
    questionType: string,
    totalNeeded: number,
    distribution: Record<string, Record<string, number>>
  ) {
    // Sort rules by priority (specific ranges first, then wider ranges)
    const sortedRules = [...rules].sort((a, b) => {
      const rangeSizeA = a.chapter_end - a.chapter_start;
      const rangeSizeB = b.chapter_end - b.chapter_start;
      return rangeSizeA - rangeSizeB; // Smaller ranges first
    });
    
    let remaining = totalNeeded;
    
    sortedRules.forEach(rule => {
      if (remaining <= 0) return;
      
      const chaptersInRange = chapters.filter(c => 
        c.chapterNo >= rule.chapter_start && c.chapterNo <= rule.chapter_end
      );
      
      if (chaptersInRange.length === 0) return;
      
      // Determine how many questions to allocate for this rule
      const ruleMax = rule.max_questions || Infinity;
      const ruleAllocation = Math.min(
        rule.min_questions + Math.floor(Math.random() * (ruleMax - rule.min_questions + 1)),
        remaining
      );
      
      if (rule.rule_mode === 'total') {
        // Distribute across chapters in range
        this.distributeTotalMode(chaptersInRange, questionType, ruleAllocation, distribution);
      } else {
        // Per chapter mode
        this.distributePerChapterMode(chaptersInRange, questionType, ruleAllocation, distribution);
      }
      
      remaining -= ruleAllocation;
    });
    
    // If still have questions after applying all rules, distribute evenly
    if (remaining > 0) {
      this.distributeEvenly(chapters, questionType, remaining, distribution);
    }
  }
  
  private distributeTotalMode(
    chaptersInRange: Array<{ id: string; chapterNo: number }>,
    questionType: string,
    totalAllocation: number,
    distribution: Record<string, Record<string, number>>
  ) {
    const perChapter = Math.max(1, Math.floor(totalAllocation / chaptersInRange.length));
    let remaining = totalAllocation;
    
    chaptersInRange.forEach(chapter => {
      if (remaining > 0) {
        const toAdd = Math.min(perChapter, remaining);
        distribution[chapter.id][questionType] += toAdd;
        remaining -= toAdd;
      }
    });
    
    // Distribute any remaining
    if (remaining > 0) {
      chaptersInRange.forEach(chapter => {
        if (remaining > 0) {
          distribution[chapter.id][questionType] += 1;
          remaining -= 1;
        }
      });
    }
  }
  
  private distributePerChapterMode(
    chaptersInRange: Array<{ id: string; chapterNo: number }>,
    questionType: string,
    perChapterAllocation: number,
    distribution: Record<string, Record<string, number>>
  ) {
    chaptersInRange.forEach(chapter => {
      distribution[chapter.id][questionType] += perChapterAllocation;
    });
  }
}

// Export an alias for QuestionRuleEngine for backward compatibility
export { ChapterRangeRuleEngine as QuestionRuleEngine };

// Updated function to fetch rules (now uses chapter-range-rules API)
export async function fetchChapterRangeRules(subjectId: string, classId?: string) {
  try {
    const params = new URLSearchParams({ subjectId });
    if (classId) {
      params.append('classId', classId);
    }
    
    const response = await axios.get(`/api/chapter-range-rules?${params}`);
    return response.data as ChapterRangeRule[];
  } catch (error) {
    console.error('Error fetching chapter range rules:', error);
    return [];
  }
}

// Keep old function for backward compatibility (but updated to use new API)
export async function fetchSubjectRules(subjectId: string, classId?: string) {
  try {
    const params = new URLSearchParams({ subjectId });
    if (classId) {
      params.append('classId', classId);
    }
    
    const response = await axios.get(`/api/chapter-range-rules?${params}`);
    return response.data as ChapterRangeRule[];
  } catch (error) {
    console.error('Error fetching chapter range rules:', error);
    return [];
  }
}
// Helper to convert new range rules to old format for backward compatibility
function convertRangeRulesToOldFormat(
  rangeRules: ChapterRangeRule[],
  subjectId: string
): ChapterRule[] {
  const oldFormatRules: ChapterRule[] = [];
  
  // This is a simplified conversion - you might need to adjust based on your needs
  rangeRules.forEach(rangeRule => {
    // Create a placeholder old-format rule
    const oldRule: ChapterRule = {
      id: rangeRule.id,
      subject_id: rangeRule.subject_id,
      chapter_id: 'placeholder', // We don't have specific chapter_id in range rules
      class_subject_id: null,
      mcq_min: 0,
      mcq_max: null,
      short_min: 0,
      short_max: null,
      long_min: 0,
      long_max: null,
    };
    
    // Set values based on question type
    switch (rangeRule.question_type) {
      case 'mcq':
        oldRule.mcq_min = rangeRule.min_questions;
        oldRule.mcq_max = rangeRule.max_questions;
        break;
      case 'short':
        oldRule.short_min = rangeRule.min_questions;
        oldRule.short_max = rangeRule.max_questions;
        break;
      case 'long':
        oldRule.long_min = rangeRule.min_questions;
        oldRule.long_max = rangeRule.max_questions;
        break;
      // Add other question types as needed
    }
    
    oldFormatRules.push(oldRule);
  });
  
  return oldFormatRules;
}

// Generate questions based on range rules
export async function generateQuestionsByRangeRules(
  config: QuestionGenerationConfig,
  rangeRules: ChapterRangeRule[],
  formValues: Record<string, any>
) {
  const ruleEngine = new ChapterRangeRuleEngine(rangeRules);
  const allQuestions: Record<string, Question[]> = {};
  
  // Get question types from form
  const questionTypes = getQuestionTypesFromForm(formValues);
  const questionTypeKeys = questionTypes.map(t => t.value);
  
  // Get chapters info
  const chapters = await fetchChaptersInfo(config.chapterIds, config.subjectId, config.classId);
  
  // Calculate distribution based on rules
  const formCounts: Record<string, number> = {};
  questionTypes.forEach(type => {
    const countField = `${getFieldPrefix(type.value)}Count`;
    formCounts[type.value] = formValues[countField] || 0;
  });
  
  const distribution = ruleEngine.distributeQuestions(
    chapters,
    questionTypeKeys,
    formCounts
  );
  
  // Fetch questions based on distribution
  for (const chapterId of config.chapterIds) {
    const chapterDist = distribution[chapterId];
    if (!chapterDist) continue;
    
    for (const [questionType, count] of Object.entries(chapterDist)) {
      if (count > 0) {
        const questions = await fetchQuestionsForChapter({
          ...config,
          chapterIds: [chapterId],
          questionType,
          count,
          difficulty: formValues[`${getFieldPrefix(questionType)}Difficulty`] || 'any'
        });
        
        if (!allQuestions[questionType]) {
          allQuestions[questionType] = [];
        }
        allQuestions[questionType].push(...questions);
      }
    }
  }
  
  // Apply fallback if enabled
  if (config.fallbackEnabled) {
    await applyFallbackForMissingQuestions(allQuestions, questionTypes, formCounts, config, formValues);
  }
  
  return allQuestions;
}

// Alias for generateQuestionsByRules for backward compatibility
export const generateQuestionsByRules = generateQuestionsByRangeRules;

// Helper function to get field prefix from question type
function getFieldPrefix(questionType: string): string {
  const mapping: Record<string, string> = {
    'mcq': 'mcq',
    'short': 'short',
    'long': 'long',
    'translate_urdu': 'translateUrdu',
    'translate_english': 'translateEnglish',
    'idiom_phrases': 'idiomPhrases',
    'passage': 'passage',
    'poetry_explanation': 'poetryExplanation',
    'prose_explanation': 'proseExplanation',
    'sentence_correction': 'sentenceCorrection',
    'sentence_completion': 'sentenceCompletion',
    'directindirect': 'directInDirect',
    'activepassive': 'activePassive',
    'darkhwast_khat': 'darkhwastKhat',
    'kahani_makalma': 'kahaniMakalma',
    'nasarkhulasa_markzikhyal': 'nasarkhulasaMarkziKhyal'
  };
  
  return mapping[questionType] || questionType;
}

// Helper to get question types from form
function getQuestionTypesFromForm(formValues: Record<string, any>) {
  const types: Array<{ value: string; fieldPrefix: string }> = [];
  
  // Standard types
  if (formValues.mcqCount > 0) types.push({ value: 'mcq', fieldPrefix: 'mcq' });
  if (formValues.shortCount > 0) types.push({ value: 'short', fieldPrefix: 'short' });
  if (formValues.longCount > 0) types.push({ value: 'long', fieldPrefix: 'long' });
  
  // Special types
  if (formValues.translateUrduCount > 0) types.push({ value: 'translate_urdu', fieldPrefix: 'translateUrdu' });
  if (formValues.translateEnglishCount > 0) types.push({ value: 'translate_english', fieldPrefix: 'translateEnglish' });
  if (formValues.idiomPhrasesCount > 0) types.push({ value: 'idiom_phrases', fieldPrefix: 'idiomPhrases' });
  if (formValues.passageCount > 0) types.push({ value: 'passage', fieldPrefix: 'passage' });
  
  // Add other types as needed
  if (formValues.poetryExplanationCount > 0) types.push({ value: 'poetry_explanation', fieldPrefix: 'poetryExplanation' });
  if (formValues.proseExplanationCount > 0) types.push({ value: 'prose_explanation', fieldPrefix: 'proseExplanation' });
  
  return types;
}

// Get question types for a subject (placeholder function)
export async function getQuestionTypesForSubject(subjectId: string): Promise<string[]> {
  // This is a placeholder - implement based on your actual logic
  // For now, return common question types
  return ['mcq', 'short', 'long'];
}

// Fetch chapters info
async function fetchChaptersInfo(
  chapterIds: string[],
  subjectId: string,
  classId: string
): Promise<Array<{ id: string; chapterNo: number }>> {
  try {
    const response = await axios.get('/api/chapters', {
      params: {
        subjectId,
        classId,
        includeIds: chapterIds.join(',')
      }
    });
    
    return (response.data || []).map((chapter: any) => ({
      id: chapter.id,
      chapterNo: chapter.chapterNo
    }));
  } catch (error) {
    console.error('Error fetching chapters info:', error);
    return [];
  }
}

// Fetch questions from API
async function fetchQuestionsForChapter(params: {
  subjectId: string;
  classId: string;
  chapterIds: string[];
  questionType: string;
  count: number;
  language: string;
  source_type: string;
  difficulty?: string;
  randomSeed: number;
}) {
  try {
    const response = await axios.get('/api/questions', {
      params: {
        subjectId: params.subjectId,
        classId: params.classId,
        questionType: params.questionType,
        chapterIds: params.chapterIds.join(','),
        language: params.language,
        sourceType: params.source_type !== 'all' ? params.source_type : undefined,
        difficulty: params.difficulty !== 'any' ? params.difficulty : undefined,
        limit: params.count * 2, // Fetch more to ensure we have enough
        random: true,
        randomSeed: params.randomSeed,
        timestamp: Date.now()
      }
    });
    
    // Shuffle and limit to count
    const questions = response.data || [];
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, params.count);
  } catch (error) {
    console.error(`Error fetching ${params.questionType} questions:`, error);
    return [];
  }
}

// Apply fallback strategy for missing questions
async function applyFallbackForMissingQuestions(
  allQuestions: Record<string, Question[]>,
  questionTypes: Array<{ value: string; fieldPrefix: string }>,
  formCounts: Record<string, number>,
  config: QuestionGenerationConfig,
  formValues: Record<string, any>
) {
  const missing: Record<string, number> = {};
  
  // Calculate missing questions
  questionTypes.forEach(type => {
    const currentCount = (allQuestions[type.value] || []).length;
    const neededCount = formCounts[type.value] || 0;
    
    if (currentCount < neededCount) {
      missing[type.value] = neededCount - currentCount;
    }
  });
  
  // Try to fetch missing questions
  for (const [questionType, missingCount] of Object.entries(missing)) {
    if (missingCount <= 0) continue;
    
    const fallbackQuestions = await fetchQuestionsForChapter({
      ...config,
      chapterIds: config.chapterIds, // Use all chapters for fallback
      questionType,
      count: missingCount,
      difficulty: formValues[`${getFieldPrefix(questionType)}Difficulty`] || 'any'
    });
    
    if (fallbackQuestions.length > 0) {
      if (!allQuestions[questionType]) {
        allQuestions[questionType] = [];
      }
      allQuestions[questionType].push(...fallbackQuestions);
      
      // Mark as fallback questions
      fallbackQuestions.forEach(q => {
        (q as any).isFallback = true;
        (q as any).fallbackReason = 'Could not meet distribution requirements';
      });
    }
  }
}