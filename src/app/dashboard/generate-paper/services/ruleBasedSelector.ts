// src/app/dashboard/generate-paper/services/ruleBasedSelector.ts
import { QuestionService } from './questionService';
import { QuestionRuleEngine } from '@/lib/questionRules';
import { PaperFormData } from '../schema/paperSchema';
import { Question, Chapter } from '@/types/types';
import axios from 'axios';

interface DistributionResult {
  [chapterId: string]: {
    [questionType: string]: number;
  };
}

interface ChapterWithNumber {
  id: string;
  chapterNo: number;
}

interface QuestionFetchConfig {
  subjectId: string;
  classId: string;
  language: string;
  sourceType?: string;
  difficulty?: string;
  randomSeed?: number;
}

export class RuleBasedSelector {
  private static readonly MAX_RETRIES = 2;
  private static readonly BATCH_SIZE = 50;

  /**
   * Main entry point for rule-based question selection
   */
  static async selectQuestions(
    formValues: PaperFormData,
    chapterIds: string[],
    rules: any[]
  ): Promise<Record<string, Question[]>> {
    try {
      // If no rules exist, fall back to simple selection
      if (!rules || rules.length === 0) {
        console.log('No rules found, using simple selection');
        return this.selectSimple(formValues, chapterIds);
      }

      // Get chapters with their numbers
      const chaptersWithNumbers = await this.getChaptersWithNumbers(chapterIds);
      
      if (chaptersWithNumbers.length === 0) {
        return this.selectSimple(formValues, chapterIds);
      }

      // Initialize rule engine
      const engine = new QuestionRuleEngine(rules);
      
      // Get question types based on subject
      const questionTypes = this.getQuestionTypes(formValues);
      const questionTypeValues = questionTypes.map(t => t.value);
      
      // Get counts from form
      const counts = this.getCounts(formValues, questionTypes);
      
      // Check if any counts are greater than zero
      const hasQuestions = Object.values(counts).some(count => count > 0);
      if (!hasQuestions) {
        return {};
      }

      // Distribute questions according to rules
      const distribution = engine.distributeQuestions(
        chaptersWithNumbers,
        questionTypeValues,
        counts
      );

      console.log('Rule-based distribution:', distribution);

      // Fetch questions based on distribution
      const questions = await this.fetchDistributedQuestions(
        distribution,
        formValues,
        chaptersWithNumbers
      );

      // Validate we got all required questions
      await this.validateAndFillMissing(questions, distribution, formValues, chapterIds);

      return questions;
    } catch (error) {
      console.error('Error in rule-based selection:', error);
      // Fall back to simple selection on error
      return this.selectSimple(formValues, chapterIds);
    }
  }

  /**
   * Simple random selection (fallback method)
   */
  static async selectSimple(
    formValues: PaperFormData,
    chapterIds: string[]
  ): Promise<Record<string, Question[]>> {
    const questions: Record<string, Question[]> = {};
    const questionTypes = this.getQuestionTypes(formValues);
    
    // Fetch questions for each type in parallel with concurrency limit
    const fetchPromises = questionTypes.map(async (type) => {
      const count = formValues[`${type.fieldPrefix}Count` as keyof PaperFormData] as number || 0;
      
      if (count === 0) return;

      try {
        const fetched = await QuestionService.fetchQuestions({
          subjectId: formValues.subjectId,
          classId: formValues.classId,
          questionType: type.value,
          chapterIds: chapterIds,
          language: formValues.language,
          sourceType: formValues.source_type !== 'all' ? formValues.source_type : undefined,
          difficulty: this.getDifficulty(formValues, type.fieldPrefix),
          limit: count * 2, // Fetch extra to ensure we have enough
          random: true,
          randomSeed: Date.now(),
        });

        // Randomly select required count
        const selected = this.selectRandom(fetched, count);
        
        // Translate if needed
        questions[type.value] = QuestionService.translateQuestions(
          selected,
          formValues.language
        );
      } catch (error) {
        console.error(`Error fetching ${type.value} questions:`, error);
        questions[type.value] = [];
      }
    });

    await Promise.all(fetchPromises);
    return questions;
  }

