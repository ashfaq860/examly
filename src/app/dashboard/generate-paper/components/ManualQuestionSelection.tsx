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
  autoAdvance?: boolean; // New prop for auto-advance feature
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
  autoAdvance = true, // Default to auto-advance enabled
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

  const questionTypes = getQuestionTypesLocal();

  const [questions, setQuestions] = useState<Record<string, Question[]>>({});
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
  
  // Add refs for request management and state tracking
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchParamsRef = useRef<string>('');
  const prevSelectedRef = useRef<Record<string, string[]>>({});
  const prevRequiredCountsRef = useRef<Record<string, number>>({});
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const completionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Compute required counts without triggering unnecessary updates
  const computedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Set counts from props
    counts['mcq'] = mcqCount || 0;
    counts['short'] = shortCount || 0;
    counts['long'] = longCount || 0;

    // Set counts from typeCounts if available
    if (typeCounts) {
      Object.keys(typeCounts).forEach(k => {
        counts[k] = typeCounts[k] || 0;
      });
    } else {
      // Fallback: try to get from question types
      questionTypes.forEach(type => {
        if (counts[type.value] === undefined) {
          counts[type.value] = 0;
        }
      });
    }
    
    return counts;
  }, [questionTypes, mcqCount, shortCount, longCount, typeCounts]);

  // Update required counts only when they actually change
  useEffect(() => {
    const countsChanged = JSON.stringify(computedCounts) !== JSON.stringify(prevRequiredCountsRef.current);
    
    if (countsChanged) {
      setRequiredCounts(computedCounts);
      prevRequiredCountsRef.current = computedCounts;
    }
  }, [computedCounts]);

  // Initialize selected state for all question types - only on mount
  useEffect(() => {
    const initialSelected: Record<string, string[]> = {};
    const initialQuestions: Record<string, Question[]> = {};
    
    questionTypes.forEach(type => {
      initialSelected[type.value] = [];
      initialQuestions[type.value] = [];
    });
    
    setSelected(initialSelected);
    setQuestions(initialQuestions);
    setCurrentTypeIndex(0);
    prevSelectedRef.current = initialSelected;
    
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-initialize when question types change significantly
  useEffect(() => {
    if (Object.keys(selected).length === 0 && Object.keys(questions).length === 0) {
      const initialSelected: Record<string, string[]> = {};
      const initialQuestions: Record<string, Question[]> = {};
      
      questionTypes.forEach(type => {
        initialSelected[type.value] = [];
        initialQuestions[type.value] = [];
      });
      
      setSelected(initialSelected);
      setQuestions(initialQuestions);
      setCurrentTypeIndex(0);
      prevSelectedRef.current = initialSelected;
    }
  }, [questionTypes, selected, questions]);
  
  // Filter active types (those with required count > 0)
  const activeTypes = useMemo(() => {
    return questionTypes.filter(type => requiredCounts[type.value] > 0);
  }, [questionTypes, requiredCounts]);

  // Get current type
  const currentType = activeTypes[currentTypeIndex];

  // Get completion status for a type
  const getCompletionStatus = (type: string) => {
    const required = requiredCounts[type] || 0;
    const selectedCount = selected[type]?.length || 0;
    return {
      completed: required === 0 || selectedCount >= required,
      progress: required === 0 ? `${selectedCount}` : `${selectedCount}/${required}`,
      remaining: Math.max(0, required - selectedCount)
    };
  };

  // Auto-advance to next type when current type is completed
  useEffect(() => {
    if (!currentType || !autoAdvance) return;
    
    const currentTypeKey = currentType.value;
    const currentCompletionStatus = getCompletionStatus(currentTypeKey);
    
    // If current type is completed and there are more types, auto-advance
    if (currentCompletionStatus.completed && currentTypeIndex < activeTypes.length - 1) {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
      
      autoAdvanceTimerRef.current = setTimeout(() => {
        setCurrentTypeIndex(prev => prev + 1);
        autoAdvanceTimerRef.current = null;
      }, 800); // 0.8 second delay for user to see completion
    }
    
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [selected, currentTypeIndex, currentType, activeTypes.length, autoAdvance]);

  // Check if all types are complete and automatically proceed to next step
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
        
        // Wait a moment to show completion message, then proceed
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

  // Notify parent of selected questions - only when selection actually changes
  useEffect(() => {
    const selectionChanged = JSON.stringify(selected) !== JSON.stringify(prevSelectedRef.current);
    
    if (selectionChanged) {
      prevSelectedRef.current = selected;
      onQuestionsSelected(selected);
    }
  }, [selected, onQuestionsSelected]);

  // Get chapters for current subject
  const subjectChapters = useMemo(() => {
    return chapters.filter(chapter => chapter.subject_id === subjectId && chapter.class_id === classId);
  }, [chapters, subjectId, classId]);

  // Get chapter IDs based on selection
  const getChapterIdsToUse = useCallback((): string[] => {
    if (subjectChapters.length === 0) {
      return [];
    }
    
    let chapterIds: string[] = [];
    
    if (chapterOption === 'full_book') {
      chapterIds = subjectChapters.map(c => c.id);
    } else if (chapterOption === 'half_book') {
      const halfIndex = Math.ceil(subjectChapters.length / 2);
      chapterIds = subjectChapters.slice(0, halfIndex).map(c => c.id);
    } else if (chapterOption === 'single_chapter' && selectedChapters && selectedChapters.length > 0) {
      chapterIds = [selectedChapters[0]]; // Take first if multiple
    } else if (chapterOption === 'custom' && selectedChapters && selectedChapters.length > 0) {
      chapterIds = selectedChapters;
    } else {
      return [];
    }
    
    return chapterIds.filter(id => id); // Remove any falsy values
  }, [chapterOption, selectedChapters, subjectChapters]);

  // Handle language translation
  const handleLanguageTranslation = useCallback((questions: Question[], language: string) => {
    return questions.map(question => {
      const translatedQuestion = { ...question };
      
      if (language !== 'english') {
        const isBi = language === 'bilingual';
        
        // Translate question text
        if (question.question_text_ur) {
          if (isBi) {
            (translatedQuestion as any).question_text_english = question.question_text;
            (translatedQuestion as any).question_text_urdu = question.question_text_ur;
          } else {
            translatedQuestion.question_text = question.question_text_ur;
          }
        }
        
        // Translate MCQ options
        if (question.question_type === 'mcq') {
          const options = ['option_a', 'option_b', 'option_c', 'option_d'];
          options.forEach(opt => {
            const urduField = `${opt}_ur`;
            if (question[urduField]) {
              if (isBi) {
                (translatedQuestion as any)[`${opt}_english`] = question[opt];
                (translatedQuestion as any)[`${opt}_urdu`] = question[urduField];
              } else {
                translatedQuestion[opt] = question[urduField];
              }
            }
          });
        }
      }
      
      return translatedQuestion;
    });
  }, []);

  // Cancel any ongoing requests
  const cancelPendingRequests = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }
  }, []);

  // Fetch questions for all types with proper debouncing
  const fetchQuestions = useCallback(async () => {
    if (!subjectId || !classId) {
      console.log('Missing subjectId or classId:', { subjectId, classId });
      return;
    }

    const chapterIds = getChapterIdsToUse();
    
    // Create a unique key for this fetch request
    const fetchKey = JSON.stringify({
      subjectId,
      classId,
      chapterIds: chapterIds.sort(),
      language,
      source_type,
      questionTypes: questionTypes.map(t => t.value).sort()
    });

    // If we're already fetching with the same parameters, skip
    if (lastFetchParamsRef.current === fetchKey) {
      console.log('Skipping duplicate fetch request');
      return;
    }

    console.log('Fetching questions with:', {
      subjectId,
      classId,
      chapterIds: chapterIds.length,
      chapterOption,
      language,
      source_type,
      questionTypes: questionTypes.map(t => t.value)
    });

    if (chapterIds.length === 0) {
      console.log('No chapters selected');
      setError('Please select at least one chapter');
      setQuestions({});
      return;
    }

    // Cancel any pending requests
    cancelPendingRequests();

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    lastFetchParamsRef.current = fetchKey;

    try {
      setIsLoading(true);
      setError(null);
      
      const result: Record<string, Question[]> = {};
      
      // Fetch questions for each type with delay to avoid overloading
      for (let i = 0; i < questionTypes.length; i++) {
        const type = questionTypes[i];
        
        // Add small delay between requests
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
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
            signal: abortControllerRef.current?.signal,
            timeout: 30000 // 30 second timeout
          });
          
          const questionsForType = response.data || [];
          console.log(`Found ${questionsForType.length} ${type.value} questions`);
          
          if (questionsForType.length > 0) {
            result[type.value] = handleLanguageTranslation(questionsForType, language);
          } else {
            result[type.value] = [];
          }
        } catch (err) {
          if (axios.isCancel(err)) {
            console.log(`Fetch for ${type.value} was cancelled`);
          } else {
            console.error(`Error fetching ${type.value} questions:`, err);
            result[type.value] = [];
          }
        }
      }
      
      console.log('All questions fetched:', Object.keys(result).map(k => `${k}: ${result[k].length}`));
      setQuestions(result);
      
      // If no questions found, show error
      const totalQuestions = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);
      if (totalQuestions === 0) {
        setError('No questions found for the selected criteria. Please try different chapters or filters.');
      }
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log('Fetch request was cancelled');
      } else {
        console.error('Error fetching questions:', err);
        setError('Failed to load questions. Please try again.');
        setQuestions({});
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [
    subjectId,
    classId,
    getChapterIdsToUse,
    language,
    source_type,
    questionTypes,
    handleLanguageTranslation,
    chapterOption,
    cancelPendingRequests
  ]);

  // Debounced fetch function
  const debouncedFetchQuestions = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    fetchTimeoutRef.current = setTimeout(() => {
      fetchQuestions();
    }, 300); // 300ms debounce
  }, [fetchQuestions]);

  // Fetch questions when component mounts or dependencies change
  useEffect(() => {
    if (subjectId && classId && subjectChapters.length > 0) {
      debouncedFetchQuestions();
    }
    
    return () => {
      cancelPendingRequests();
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
    };
  }, [subjectId, classId, debouncedFetchQuestions, subjectChapters.length, cancelPendingRequests]);

  // Adjust selection when required counts change
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

  // Toggle question selection
  const toggleQuestionSelection = useCallback((questionId: string, type: string) => {
    setSelected(prev => {
      const newSelected = { ...prev };
      if (!newSelected[type]) newSelected[type] = [];
      
      if (newSelected[type].includes(questionId)) {
        // Remove if already selected
        newSelected[type] = newSelected[type].filter(id => id !== questionId);
      } else {
        // Add if not at limit
        const maxCount = requiredCounts[type] || Infinity;
        if (newSelected[type].length < maxCount) {
          newSelected[type] = [...newSelected[type], questionId];
        }
      }
      return newSelected;
    });
  }, [requiredCounts]);

  // Filter questions based on selected filters
  const filteredQuestions = useMemo(() => {
    const allFiltered: Record<string, Question[]> = {};
    
    questionTypes.forEach(type => {
      const typeQuestions = questions[type.value] || [];
      
      allFiltered[type.value] = typeQuestions.filter(q => {
        // Filter by difficulty
        const matchesDifficulty = filters.difficulty === 'all' || q.difficulty === filters.difficulty;
        
        // Filter by chapter
        const matchesChapter = filters.chapter === 'all' || q.chapter_id === filters.chapter;
        
        return matchesDifficulty && matchesChapter;
      });
    });
    
    return allFiltered;
  }, [questions, filters, questionTypes]);

  // Shuffle questions for a specific type
  const shuffleQuestions = async (type: string) => {
    setIsShuffling(true);
    
    const availableQuestions = questions[type] || [];
    if (availableQuestions.length === 0) {
      setIsShuffling(false);
      return;
    }
    
    // Shuffle all available questions
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

  // Shuffle all types
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

  // Navigation between types
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
      // If we're on the last type and user clicks next, complete
      onAllComplete();
    }
  };

  // Select all for current type
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

  // Clear all for current type
  const clearAllForCurrentType = () => {
    if (!activeTypes[currentTypeIndex]) return;
    
    const currentTypeKey = activeTypes[currentTypeIndex].value;
    setSelected(prev => ({
      ...prev,
      [currentTypeKey]: []
    }));
  };

  // Manually proceed to next step
  const handleProceed = () => {
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
    }
    onAllComplete();
  };

  // Refresh questions
  const refreshQuestions = () => {
    // Clear the last fetch params to force a new fetch
    lastFetchParamsRef.current = '';
    fetchQuestions();
  };

  return (
    <div className="card mt-4 step-transition">
      <div className="card-body">
        <h2 className="h4 card-title mb-3">Manual Question Selection</h2>
        
        {/* Selection Progress */}
        <div className="card bg-light mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="h6 card-title mb-0">Selection Progress</h3>
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
            
            {/* Progress indicators */}
            <div className="mb-3">
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
          </div>
        </div>

        {/* Completion Message */}
        {showCompletionMessage && (
          <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
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
          <div className="alert alert-danger mb-3" role="alert">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading questions...</span>
            </div>
            <p className="mt-2">Loading questions... (This may take a moment)</p>
            <small className="text-muted">Please don't navigate away while questions are loading.</small>
          </div>
        )}

        {/* Filters */}
        {!isLoading && activeTypes.length > 0 && (
          <>
            <div className="row mb-4">
              <div className="col-md-6">
                <label className="form-label">Difficulty</label>
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
                <label className="form-label">Chapter</label>
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
                <div className="d-flex justify-content-between align-items-center mb-3">
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
                      <p className="text-muted">No questions found for the selected criteria.</p>
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
                      
                      return (
                        <div
                          key={question.id}
                          className={`list-group-item list-group-item-action ${isSelected ? 'active' : ''}`}
                          onClick={() => toggleQuestionSelection(question.id, currentType.value)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="d-flex align-items-start">
                            <div className="form-check me-3 mt-1">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={isSelected}
                                onChange={() => toggleQuestionSelection(question.id, currentType.value)}
                                onClick={(e) => e.stopPropagation()}
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
                                </div>
                              </div>
                              
                              {/* Question Text */}
                              <div className="mb-2">
                                {language === 'english' && (
                                  <div className="question-text">
                                    {question.question_text}
                                  </div>
                                )}
                                {language === 'urdu' && (
                                  <div className="question-text urdu-text" style={{ direction: 'rtl', textAlign: 'right' }}>
                                    {question.question_text_urdu || question.question_text}
                                  </div>
                                )}
                                {language === 'bilingual' && (
                                  <div className="bilingual-text">
                                    <div className="english-version mb-2">
                                      <strong>English:</strong> {question.question_text_english || question.question_text}
                                    </div>
                                    <div className="urdu-version" style={{ direction: 'rtl', textAlign: 'right' }}>
                                      <strong>اردو:</strong> {question.question_text_urdu}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* MCQ Options */}
                              {currentType.value === 'mcq' && question.question_type === 'mcq' && (
                                <div className="mt-3">
                                  <div className="row g-2">
                                    {['option_a', 'option_b', 'option_c', 'option_d'].map((option, idx) => {
                                      const letter = ['A', 'B', 'C', 'D'][idx];
                                      const optionText = question[option];
                                      const urduOptionText = question[`${option}_urdu`];
                                      
                                      if (!optionText) return null;
                                      
                                      return (
                                        <div key={option} className="col-12 col-md-6">
                                          <div className="border rounded p-2 bg-light">
                                            <div className="d-flex align-items-start">
                                              <span className="badge bg-primary me-2">{letter}</span>
                                              <div className="flex-grow-1">
                                                {language === 'english' && (
                                                  <span>{optionText}</span>
                                                )}
                                                {language === 'urdu' && (
                                                  <span className="urdu-text" style={{ direction: 'rtl', display: 'block' }}>
                                                    {urduOptionText || optionText}
                                                  </span>
                                                )}
                                                {language === 'bilingual' && urduOptionText && (
                                                  <div>
                                                    <div>{optionText}</div>
                                                    <div className="urdu-text" style={{ direction: 'rtl' }}>
                                                      {urduOptionText}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
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
    </div>
  );
};