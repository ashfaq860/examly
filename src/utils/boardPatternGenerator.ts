import { ChapterRangeRule, PaperSection } from '@/types/paperBuilderTypes';
import { Question, Chapter } from '@/types/types';

export class BoardPatternGenerator {
  private subjectId: string;
  private classId: string;
  private language: string;
  private rules: ChapterRangeRule[];
  private availableChapters: Chapter[];
  private allQuestions: Question[];

  constructor(
    subjectId: string,
    classId: string,
    language: string,
    rules: ChapterRangeRule[],
    chapters: Chapter[],
    questions: Question[]
  ) {
    this.subjectId = subjectId;
    this.classId = classId;
    this.language = language;
    this.rules = rules;
    this.availableChapters = chapters;
    this.allQuestions = questions;
  }

  async generatePaperSections(): Promise<PaperSection[]> {
    const sections: PaperSection[] = [];
    
    // Group rules by question type
    const rulesByType = this.groupRulesByType();
    
    // Generate sections for each question type
    for (const [questionType, typeRules] of Object.entries(rulesByType)) {
      const section = await this.generateSection(questionType, typeRules);
      if (section) {
        sections.push(section);
      }
    }
    
    return sections;
  }

  private groupRulesByType(): Record<string, ChapterRangeRule[]> {
    return this.rules.reduce((acc, rule) => {
      if (!acc[rule.question_type]) {
        acc[rule.question_type] = [];
      }
      acc[rule.question_type].push(rule);
      return acc;
    }, {} as Record<string, ChapterRangeRule[]>);
  }

  private async generateSection(
    questionType: string,
    rules: ChapterRangeRule[]
  ): Promise<PaperSection | null> {
    const questions: Question[] = [];
    let totalMarks = 0;
    let totalQuestions = 0;

    // Apply each rule
    for (const rule of rules) {
      const ruleQuestions = await this.applyRule(rule);
      questions.push(...ruleQuestions);
      
      if (rule.rule_mode === 'total') {
        totalQuestions += rule.min_questions;
      } else {
        // per_chapter mode
        const chaptersInRange = this.getChaptersInRange(rule.chapter_start, rule.chapter_end);
        totalQuestions += chaptersInRange.length * rule.min_questions;
      }
    }

    if (questions.length === 0) return null;

    // Calculate marks based on question type
    const marksEach = this.getMarksPerQuestion(questionType);
    totalMarks = questions.length * marksEach;

    return {
      id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: questionType,
      questions,
      totalQuestions,
      attemptCount: this.getAttemptCount(questionType, questions.length),
      marksEach,
      totalMarks,
      subject: this.getSubjectName(),
      language: this.language,
      layout: 'separate',
      timestamp: new Date().toISOString()
    };
  }

  private async applyRule(rule: ChapterRangeRule): Promise<Question[]> {
    const selectedQuestions: Question[] = [];
    const chaptersInRange = this.getChaptersInRange(rule.chapter_start, rule.chapter_end);
    
    // Filter questions by type and chapters
    let filteredQuestions = this.allQuestions.filter(q => 
      q.type === rule.question_type && 
      q.chapter_id && 
      chaptersInRange.some(ch => ch.id === q.chapter_id)
    );

    // Shuffle to get random selection
    filteredQuestions = this.shuffleArray(filteredQuestions);

    if (rule.rule_mode === 'total') {
      // Select total number of questions from the entire range
      const count = Math.min(rule.min_questions, filteredQuestions.length);
      return filteredQuestions.slice(0, count);
    } else {
      // per_chapter mode - select questions per chapter
      for (const chapter of chaptersInRange) {
        const chapterQuestions = filteredQuestions.filter(q => q.chapter_id === chapter.id);
        const count = Math.min(rule.min_questions, chapterQuestions.length);
        selectedQuestions.push(...chapterQuestions.slice(0, count));
      }
    }

    return selectedQuestions;
  }

  private getChaptersInRange(start: number, end: number): Chapter[] {
    return this.availableChapters.filter(ch => {
      const chapterNum = parseInt(ch.name.match(/\d+/)?.[0] || '0');
      return chapterNum >= start && chapterNum <= end;
    });
  }

  private getMarksPerQuestion(questionType: string): number {
    const marksMap: Record<string, number> = {
      'mcq': 1,
      'short': 2,
      'long': 5,
      'conceptual': 3,
      'numerical': 3,
      'translate_urdu': 2,
      'translate_english': 2,
      'idiom_phrases': 1,
      'passage': 5,
      'poetry_explanation': 4,
      'prose_explanation': 4,
      'sentence_correction': 1,
      'sentence_completion': 1,
      'directindirect': 1,
      'activepassive': 1,
      'darkhwast_khat': 10,
      'kahani_makalma': 10,
      'nasarkhulasa_markzikhyal': 8
    };
    
    return marksMap[questionType] || 1;
  }

  private getAttemptCount(questionType: string, totalQuestions: number): number {
    // Define attempt rules based on question type
    const attemptRules: Record<string, (count: number) => number> = {
      'mcq': (count) => count, // Attempt all MCQs
      'short': (count) => Math.floor(count * 0.7), // Attempt 70% of short questions
      'long': (count) => Math.floor(count * 0.5), // Attempt 50% of long questions
      'default': (count) => count
    };

    const rule = attemptRules[questionType] || attemptRules['default'];
    return rule(totalQuestions);
  }

  private getSubjectName(): string {
    // This should fetch from your subjects data
    return "Subject";
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}