  /**
   * Fetch questions based on distribution
   */
  private static async fetchDistributedQuestions(
    distribution: DistributionResult,
    formValues: PaperFormData,
    chaptersWithNumbers: ChapterWithNumber[]
  ): Promise<Record<string, Question[]>> {
    const questions: Record<string, Question[]> = {};
    const fetchPromises: Promise<void>[] = [];

    // Process each chapter's distribution
    for (const [chapterId, typeCounts] of Object.entries(distribution)) {
      for (const [questionType, count] of Object.entries(typeCounts)) {
        if (count === 0) continue;

        fetchPromises.push(
          this.fetchQuestionsForChapter(
            chapterId,
            questionType,
            count,
            formValues,
            questions
          )
        );
      }
    }

    await Promise.all(fetchPromises);
    return questions;
  }

  /**
   * Fetch questions for a specific chapter and type
   */
  private static async fetchQuestionsForChapter(
    chapterId: string,
    questionType: string,
    count: number,
    formValues: PaperFormData,
    questions: Record<string, Question[]>
  ): Promise<void> {
    let attempts = 0;
    let fetched: Question[] = [];
    
    while (attempts < this.MAX_RETRIES && fetched.length < count) {
      try {
        const response = await axios.get('/api/questions', {
          params: {
            subjectId: formValues.subjectId,
            classId: formValues.classId,
            questionType,
            chapterIds: chapterId,
            language: formValues.language,
            sourceType: formValues.source_type !== 'all' ? formValues.source_type : undefined,
            difficulty: this.getDifficulty(formValues, this.getFieldPrefix(questionType)),
            limit: Math.min(count * 2, this.BATCH_SIZE),
            random: true,
            randomSeed: Date.now() + attempts,
            excludeIds: this.getExistingQuestionIds(questions[questionType]),
          },
        });

        const newQuestions = response.data || [];
        
        if (newQuestions.length > 0) {
          // Filter out duplicates
          const existingIds = new Set((questions[questionType] || []).map(q => q.id));
          const uniqueNewQuestions = newQuestions.filter(q => !existingIds.has(q.id));
          
          fetched = [...fetched, ...uniqueNewQuestions];
        }

        attempts++;
      } catch (error) {
        console.error(`Error fetching questions (attempt ${attempts + 1}):`, error);
        attempts++;
        
        if (attempts < this.MAX_RETRIES) {
          await this.delay(500 * attempts); // Exponential backoff
        }
      }
    }

    // Select required number of questions
    const selected = this.selectRandom(fetched, count);
    
    if (selected.length > 0) {
      if (!questions[questionType]) {
        questions[questionType] = [];
      }
      
      questions[questionType].push(
        ...QuestionService.translateQuestions(selected, formValues.language)
      );
    }

    // Mark if we couldn't get enough questions
    if (selected.length < count) {
      console.warn(`Only got ${selected.length}/${count} ${questionType} questions for chapter ${chapterId}`);
      selected.forEach(q => {
        (q as any).isFallback = true;
        (q as any).fallbackReason = 'Insufficient questions for distribution';
      });
    }
  }

  /**
   * Validate we have all required questions and fill missing ones
   */
  private static async validateAndFillMissing(
    questions: Record<string, Question[]>,
    distribution: DistributionResult,
    formValues: PaperFormData,
    allChapterIds: string[]
  ): Promise<void> {
    // Calculate required counts from distribution
    const required: Record<string, number> = {};
    
    Object.values(distribution).forEach(typeCounts => {
      Object.entries(typeCounts).forEach(([type, count]) => {
        required[type] = (required[type] || 0) + count;
      });
    });

    // Check for missing questions
    const missing: Record<string, number> = {};
    Object.entries(required).forEach(([type, requiredCount]) => {
      const currentCount = (questions[type] || []).length;
      if (currentCount < requiredCount) {
        missing[type] = requiredCount - currentCount;
      }
    });

    // If missing questions, try to fill from any chapter
    if (Object.keys(missing).length > 0) {
      console.log('Filling missing questions:', missing);
      await this.fillMissingQuestions(missing, questions, formValues, allChapterIds);
    }
  }

