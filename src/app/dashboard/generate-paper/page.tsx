//src/app/dashboard/generate-paper/page.tsx
'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { Class, Subject, Chapter, Question } from '@/types/types';
import AcademyLayout from '@/components/AcademyLayout';
import { useUser } from '@/app/context/userContext';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// Import components
import { TrialStatusSection } from './components/TrialStatusSection';
import { SubscriptionModal } from './components/SubscriptionModal';
import { GenerationProgressModal } from './components/GenerationProgressModal';
import { StepProgress } from './components/StepProgress';
import { ClassSelectionStep } from './components/steps/ClassSelectionStep';
import { SubjectSelectionStep } from './components/steps/SubjectSelectionStep';
import { ChapterSelectionStep } from './components/steps/ChapterSelectionStep';
import { PaperTypeStep } from './components/steps/PaperTypeStep';
import { SelectionMethodStep } from './components/steps/SelectionMethodStep';
import { ReviewStep } from './components/steps/ReviewStep';
import { ManualQuestionSelection } from './components/ManualQuestionSelection';

const supabase = createClientComponentClient();

// Simple API cache
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

const cachedGet = async (url: string) => {
  const cached = apiCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  const response = await axios.get(url);
  apiCache.set(url, { data: response.data, timestamp: Date.now() });
  return response.data;
};

