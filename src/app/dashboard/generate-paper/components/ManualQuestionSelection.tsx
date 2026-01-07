// src/app/dashboard/generate-paper/components/ManualQuestionSelection.tsx
'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { Subject, Chapter, Question } from '@/types/types';

interface ManualQuestionSelectionProps {
  subjectId: string;
  classId: string;
  chapterOption: string;
  selectedChapters: string[];
  chapters: Chapter[];
  subjects: Subject[];
  onQuestionsSelected: (questions: Record<string, string[]>) => void;
  onAllComplete: () => void;
  mcqCount: number;
  shortCount: number;
  longCount: number;
  language: 'english' | 'urdu' | 'bilingual';
  source_type: string;
  typeCounts?: Record<string, number>;
  autoAdvance?: boolean;
}

interface QuestionWithOptions extends Question {
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  option_a_ur?: string;
  option_b_ur?: string;
  option_c_ur?: string;
  option_d_ur?: string;
  option_a_urdu?: string;
  option_b_urdu?: string;
  option_c_urdu?: string;
  option_d_urdu?: string;
  option_a_english?: string;
  option_b_english?: string;
  option_c_english?: string;
  option_d_english?: string;
  question_text_english?: string;
  question_text_urdu?: string;
}

export const ManualQuestionSelection: React.FC<ManualQuestionSelectionProps> = ({
  subjectId,
  classId,
  chapterOption,
  selectedChapters,
  chapters,
  subjects,
  onQuestionsSelected,
  onAllComplete,
  mcqCount,
  shortCount,
  longCount,
  language,
  source_type,
  typeCounts,
  autoAdvance = true,
}) => {
  // Get question types based on subject
  const getQuestionTypesLocal = useCallback(() => {
    const defaultTypes = [
      { value: 'mcq', label: 'Multiple Choice', fieldPrefix: 'mcq' },
      { value: 'short', label: 'Short Answer', fieldPrefix: 'short' },
      { value: 'long', label: 'Long Answer', fieldPrefix: 'long' },
    ];

    const englishTypes = [
      { value: 'mcq', label: 'Multiple Choice', fieldPrefix: 'mcq' },
      { value: 'short', label: 'Short Answer', fieldPrefix: 'short' },
      { value: 'translate_urdu', label: 'Translate into Urdu', fieldPrefix: 'translateUrdu' },
      { value: 'long', label: 'Long Answer', fieldPrefix: 'long' },
      { value: 'idiom_phrases', label: 'Idiom/Phrases', fieldPrefix: 'idiomPhrases' },
      { value: 'translate_english', label: 'Translate into English', fieldPrefix: 'translateEnglish' },
      { value: 'passage', label: 'Passage and Questions', fieldPrefix: 'passage' },
      { value: 'directInDirect', label: 'Direct In Direct', fieldPrefix: 'directInDirect' },
      { value: 'activePassive', label: 'Active Voice / Passive Voice', fieldPrefix: 'activePassive' },
    ];

    const urduTypes = [
      { value: 'mcq', label: 'MCQ (اردو)', fieldPrefix: 'mcq' },
      { value: 'poetry_explanation', label: 'اشعار کی تشریح', fieldPrefix: 'poetryExplanation' },
      { value: 'prose_explanation', label: 'نثرپاروں کی تشریح', fieldPrefix: 'proseExplanation' },
      { value: 'short', label: 'مختصر سوالات', fieldPrefix: 'short' },
      { value: 'long', label: 'تفصیلی جوابات', fieldPrefix: 'long' },
      { value: 'sentence_correction', label: 'جملوں کی درستگی', fieldPrefix: 'sentenceCorrection' },
      { value: 'sentence_completion', label: 'جملوں کی تکمیل', fieldPrefix: 'sentenceCompletion' },
    ];

    const currentSubject = subjects.find(s => s.id === subjectId);
    const subjectName = currentSubject?.name.toLowerCase() || '';
    
    if (subjectName.includes('english')) return englishTypes;
    if (subjectName.includes('urdu')) return urduTypes;
    return defaultTypes;
  }, [subjectId, subjects]);

  const questionTypes = useMemo(() => getQuestionTypesLocal(), [getQuestionTypesLocal]);

  const [questions, setQuestions] = useState<Record<string, QuestionWithOptions[]>>({});
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [filters, setFilters] = useState({
    difficulty: 'all' as 'all' | string,
    chapter: 'all' as 'all' | string,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiredCounts, setRequiredCounts] = useState<Record<string, number>>({});
  const [currentTypeIndex, setCurrentTypeIndex] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  
  const fetchInProgressRef = useRef(false);
  const fetchAttemptsRef = useRef(0);
  const prevFetchParamsRef = useRef<string>('');
  const prevSelectedRef = useRef<Record<string, string[]>>({});
  const prevRequiredCountsRef = useRef<Record<string, number>>({});
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const completionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const computedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    counts['mcq'] = mcqCount || 0;
    counts['short'] = shortCount || 0;
    counts['long'] = longCount || 0;

    if (typeCounts) {
      Object.keys(typeCounts).forEach(k => {
        counts[k] = typeCounts[k] || 0;
      });
    } else {
      questionTypes.forEach(type => {
        if (counts[type.value] === undefined) {
          counts[type.value] = 0;
        }
      });
    }
    
    return counts;
  }, [questionTypes, mcqCount, shortCount, longCount, typeCounts]);

  useEffect(() => {
    const countsChanged = JSON.stringify(computedCounts) !== JSON.stringify(prevRequiredCountsRef.current);
    
    if (countsChanged) {
      setRequiredCounts(computedCounts);
      prevRequiredCountsRef.current = computedCounts;
    }
  }, [computedCounts]);

  useEffect(() => {
    const initialSelected: Record<string, string[]> = {};
    
    questionTypes.forEach(type => {
      initialSelected[type.value] = [];
    });
    
    setSelected(initialSelected);
    prevSelectedRef.current = initialSelected;
  }, [questionTypes]);

  const activeTypes = useMemo(() => {
    return questionTypes.filter(type => requiredCounts[type.value] > 0);
  }, [questionTypes, requiredCounts]);

  const currentType = activeTypes[currentTypeIndex];

  const getCompletionStatus = (type: string) => {
    const required = requiredCounts[type] || 0;
    const selectedCount = selected[type]?.length || 0;
    return {
      completed: required === 0 || selectedCount >= required,
      progress: required === 0 ? `${selectedCount}` : `${selectedCount}/${required}`,
      remaining: Math.max(0, required - selectedCount)
    };
  };

  useEffect(() => {
    if (!currentType || !autoAdvance) return;
    
    const currentTypeKey = currentType.value;
    const currentCompletionStatus = getCompletionStatus(currentTypeKey);
    
    if (currentCompletionStatus.completed && currentTypeIndex < activeTypes.length - 1) {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
      
      autoAdvanceTimerRef.current = setTimeout(() => {
        setCurrentTypeIndex(prev => prev + 1);
        autoAdvanceTimerRef.current = null;
      }, 800);
    }
    
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [selected, currentTypeIndex, currentType, activeTypes.length, autoAdvance]);

  useEffect(() => {
    if (activeTypes.length === 0) return;
    
    const allComplete = activeTypes.every(type => {
      return getCompletionStatus(type.value).completed;
    });
    
    if (allComplete) {
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
      
      completionTimerRef.current = setTimeout(() => {
        setShowCompletionMessage(true);
        
        setTimeout(() => {
          onAllComplete();
        }, 1500);
      }, 500);
    } else {
      setShowCompletionMessage(false);
    }
    
    return () => {
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
    };
  }, [selected, activeTypes, requiredCounts, onAllComplete]);

  useEffect(() => {
    const selectionChanged = JSON.stringify(selected) !== JSON.stringify(prevSelectedRef.current);
    
    if (selectionChanged) {
      prevSelectedRef.current = selected;
      onQuestionsSelected(selected);
    }
  }, [selected, onQuestionsSelected]);

  const subjectChapters = useMemo(() => {
    return chapters.filter(chapter => chapter.subject_id === subjectId && chapter.class_id === classId);
  }, [chapters, subjectId, classId]);

  const chapterIds = useMemo(() => {
    if (subjectChapters.length === 0) {
      return [];
    }
    
    let ids: string[] = [];
    
    if (chapterOption === 'full_book') {
      ids = subjectChapters.map(c => c.id);
    } else if (chapterOption === 'half_book') {
      const halfIndex = Math.ceil(subjectChapters.length / 2);
      ids = subjectChapters.slice(0, halfIndex).map(c => c.id);
    } else if (chapterOption === 'single_chapter' && selectedChapters && selectedChapters.length > 0) {
      ids = [selectedChapters[0]];
    } else if (chapterOption === 'custom' && selectedChapters && selectedChapters.length > 0) {
      ids = selectedChapters;
    } else {
      return [];
    }
    
    return ids.filter(id => id);
  }, [chapterOption, selectedChapters, subjectChapters]);

  const handleLanguageTranslation = useCallback((questions: QuestionWithOptions[], lang: string) => {
    return questions.map(question => {
      const translatedQuestion = { ...question };
      
      if (lang !== 'english') {
        const isBi = lang === 'bilingual';
        
        // Translate question text
        if (question.question_text_ur) {
          if (isBi) {
            (translatedQuestion as any).question_text_english = question.question_text;
            (translatedQuestion as any).question_text_urdu = question.question_text_ur;
          } else {
            translatedQuestion.question_text = question.question_text_ur;
          }
        }
        
        // Translate MCQ options if they exist
        const options = ['option_a', 'option_b', 'option_c', 'option_d'];
        options.forEach(opt => {
          const urduField = `${opt}_ur` as keyof QuestionWithOptions;
          if (question[urduField]) {
            if (isBi) {
              (translatedQuestion as any)[`${opt}_english`] = question[opt as keyof QuestionWithOptions];
              (translatedQuestion as any)[`${opt}_urdu`] = question[urduField];
            } else {
              (translatedQuestion as any)[opt] = question[urduField];
            }
          }
        });
      }
      
      return translatedQuestion;
    });
  }, []);

  const fetchQuestions = useCallback(async () => {
    if (fetchInProgressRef.current) {
      console.log('Fetch already in progress, skipping...');
      return;
    }

    if (!subjectId || !classId) {
      console.log('Missing subjectId or classId');
      return;
    }

    if (chapterIds.length === 0) {
      console.log('No chapters selected');
      setError('Please select at least one chapter');
      setQuestions({});
      return;
    }

    const fetchKey = JSON.stringify({
      subjectId,
      classId,
      chapterIds: chapterIds.sort(),
      language,
      source_type,
      questionTypes: questionTypes.map(t => t.value).sort()
    });

    if (prevFetchParamsRef.current === fetchKey && fetchAttemptsRef.current > 0) {
      console.log('Skipping duplicate fetch request with same parameters');
      return;
    }

    console.log('Fetching questions...', {
      subjectId,
      classId,
      chapterCount: chapterIds.length,
      language,
      source_type,
      fetchAttempt: fetchAttemptsRef.current + 1
    });

    try {
      setIsLoading(true);
      setError(null);
      fetchInProgressRef.current = true;
      fetchAttemptsRef.current++;
      prevFetchParamsRef.current = fetchKey;
      
      const result: Record<string, QuestionWithOptions[]> = {};
      
      const typesToFetch = activeTypes.length > 0 ? activeTypes : questionTypes;
      
      for (let i = 0; i < typesToFetch.length; i++) {
        const type = typesToFetch[i];
        
        try {
          console.log(`Fetching ${type.value} questions...`);
          
          const response = await axios.get(`/api/questions`, {
            params: {
              subjectId,
              classId,
              questionType: type.value,
              chapterIds: chapterIds.join(','),
              language,
              includeUrdu: language !== 'english',
              sourceType: source_type !== 'all' ? source_type : undefined,
              limit: 100,
              random: false,
              shuffle: false
            },
            timeout: 30000
          });
          
          const questionsForType = response.data || [];
          console.log(`Found ${questionsForType.length} ${type.value} questions`);
          
          if (questionsForType.length > 0) {
            result[type.value] = handleLanguageTranslation(questionsForType, language);
          } else {
            result[type.value] = [];
          }
        } catch (err) {
          console.error(`Error fetching ${type.value} questions:`, err);
          result[type.value] = [];
        }
      }
      
      console.log('Fetch completed successfully');
      console.log('Questions summary:', Object.keys(result).map(k => `${k}: ${result[k].length}`));
      
      setQuestions(result);
      
      const totalQuestions = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);
      if (totalQuestions === 0) {
        setError('No questions found for the selected criteria. Please try different chapters or filters.');
      }
      
    } catch (err) {
      console.error('Error in fetchQuestions:', err);
      setError('Failed to load questions. Please try again.');
      setQuestions({});
    } finally {
      setIsLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [
    subjectId,
    classId,
    chapterIds,
    language,
    source_type,
    questionTypes,
    handleLanguageTranslation,
    activeTypes
  ]);

  useEffect(() => {
    if (subjectId && classId && subjectChapters.length > 0) {
      console.log('Triggering initial fetch...');
      fetchQuestions();
    }
    
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
    };
  }, [subjectId, classId, fetchQuestions, subjectChapters.length]);

  useEffect(() => {
    setSelected(prev => {
      const newSelected = { ...prev };
      let hasChanges = false;
      
      Object.keys(newSelected).forEach(type => {
        const maxCount = requiredCounts[type] || 0;
        if (newSelected[type].length > maxCount) {
          newSelected[type] = newSelected[type].slice(0, maxCount);
          hasChanges = true;
        }
      });
      
      return hasChanges ? newSelected : prev;
    });
  }, [requiredCounts]);

  const toggleQuestionSelection = useCallback((questionId: string, type: string) => {
    setSelected(prev => {
      const newSelected = { ...prev };
      if (!newSelected[type]) newSelected[type] = [];
      
      if (newSelected[type].includes(questionId)) {
        newSelected[type] = newSelected[type].filter(id => id !== questionId);
      } else {
        const maxCount = requiredCounts[type] || Infinity;
        if (newSelected[type].length < maxCount) {
          newSelected[type] = [...newSelected[type], questionId];
        }
      }
      return newSelected;
    });
  }, [requiredCounts]);

  const filteredQuestions = useMemo(() => {
    const allFiltered: Record<string, QuestionWithOptions[]> = {};
    
    questionTypes.forEach(type => {
      const typeQuestions = questions[type.value] || [];
      
      allFiltered[type.value] = typeQuestions.filter(q => {
        const matchesDifficulty = filters.difficulty === 'all' || q.difficulty === filters.difficulty;
        const matchesChapter = filters.chapter === 'all' || q.chapter_id === filters.chapter;
        
        return matchesDifficulty && matchesChapter;
      });
    });
    
    return allFiltered;
  }, [questions, filters, questionTypes]);

  const shuffleQuestions = async (type: string) => {
    setIsShuffling(true);
    
    const availableQuestions = questions[type] || [];
    if (availableQuestions.length === 0) {
      setIsShuffling(false);
      return;
    }
    
    const shuffled = [...availableQuestions]
      .map(q => q.id)
      .sort(() => Math.random() - 0.5);
    
    const needed = requiredCounts[type] || 0;
    
    setSelected(prev => ({
      ...prev,
      [type]: shuffled.slice(0, needed)
    }));
    
    setIsShuffling(false);
  };

  const shuffleAll = async () => {
    setIsShuffling(true);
    
    const newSelected: Record<string, string[]> = { ...selected };
    
    activeTypes.forEach(type => {
      const availableQuestions = questions[type.value] || [];
      if (availableQuestions.length > 0) {
        const shuffled = [...availableQuestions]
          .map(q => q.id)
          .sort(() => Math.random() - 0.5);
        
        const needed = requiredCounts[type.value] || 0;
        newSelected[type.value] = shuffled.slice(0, needed);
      }
    });
    
    setSelected(newSelected);
    setIsShuffling(false);
  };

  const handlePreviousType = () => {
    if (currentTypeIndex > 0) {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      setCurrentTypeIndex(currentTypeIndex - 1);
    }
  };

  const handleNextType = () => {
    if (currentTypeIndex < activeTypes.length - 1) {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      setCurrentTypeIndex(currentTypeIndex + 1);
    } else {
      onAllComplete();
    }
  };

  const selectAllForCurrentType = () => {
    if (!activeTypes[currentTypeIndex]) return;
    
    const currentTypeKey = activeTypes[currentTypeIndex].value;
    const availableQuestions = filteredQuestions[currentTypeKey] || [];
    const maxCount = requiredCounts[currentTypeKey] || Infinity;
    
    const toSelect = availableQuestions
      .slice(0, maxCount)
      .map(q => q.id);
    
    setSelected(prev => ({
      ...prev,
      [currentTypeKey]: toSelect
    }));
  };

  const clearAllForCurrentType = () => {
    if (!activeTypes[currentTypeIndex]) return;
    
    const currentTypeKey = activeTypes[currentTypeIndex].value;
    setSelected(prev => ({
      ...prev,
      [currentTypeKey]: []
    }));
  };

  const handleProceed = () => {
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
    }
    onAllComplete();
  };

  const refreshQuestions = () => {
    fetchInProgressRef.current = false;
    prevFetchParamsRef.current = '';
    fetchAttemptsRef.current = 0;
    fetchQuestions();
  };

  const hasMcqOptions = (question: QuestionWithOptions): boolean => {
    return !!(question.option_a || question.option_b || question.option_c || question.option_d);
  };

  const getMcqOptionText = (question: QuestionWithOptions, optionKey: string): { english: string, urdu: string } => {
    const baseOption = question[`${optionKey}` as keyof QuestionWithOptions] as string || '';
    
    if (language === 'english') {
      return { english: baseOption, urdu: '' };
    } else if (language === 'urdu') {
      const urduField = `${optionKey}_ur` as keyof QuestionWithOptions;
      const urduText = question[urduField] as string || baseOption;
      return { english: '', urdu: urduText };
    } else if (language === 'bilingual') {
      const englishField = `${optionKey}_english` as keyof QuestionWithOptions;
      const urduField = `${optionKey}_urdu` as keyof QuestionWithOptions;
      const englishText = question[englishField] as string || baseOption;
      const urduText = question[urduField] as string || question[`${optionKey}_ur` as keyof QuestionWithOptions] as string || baseOption;
      return { english: englishText, urdu: urduText };
    }
    
    return { english: baseOption, urdu: '' };
  };

  const getQuestionText = (question: QuestionWithOptions) => {
    if (language === 'english') {
      return question.question_text || 'No question text available';
    } else if (language === 'urdu') {
      return question.question_text_urdu || question.question_text_ur || question.question_text || 'No question text available';
    } else if (language === 'bilingual') {
      return {
        english: question.question_text_english || question.question_text || 'No question text available',
        urdu: question.question_text_urdu || question.question_text_ur || 'No Urdu text available'
      };
    }
    return question.question_text || 'No question text available';
  };

  // Custom styles for selected items
  const selectedStyle: React.CSSProperties = {
    backgroundColor: '#000',
    color: '#fff',
    borderColor: '#000',
  };

  return (
    <div className="card mt-2 step-transition">
      <div className="card-body">
        <h2 className="h4 card-title mb-1">Manual Question Selection</h2>
        
        {/* Debug panel }
        {process.env.NODE_ENV === 'development' && (
          <div className="alert alert-info mb-3">
            <h6>Debug Info:</h6>
            <div className="row">
              <div className="col-md-6">
                <small>
                  <strong>Current Type:</strong> {currentType?.value}<br />
                  <strong>MCQ Questions:</strong> {questions['mcq']?.length || 0}<br />
                  <strong>Is Loading:</strong> {isLoading ? 'Yes' : 'No'}<br />
                  <strong>Fetch Attempts:</strong> {fetchAttemptsRef.current}
                </small>
              </div>
              <div className="col-md-6">
                <small>
                  <strong>Active Types:</strong> {activeTypes.length}<br />
                  <strong>Chapters:</strong> {chapterIds.length}<br />
                  <strong>Language:</strong> {language}
                </small>
              </div>
            </div>
          </div>
        )}
        {/* Debug panel */}
        {/* Selection Progress */}
        <div className="card bg-light mb-2">
          <div className="card-body px-1 pb-0 pt-1">
            <div className="d-flex justify-content-between align-items-center mb-1 d-none d-lg-flex">
              {/*<h3 className="h6 card-title mb-0">Selection Progress</h3>*/}

                  {/* Progress indicators */}
            <div className="mb-0">
              <div className="d-flex flex-wrap gap-2">
                {activeTypes.map((type, index) => {
                  const status = getCompletionStatus(type.value);
                  return (
                    <div key={type.value} className="d-flex align-items-center">
                      <div className={`badge ${index === currentTypeIndex ? 'bg-primary' : status.completed ? 'bg-success' : 'bg-secondary'} me-1`}>
                        {index + 1}
                      </div>
                      <small className={index === currentTypeIndex ? 'fw-bold text-primary' : ''}>
                        {type.label} ({status.progress})
                        {status.completed && (
                          <i className="bi bi-check-circle-fill text-success ms-1" style={{ fontSize: '0.8em' }}></i>
                        )}
                      </small>
                      {index < activeTypes.length - 1 && <span className="mx-1">›</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            { /** button grould select alll and shufle all */}
              <div className="btn-group">
                <button 
                  className="btn btn-outline-primary btn-sm"
                  onClick={shuffleAll}
                  disabled={isLoading || isShuffling || activeTypes.length === 0}
                >
                  <i className={`bi bi-shuffle me-1 ${isShuffling ? 'spinning' : ''}`}></i> Shuffle All
                </button>
                <button 
                  className="btn btn-outline-secondary btn-sm"
                  onClick={refreshQuestions}
                  disabled={isLoading}
                >
                  <i className="bi bi-arrow-clockwise me-1"></i> Refresh
                </button>
              </div>
            </div>
            
        
          </div>
        </div>

        {/* Completion Message */}
        {showCompletionMessage && (
          <div className="alert alert-success alert-dismissible fade show mb-1" role="alert">
            <i className="bi bi-check-circle-fill me-2"></i>
            <strong>All questions selected!</strong> Automatically proceeding to next step...
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setShowCompletionMessage(false)}
              aria-label="Close"
            ></button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="alert alert-danger mb-1" role="alert">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-2">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading questions...</span>
            </div>
            <p className="mt-2">Loading questions...</p>
          </div>
        )}

        {/* Filters and Question Selection */}
        {!isLoading && activeTypes.length > 0 && (
          <>
            <div className="row mb-2">
              <div className="col-md-6">
                <label className="form-label mb-0">Difficulty</label>
                <select
                  className="form-select"
                  value={filters.difficulty}
                  onChange={(e) => setFilters(prev => ({ ...prev, difficulty: e.target.value }))}
                >
                  <option value="all">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              
              <div className="col-md-6">
                <label className="form-label mb-0 ">Chapter</label>
                <select
                  className="form-select"
                  value={filters.chapter}
                  onChange={(e) => setFilters(prev => ({ ...prev, chapter: e.target.value }))}
                >
                  <option value="all">All Chapters</option>
                  {subjectChapters.map(chapter => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.chapterNo}. {chapter.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Current Type Selection */}
            {currentType && (
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <div>
                    <h5 className="mb-0">
                      {currentType.label} Questions
                      <span className="badge bg-primary ms-2">
                        {getCompletionStatus(currentType.value).progress}
                      </span>
                      {getCompletionStatus(currentType.value).completed && (
                        <span className="badge bg-success ms-2">
                          <i className="bi bi-check-circle me-1"></i> Complete
                        </span>
                      )}
                    </h5>
                    <small className="text-muted">
                      Select {requiredCounts[currentType.value] || 0} questions
                      {getCompletionStatus(currentType.value).completed && autoAdvance && (
                        <span className="ms-2 text-success">
                          <i className="bi bi-arrow-right me-1"></i>
                          Auto-advancing to next type...
                        </span>
                      )}
                    </small>
                  </div>
                  
                  <div className="btn-group">
                    <button 
                      className="btn btn-outline-secondary btn-sm"
                      onClick={selectAllForCurrentType}
                      disabled={filteredQuestions[currentType.value]?.length === 0}
                    >
                      <i className="bi bi-check-all me-1"></i> Select All
                    </button>
                    <button 
                      className="btn btn-outline-danger btn-sm"
                      onClick={clearAllForCurrentType}
                    >
                      <i className="bi bi-x-circle me-1"></i> Clear
                    </button>
                    <button 
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => shuffleQuestions(currentType.value)}
                      disabled={isShuffling || filteredQuestions[currentType.value]?.length === 0}
                    >
                      <i className={`bi bi-shuffle ${isShuffling ? 'spinning' : ''}`}></i> Shuffle
                    </button>
                  </div>
                </div>

                {/* Questions List */}
                <div className="list-group" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {filteredQuestions[currentType.value]?.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted">No {currentType.label.toLowerCase()} questions found.</p>
                      <button 
                        className="btn btn-outline-primary btn-sm"
                        onClick={refreshQuestions}
                      >
                        <i className="bi bi-arrow-clockwise me-1"></i> Refresh Questions
                      </button>
                    </div>
                  ) : (
                    filteredQuestions[currentType.value]?.map((question, index) => {
                      const isSelected = selected[currentType.value]?.includes(question.id) || false;
                      const questionText = getQuestionText(question);
                      
                      return (
                        <div
                          key={question.id}
                          className={`list-group-item list-group-item-action ${isSelected ? 'active' : ''}`}
                          onClick={() => toggleQuestionSelection(question.id, currentType.value)}
                          style={isSelected ? selectedStyle : {}}
                          data-selected={isSelected}
                        >
                          <div className="d-flex align-items-start">
                            <div className="form-check me-3 mt-1 d-none">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={isSelected}
                                onChange={() => toggleQuestionSelection(question.id, currentType.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={isSelected ? { backgroundColor: '#fff', borderColor: '#fff' } : {}}
                              />
                            </div>
                            <div className="flex-grow-1">
                              <div className="d-flex justify-content-between align-items-start mb-1">
                                <div className="badge bg-secondary me-2">
                                  Q{index + 1}
                                </div>
                                <div className="text-muted small">
                                  {question.difficulty && (
                                    <span className="badge bg-info me-2">
                                      {question.difficulty}
                                    </span>
                                  )}
                                  {question.chapter_name && (
                                    <span>Chapter: {question.chapter_name}</span>
                                  )}
                                  {currentType.value === 'mcq' && (
                                    <span className="badge bg-warning ms-2">MCQ</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Question Text */}
                              <div className="mb-2">
                                {language === 'english' && (
                                  <div className="question-text" style={isSelected ? { color: '#fff' } : {}}>
                                    {typeof questionText === 'string' ? questionText : questionText.english}
                                  </div>
                                )}
                                {language === 'urdu' && (
                                  <div 
                                    className="question-text urdu-text" 
                                    style={{ 
                                      direction: 'rtl', 
                                      textAlign: 'right',
                                      ...(isSelected ? { color: '#fff' } : {})
                                    }}
                                  >
                                    {typeof questionText === 'string' ? questionText : questionText.urdu}
                                  </div>
                                )}
                                {language === 'bilingual' && (
                                  <div className="bilingual-text">
                                    <div className="english-version mb-2" style={isSelected ? { color: '#fff' } : {}}>
                                       {typeof questionText === 'object' ? questionText.english : questionText}
                                    </div>
                                    <div 
                                      className="urdu-version" 
                                      style={{ 
                                        direction: 'rtl', 
                                        textAlign: 'right',
                                        ...(isSelected ? { color: '#fff' } : {})
                                      }}
                                    >
                                       {typeof questionText === 'object' ? questionText.urdu : questionText}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* MCQ Options - FIXED: English and Urdu in same line for bilingual */}
                              {currentType.value === 'mcq' && (
                                <div className="mt-3">
                                  <div className="row g-2">
                                    {['option_a', 'option_b', 'option_c', 'option_d'].map((optionKey, idx) => {
                                      const { english, urdu } = getMcqOptionText(question, optionKey);
                                      const hasOptionText = english || urdu;
                                      
                                      if (!hasOptionText) return null;
                                      
                                      const letter = ['A', 'B', 'C', 'D'][idx];
                                      
                                      return (
                                        <div key={optionKey} className="col-12 col-md-6">
                                          <div 
                                            className="border rounded p-2" 
                                            style={isSelected ? { 
                                              backgroundColor: '#333', 
                                              borderColor: '#555',
                                              color: '#fff'
                                            } : { backgroundColor: '#f8f9fa' }}
                                          >
                                            <div className="d-flex align-items-start">
                                              <span 
                                                className="badge me-2"
                                                style={isSelected ? { backgroundColor: '#666' } : { backgroundColor: '#0d6efd' }}
                                              >
                                                {letter}
                                              </span>
                                              <div className="flex-grow-1">
                                                {language === 'english' && english && (
                                                  <span style={isSelected ? { color: '#fff' } : {}}>{english}</span>
                                                )}
                                                {language === 'urdu' && urdu && (
                                                  <span 
                                                    className="urdu-text" 
                                                    style={{ 
                                                      direction: 'rtl', 
                                                      display: 'block',
                                                      ...(isSelected ? { color: '#fff' } : {})
                                                    }}
                                                  >
                                                    {urdu}
                                                  </span>
                                                )}
                                                {language === 'bilingual' && (
                                                  <div className="d-flex justify-content-between align-items-center w-100">
                                                    {english && (
                                                      <div 
                                                        className="english-option me-2"
                                                        style={isSelected ? { color: '#fff' } : {}}
                                                      >
                                                        {english}
                                                      </div>
                                                    )}
                                                    {urdu && (
                                                      <div 
                                                        className="urdu-option text-end"
                                                        style={{ 
                                                          direction: 'rtl',
                                                          flex: 1,
                                                          ...(isSelected ? { color: '#fff' } : {})
                                                        }}
                                                      >
                                                        {urdu}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {!hasMcqOptions(question) && (
                                    <div 
                                      className="alert mt-2 py-1"
                                      style={isSelected ? { 
                                        backgroundColor: '#444', 
                                        borderColor: '#666',
                                        color: '#fff'
                                      } : {}}
                                    >
                                      <small>
                                        <i className="bi bi-exclamation-triangle me-1"></i> 
                                        This MCQ question has no options defined.
                                      </small>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="d-flex justify-content-between mt-4">
              <button 
                className="btn btn-outline-primary"
                onClick={handlePreviousType}
                disabled={currentTypeIndex === 0 || isLoading}
              >
                <i className="bi bi-arrow-left me-2"></i>
                Previous Type
              </button>
              
              <div>
                <span className="me-3">
                  Type {currentTypeIndex + 1} of {activeTypes.length}
                  {getCompletionStatus(currentType?.value || '').completed && (
                    <span className="badge bg-success ms-2">
                      <i className="bi bi-check-circle me-1"></i> Completed
                    </span>
                  )}
                </span>
                <button 
                  className="btn btn-primary"
                  onClick={handleNextType}
                  disabled={!currentType || isLoading}
                >
                  {currentTypeIndex === activeTypes.length - 1 ? (
                    <>
                      Finish Selection <i className="bi bi-check-lg ms-2"></i>
                    </>
                  ) : (
                    <>
                      Next Type <i className="bi bi-arrow-right ms-2"></i>
                    </>
                  )}
                </button>
                {activeTypes.every(type => getCompletionStatus(type.value).completed) && (
                  <button 
                    className="btn btn-success ms-2"
                    onClick={handleProceed}
                  >
                    Proceed Now <i className="bi bi-arrow-right ms-2"></i>
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* No Active Types Message */}
        {!isLoading && activeTypes.length === 0 && (
          <div className="text-center py-5">
            <div className="alert alert-warning mb-4">
              <h4 className="alert-heading">No Question Types Selected</h4>
              <p className="mb-0">
                Please go back and select at least one question type with count greater than 0.
              </p>
            </div>
            <button 
              className="btn btn-primary btn-lg"
              onClick={onAllComplete}
            >
              Continue to Next Step <i className="bi bi-arrow-right ms-2"></i>
            </button>
          </div>
        )}
      </div>

      {/* CSS for selected state */}
      <style jsx>{`
        .list-group-item.active {
          background-color: #1BA79A !important;
          border-color: #08408D !important;
          color: #000 !important;
        }
        
        .list-group-item.active .badge:not(.bg-primary):not(.bg-success):not(.bg-info):not(.bg-warning) {
          background-color: #CFF4FC !important;
          color: #000 !important;
        }
        
        .list-group-item.active .text-muted {
          color: #000 !important;
        }
        
        .list-group-item.active .alert-warning {
          background-color: #CFF4FC !important;
          border-color: #666 !important;
          color: #000 !important;
        }
      `}</style>
    </div>
  );
};