  /**
   * Fill missing questions by fetching from any chapter
   */
  private static async fillMissingQuestions(
    missing: Record<string, number>,
    questions: Record<string, Question[]>,
    formValues: PaperFormData,
    chapterIds: string[]
  ): Promise<void> {
    const fillPromises = Object.entries(missing).map(async ([type, count]) => {
      try {
        const response = await axios.get('/api/questions', {
          params: {
            subjectId: formValues.subjectId,
            classId: formValues.classId,
            questionType: type,
            chapterIds: chapterIds.join(','),
            language: formValues.language,
            sourceType: formValues.source_type !== 'all' ? formValues.source_type : undefined,
            difficulty: this.getDifficulty(formValues, this.getFieldPrefix(type)),
            limit: count * 3,
            random: true,
            randomSeed: Date.now() + 1000,
            excludeIds: this.getExistingQuestionIds(questions[type]),
          },
        });

        const newQuestions = response.data || [];
        const selected = this.selectRandom(newQuestions, count);
        
        if (selected.length > 0) {
          if (!questions[type]) {
            questions[type] = [];
          }
          
          questions[type].push(
            ...QuestionService.translateQuestions(selected, formValues.language)
          );
          
          // Mark as fallback
          selected.forEach(q => {
            (q as any).isFallback = true;
            (q as any).fallbackReason = 'Filled from general pool';
          });
        }
      } catch (error) {
        console.error(`Error filling missing ${type} questions:`, error);
      }
    });

    await Promise.all(fillPromises);
  }

  /**
   * Get chapters with their numbers from the database
   */
  private static async getChaptersWithNumbers(chapterIds: string[]): Promise<ChapterWithNumber[]> {
    if (chapterIds.length === 0) return [];

    try {
      const response = await axios.get('/api/chapters', {
        params: {
          chapterIds: chapterIds.join(','),
          fields: 'id,chapterNo',
        },
      });

      return (response.data || []).map((chapter: Chapter) => ({
        id: chapter.id,
        chapterNo: chapter.chapterNo || 0,
      }));
    } catch (error) {
      console.error('Error fetching chapter numbers:', error);
      // Fallback: return chapters with default numbers
      return chapterIds.map((id, index) => ({
        id,
        chapterNo: index + 1,
      }));
    }
  }

  /**
   * Get question types based on subject
   */
  private static getQuestionTypes(formValues: PaperFormData): Array<{ value: string; fieldPrefix: string }> {
    // This should be imported from constants based on subject
    const defaultTypes = [
      { value: 'mcq', label: 'Multiple Choice', fieldPrefix: 'mcq' },
      { value: 'short', label: 'Short Answer', fieldPrefix: 'short' },
      { value: 'long', label: 'Long Answer', fieldPrefix: 'long' },
    ];

    // You can enhance this to return subject-specific types
    return defaultTypes;
  }

  /**
   * Get counts from form values
   */
  private static getCounts(
    formValues: PaperFormData,
    questionTypes: Array<{ value: string; fieldPrefix: string }>
  ): Record<string, number> {
    const counts: Record<string, number> = {};
    
    questionTypes.forEach(type => {
      const count = formValues[`${type.fieldPrefix}Count` as keyof PaperFormData];
      counts[type.value] = typeof count === 'number' ? count : 0;
    });

    return counts;
  }

  /**
   * Get difficulty for a question type
   */
  private static getDifficulty(formValues: PaperFormData, fieldPrefix: string): string | undefined {
    const difficulty = formValues[`${fieldPrefix}Difficulty` as keyof PaperFormData];
    return difficulty && difficulty !== 'any' ? difficulty as string : undefined;
  }