// Form validation schema
const paperSchema = z.object({
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
  mcqPlacement: z.enum(['same_page', 'separate','two_papers']),
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

type PaperFormData = z.infer<typeof paperSchema>;

const isEnglishSubject = (subjects: Subject[], subjectId: string) => {
  const subject = subjects.find(s => s.id === subjectId);
  return subject?.name.toLowerCase() === 'english';
};

const isUrduSubject = (subjects: Subject[], subjectId: string) => {
  const subject = subjects.find(s => s.id === subjectId);
  return subject?.name.toLowerCase() === 'urdu';
};

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

const useDebounce = (value: any, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const GeneratePaperPage = () => {
  const [step, setStep] = useState(1);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingKey, setIsDownloadingKey] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isManualNavigation, setIsManualNavigation] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<Record<string, Question[]>>({});
  const [questionsCache, setQuestionsCache] = useState<Record<string, Record<string, Question[]>>>({});
  const [lastPreviewLoad, setLastPreviewLoad] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  const [generationProgress, setGenerationProgress] = useState({
    percentage: 0,
    message: 'Starting generation...',
    isVisible: false,
    estimatedTimeRemaining: 0,
    startTime: 0
  });

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { trialStatus, isLoading: trialLoading, refreshTrialStatus } = useUser();
  const [isFormInitialized, setIsFormInitialized] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    getValues,
    reset,
    trigger,
  } = useForm<PaperFormData>({
    resolver: zodResolver(paperSchema),
    defaultValues: {
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
      mcqToAttempt: 0,
      shortToAttempt: 0,
      longToAttempt: 0,
      title: '',
      shuffleQuestions: true,
      dateOfPaper: new Date().toISOString().split('T')[0],
    },
  });

  const getQuestionTypes = () => {
    const subjectId = watch('subjectId');
    if (isEnglishSubject(subjects, subjectId)) return englishTypes;
    if (isUrduSubject(subjects, subjectId)) return urduTypes;
    return defaultTypes;
  };

  // Initialize form with profile
  useEffect(() => {
    const initializeFormWithProfile = async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const data = await cachedGet('/api/instituteName');
          let titleValue = 'BISE LAHORE';
          if (data) {
            titleValue = data.profile.institution;
            setValue('title', titleValue);
          }
          setIsFormInitialized(true);
          return;
        } catch (error) {
          console.error(`Error fetching profile (attempt ${attempt}):`, error);
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }
      }
      setValue('title', 'BISE LAHORE');
      setIsFormInitialized(true);
    };

    initializeFormWithProfile();
  }, [setValue]);

  const watchedClassId = watch('classId');
  const watchedSubjectId = watch('subjectId');
  const watchedChapterOption = watch('chapterOption');
  const watchedSelectionMethod = watch('selectionMethod');
  const watchedMcqCount = watch('mcqCount');
  const watchedShortCount = watch('shortCount');
  const watchedLongCount = watch('longCount');
  const watchedPaperType = watch('paperType');
  const watchedLanguage = watch('language');

  const debouncedSubjectId = useDebounce(watchedSubjectId, 500);
  const debouncedClassId = useDebounce(watchedClassId, 500);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();
  }, []);

  // Language restriction based on subject
  useEffect(() => {
    if (watchedSubjectId && subjects.length > 0) {
      const subject = subjects.find(s => s.id === watchedSubjectId);
      if (subject) {
        const subjectName = subject.name.toLowerCase();
        if (subjectName === 'english') {
          setValue('language', 'english');
        } else if (subjectName === 'urdu') {
          setValue('language', 'urdu');
        }
      }
    }
  }, [watchedSubjectId, subjects, setValue]);

  // Check if user can generate paper
  const canGeneratePaper = () => {
    if (!trialStatus) return false;
    
    if (trialStatus.hasActiveSubscription) return true;
    
    if (trialStatus.isTrial && 
        trialStatus.trialEndsAt &&
        trialStatus.trialEndsAt.getTime() > Date.now()) {
      return true;
    }
    
    return false;
  };

  // Fetch classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const data = await cachedGet('/api/classes');
          setClasses(data);
          return;
        } catch (error) {
          console.error(`Error fetching classes (attempt ${attempt}):`, error);
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }
      }
      setClasses([]);
    };
    fetchClasses();
  }, []);

  // Fetch subjects when class changes
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!watchedClassId) {
        setSubjects([]);
        return;
      }
      try {
        const data = await cachedGet(`/api/subjects?classId=${watchedClassId}`);
        setSubjects(data);
      } catch (error) {
        console.error('Error fetching subjects:', error);
      }
    };
    fetchSubjects();
  }, [watchedClassId]);

  // Fetch chapters when subject changes
  useEffect(() => {
    const fetchChapters = async () => {
      if (!watchedSubjectId || !watchedClassId) {
        setChapters([]);
        return;
      }
      try {
        const data = await cachedGet(`/api/chapters?subjectId=${watchedSubjectId}&classId=${watchedClassId}`);
        setChapters(data);
      } catch (error) {
        console.error('Error fetching chapters:', error);
      }
    };
    fetchChapters();
  }, [watchedSubjectId, watchedClassId]);

  // Get chapter IDs to use
  const getChapterIdsToUse = useCallback(() => {
    if (!chapters || chapters.length === 0) {
      return [];
    }
    
    const subjectChapters = chapters.filter(chapter => 
      chapter.subject_id === watchedSubjectId && chapter.class_id === watchedClassId
    );
    
    if (subjectChapters.length === 0) {
      return [];
    }
    
    let selectedChapterIds: string[] = [];
    
    if (watchedChapterOption === 'full_book') {
      selectedChapterIds = subjectChapters.map(c => c.id);
    } else if (watchedChapterOption === 'half_book') {
      const halfIndex = Math.ceil(subjectChapters.length / 2);
      selectedChapterIds = subjectChapters.slice(0, halfIndex).map(c => c.id);
    } else if (watchedChapterOption === 'single_chapter' && watch('selectedChapters') && watch('selectedChapters')!.length > 0) {
      selectedChapterIds = watch('selectedChapters')!;
    } else if (watchedChapterOption === 'custom' && watch('selectedChapters') && watch('selectedChapters')!.length > 0) {
      selectedChapterIds = watch('selectedChapters')!;
    } else {
      return [];
    }
    
    return selectedChapterIds;
  }, [chapters, watchedSubjectId, watchedClassId, watchedChapterOption, watch]);

  const handleLanguageTranslation = (questions: Question[], language: string) => {
    return questions.map(question => {
      const translatedQuestion = { ...question };
      
      if (language !== 'english') {
        const isBi = language === 'bilingual';
        
        if (question.question_text_ur) {
          if (isBi) {
            translatedQuestion.question_text_english = question.question_text;
            translatedQuestion.question_text_urdu = question.question_text_ur;
          } else {
            translatedQuestion.question_text = question.question_text_ur;
          }
        }
        
        if (question.question_type === 'mcq') {
          const options = ['option_a', 'option_b', 'option_c', 'option_d'];
          options.forEach(opt => {
            const urduField = `${opt}_ur`;
            if (question[urduField]) {
              if (isBi) {
                translatedQuestion[`${opt}_english`] = question[opt];
                translatedQuestion[`${opt}_urdu`] = question[urduField];
              } else {
                translatedQuestion[opt] = question[urduField];
              }
            }
          });
        }
      }
      
      return translatedQuestion;
    });
  };

  const loadManualSelectedQuestions = async () => {
    try {
      const language = watch('language');
      const allSelectedIds: string[] = [];
      Object.values(selectedQuestions).forEach(ids => {
        allSelectedIds.push(...ids);
      });
      
      if (allSelectedIds.length === 0) {
        return {};
      }

      const response = await axios.get(`/api/questions`, {
        params: {
          questionIds: allSelectedIds.join(','),
          language: watch('language'),
          includeUrdu: watch('language') !== 'english',
          subjectId: watchedSubjectId,
          classId: watchedClassId
        },
      });

      const allQuestions = response.data || [];
      
      const result: Record<string, Question[]> = {};
      Object.keys(selectedQuestions).forEach(type => {
        const questionsForType = allQuestions.filter(q => 
          selectedQuestions[type].includes(q.id)
        );
        result[type] = handleLanguageTranslation(questionsForType, language);
      });

      return result;
    } catch (error) {
      console.error('Error loading manual questions:', error);
      throw error;
    }
  };

  const loadAutoSelectedQuestions = async (chapterIds: string[], formValues: PaperFormData) => {
    try {
      const language = formValues.language;
      const sourceType = formValues.source_type;
      const availableQuestionTypes = getQuestionTypes(); 

      const fetchRandomQuestionsByType = async (
        questionType: string, 
        count: number,
        chapterIds: string[]
      ) => {
        if (count <= 0) return [];
        
        try {
          const response = await axios.get(`/api/questions`, {
            params: {
              subjectId: watchedSubjectId,
              classId: watchedClassId,
              questionType,
              chapterIds: chapterIds.join(','),
              language,
              includeUrdu: language !== 'english',
              sourceType: sourceType !== 'all' ? sourceType : undefined,
              limit: count * 3,
              random: true,
              shuffle: true
            },
          });
          
          let questions = response.data || [];
          
          if (questions.length < count && sourceType !== 'all') {
            const fallbackResponse = await axios.get(`/api/questions`, {
              params: {
                subjectId: watchedSubjectId,
                classId: watchedClassId,
                questionType,
                chapterIds: chapterIds.join(','),
                language,
                includeUrdu: language !== 'english',
                limit: count * 3,
                random: true,
                shuffle: true
              },
            });
            
            const fallbackQuestions = fallbackResponse.data || [];
            const combinedQuestions = [...questions, ...fallbackQuestions];
            const uniqueQuestions = combinedQuestions.filter((q, index, self) => 
              index === self.findIndex(q2 => q2.id === q.id)
            );
            
            questions = uniqueQuestions;
          }
          
          if (questions.length > 0) {
            const shuffled = [...questions].sort(() => Math.random() - 0.5);
            
            if (chapterIds.length > 1 && shuffled.length >= count) {
              const questionsByChapter: Record<string, Question[]> = {};
              
              shuffled.forEach(question => {
                const chapterId = question.chapter_id;
                if (!questionsByChapter[chapterId]) {
                  questionsByChapter[chapterId] = [];
                }
                questionsByChapter[chapterId].push(question);
              });
              
              const distributedQuestions: Question[] = [];
              const chaptersWithQuestions = Object.keys(questionsByChapter);
              
              if (chaptersWithQuestions.length > 0) {
                let chapterIndex = 0;
                let attempts = 0;
                const maxAttempts = count * 2;
                
                while (distributedQuestions.length < count && attempts < maxAttempts) {
                  const chapterId = chaptersWithQuestions[chapterIndex % chaptersWithQuestions.length];
                  const chapterQuestions = questionsByChapter[chapterId] || [];
                  
                  if (chapterQuestions.length > 0) {
                    const question = chapterQuestions.shift();
                    if (question) {
                      distributedQuestions.push(question);
                    }
                  }
                  
                  chapterIndex++;
                  attempts++;
                  
                  if (chapterIndex >= chaptersWithQuestions.length * 2 && distributedQuestions.length < count) {
                    const remainingQuestions = shuffled.filter(q => 
                      !distributedQuestions.some(dq => dq.id === q.id)
                    );
                    distributedQuestions.push(...remainingQuestions.slice(0, count - distributedQuestions.length));
                    break;
                  }
                }
              }
              
              if (distributedQuestions.length >= count) {
                return distributedQuestions.slice(0, count);
              }
            }
            
            return shuffled.slice(0, count);
          }
          
          return questions.slice(0, count);
        } catch (error) {
          console.error(`Error fetching ${questionType} questions:`, error);
          return [];
        }
      };

      const questionPromises: Promise<Question[]>[] = [];
      const questionTypeOrder = availableQuestionTypes;

      questionTypeOrder.forEach(type => {
        const countField = `${type.fieldPrefix}Count`;
        const count = (formValues as any)[countField] || 0;
        if (count > 0) {
          questionPromises.push(fetchRandomQuestionsByType(type.value as string, count, chapterIds));
        } else {
          questionPromises.push(Promise.resolve([]));
        }
      });

      const results = await Promise.all(questionPromises);

      const result: Record<string, Question[]> = {};
      const questionTypesOrder = availableQuestionTypes;

      questionTypesOrder.forEach((type, index) => {
        result[type.value] = handleLanguageTranslation(results[index] || [], language);
      });

      return result;
    } catch (error) {
      console.error('Error loading auto questions:', error);
      throw error;
    }
  };

  const loadPreviewQuestions = async () => {
    try {
      setIsLoadingPreview(true);
      
      const chapterIds = getChapterIdsToUse();
      
      if (chapterIds.length === 0) {
        setPreviewQuestions({});
        return;
      }

      const formValues = getValues();
      
      let result: Record<string, Question[]>;
      
      if (formValues.selectionMethod === 'manual' && Object.keys(selectedQuestions).some(type => selectedQuestions[type].length > 0)) {
        result = await loadManualSelectedQuestions();
      } else {
        result = await loadAutoSelectedQuestions(chapterIds, formValues);
      }
      
      setPreviewQuestions(result);
      
    } catch (error) {
      console.error('Error loading preview questions:', error);
      alert('Failed to load questions for preview. Please try again.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Force refresh preview when paper type changes
  useEffect(() => {
    if (step === 7 && watchedPaperType) {
      setQuestionsCache({});
      setLastPreviewLoad(null);
      loadPreviewQuestions();
    }
  }, [watchedPaperType]);

  // Fixed useEffect for step 7 loading
  useEffect(() => {
    if (step === 7 && watchedSubjectId && watchedClassId) {
      setQuestionsCache({});
      setLastPreviewLoad(null);
      
      const chapterIds = getChapterIdsToUse();
      
      if (chapterIds.length > 0) {
        setTimeout(() => {
          loadPreviewQuestions();
        }, 100);
      } else {
        setPreviewQuestions({});
      }
    }
  }, [step, watchedSubjectId, watchedClassId]);

  // Listen for form value changes and reload preview
  useEffect(() => {
    if (step === 7) {
      const timer = setTimeout(() => {
        loadPreviewQuestions();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [watchedMcqCount, watchedShortCount, watchedLongCount, watchedPaperType, step]);

  // Additional effect to reload when question counts change while on step 7
  useEffect(() => {
    if (step === 7) {
      const timer = setTimeout(() => {
        loadPreviewQuestions();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [watchedMcqCount, watchedShortCount, watchedLongCount, step]);

  // Auto-advance steps when selections are made
  useEffect(() => {
    if (step === 1 && watchedClassId) {
      setTimeout(() => setStep(2), 300);
    }
  }, [watchedClassId, step]);

  useEffect(() => {
    if (step === 2 && watchedSubjectId && !isManualNavigation) {
      setTimeout(() => setStep(3), 300);
    }
  }, [watchedSubjectId, step, isManualNavigation]);

  const startProgressSimulation = () => {
    const startTime = Date.now();
    setGenerationProgress({
      percentage: 0,
      message: 'Starting paper generation...',
      isVisible: true,
      estimatedTimeRemaining: 20,
      startTime
    });

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    let currentStep = 0;
    progressIntervalRef.current = setInterval(() => {
      setGenerationProgress(prev => {
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        let estimatedTotalTime = 20;
        let progressPerSecond = 100 / estimatedTotalTime;
        let newPercentage = Math.min(95, Math.floor(elapsedSeconds * progressPerSecond));
        
        const serverProgressSteps = [
          { percentage: 5, message: 'Authenticating user...' },
          { percentage: 10, message: 'Calculating total marks...' },
          { percentage: 15, message: 'Creating paper record...' },
          { percentage: 20, message: 'Finding MCQ questions...' },
          { percentage: 30, message: 'Finding short answer questions...' },
          { percentage: 45, message: 'Finding long answer questions...' },
          { percentage: 55, message: 'Inserting questions into paper...' },
          { percentage: 65, message: 'Generating HTML content...' },
          { percentage: 75, message: 'Creating PDF...' },
          { percentage: 85, message: 'Finalizing paper...' },
          { percentage: 95, message: 'Preparing download...' },
          { percentage: 100, message: 'Paper generated successfully!' }
        ];
        
        const currentStep = serverProgressSteps.find(step => step.percentage > newPercentage) || 
                          serverProgressSteps[serverProgressSteps.length - 1];
        const newMessage = currentStep?.message || prev.message;
        
        const estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedSeconds);
        
        return {
          ...prev,
          percentage: newPercentage,
          message: newMessage,
          estimatedTimeRemaining
        };
      });
    }, 500);
  };

  const stopProgressSimulation = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopProgressSimulation();
    };
  }, []);

  const handleDownloadKey = async () => {
    setIsDownloadingKey(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in to download the MCQ key.');
        return;
      }

      const formValues = getValues();
      const payload = {
        subjectId: watchedSubjectId,
        selectedChapters: formValues.selectedChapters || [],
        mcqCount: formValues.mcqCount,
        selectionMethod: formValues.selectionMethod,
        chapterOption: formValues.chapterOption,
        paperTitle: formValues.title,
        mcqDifficulty: formValues.mcqDifficulty,
        sourceType: formValues.source_type,
        difficultyDistribution: {
          easy: formValues.easyPercent,
          medium: formValues.mediumPercent,
          hard: formValues.hardPercent
        },
        shuffleQuestions: formValues.shuffleQuestions,
        selectedQuestions: formValues.selectionMethod === "manual" ? selectedQuestions : undefined,
        randomSeed: Date.now(),
        reorderedQuestions: previewQuestions
      };

      const response = await fetch("/api/generate-mcq-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${payload.paperTitle.replace(/[^a-z0-9]/gi, '_')}-key.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const err = await response.json();
        alert("Failed: " + (err.message || 'Unknown error'));
      }
    } catch (error) {
      console.error("Error downloading MCQ key:", error);
      alert("Failed to download MCQ key.");
    } finally {
      setIsDownloadingKey(false);
    }
  };

  const prevStep = () => {
    if (step === 2) {
      setValue('classId', '');
      setValue('subjectId', '');
      setSubjects([]);
      setChapters([]);
      setStep(1);
    } else if (step === 3) {
      setIsManualNavigation(true);
      setValue('chapterOption', 'full_book');
      setValue('selectedChapters', []);
      setStep(2);
      setTimeout(() => setIsManualNavigation(false), 1000);
    } else if (step === 4) {
      setStep(3);
    } else if (step === 5) {
      setStep(4);
    } else if (step === 6) {
      setStep(5);
    } else if (step === 7) {
      if (watchedSelectionMethod === 'manual') {
        setStep(6);
      } else {
        setStep(5);
      }
    }
  };

  // FIXED: onSubmit with proper progress simulation
// FIXED: onSubmit function with proper handling of all question types
const onSubmit = async (formData: PaperFormData) => {
  // Validate two_papers layout before anything else
  if (formData.mcqPlacement === 'two_papers') {
    const totalQuestions = formData.mcqCount + formData.shortCount + formData.longCount;
    if (totalQuestions > 15) {
      alert(`Two Papers Layout: Maximum 15 total questions allowed. You have ${totalQuestions}. Please adjust your question counts.`);
      return;
    }
  }

  if (!canGeneratePaper()) {
    setShowSubscriptionModal(true);
    return;
  }

  // Start progress simulation
  startProgressSimulation();
  setIsLoading(true);

  try {
    // 1. Get current session with error handling
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      stopProgressSimulation();
      setGenerationProgress({
        percentage: 0,
        message: 'Authentication error. Please try again.',
        isVisible: false,
        estimatedTimeRemaining: 0,
        startTime: 0
      });
      setIsLoading(false);
      alert('Authentication error. Please try logging in again.');
      window.location.href = '/login';
      return;
    }

    if (!session) {
      console.error('No session found');
      stopProgressSimulation();
      setGenerationProgress({
        percentage: 0,
        message: 'Session expired. Please log in again.',
        isVisible: false,
        estimatedTimeRemaining: 0,
        startTime: 0
      });
      setIsLoading(false);
      alert('Your session has expired. Please log in again.');
      window.location.href = '/login';
      return;
    }

    const user = session.user;
    let accessToken = session.access_token;

    // 2. Check token validity and refresh if needed
    if (!accessToken || accessToken.split('.').length !== 3) {
      console.warn('Invalid or missing access token, attempting refresh...');
      try {
        const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('Token refresh error:', refreshError);
          throw new Error('Token refresh failed');
        }
        
        if (!refreshedSession?.session) {
          throw new Error('No session after refresh');
        }
        
        accessToken = refreshedSession.session.access_token;
        console.log('Token refreshed successfully');
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        stopProgressSimulation();
        setGenerationProgress({
          percentage: 0,
          message: 'Session refresh failed.',
          isVisible: false,
          estimatedTimeRemaining: 0,
          startTime: 0
        });
        setIsLoading(false);
        alert('Your session has expired. Please log in again.');
        window.location.href = '/login';
        return;
      }
    }

    // 3. Validate token format
    if (!accessToken || accessToken.split('.').length !== 3) {
      console.error('Invalid token format');
      stopProgressSimulation();
      setGenerationProgress({
        percentage: 0,
        message: 'Invalid authentication token.',
        isVisible: false,
        estimatedTimeRemaining: 0,
        startTime: 0
      });
      setIsLoading(false);
      alert('Authentication token is invalid. Please log in again.');
      window.location.href = '/login';
      return;
    }

    const randomSeed = Date.now();
    
    // Get chapter IDs for validation
    const chapterIds = getChapterIdsToUse();
    
    // Validate we have chapters
    if (chapterIds.length === 0) {
      stopProgressSimulation();
      setGenerationProgress({
        percentage: 0,
        message: 'No chapters found.',
        isVisible: false,
        estimatedTimeRemaining: 0,
        startTime: 0
      });
      setIsLoading(false);
      alert('No chapters found for the selected subject and class. Please check your selection.');
      return;
    }

    // Validate we're requesting questions
    if (formData.mcqCount === 0 && formData.shortCount === 0 && formData.longCount === 0) {
      stopProgressSimulation();
      setGenerationProgress({
        percentage: 0,
        message: 'No questions selected.',
        isVisible: false,
        estimatedTimeRemaining: 0,
        startTime: 0
      });
      setIsLoading(false);
      alert('Please select at least one question type with count greater than 0.');
      return;
    }

    // Validate attempt counts for ALL question types
    const allQuestionTypes = getQuestionTypes();
    let hasInvalidAttemptCount = false;
    let invalidType = '';
    
    allQuestionTypes.forEach(type => {
      const countField = `${type.fieldPrefix}Count`;
      const attemptField = `${type.fieldPrefix}ToAttempt`;
      
      const count = (formData as any)[countField] || 0;
      const attempt = (formData as any)[attemptField] || 0;
      
      if (attempt > count) {
        hasInvalidAttemptCount = true;
        invalidType = type.label;
      }
    });
    
    if (hasInvalidAttemptCount) {
      stopProgressSimulation();
      setGenerationProgress({
        percentage: 0,
        message: 'Invalid attempt values.',
        isVisible: false,
        estimatedTimeRemaining: 0,
        startTime: 0
      });
      setIsLoading(false);
      alert(`Please fix the 'To Attempt' value for ${invalidType}. It cannot exceed 'Total Qs'.`);
      return;
    }

    // Debug log to verify form data
    console.log('🎯 Debug - Form submission details:', {
      mcqPlacement: formData.mcqPlacement,
      isTwoPapers: formData.mcqPlacement === 'two_papers',
      questionCounts: {
        mcq: formData.mcqCount,
        short: formData.shortCount,
        long: formData.longCount,
        total: formData.mcqCount + formData.shortCount + formData.longCount
      },
      attemptCounts: {
        mcq: formData.mcqToAttempt,
        short: formData.shortToAttempt,
        long: formData.longToAttempt
      },
      timeSettings: {
        timeMinutes: formData.timeMinutes,
        mcqTimeMinutes: formData.mcqTimeMinutes,
        subjectiveTimeMinutes: formData.subjectiveTimeMinutes
      },
      layoutLimits: formData.mcqPlacement === 'two_papers' ? 'Max 15 questions' : 'No limit'
    });

    // Prepare selected questions based on current preview order
    const selectedQuestionsFromPreview: Record<string, string[]> = {};
    Object.keys(previewQuestions).forEach(type => {
      selectedQuestionsFromPreview[type] = previewQuestions[type].map(q => q.id);
    });

    // CRITICAL FIX: Extract "to attempt" values for ALL question types
    const toAttemptValues: Record<string, number> = {};
    const customMarksData: Record<string, Array<{questionId: string, marks: number}>> = {};

    // Get all question types and their toAttempt values
    allQuestionTypes.forEach(type => {
      const fieldPrefix = type.fieldPrefix;
      const typeValue = type.value;
      
      // Get the "to attempt" value for this question type
      const toAttemptField = `${fieldPrefix}ToAttempt`;
      const countField = `${fieldPrefix}Count`;
      const marksField = `${fieldPrefix}Marks`;
      
      // Use toAttempt if provided, otherwise fall back to count
      const toAttemptValue = (formData as any)[toAttemptField] !== undefined 
        ? (formData as any)[toAttemptField] 
        : (formData as any)[countField] || 0;
      
      const marksValue = (formData as any)[marksField] || 
        (typeValue === 'mcq' ? formData.mcqMarks :
         typeValue === 'short' ? formData.shortMarks :
         typeValue === 'long' ? formData.longMarks : 2);
      
      // Store the toAttempt value
      toAttemptValues[typeValue] = toAttemptValue;
      
      // Prepare custom marks data for this question type
      const questionsOfType = previewQuestions[typeValue] || [];
      if (questionsOfType.length > 0) {
        customMarksData[typeValue] = questionsOfType.map(q => ({
          questionId: q.id,
          marks: q.customMarks || marksValue
        }));
      }
      
      console.log(`📊 ${type.label} - To Attempt: ${toAttemptValue}, Count: ${(formData as any)[countField] || 0}, Marks: ${marksValue}`);
    });

    // Log all toAttempt values for debugging
    console.log('📋 All To Attempt Values:', toAttemptValues);
    console.log('📋 Custom Marks Data:', customMarksData);

    // Calculate total time based on layout
    let totalTimeMinutes = formData.timeMinutes;
    if (formData.mcqPlacement === 'separate') {
      // For separate layout, sum objective and subjective times
      totalTimeMinutes = (formData.mcqTimeMinutes || 0) + (formData.subjectiveTimeMinutes || 0);
    }

    // Prepare questions with custom marks for PDF generation
    const questionsWithCustomMarks: Record<string, any[]> = {};
    Object.keys(previewQuestions).forEach(type => {
      const questionType = allQuestionTypes.find(t => t.value === type);
      let defaultMarks = formData.mcqMarks;
      if (type === 'short') defaultMarks = formData.shortMarks;
      if (type === 'long') defaultMarks = formData.longMarks;
      // For other types, try to get from questionType configuration
      if (questionType) {
        const marksField = `${questionType.fieldPrefix}Marks`;
        defaultMarks = (formData as any)[marksField] || defaultMarks;
      }
      
      questionsWithCustomMarks[type] = previewQuestions[type].map(q => {
        return {
          ...q,
          marks: q.customMarks || defaultMarks,
          defaultMarks: defaultMarks
        };
      });
    });

    // CRITICAL: Calculate total marks based on "to attempt" values
    let totalMarksFromToAttempt = 0;
    const marksByType: Record<string, number> = {};
    
    allQuestionTypes.forEach(type => {
      const typeValue = type.value;
      const questionsOfType = questionsWithCustomMarks[typeValue] || [];
      const toAttemptForType = toAttemptValues[typeValue] || 0;
      
      // Get default marks for this type
      let defaultMarks = formData.mcqMarks;
      if (typeValue === 'short') defaultMarks = formData.shortMarks;
      if (typeValue === 'long') defaultMarks = formData.longMarks;
      
      // Get custom marks from the customMarksData
      const customMarksForType = customMarksData[typeValue] || [];
      
      // Calculate marks for the questions that will be attempted
      const attemptedQuestions = questionsOfType.slice(0, toAttemptForType);
      const typeMarks = attemptedQuestions.reduce((total, q, index) => {
        const customMark = customMarksForType[index]?.marks || q.marks || defaultMarks;
        return total + customMark;
      }, 0);
      
      marksByType[typeValue] = typeMarks;
      totalMarksFromToAttempt += typeMarks;
      
      console.log(`📈 ${type.label} Marks: ${typeMarks} (${toAttemptForType} attempted)`);
    });

    console.log('🎯 Total Marks from To Attempt:', totalMarksFromToAttempt);
    console.log('🎯 Marks by Type:', marksByType);

    // Prepare the payload with all layout support
    const payload = {
      ...formData,
      // Ensure mcqPlacement is properly included
      mcqPlacement: formData.mcqPlacement,
      // Handle time fields properly for all layouts
      timeMinutes: totalTimeMinutes,
      // For separate layout, keep individual times
      mcqTimeMinutes: formData.mcqPlacement === 'separate' ? formData.mcqTimeMinutes : undefined,
      subjectiveTimeMinutes: formData.mcqPlacement === 'separate' ? formData.subjectiveTimeMinutes : undefined,
      userId: user.id,
      randomSeed,
      // CRITICAL: Include toAttempt values for ALL question types
      mcqToAttempt: toAttemptValues.mcq || formData.mcqCount || 0,
      shortToAttempt: toAttemptValues.short || formData.shortCount || 0,
      longToAttempt: toAttemptValues.long || formData.longCount || 0,
      // Include the complete toAttemptValues object
      toAttemptValues,
      // Include custom marks data
      customMarksData,
      // Include questions with their order and marks
      selectedQuestions: selectedQuestionsFromPreview,
      language: formData.language,
      shuffleQuestions: formData.shuffleQuestions,
      reorderedQuestions: questionsWithCustomMarks,
      // Pass the calculated total marks based on toAttempt
      calculatedTotalMarks: totalMarksFromToAttempt,
      // Pass marks by type for verification
      marksByType,
      questionOrder: Object.keys(previewQuestions).reduce((acc, type) => {
        acc[type] = previewQuestions[type].map((q, index) => {
          const questionType = allQuestionTypes.find(t => t.value === type);
          let defaultMarks = formData.mcqMarks;
          if (type === 'short') defaultMarks = formData.shortMarks;
          if (type === 'long') defaultMarks = formData.longMarks;
          if (questionType) {
            const marksField = `${questionType.fieldPrefix}Marks`;
            defaultMarks = (formData as any)[marksField] || defaultMarks;
          }
          
          return { 
            id: q.id, 
            order: index + 1,
            marks: q.customMarks || defaultMarks 
          };
        });
        return acc;
      }, {} as Record<string, any[]>)
    };

    // Log the final payload for debugging
    console.log('📤 Final Payload for API:', {
      toAttemptValues: payload.toAttemptValues,
      customMarksDataKeys: Object.keys(payload.customMarksData || {}),
      calculatedTotalMarks: payload.calculatedTotalMarks,
      layout: payload.mcqPlacement,
      hasReorderedQuestions: !!payload.reorderedQuestions
    });

    // Prepare headers with token
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
      console.log('🔐 Using token for API request:', {
        tokenLength: accessToken.length,
        tokenPrefix: accessToken.substring(0, 20) + '...'
      });
    } else {
      console.error('No access token available for request');
      stopProgressSimulation();
      setGenerationProgress({
        percentage: 0,
        message: 'Missing authentication token.',
        isVisible: false,
        estimatedTimeRemaining: 0,
        startTime: 0
      });
      setIsLoading(false);
      alert('Authentication token missing. Please log in again.');
      window.location.href = '/login';
      return;
    }

    // Perform the fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 240000); // 4 minute timeout

    let response;
    try {
      response = await fetch("/api/generate-paper", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      stopProgressSimulation();
      
      if (fetchError.name === 'AbortError') {
        console.error('Request timeout');
        setGenerationProgress({
          percentage: 0,
          message: 'Request timed out after 4 minutes.',
          isVisible: false,
          estimatedTimeRemaining: 0,
          startTime: 0
        });
        alert('Request timed out after 4 minutes. Please try again.');
      } else {
        console.error('Fetch error:', fetchError);
        setGenerationProgress({
          percentage: 0,
          message: 'Network error occurred.',
          isVisible: false,
          estimatedTimeRemaining: 0,
          startTime: 0
        });
        alert('Network error. Please check your connection and try again.');
      }
      
      setIsLoading(false);
      return;
    }
    
    clearTimeout(timeoutId);
    
    const contentType = response.headers.get("content-type") || "";
    
    if (response.ok) {
      // Update progress to 100% when response is received
      stopProgressSimulation();
      setGenerationProgress(prev => ({
        ...prev,
        percentage: 100,
        message: 'Paper generated successfully! Downloading PDF...',
        estimatedTimeRemaining: 0
      }));
      
      await refreshTrialStatus();
    }
    
    // Handle API errors
    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      
      console.error('API Error:', {
        status: response.status,
        statusText: response.statusText,
        contentType,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      stopProgressSimulation();
      
      if (contentType.includes('application/json')) {
        try {
          const json = await response.json();
          console.error('API error response JSON:', json);
          
          // Handle authentication errors
          if (response.status === 401 || response.status === 403) {
            if (json.message?.includes('session') || json.error?.includes('Auth') || Object.keys(json).length === 0) {
              setGenerationProgress({
                percentage: 0,
                message: 'Session expired. Please log in again.',
                isVisible: false,
                estimatedTimeRemaining: 0,
                startTime: 0
              });
              alert('Your session has expired. Please log in again.');
              window.location.href = '/login';
            } else {
              setGenerationProgress({
                percentage: 0,
                message: 'Authentication failed.',
                isVisible: false,
                estimatedTimeRemaining: 0,
                startTime: 0
              });
              alert(json.error || json.message || 'Authentication failed.');
            }
          } else {
            setGenerationProgress({
              percentage: 0,
              message: `Server error (${response.status})`,
              isVisible: false,
              estimatedTimeRemaining: 0,
              startTime: 0
            });
            alert(json.error || json.message || `Server error (${response.status})`);
          }
        } catch (jsonError) {
          console.error('Failed to parse JSON error:', jsonError);
          setGenerationProgress({
            percentage: 0,
            message: `Server error (${response.status})`,
            isVisible: false,
            estimatedTimeRemaining: 0,
            startTime: 0
          });
          alert(`Server error (${response.status}). Please try again.`);
        }
      } else {
        try {
          const text = await response.text();
          console.error('API error response text:', text);
          
          if (response.status === 401 || response.status === 403) {
            setGenerationProgress({
              percentage: 0,
              message: 'Authentication failed.',
              isVisible: false,
              estimatedTimeRemaining: 0,
              startTime: 0
            });
            alert('Authentication failed. Please log in again.');
            window.location.href = '/login';
          } else if (text) {
            setGenerationProgress({
              percentage: 0,
              message: text,
              isVisible: false,
              estimatedTimeRemaining: 0,
              startTime: 0
            });
            alert(text);
          } else {
            setGenerationProgress({
              percentage: 0,
              message: `Server error (${response.status})`,
              isVisible: false,
              estimatedTimeRemaining: 0,
              startTime: 0
            });
            alert(`Server error (${response.status}). Please try again.`);
          }
        } catch (textError) {
          console.error('Failed to read error text:', textError);
          setGenerationProgress({
            percentage: 0,
            message: `Server error (${response.status})`,
            isVisible: false,
            estimatedTimeRemaining: 0,
            startTime: 0
          });
          alert(`Server error (${response.status}). Please try again.`);
        }
      }
      
      setIsLoading(false);
      return;
    }
    
    // Handle successful PDF response
    if (response.ok && contentType.includes("application/pdf")) {
      try {
        const blob = await response.blob();
        
        if (blob.size === 0) {
          throw new Error('Empty PDF received');
        }
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `paper-${formData.title?.replace(/[^a-z0-9]/gi, '_') || 'paper'}-${new Date().getTime()}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        
        // Show success message for 2 seconds then hide
        setTimeout(() => {
          setGenerationProgress(prev => ({ ...prev, isVisible: false }));
        }, 2000);
        
      } catch (blobError) {
        console.error('Error processing PDF blob:', blobError);
        setGenerationProgress({
          percentage: 0,
          message: 'Failed to download PDF.',
          isVisible: false,
          estimatedTimeRemaining: 0,
          startTime: 0
        });
        alert('Failed to download PDF. Please try again.');
      }
    } else if (contentType.includes("application/json")) {
      try {
        const result = await response.json();
        setGenerationProgress({
          percentage: 0,
          message: result.error || result.message || 'No PDF returned.',
          isVisible: false,
          estimatedTimeRemaining: 0,
          startTime: 0
        });
        alert(result.error || result.message || "Paper generated, but no PDF was returned.");
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        setGenerationProgress({
          percentage: 0,
          message: 'Unexpected server response.',
          isVisible: false,
          estimatedTimeRemaining: 0,
          startTime: 0
        });
        alert('Server returned unexpected response.');
      }
    } else {
      try {
        const text = await response.text();
        setGenerationProgress({
          percentage: 0,
          message: text || 'Unknown error occurred.',
          isVisible: false,
          estimatedTimeRemaining: 0,
          startTime: 0
        });
        alert(text || "Failed to generate paper (unknown error)");
      } catch (textError) {
        console.error('Failed to read response text:', textError);
        setGenerationProgress({
          percentage: 0,
          message: 'Server error occurred.',
          isVisible: false,
          estimatedTimeRemaining: 0,
          startTime: 0
        });
        alert('Server error occurred. Please try again.');
      }
    }
  } catch (error) {
    console.error('Unexpected error generating paper:', error);
    stopProgressSimulation();
    setGenerationProgress({
      percentage: 0,
      message: 'An unexpected error occurred.',
      isVisible: false,
      estimatedTimeRemaining: 0,
      startTime: 0
    });
    alert("An unexpected error occurred. Please try again.");
  } finally {
    setIsLoading(false);
    
    // Hide progress modal after 3 seconds if still visible
    setTimeout(() => {
      setGenerationProgress(prev => ({ ...prev, isVisible: false }));
    }, 3000);
  }
};

  const handleChapterSelection = (chapterId: string) => {
    if (watchedChapterOption === 'single_chapter') {
      setValue('selectedChapters', [chapterId]);
      setTimeout(() => setStep(4), 300);
    } else if (watchedChapterOption === 'custom') {
      const currentSelected = watch('selectedChapters') || [];
      if (currentSelected.includes(chapterId)) {
        setValue('selectedChapters', currentSelected.filter(id => id !== chapterId));
      } else {
        setValue('selectedChapters', [...currentSelected, chapterId]);
      }
    } else if (watchedChapterOption === 'full_book' || watchedChapterOption === 'half_book') {
      setTimeout(() => setStep(4), 300);
    }
  };

  const calculateTotalMarks = () => {
    const formValues = getValues();
    const questionTypes = getQuestionTypes();
    
    let totalMarks = 0;
    const typeMarks: Record<string, number> = {};
    
    questionTypes.forEach(type => {
      const questions = previewQuestions[type.value] || [];
      const toAttempt = formValues[`${type.fieldPrefix}ToAttempt` as keyof typeof formValues] || 
                       formValues[`${type.fieldPrefix}Count` as keyof typeof formValues] || 0;
      
      const defaultMarks = type.value === 'mcq' ? formValues.mcqMarks :
                          type.value === 'short' ? formValues.shortMarks :
                          type.value === 'long' ? formValues.longMarks : 2;
      
      const marks = questions.length > 0
        ? questions.slice(0, toAttempt as number).reduce((total, q) => total + (q.customMarks || defaultMarks), 0)
        : (toAttempt as number) * defaultMarks;
      
      typeMarks[type.value] = marks;
      totalMarks += marks;
    });
    
    return {
      ...typeMarks,
      total: totalMarks
    };
  };

  return (
    <AcademyLayout>
      <div className="container mx-auto px-0 py-0">
        <style jsx>{`
          .step-transition {
            transition: all 0.3s ease-in-out;
          }
          .option-card {
            transition: all 0.3s ease;
            border: 2px solid transparent;
          }
          .option-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          .option-card.active {
            border-color: #0d6efd;
            background-color: rgba(13, 110, 253, 0.05);
          }
          .bi-shuffle.spinning {
            animation: spin 0.5s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .cursor-grab {
            cursor: grab;
          }
          .cursor-grab:active {
            cursor: grabbing;
          }
          .drag-handle {
            cursor: grab;
          }
          .drag-handle:active {
            cursor: grabbing;
          }
          .question-item {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .question-item.dragging {
            opacity: 0.5;
            transform: scale(0.95);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          }
          .questions-list {
            min-height: 100px;
          }
          .modal-backdrop {
            z-index: 1050 !important;
          }
          .modal {
            z-index: 1055 !important;
          }
          
          @media (max-width: 768px) {
            .mobile-action-buttons {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              z-index: 1000;
              background: white;
              box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
              padding: 10px;
            }
            
            .paper-preview {
              padding: 10px !important;
              font-size: 13px !important;
            }
            
            .bilingual-stacked {
              flex-direction: column !important;
              gap: 8px !important;
            }
            
            .bilingual-stacked .english-version,
            .bilingual-stacked .urdu-version {
              width: 100% !important;
              padding: 0 !important;
            }
            
            .urdu-version {
              margin-bottom: 8px !important;
            }
            
            .questions-preview .question-item {
              padding: 10px !important;
              margin-bottom: 15px !important;
            }
          }
        `}</style>

       

        <GenerationProgressModal progress={generationProgress} />
        {!isAuthenticated && (
          <div className="alert alert-warning mb-2">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Please <a href="/login" className="alert-link">login</a> to generate papers.
          </div>
        )}

        <div style={{ 
          opacity: canGeneratePaper() && isAuthenticated ? 1 : 0.6,
          pointerEvents: canGeneratePaper() && isAuthenticated ? 'auto' : 'none'
        }}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h1 className="h2 mb-0">Generate <span className='d-none d-sm-inline'>New</span> Paper</h1>
            {step > 1 && (
              <button className="btn btn-outline-primary btn-lg" onClick={prevStep}>
                <i className="bi bi-arrow-left me-2"></i>
                <span className="d-inline d-sm-none">Back</span>
                <span className="d-none d-sm-inline">
                  {step === 2 && 'Back to Class Selection'}
                  {step === 3 && 'Back to Subject Selection'}
                  {step === 4 && 'Back to Chapter Selection'}
                  {step === 5 && 'Back to Paper Type'}
                  {step === 6 && 'Back to Selection Method'}
                  {step === 7 && 'Back to Previous Step'}
                </span>
              </button>
            )}
          </div>

         <div className='d-none d-sm-inline'><StepProgress step={step} /></div>

          {/* Step 1: Class selection */}
          {step === 1 && (
            <ClassSelectionStep
              classes={classes}
              watchedClassId={watchedClassId}
              setValue={setValue}
              errors={errors}
            />
          )}

          {/* Step 2: Subject selection */}
          {step === 2 && (
            <SubjectSelectionStep
              subjects={subjects}
              watchedSubjectId={watchedSubjectId}
              watchedClassId={watchedClassId}
              classes={classes}
              setValue={setValue}
              errors={errors}
            />
          )}

          {/* Step 3: Chapter selection */}
          {step === 3 && (
            <ChapterSelectionStep
              chapters={chapters}
              watchedSubjectId={watchedSubjectId}
              watchedChapterOption={watchedChapterOption}
              selectedChapters={watch('selectedChapters') || []}
              subjects={subjects}
              setValue={setValue}
              setStep={setStep}
              watch={watch}
              handleChapterSelection={handleChapterSelection}
            />
          )}

          {/* Step 4: Paper Type Selection */}
          {step === 4 && (
            <PaperTypeStep
              watch={watch}
              setValue={setValue}
                register={register} // Add this
                errors={errors} // Add this
              setStep={setStep}
              setSelectedQuestions={setSelectedQuestions}
              setQuestionsCache={setQuestionsCache}
              setLastPreviewLoad={setLastPreviewLoad}
              setPreviewQuestions={setPreviewQuestions}
              subjects={subjects}
              classes={classes}
              getQuestionTypes={getQuestionTypes}
            />
          )}

          {/* Step 5: Selection method */}
          {step === 5 && (
            <SelectionMethodStep
              watchedSelectionMethod={watchedSelectionMethod}
              setValue={setValue}
              setStep={setStep}
            />
          )}

          {/* Step 6: Manual Question Selection */}
          {step === 6 && watchedSelectionMethod === 'manual' && (
            <div className="step-transition">
              {(() => {
                const qTypes = getQuestionTypes();
                const typeCounts: Record<string, number> = {};
                qTypes.forEach(t => {
                  const field = `${t.fieldPrefix}Count`;
                  try {
                    const v = Number(watch(field) || 0);
                    typeCounts[t.value] = isNaN(v) ? 0 : v;
                  } catch (e) {
                    typeCounts[t.value] = 0;
                  }
                });

                return (
                  <ManualQuestionSelection
                    subjectId={watchedSubjectId}
                    classId={watchedClassId}
                    chapterOption={watchedChapterOption}
                    selectedChapters={watch('selectedChapters') || []}
                    chapters={chapters}
                    subjects={subjects}
                    onQuestionsSelected={setSelectedQuestions}
                    onAllComplete={() => setStep(7)}
                    mcqCount={Number(watchedMcqCount)}
                    shortCount={Number(watchedShortCount)}
                    longCount={Number(watchedLongCount)}
                    language={watch('language')}
                    source_type={watch('source_type')}
                    typeCounts={typeCounts}
                  />
                );
              })()}
            </div>
          )}

          {/* Step 7: Review Step */}
          {step === 7 && (
            <ReviewStep
              watch={watch}
              getValues={getValues}
              setStep={setStep}
              onSubmit={onSubmit}
              isLoading={isLoading}
              isLoadingPreview={isLoadingPreview}
              isDownloadingKey={isDownloadingKey}
              isAuthenticated={isAuthenticated}
              isEditMode={isEditMode}
              setIsEditMode={setIsEditMode}
              previewQuestions={previewQuestions}
              chapters={chapters}
              subjects={subjects}
              classes={classes}
              loadPreviewQuestions={loadPreviewQuestions}
              calculateTotalMarks={calculateTotalMarks}
              getQuestionTypes={getQuestionTypes}
              setPreviewQuestions={setPreviewQuestions}
              onDownloadKey={handleDownloadKey}
            />
          )}
        </div>
        
        {!canGeneratePaper() && trialStatus && isAuthenticated && (
          <div className="card mt-4 border-0 shadow-sm">
            <div className="card-body text-center py-5">
              <i className="bi bi-stars display-1 text-primary mb-3"></i>
              <h3 className="card-title">Upgrade to Continue</h3>
              <p className="card-text fs-5">
                {trialStatus.isTrial 
                  ? "Your free trial has ended." 
                  : "Your free trial has ended."
                } Subscribe to continue generating papers.
              </p>
              <button 
                className="btn btn-primary btn-lg px-5"
                onClick={() => window.location.href = '/dashboard/packages'}
              >
                <i className="bi bi-rocket-takeoff me-2"></i>
                View Subscription Plans
              </button>
            </div>
          </div>
        )}
      </div>
    </AcademyLayout>
  );
};

export default GeneratePaperPage;