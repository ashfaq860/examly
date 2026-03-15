import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { Class, Subject, Chapter, Question } from '@/types/types';
import { useUser } from '@/app/context/userContext';
import { fetchSubjectRules, QuestionRuleEngine} from '@/lib/questionRules';
import { cachedGet, isEnglishSubject, isUrduSubject, defaultTypes, englishTypes, urduTypes, useDebounce } from '../utils';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const supabase = createClientComponentClient();

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

export const useGeneratePaper = () => {
  const [step, setStep] = useState(1);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingKey, setIsDownloadingKey] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isManualNavigation, setIsManualNavigation] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<Record<string, Question[]>>({});
  const [questionsCache, setQuestionsCache] = useState<Record<string, Record<string, Question[]>>>({});
  const [lastPreviewLoad, setLastPreviewLoad] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [subjectRules, setSubjectRules] = useState<any[]>([]);
  const [ruleValidation, setRuleValidation] = useState<{
    isValid: boolean;
    missing: Record<string, number>;
    warnings: string[];
  }>({ isValid: true, missing: {}, warnings: [] });
  const [generationProgress, setGenerationProgress] = useState({
    percentage: 0,
    message: 'Starting generation...',
    isVisible: false,
    estimatedTimeRemaining: 0,
    startTime: 0
  });

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  // watched values
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

  const getQuestionTypes = useCallback(() => {
    if (!watchedSubjectId || subjects.length === 0) {
      return defaultTypes;
    }
    
    if (isEnglishSubject(subjects, watchedSubjectId)) return englishTypes;
    if (isUrduSubject(subjects, watchedSubjectId)) return urduTypes;
    return defaultTypes;
  }, [watchedSubjectId, subjects]);

  // Effects and other handlers moved here

  // --- authentication check effect -------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      if (!isMounted) return;

      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          if (isMounted) {
            setAuthError('Please log in to access this page');
            setAuthChecked(true);
          }
          return;
        }

        // Check user role
        const { data: roleData, error: roleError } = await supabase.rpc(
          'get_user_role',
          { user_id: session.user.id }
        );

        if (roleError || roleData !== 'teacher') {
          if (isMounted) {
            setAuthError('This page is only available to teachers');
            setAuthChecked(true);
          }
          return;
        }

        if (isMounted) {
          setIsAuthenticated(true);
          setAuthChecked(true);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        if (isMounted) {
          setAuthError('Authentication error. Please try again.');
          setAuthChecked(true);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

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
    if (!trialStatus || !isAuthenticated) return false;
    
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

  // Fetch subject rules when subject changes
  useEffect(() => {
    const fetchRules = async () => {
      if (!watchedSubjectId || !watchedClassId) {
        setSubjectRules([]);
        return;
      }
      try {
        const rules = await fetchSubjectRules(watchedSubjectId, watchedClassId);
        setSubjectRules(rules);
      } catch (error) {
        console.error('Error fetching subject rules:', error);
        setSubjectRules([]);
      }
    };
    
    if (watchedSubjectId) {
      fetchRules();
    }
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

  // Validate form against rules
  const validateFormAgainstRules = useCallback((formValues: PaperFormData, chapterIds: string[]) => {
    if (subjectRules.length === 0 || chapterIds.length === 0) {
      setRuleValidation({ isValid: true, missing: {}, warnings: [] });
      return;
    }
    
    try {
      const ruleEngine = new QuestionRuleEngine(subjectRules);
      const questionTypes = getQuestionTypes();
      const questionTypeValues = questionTypes.map(t => t.value);
      
      const chaptersWithNumbers = chapters
        .filter(chapter => chapterIds.includes(chapter.id))
        .map(chapter => ({
          id: chapter.id,
          chapterNo: chapter.chapterNo
        }));
      
      if (chaptersWithNumbers.length === 0) {
        setRuleValidation({ isValid: true, missing: {}, warnings: [] });
        return;
      }
      
      if (!ruleEngine.calculateRequirementsForChapters) {
        console.warn('QuestionRuleEngine does not have calculateRequirementsForChapters method');
        setRuleValidation({ isValid: true, missing: {}, warnings: [] });
        return;
      }
      
      const requirements = ruleEngine.calculateRequirementsForChapters(
        chaptersWithNumbers,
        questionTypeValues
      );
      
      const missing: Record<string, number> = {};
      const warnings: string[] = [];
      
      Object.entries(requirements).forEach(([questionType, typeRequirements]) => {
        if (!typeRequirements || typeRequirements.length === 0) return;
        
        const formField = questionTypes.find(t => t.value === questionType)?.fieldPrefix;
        if (!formField) return;
        
        const formCount = formValues[`${formField}Count` as keyof PaperFormData] as number || 0;
        
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
          const typeLabel = questionTypes.find(t => t.value === questionType)?.label || questionType;
          warnings.push(`Chapter rules require at least ${totalMinRequired} ${typeLabel} questions (you have ${formCount})`);
        }
      });
      
      const isValid = Object.keys(missing).length === 0;
      setRuleValidation({ isValid, missing, warnings });
      
    } catch (error) {
      console.error('Error validating form against rules:', error);
      setRuleValidation({ isValid: true, missing: {}, warnings: [] });
    }
  }, [subjectRules, getQuestionTypes, chapters]);

  // Load auto selected questions
  const loadAutoSelectedQuestions = async (chapterIds: string[], formValues: PaperFormData) => {
    try {
      const language = formValues.language;
      const sourceType = formValues.source_type;
      
      const questionTypes = getQuestionTypes();
      
      const result: Record<string, Question[]> = {};
      
      for (const type of questionTypes) {
        const countField = `${type.fieldPrefix}Count`;
        const difficultyField = `${type.fieldPrefix}Difficulty`;
        
        const count = formValues[countField as keyof PaperFormData] as number || 0;
        const difficulty = formValues[difficultyField as keyof PaperFormData] as string || 'any';
        
        if (count > 0) {
          try {
            const response = await axios.get('/api/questions', {
              params: {
                subjectId: watchedSubjectId,
                classId: watchedClassId,
                questionType: type.value,
                chapterIds: chapterIds.join(','),
                language: language,
                sourceType: sourceType !== 'all' ? sourceType : undefined,
                difficulty: difficulty !== 'any' ? difficulty : undefined,
                limit: count * 2, // Fetch more to ensure we have enough
                random: true,
                randomSeed: Date.now(),
                timestamp: Date.now()
              }
            });
            
            const questions = response.data || [];
            const shuffled = [...questions].sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, count);
            
            result[type.value] = handleLanguageTranslation(selected, language);
          } catch (error) {
            console.error(`Error fetching ${type.value} questions:`, error);
            result[type.value] = [];
          }
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error loading auto questions:', error);
      throw error;
    }
  };

  // Load manual selected questions
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

  // Load auto questions with rules
  const loadAutoSelectedQuestionsWithRules = async (chapterIds: string[], formValues: PaperFormData) => {
    try {
      const language = formValues.language;
      const sourceType = formValues.source_type;
      
      // If no rules exist, fall back to original method
      if (subjectRules.length === 0) {
        console.log('No rules found, using standard auto generation');
        return await loadAutoSelectedQuestions(chapterIds, formValues);
      }
      
      const ruleEngine = new QuestionRuleEngine(subjectRules);
      const questionTypes = getQuestionTypes();
      
      // Get chapters with their numbers
      const chaptersWithNumbers = chapters
        .filter(chapter => chapterIds.includes(chapter.id))
        .map(chapter => ({
          id: chapter.id,
          chapterNo: chapter.chapterNo
        }));
      
      if (chaptersWithNumbers.length === 0) {
        return await loadAutoSelectedQuestions(chapterIds, formValues);
      }
      
      // Get question counts from form
      const formCounts: Record<string, number> = {};
      questionTypes.forEach(type => {
        const countField = `${type.fieldPrefix}Count`;
        const countValue = formValues[countField as keyof PaperFormData];
        formCounts[type.value] = typeof countValue === 'number' ? countValue : 0;
      });
      
      // Check if ruleEngine has distributeQuestions method
      if (ruleEngine.distributeQuestions && typeof ruleEngine.distributeQuestions === 'function') {
        // Use the rule engine to distribute questions
        const distribution = ruleEngine.distributeQuestions(
          chaptersWithNumbers,
          questionTypes.map(t => t.value),
          formCounts
        );
        
        console.log('Rule-based distribution:', distribution);

        // Now fetch questions based on the distribution
        const allQuestions: Record<string, Question[]> = {};
        
        // Process each chapter's distribution
        for (const chapterDist of Object.entries(distribution)) {
          const [chapterId, typeDistribution] = chapterDist as [string, Record<string, number>];
          
          for (const [questionType, count] of Object.entries(typeDistribution)) {
            if (count > 0) {
              const difficultyField = `${questionTypes.find(t => t.value === questionType)?.fieldPrefix || ''}Difficulty`;
              const difficulty = formValues[difficultyField as keyof PaperFormData] as string || 'any';
              
              try {
                const response = await axios.get('/api/questions', {
                  params: {
                    subjectId: watchedSubjectId,
                    classId: watchedClassId,
                    questionType: questionType,
                    chapterIds: chapterId, // Single chapter
                    language: language,
                    sourceType: sourceType !== 'all' ? sourceType : undefined,
                    difficulty: difficulty !== 'any' ? difficulty : undefined,
                    limit: count * 3, // Fetch more to ensure we have enough
                    random: true,
                    randomSeed: Date.now(),
                    timestamp: Date.now()
                  }
                });
                
                const questions = response.data || [];
                
                if (questions.length > 0) {
                  // Shuffle and limit to count
                  const shuffled = [...questions].sort(() => Math.random() - 0.5);
                  const selected = shuffled.slice(0, count);
                  
                  if (!allQuestions[questionType]) {
                    allQuestions[questionType] = [];
                  }
                  
                  // Avoid duplicate questions
                  const existingIds = new Set(allQuestions[questionType].map(q => q.id));
                  const uniqueQuestions = selected.filter(q => !existingIds.has(q.id));
                  
                  if (uniqueQuestions.length > 0) {
                    allQuestions[questionType].push(...handleLanguageTranslation(uniqueQuestions, language));
                  }
                }
              } catch (error) {
                console.error(`Error fetching ${questionType} questions for chapter ${chapterId}:`, error);
              }
            }
          }
        }
        
        let totalObtained = 0;
        let totalNeeded = 0;
        
        questionTypes.forEach(type => {
          const required = formCounts[type.value] || 0;
          const obtained = (allQuestions[type.value] || []).length;
          totalNeeded += required;
          totalObtained += obtained;
          
          if (obtained < required) {
            console.warn(`Missing ${required - obtained} ${type.value} questions`);
          }
        });
        
        if (totalObtained < totalNeeded) {
          console.log(`Fetching additional questions: ${totalObtained}/${totalNeeded}`);
          await fetchMissingQuestions(
            allQuestions,
            questionTypes,
            formCounts,
            {
              subjectId: watchedSubjectId,
              classId: watchedClassId,
              chapterIds,
              language,
              source_type: sourceType,
              randomSeed: Date.now(),
              formValues
            }
          );
        }
        
        return allQuestions;
      } else {
        console.log('Rule engine missing distributeQuestions method, using standard generation');
        return await loadAutoSelectedQuestions(chapterIds, formValues);
      }
      
    } catch (error) {
      console.error('Error loading auto questions with rules:', error);
      
      return await loadAutoSelectedQuestions(chapterIds, formValues);
    }
  };

  // Helper function to fetch missing questions
  const fetchMissingQuestions = async (
    allQuestions: Record<string, Question[]>,
    questionTypes: Array<{ value: string; fieldPrefix: string }>,
    formCounts: Record<string, number>,
    config: {
      subjectId: string;
      classId: string;
      chapterIds: string[];
      language: string;
      source_type: string;
      randomSeed: number;
      formValues: PaperFormData;
    }
  ) => {
    const missing: Record<string, number> = {};
    
    questionTypes.forEach(type => {
      const currentCount = (allQuestions[type.value] || []).length;
      const neededCount = formCounts[type.value] || 0;
      
      if (currentCount < neededCount) {
        missing[type.value] = neededCount - currentCount;
      }
    });
    
    for (const [questionType, missingCount] of Object.entries(missing)) {
      if (missingCount <= 0) continue;
      
      const typeInfo = questionTypes.find(t => t.value === questionType);
      if (!typeInfo) continue;
      
      const difficultyField = `${typeInfo.fieldPrefix}Difficulty`;
      const difficulty = config.formValues[difficultyField as keyof PaperFormData] as string || 'any';
      
      try {
        const response = await axios.get('/api/questions', {
          params: {
            subjectId: config.subjectId,
            classId: config.classId,
            questionType: questionType,
            chapterIds: config.chapterIds.join(',') , // All chapters
            language: config.language,
            sourceType: config.source_type !== 'all' ? config.source_type : undefined,
            difficulty: difficulty !== 'any' ? difficulty : undefined,
            limit: missingCount * 3, // Fetch more to ensure we have enough
            random: true,
            randomSeed: config.randomSeed + 1, // Different seed
            timestamp: Date.now()
          }
        });
        
        const questions = response.data || [];
        const existingIds = new Set((allQuestions[questionType] || []).map(q => q.id));
        const newQuestions = questions
          .filter(q => !existingIds.has(q.id))
          .slice(0, missingCount);
        
        if (newQuestions.length > 0) {
          if (!allQuestions[questionType]) {
            allQuestions[questionType] = [];
          }
          allQuestions[questionType].push(...handleLanguageTranslation(newQuestions, config.language));
          
          newQuestions.forEach(q => {
            (q as any).isFallback = true;
            (q as any).fallbackReason = 'Could not meet distribution requirements';
          });
        }
      } catch (error) {
        console.error(`Error fetching missing ${questionType} questions:`, error);
      }
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
      
      validateFormAgainstRules(formValues, chapterIds);
      
      let result: Record<string, Question[]>;
      
      if (formValues.selectionMethod === 'manual' && Object.keys(selectedQuestions).some(type => selectedQuestions[type].length > 0)) {
        result = await loadManualSelectedQuestions();
      } else {
        if (subjectRules.length > 0 && formValues.selectionMethod === 'auto') {
          result = await loadAutoSelectedQuestionsWithRules(chapterIds, formValues);
        } else {
          result = await loadAutoSelectedQuestions(chapterIds, formValues);
        }
      }
      
      setPreviewQuestions(result);
      
    } catch (error) {
      console.error('Error loading preview questions:', error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // preview effect watchers
  useEffect(() => {
    if (step === 4 && watchedPaperType) {
      setQuestionsCache({});
      setLastPreviewLoad(null);
      loadPreviewQuestions();
    }
  }, [watchedPaperType, step]);

  useEffect(() => {
    if (step === 4 && watchedSubjectId && watchedClassId) {
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

  useEffect(() => {
    if (step === 4) {
      const timer = setTimeout(() => {
        loadPreviewQuestions();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [watchedMcqCount, watchedShortCount, watchedLongCount, watchedPaperType, step]);

  // Auto-advance steps
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

  // navigation helpers
  const prevStep = () => {
    if (step === 2) {
      setValue('classId', '');
      setValue('subjectId', '');
      setSubjects([]);
      setChapters([]);
      setStep(1);
    } else if (step === 3) {
      setIsManualNavigation(true);
      setValue('subjectId', '');
      setValue('chapterOption', 'full_book');
      setValue('selectedChapters', []);
      setStep(2);
      setTimeout(() => setIsManualNavigation(false), 1000);
    } else if (step === 4) {
      setStep(3);
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

  // return values used by page component
  return {
    step,
    classes,
    subjects,
    chapters,
    watchedClassId,
    watchedSubjectId,
    watchedChapterOption,
    selectedQuestions,
    setSelectedQuestions,
    setPreviewQuestions,
    isLoading,
    isLoadingPreview,
    isDownloadingKey,
    previewQuestions,
    loadPreviewQuestions,
    trialStatus,
    subjectRules,
    ruleValidation,
    setRuleValidation,
    validateFormAgainstRules,
    getChapterIdsToUse,
    canGeneratePaper,
    prevStep,
    handleChapterSelection,
    watch,
    setValue,
    register,
    errors,
    getValues,
    trigger,
    getQuestionTypes,
    isAuthenticated,
    authChecked,
    authError,
    trialLoading,
    setStep,
    setSubjects,
    setChapters,
  };
};