  /**
   * Get field prefix from question type
   */
  private static getFieldPrefix(questionType: string): string {
    const mapping: Record<string, string> = {
      'mcq': 'mcq',
      'short': 'short',
      'long': 'long',
      'translate_urdu': 'translateUrdu',
      'translate_english': 'translateEnglish',
      'poetry_explanation': 'poetryExplanation',
      'prose_explanation': 'proseExplanation',
      'idiom_phrases': 'idiomPhrases',
      'passage': 'passage',
      'directInDirect': 'directInDirect',
      'activePassive': 'activePassive',
      'sentence_correction': 'sentenceCorrection',
      'sentence_completion': 'sentenceCompletion',
    };
    
    return mapping[questionType] || questionType;
  }

  /**
   * Get existing question IDs to exclude
   */
  private static getExistingQuestionIds(questions?: Question[]): string[] {
    return (questions || []).map(q => q.id);
  }

  /**
   * Randomly select items from array
   */
  private static selectRandom<T>(items: T[], count: number): T[] {
    if (!items || items.length === 0) return [];
    if (items.length <= count) return [...items];
    
    // Fisher-Yates shuffle and slice
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled.slice(0, count);
  }

  /**
   * Delay helper for retries
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if we have enough questions for distribution
   */
  static async validateDistribution(
    formValues: PaperFormData,
    chapterIds: string[],
    rules: any[]
  ): Promise<{ isValid: boolean; missing: Record<string, number>; warnings: string[] }> {
    if (!rules || rules.length === 0 || chapterIds.length === 0) {
      return { isValid: true, missing: {}, warnings: [] };
    }

    try {
      const chaptersWithNumbers = await this.getChaptersWithNumbers(chapterIds);
      const engine = new QuestionRuleEngine(rules);
      const questionTypes = this.getQuestionTypes(formValues);
      const questionTypeValues = questionTypes.map(t => t.value);
      const counts = this.getCounts(formValues, questionTypes);

      // Calculate requirements
      const requirements = engine.calculateRequirementsForChapters(
        chaptersWithNumbers,
        questionTypeValues
      );

      const missing: Record<string, number> = {};
      const warnings: string[] = [];

      Object.entries(requirements).forEach(([questionType, typeRequirements]) => {
        if (!typeRequirements || typeRequirements.length === 0) return;

        const typeInfo = questionTypes.find(t => t.value === questionType);
        if (!typeInfo) return;

        const formCount = counts[questionType] || 0;
        
        // Calculate minimum required
        let totalMinRequired = 0;
        typeRequirements.forEach((req: any) => {
          if (req.mode === 'per_chapter') {
            totalMinRequired += (req.min || 0) * (req.chaptersInRange?.length || 0);
          } else {
            totalMinRequired += req.min || 0;
          }
        });

        if (formCount < totalMinRequired) {
          missing[questionType] = totalMinRequired - formCount;
          warnings.push(
            `Chapter rules require at least ${totalMinRequired} ${typeInfo.label} questions ` +
            `(you have ${formCount})`
          );
        }
      });

      return {
        isValid: Object.keys(missing).length === 0,
        missing,
        warnings,
      };
    } catch (error) {
      console.error('Error validating distribution:', error);
      return { isValid: true, missing: {}, warnings: [] };
    }
  }

  /**
   * Get distribution statistics
   */
  static getDistributionStats(
    distribution: DistributionResult
  ): { total: number; perChapter: Record<string, number>; perType: Record<string, number> } {
    const perChapter: Record<string, number> = {};
    const perType: Record<string, number> = {};
    let total = 0;

    Object.entries(distribution).forEach(([chapterId, typeCounts]) => {
      let chapterTotal = 0;
      
      Object.entries(typeCounts).forEach(([type, count]) => {
        chapterTotal += count;
        perType[type] = (perType[type] || 0) + count;
        total += count;
      });
      
      perChapter[chapterId] = chapterTotal;
    });

    return { total, perChapter, perType };
  }
}

// Export types for use in other files
export type { DistributionResult, ChapterWithNumber };