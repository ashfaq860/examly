// services/boardPatternService.ts
import { BoardPatternDetails, AdditionalQuestionType } from '@/types/paper-builder';

export class BoardPatternService {
static getQuestionDetails(subjectName: string, className: string, currentSubject: any): BoardPatternDetails {
    const name = subjectName.toLowerCase();
    
    const baseDetails: BoardPatternDetails = {
        mcq: {
            count: name === 'english' ? 19 : name === 'urdu' ? 15 : name.toLowerCase().includes('computer') ? 10 : 12,
            attempt: name === 'english' ? 19 : name === 'urdu' ? 15 : name.toLowerCase().includes('computer') ? 10 : 12,
            marks: 1,
            total: 0 // Calculated below
        },
        short: { count: 0, attempt: 0, marks: 2, total: 0 },
        long: { 
            count: name==='english'||name==='urdu' ? 2 : 3, 
            attempt: name==='english'||name==='urdu' ? 1 : 2, 
            marks:name==='urdu' ? 5 : 8, 
            total: 0 
        },
        totalMarks: 0,
        timeMinutes: 145,
        additionalTypes: []
    };

    // Correcting the Short Question totals for splitting logic
    if (name === 'urdu' || name === 'english') {
        baseDetails.short = { count: 0, attempt: 0, marks: 2, total: 0 }; // Will be added as additional type
        baseDetails.long = { count: 0, attempt: 0, marks: name === 'urdu' ? 5 : 8, total: 0 }; // Will be added as additional type
    } else if (name.toLowerCase().includes('computer')) {
        // 18 total allows for 3 sections of 6
        baseDetails.short = { count: 18, attempt: 12, marks: 2, total: 24 };
    } else {
        // 24 total allows for 4 sections of 6 (Physics, Bio, Chem)
        baseDetails.short = { count: 24, attempt: 16, marks: 2, total: 32 };
    }

    // Set initial totals
    baseDetails.mcq.total = baseDetails.mcq.count * baseDetails.mcq.marks;
    baseDetails.long.total = baseDetails.long.attempt * baseDetails.long.marks;

    this.addSubjectSpecificTypes(baseDetails, name, className, currentSubject);

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
        count: 4,
        attempt: 3,
        marks: 2,
        total: 6
      },
      {
        name: 'gazal',
        label: 'Gazal',
        count: 3,
        attempt: 2,
        marks: 2,
        total: 4
      },
      {
        name: 'prose_explanation',
        label: 'Prose Explanation',
        count: 2,
        attempt: 1,
        marks: 10,
        total: 10
      },
      {
        name: 'short',
        label: 'Short Questions',
        count: 8,
        attempt: 5,
        marks: 2,
        total: 10
      },
      {
        name: 'Nasarkhulasa_markziKhyal',
        label: 'Nasarkhulasa/markziKhyal',
        count: 2,
        attempt: 1,
        marks: 5,
        total:5
      },
      {
        name: 'long',
        label: 'Long Questions',
        count: 2,
        attempt: 1,
        marks: 5,
        total: 10
      },
      {
        name: 'darkhwast_khat',
        label: 'Darkhwast Khat',
        count: 2,
        attempt: 1,
        marks:10,
        total: 10
      },{
        name: 'kahani_makalma',
        label: 'Kahani Makalma',
        count: 2,
        attempt: 1,
        marks: 5,
        total: 5
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
          count: 4,
          attempt: 3,
          marks: 1,
          total: 3
        },
        {
          name: 'sentence_completion',
          label: 'Sentence Completion',
          count: 3,
          attempt: 2,
          marks: 1,
          total: 2
        }
      );
    }
  }

  private static addEnglishTypes(details: BoardPatternDetails, className: string) {
    // 1. short
    details.additionalTypes.push({
      name: 'short',
      label: 'Short Questions',
      count: 8,
      attempt: 5,
      marks: 2,
      total: 10
    });
    
    // 2. translate_urdu
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
    
    // 3. summary
    details.additionalTypes.push({
      name: 'summary',
      label: 'Summary',
      count: 1,
      attempt: 1,
      marks: 5,
      total: 5
    });
    
    // 4. idiom_phrases
    details.additionalTypes.push({
      name: 'idiom_phrases',
      label: 'Idiom & Phrases',
      count: 8,
      attempt: 5,
      marks: 1,
      total: 5
    });
    
    // 5. long
    details.additionalTypes.push({
      name: 'long',
      label: 'Long Questions',
      count: 2,
      attempt: 1,
      marks: 8,
      total: 8
    });
    
    // 6. passage (class 9 only)
    if (className === '9') {
      details.additionalTypes.push({
        name: 'passage',
        label: 'Passage',
        count: 1,
        attempt: 1,
        marks: 10,
        total: 10
      });
    }
    
    // 7. translate_english
    if (className === '9') {
      details.additionalTypes.push({
        name: 'translate_english',
        label: 'Translate to English',
        count: 8,
        attempt: 5,
        marks: 1,
        total: 5
      });
    } else if (className === '10') {
      details.additionalTypes.push({
        name: 'translate_english',
        label: 'Translate to English',
        count: 6,
        attempt: 1,
        marks: 5,
        total: 5
      });
    }
    
    // 8. activePassive or directInDirect
    if (className === '9') {
      details.additionalTypes.push({
        name: 'activePassive',
        label: 'Active/Passive',
        count: 5,
        attempt: 5,
        marks: 1,
        total: 5
      });
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
    // Reset base counts to 0 before summing rules from database
    const typeTotals: Record<string, number> = { mcq: 0, short: 0, long: 0 };

    rules.forEach(rule => {
        const typeKey = rule.question_type.toLowerCase();
        
        // Sum up counts for standard types
        if (typeTotals.hasOwnProperty(typeKey)) {
            // Use min_questions or max_questions depending on your logic preference
            typeTotals[typeKey] += (rule.min_questions || 0);
        } else {
            // Handle Additional Types (Urdu/English components)
            const additionalType = details.additionalTypes.find(t => t.name === typeKey);
            if (additionalType) {
                additionalType.count = (rule.min_questions || additionalType.count);
                additionalType.total = additionalType.count * additionalType.marks;
            }
        }
    });

    // Update the details object with summed values
    if (typeTotals.mcq > 0) {
        details.mcq.count = typeTotals.mcq;
        details.mcq.total = details.mcq.count * details.mcq.marks;
    }
    if (typeTotals.short > 0) {
        details.short.count = typeTotals.short;
        // This is crucial: Short questions in Science/Computer are 2 marks each
        details.short.total = details.short.count * 2; 
    }
    if (typeTotals.long > 0) {
        details.long.count = typeTotals.long;
        details.long.total = details.long.count * details.long.marks;
    }

    // Final global total calculation
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