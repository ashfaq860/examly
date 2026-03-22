// services/boardPatternService.ts
import { BoardPatternDetails, AdditionalQuestionType } from '@/types/paper-builder';

export class BoardPatternService {
  static getQuestionDetails(subjectName: string, className: string, currentSubject: any): BoardPatternDetails {
    const baseDetails: BoardPatternDetails = {
      mcq: {
        count: subjectName === 'english' ? 19: subjectName === 'urdu' ? 15 : subjectName === 'computer' ? 10 : 12,
        attempt: subjectName === 'english' ? 16 : subjectName === 'urdu' ? 15 : subjectName === 'computer' ? 10 : 12,
        marks: 1,
        total: subjectName === 'english' ? 19: subjectName === 'urdu' ? 15 : subjectName === 'computer' ? 10 : 12
      },
      short: { count: 0, attempt: 0, marks: 2, total: 0 },
      long: { 
        count: 3, 
        attempt: 2, 
        marks: subjectName === 'urdu' ? 10 : 8, 
        total: subjectName === 'urdu' ? 20 : 16 
      },
      totalMarks: 0,
      timeMinutes: 145,
      additionalTypes: []
    };

    // Set short questions
    if (subjectName === 'urdu' || subjectName === 'english') {
      baseDetails.short = { count: 8, attempt: 5, marks: 2, total: 10 };
    } else if (subjectName === "computer") {
      baseDetails.short = { count: 18, attempt: 12, marks: 2, total: 24 };
    } else {
      baseDetails.short = { count: 24, attempt: 16, marks: 2, total: 32 };
    }

    // Calculate base total
    baseDetails.totalMarks = baseDetails.mcq.total + baseDetails.short.total + baseDetails.long.total;

    // Add subject-specific types
    this.addSubjectSpecificTypes(baseDetails, subjectName, className, currentSubject);

    return baseDetails;
  }

  private static addSubjectSpecificTypes(
    details: BoardPatternDetails,
    subjectName: string,
    className: string,
    currentSubject: any
  ) {
    if (subjectName === 'urdu') {
      this.addUrduTypes(details, className);
    } else if (subjectName === 'english') {
      this.addEnglishTypes(details, className);
    }
    
    // Add subject-specific rules from currentSubject if available
    if (currentSubject?.board_rules) {
      this.applyBoardRules(details, currentSubject.board_rules);
    }
  }

  private static addUrduTypes(details: BoardPatternDetails, className: string) {
    details.additionalTypes.push(
      {
        name: 'poetry_explanation',
        label: 'Poetry Explanation',
        count: 8,
        attempt: 5,
        marks: 2,
        total: 10
      },
      {
        name: 'prose_explanation',
        label: 'Prose Explanation',
        count: 2,
        attempt: 2,
        marks: 5,
        total: 10
      }
    );

    if (className === '10') {
      details.additionalTypes.push({
        name: 'passage',
        label: 'Passage',
        count: 1,
        attempt: 1,
        marks: 10,
        total: 10
      });
    } else if (className === '9') {
      details.additionalTypes.push(
        {
          name: 'sentence_correction',
          label: 'Sentence Correction',
          count: 5,
          attempt: 5,
          marks: 1,
          total: 5
        },
        {
          name: 'sentence_completion',
          label: 'Sentence Completion',
          count: 5,
          attempt: 5,
          marks: 1,
          total: 5
        }
      );
    }
  }

  private static addEnglishTypes(details: BoardPatternDetails, className: string) {
    if (className !== '10') {
      details.additionalTypes.push({
        name: 'translate_urdu',
        label: 'Translate to Urdu',
        count: 3,
        attempt: 2,
        marks: 4,
        total: 8
      });
    } else {
      details.additionalTypes.push({
        name: 'translate_urdu',
        label: 'Translate to Urdu',
        count: 1,
        attempt: 1,
        marks: 8,
        total: 8
      });
    }

    details.additionalTypes.push(
      {
        name: 'translate_english',
        label: 'Translate to English',
        count: 1,
        attempt: 1,
        marks: 5,
        total: 5
      },
      {
        name: 'idiom_phrases',
        label: 'Idiom & Phrases',
        count: 8,
        attempt: 5,
        marks: 1,
        total: 5
      }
    );

    if (className !== '10') {
      details.additionalTypes.push(
        {
          name: 'passage',
          label: 'Passage',
          count: 1,
          attempt: 1,
          marks: 10,
          total: 10
        },
        {
          name: 'activePassive',
          label: 'Active/Passive',
          count: 6,
          attempt: 5,
          marks: 1,
          total: 5
        }
      );
    } else if (className === '10') {
      details.additionalTypes.push({
        name: 'directInDirect',
        label: 'Direct/Indirect',
        count: 6,
        attempt: 5,
        marks: 1,
        total: 5
      });
    }
  }

  private static applyBoardRules(details: BoardPatternDetails, rules: any[]) {
    // Apply database rules to adjust counts
    rules.forEach(rule => {
      const typeKey = rule.question_type;
      const baseType = details[typeKey as keyof BoardPatternDetails];
      
      if (baseType && typeof baseType === 'object') {
        baseType.count = Math.max(baseType.count, rule.min_questions || 0);
        if (rule.max_questions) {
          baseType.count = Math.min(baseType.count, rule.max_questions);
        }
        baseType.total = baseType.count * baseType.marks;
      } else {
        // Check additional types
        const additionalType = details.additionalTypes.find(t => t.name === typeKey);
        if (additionalType) {
          additionalType.count = Math.max(additionalType.count, rule.min_questions || 0);
          if (rule.max_questions) {
            additionalType.count = Math.min(additionalType.count, rule.max_questions);
          }
          additionalType.total = additionalType.count * additionalType.marks;
        }
      }
    });

    // Recalculate total marks
    details.totalMarks = details.mcq.total + details.short.total + details.long.total +
      details.additionalTypes.reduce((sum, type) => sum + type.total, 0);
  }

  static async fetchBoardRules(subjectId: string, classId: string) {
    try {
      const response = await fetch(`/api/chapter-range-rules?subjectId=${subjectId}&classId=${classId}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching board rules:', error);
      return [];
    }
  }
}