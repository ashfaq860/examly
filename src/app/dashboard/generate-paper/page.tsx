/** app/dashboard/generate-paper/page.tsx */
'use client';
import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { Class, Subject, Chapter, Question, paperType, Difficulty, QuestionType, ChapterOption, SelectionMethod } from '@/types/types';
import AcademyLayout from '@/components/AcademyLayout';
import { useUser } from '@/app/context/userContext';
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
  mcqPlacement: z.enum(['same_page', 'separate']),
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
// Trial status interface
interface TrialStatus {
  isTrial: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
  hasActiveSubscription: boolean;
  papersGenerated: number;
  papersRemaining: number | "unlimited";
  subscriptionName?: string;
  subscriptionType?: "paper_pack" | "subscription";
  subscriptionEndDate?: Date;
  message?: string; // 🚨 NEW: backend may send a warning message
}

// 🎨 Modern TrialStatusBanner
const TrialStatusBanner = ({ trialStatus }: { trialStatus: TrialStatus | null }) => {
  if (!trialStatus) return null;

  // 🚨 If backend sends a message, show warning card
  // 🚨 Action required case (no cellno)
  if (trialStatus.message) {
    return (
      <div className="card border-0 shadow-sm mb-4 bg-warning bg-opacity-10">
        <div className="card-body d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <i className="bi bi-exclamation-triangle-fill text-warning display-6 me-3"></i>
            <div>
              <h5 className="fw-bold mb-1">Action Required</h5>
              <p className="mb-0">{trialStatus.message}</p>
            </div>
          </div>
          <a
            href="/dashboard/settings"
            className="btn btn-warning rounded-pill px-3 fw-semibold"
          >
            Update Now <i className="bi bi-arrow-right ms-1"></i>
          </a>
        </div>
      </div>
    );
  }


  if (trialStatus.hasActiveSubscription) {
    return (
      <div className="card border-0 shadow-sm mb-4 bg-success bg-opacity-10">
        <div className="card-body d-flex align-items-center">
          <i className="bi bi-check-circle-fill text-success display-6 me-3"></i>
          <div>
            <h5 className="fw-bold mb-1">Active Subscription</h5>
            <p className="mb-0">
              You are on <strong>{trialStatus.subscriptionName}</strong> plan.{" "}
              {trialStatus.subscriptionType === "paper_pack" ? (
                <>{trialStatus.papersRemaining} paper(s) left in your pack.</>
              ) : (
                <>Renews on {trialStatus.subscriptionEndDate?.toLocaleDateString()}.</>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (trialStatus.isTrial) {
    return (
      <div
        className={`card border-0 shadow-sm mb-4 ${
          trialStatus.daysRemaining <= 5
            ? "bg-warning bg-opacity-10"
            : "bg-info bg-opacity-10"
        }`}
      >
        <div className="card-body d-flex align-items-center">
          <i
            className={`bi bi-clock-history ${
              trialStatus.daysRemaining <= 5 ? "text-warning" : "text-info"
            } display-6 me-3`}
          ></i>
          <div>
            <h5 className="fw-bold mb-1">Free Trial</h5>
            <p className="mb-0">
              Unlimited papers for <strong>{trialStatus.daysRemaining}</strong>{" "}
              more day(s).
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm mb-4 bg-danger bg-opacity-10">
      <div className="card-body d-flex align-items-center">
        <i className="bi bi-exclamation-triangle-fill text-danger display-6 me-3"></i>
        <div>
          <h5 className="fw-bold mb-1">Trial Ended</h5>
          <p className="mb-0">Please subscribe to continue generating papers.</p>
        </div>
      </div>
    </div>
  );
};

// 🎨 Modern SubscriptionModal
const SubscriptionModal = ({
  show,
  onClose,
  trialStatus,
}: {
  show: boolean;
  onClose: () => void;
  trialStatus: TrialStatus | null;
}) => (
  <div className={`modal fade ${show ? "show d-block" : ""}`} tabIndex={-1}>
    <div className="modal-dialog modal-dialog-centered">
      <div className="modal-content shadow-lg border-0 rounded-4">
        <div className="modal-header border-0">
          <h5 className="modal-title fw-bold">
            {trialStatus?.message ? "Profile Update Required" : "Upgrade Required"}
          </h5>
          <button type="button" className="btn-close" onClick={onClose}></button>
        </div>
        <div className="modal-body text-center">
          <i className="bi bi-stars text-primary display-3 mb-3"></i>

          {/* 🚨 If message exists, show profile warning */}
          {trialStatus?.message ? (
            <p className="fs-5">{trialStatus.message}</p>
          ) : trialStatus?.isTrial ? (
            <p className="fs-5">Your free trial has ended.</p>
          ) : (
            <p className="fs-5">
              Your free trial has ended. Please subscribe to continue generating papers.
            </p>
          )}

          {!trialStatus?.message && (
            <div className="alert alert-info rounded-pill">
              🎁 Free Trial: <strong>30 days unlimited papers</strong>
            </div>
          )}
        </div>
        <div className="modal-footer border-0">
          <button
            type="button"
            className="btn btn-outline-secondary rounded-pill px-3"
            onClick={onClose}
          >
            Later
          </button>

          {trialStatus?.message ? (
            <button
              type="button"
              className="btn btn-warning rounded-pill px-4"
              onClick={() => {
                onClose();
                window.location.href = "/dashboard/settings";
              }}
            >
              Update Profile <i className="bi bi-arrow-right ms-2"></i>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary rounded-pill px-4"
              onClick={() => {
                onClose();
                window.location.href = "/dashboard/packages";
              }}
            >
              View Plans <i className="bi bi-arrow-right ms-2"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);

interface ManualQuestionSelectionProps {
  subjectId: string;
  classId: string;
  chapterOption: ChapterOption;
  selectedChapters: string[];
  chapters: Chapter[];
  onQuestionsSelected: (questions: Record<QuestionType, string[]>) => void;
  mcqCount: number;
  shortCount: number;
  longCount: number;
  language: 'english' | 'urdu' | 'bilingual';
  source_type: string;
}

function ManualQuestionSelection({
  subjectId,
  classId,
  chapterOption,
  selectedChapters,
  chapters,
  onQuestionsSelected,
  mcqCount,
  shortCount,
  longCount,
  language,
  source_type,
}: ManualQuestionSelectionProps) {
  const [questions, setQuestions] = useState<Record<QuestionType, Question[]>>({
    mcq: [],
    short: [],
    long: [],
  });
  const [selected, setSelected] = useState<Record<QuestionType, string[]>>({
    mcq: [],
    short: [],
    long: [],
  });
  const [currentStep, setCurrentStep] = useState<QuestionType>('mcq');
  const [filters, setFilters] = useState({
    difficulty: 'all' as 'all' | Difficulty,
    chapter: 'all' as 'all' | string,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiredCounts, setRequiredCounts] = useState({
    mcq: mcqCount,
    short: shortCount,
    long: longCount
  });
  const [isShuffling, setIsShuffling] = useState(false);
 

  useEffect(() => {
    onQuestionsSelected(selected);
  }, [selected, onQuestionsSelected]);

  // Filter chapters by subject
  const subjectChapters = useMemo(() => {
    return chapters.filter(chapter => chapter.subject_id === subjectId);
  }, [chapters, subjectId]);

  // Determine which chapters to use based on chapterOption
  const getChapterIdsToUse = useCallback(() => {
    if (!subjectChapters || subjectChapters.length === 0) return [];
    
    if (chapterOption === 'full_book') {
      return subjectChapters.map(c => c.id);
    } else if (chapterOption === 'half_book') {
      // Get first half of chapters
      const halfIndex = Math.ceil(subjectChapters.length / 2);
      return subjectChapters.slice(0, halfIndex).map(c => c.id);
    } else if (chapterOption === 'single_chapter' || chapterOption === 'custom') {
      return selectedChapters || [];
    }
    return [];
  }, [chapterOption, subjectChapters, selectedChapters]);

  // Shuffle functions
  const shuffleQuestions = async (type: QuestionType) => {
    setIsShuffling(true);
    
    // Add a small delay for visual effect
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setSelected(prev => {
      const newSelected = { ...prev };
      const availableQuestions = questions[type]
        .filter(q => !newSelected[type].includes(q.id))
        .map(q => q.id);
      
      // Shuffle the available questions
      const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5);
      
      // Take the number we need to complete the selection
      const needed = requiredCounts[type] - newSelected[type].length;
      const toAdd = shuffled.slice(0, needed);
      
      newSelected[type] = [...newSelected[type], ...toAdd];
      return newSelected;
    });
    
    setIsShuffling(false);
  };

  const shuffleAll = async () => {
    setIsShuffling(true);
    
    // Add a small delay for visual effect
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setSelected(prev => {
      const newSelected = { ...prev };
      
      // Shuffle each question type
      (['mcq', 'short', 'long'] as QuestionType[]).forEach(type => {
        const availableQuestions = questions[type].map(q => q.id);
        const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5);
        newSelected[type] = shuffled.slice(0, requiredCounts[type]);
      });
      
      return newSelected;
    });
    
    setIsShuffling(false);
  };

  // Add font style for Urdu text
  const getQuestionTextStyle = () => {
    if (language === 'urdu') {
      return {
        fontFamily: "'Jameel Noori Nastaleeq', 'JameelNooriNastaleeqKasheeda', 'Times New Roman', serif",
        fontSize: '18px',
        lineHeight: '1.8',
        direction: 'rtl',
        textAlign: 'right'
      };
    } else if (language === 'bilingual') {
      return {
        fontFamily: "'Jameel Noori Nastaleeq', 'JameelNooriNastaleeqKasheeda', 'Times New Roman', serif",
        fontSize: '16px',
        lineHeight: '1.6'
      };
    }
    return {};
  };

  const fetchQuestions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const chapterIds = getChapterIdsToUse();
      
      console.log('Fetching questions for subject:', subjectId, 'chapters:', chapterIds);
      
      // Only fetch questions if we have valid chapter IDs
      if (chapterIds.length === 0) {
        setQuestions({ mcq: [], short: [], long: [] });
        return;
      }

      const [mcqResponse, shortResponse, longResponse] = await Promise.all([
        axios.get(`/api/questions`, {
          params: {
            subjectId,
            classId: classId,
            questionType: 'mcq',
            chapterIds: chapterIds.join(','),
            language,
            includeUrdu: language !== 'english',
            sourceType: source_type !== 'all' ? source_type : undefined
          },
        }),
        axios.get(`/api/questions`, {
          params: {
            subjectId,
            classId: classId,
            questionType: 'short',
            chapterIds: chapterIds.join(','),
            language,
            includeUrdu: language !== 'english',
            sourceType: source_type !== 'all' ? source_type : undefined
          },
        }),
        axios.get(`/api/questions`, {
          params: {
            subjectId,
            classId: classId,
            questionType: 'long',
            chapterIds: chapterIds.join(','),
            language,
            includeUrdu: language !== 'english',
            sourceType: source_type !== 'all' ? source_type : undefined
          },
        }),
      ]);

      const result = {
        mcq: mcqResponse.data,
        short: shortResponse.data,
        long: longResponse.data,
      };

      console.log('Questions fetched:', {
        mcq: result.mcq.length,
        short: result.short.length,
        long: result.long.length
      });

      // Use pre-translated content instead of Google Translate
      if (language !== 'english') {
        const isBi = language === 'bilingual';
        
        for (const type of ['mcq','short','long'] as QuestionType[]) {
          for (const q of result[type]) {
            if (q.question_text_ur) {
              q.question_text = isBi ? 
                `${q.question_text}\n(${q.question_text_ur})` : 
                q.question_text_ur;
            }
            
            if (type === 'mcq') {
              const options = ['option_a', 'option_b', 'option_c', 'option_d'];
              options.forEach(opt => {
                const urduField = `${opt}_ur`;
                if (q[urduField]) {
                  q[opt] = isBi ? 
                    `${q[opt]}\n(${q[urduField]})` : 
                    q[urduField];
                }
              });
            }
          }
        }
      }

      setQuestions(result);

    } catch (err) {
      console.error('Error fetching questions:', err);
      setError('Failed to load questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [subjectId, getChapterIdsToUse, language, source_type, classId]);
  
  useEffect(() => {
    if (subjectId && subjectChapters && subjectChapters.length > 0) {
      console.log('Subject chapters available:', subjectChapters);
      fetchQuestions();
      setRequiredCounts({
        mcq: mcqCount,
        short: shortCount,
        long: longCount
      });
    }
  }, [subjectId, fetchQuestions, mcqCount, shortCount, longCount, subjectChapters]);

  useEffect(() => {
    console.log('ManualQuestionSelection props:', {
      subjectId,
      chapterOption,
      selectedChapters,
      chapters: chapters.length,
      subjectChapters: subjectChapters.length,
      chapterIdsToUse: getChapterIdsToUse()
    });
  }, [subjectId, chapterOption, selectedChapters, chapters, subjectChapters, getChapterIdsToUse]);

  const toggleQuestionSelection = useCallback((questionId: string, type: QuestionType) => {
    setSelected(prev => {
      const newSelected = { ...prev };
      if (newSelected[type].includes(questionId)) {
        newSelected[type] = newSelected[type].filter(id => id !== questionId);
      } else if (newSelected[type].length < requiredCounts[type]) {
        newSelected[type] = [...newSelected[type], questionId];
      }
      return newSelected;
    });
  }, [requiredCounts]);

  const filteredQuestions = useMemo(() => {
    return questions[currentStep].filter(q => {
      const matchesDifficulty = filters.difficulty === 'all' || q.difficulty === filters.difficulty;
      const matchesChapter = filters.chapter === 'all' || q.chapter_id === filters.chapter;
      return matchesDifficulty && matchesChapter;
    });
  }, [questions, currentStep, filters]);

  const getCompletionStatus = (type: QuestionType) => {
    const required = requiredCounts[type];
    const selectedCount = selected[type].length;
    return {
      completed: selectedCount >= required,
      progress: `${selectedCount}/${required}`,
      remaining: required - selectedCount
    };
  };

  const handleNext = () => {
    if (currentStep === 'mcq' && selected.mcq.length >= requiredCounts.mcq) {
      setCurrentStep('short');
    } else if (currentStep === 'short' && selected.short.length >= requiredCounts.short) {
      setCurrentStep('long');
    }
  };

  const handleBack = () => {
    if (currentStep === 'short') {
      setCurrentStep('mcq');
    } else if (currentStep === 'long') {
      setCurrentStep('short');
    }
  };

  // Get the actual chapter names for display
  const getSelectedChapterNames = useCallback(() => {
    const chapterIds = getChapterIdsToUse();
    const subjectChapters = chapters.filter(c => c.subject_id === subjectId);

    if (chapterIds.length === 0) return "No chapters selected";
    if (chapterOption === 'full_book') return `${subjectChapters.length} chapters (Full Book)`;
    if (chapterOption === 'half_book') return `${Math.ceil(subjectChapters.length/2)} chapters (Half Book)`;

    return subjectChapters
      .filter(chapter => chapterIds.includes(chapter.id))
      .map(chapter => `${chapter.chapterNo}. ${chapter.name}`)
      .join(", ");
  }, [getChapterIdsToUse, chapterOption, chapters, subjectId]);
 
  return (
    <div className="card mt-4">
      <div className="card-body">
        <h2 className="h4 card-title mb-3">Manual Question Selection</h2>
        
        {/* Add font preloading */}
        <style jsx>{`
          @font-face {
            font-family: 'Jameel Noori Nastaleeq';
            src: url('/fonts/JameelNooriNastaleeqKasheeda.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }
          
          .urdu-text {
            font-family: 'Jameel Noori Nastaleeq', 'Times New Roman', serif !important;
            font-size: 18px !important;
            line-height: 1.8 !important;
          }
          
          .bilingual-text {
            font-family: 'Jameel Noori Nastaleeq', 'Times New Roman', serif !important;
            font-size: 16px !important;
            line-height: 1.6 !important;
          }
          
          .urdu-rtl {
            direction: rtl;
            text-align: right;
          }
        `}</style>
        
        {/* Chapter selection info */}
        <div className="alert alert-info mb-3">
          <strong>Selected Chapters:</strong> {getChapterIdsToUse().length} chapters
          {chapterOption === 'full_book' && ' (Full Book)'}
          {chapterOption === 'half_book' && ' (First Half)'}
          {chapterOption === 'single_chapter' && ' (Single Chapter)'}
          {chapterOption === 'custom' && ' (Custom Selection)'}
          <br />
          <small>{getSelectedChapterNames()}</small>
        </div>
        
        {/* Selection Summary at the top */}
        <div className="card bg-light mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="h6 card-title mb-0">Selection Progress</h3>
              <button 
                className="btn btn-outline-primary btn-sm"
                onClick={shuffleAll}
                disabled={isLoading || isShuffling}
              >
                <i className={`bi bi-shuffle me-1 ${isShuffling ? 'spinning' : ''}`}></i> Shuffle All
              </button>
            </div>
            <div className="row">
              <div className="col">
                <div className="d-flex justify-content-between align-items-center">
                  <p className="fw-bold mb-1">MCQs</p>
                  <button 
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => shuffleQuestions('mcq')}
                    disabled={isLoading || getCompletionStatus('mcq').completed || isShuffling}
                  >
                    <i className={`bi bi-shuffle ${isShuffling ? 'spinning' : ''}`}></i>
                  </button>
                </div>
                <div className="d-flex align-items-center">
                  <span className={`badge ${currentStep === 'mcq' ? 'bg-primary' : 
                                  getCompletionStatus('mcq').completed ? 'bg-success' : 'bg-secondary'} me-2`}>
                    {getCompletionStatus('mcq').progress}
                  </span>
                  {currentStep === 'mcq' && !getCompletionStatus('mcq').completed && (
                    <small className="text-muted">{getCompletionStatus('mcq').remaining} more needed</small>
                  )}
                </div>
              </div>
              <div className="col">
                <div className="d-flex justify-content-between align-items-center">
                  <p className="fw-bold mb-1">Short Questions</p>
                  <button 
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => shuffleQuestions('short')}
                    disabled={isLoading || getCompletionStatus('short').completed || isShuffling}
                  >
                    <i className={`bi bi-shuffle ${isShuffling ? 'spinning' : ''}`}></i>
                  </button>
                </div>
                <div className="d-flex align-items-center">
                  <span className={`badge ${currentStep === 'short' ? 'bg-primary' : 
                                  getCompletionStatus('short').completed ? 'bg-success' : 'bg-secondary'} me-2`}>
                    {getCompletionStatus('short').progress}
                  </span>
                  {currentStep === 'short' && !getCompletionStatus('short').completed && (
                    <small className="text-muted">{getCompletionStatus('short').remaining} more needed</small>
                  )}
                </div>
              </div>
              <div className="col">
                <div className="d-flex justify-content-between align-items-center">
                  <p className="fw-bold mb-1">Long Questions</p>
                  <button 
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => shuffleQuestions('long')}
                    disabled={isLoading || getCompletionStatus('long').completed || isShuffling}
                  >
                    <i className={`bi bi-shuffle ${isShuffling ? 'spinning' : ''}`}></i>
                  </button>
                </div>
                <div className="d-flex align-items-center">
                  <span className={`badge ${currentStep === 'long' ? 'bg-primary' : 
                                  getCompletionStatus('long').completed ? 'bg-success' : 'bg-secondary'} me-2`}>
                    {getCompletionStatus('long').progress}
                  </span>
                  {currentStep === 'long' && !getCompletionStatus('long').completed && (
                    <small className="text-muted">{getCompletionStatus('long').remaining} more needed</small>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger mb-3" role="alert">
            {error}
          </div>
        )}

        {/* Current step indicator */}
        <div className="alert alert-info mb-4">
          {currentStep === 'mcq' && `Select ${requiredCounts.mcq} MCQs`}
          {currentStep === 'short' && `Select ${requiredCounts.short} Short Questions`}
          {currentStep === 'long' && `Select ${requiredCounts.long} Long Questions`}
        </div>
        
        {/* Filters */}
        <div className="row mb-4">
          <div className="col-md-6">
            <label className="form-label">Difficulty</label>
            <select
              className="form-select"
              value={filters.difficulty}
              onChange={(e) => setFilters(prev => ({ ...prev, difficulty: e.target.value as any }))}
            >
              <option value="all">All</option>
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
    {subjectChapters
      .filter(chapter => getChapterIdsToUse().includes(chapter.id))
      .map(chapter => (
        <option key={chapter.id} value={chapter.id}>
          {chapter.chapterNo}. {chapter.name}
        </option>
      ))
    }
  </select>
          </div>
        </div>
        
        {isLoading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-2">
              Showing {filteredQuestions.length} questions
              {filters.difficulty !== 'all' && ` (${filters.difficulty} difficulty)`}
              {filters.chapter !== 'all' && ` from chapter ${chapters.find(c => c.id === filters.chapter)?.chapterNo}`}
            </div>
            <div className="list-group mb-4" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {filteredQuestions.length === 0 ? (
                <div className="text-center py-4">
                  <p>No questions found matching your criteria.</p>
                  <p>Try adjusting your filters or chapter selection.</p>
                </div>
              ) : (
                filteredQuestions.map(question => (
                  <div
                    key={question.id}
                    className={`list-group-item list-group-item-action ${selected[currentStep].includes(question.id) ? 'active' : ''}`}
                    onClick={() => toggleQuestionSelection(question.id, currentStep)}
                  >
                    <div className="d-flex align-items-start">
                      <input
                        type="checkbox"
                        checked={selected[currentStep].includes(question.id)}
                        onChange={() => toggleQuestionSelection(question.id, currentStep)}
                        className="form-check-input me-3 mt-1"
                        onClick={(e) => e.stopPropagation()}
                        disabled={selected[currentStep].length >= requiredCounts[currentStep] && 
                                  !selected[currentStep].includes(question.id)}
                      />
                      <div className="flex-grow-1">
                        {/* Apply Urdu font styles based on language */}
                        <p 
                          className={`mb-1 fw-bold ${
                            language === 'urdu' ? 'urdu-text urdu-rtl' : 
                            language === 'bilingual' ? 'bilingual-text' : ''
                          }`}
                        >
                          {question.question_text}
                        </p>
                        
                        {currentStep === 'mcq' && (
                          <div className={`mt-2 ${language === 'urdu' ? 'urdu-rtl' : ''}`}>
                            <div className="row">
                              {question.option_a && (
                                <div className="col-md-6">
                                  <span className={language === 'urdu' ? 'urdu-text' : language === 'bilingual' ? 'bilingual-text' : ''}>
                                    A) {question.option_a}
                                  </span>
                                </div>
                              )}
                              {question.option_b && (
                                <div className="col-md-6">
                                  <span className={language === 'urdu' ? 'urdu-text' : language === 'bilingual' ? 'bilingual-text' : ''}>
                                    B) {question.option_b}
                                  </span>
                                </div>
                              )}
                              {question.option_c && (
                                <div className="col-md-6">
                                  <span className={language === 'urdu' ? 'urdu-text' : language === 'bilingual' ? 'bilingual-text' : ''}>
                                    C) {question.option_c}
                                  </span>
                                </div>
                              )}
                              {question.option_d && (
                                <div className="col-md-6">
                                  <span className={language === 'urdu' ? 'urdu-text' : language === 'bilingual' ? 'bilingual-text' : ''}>
                                    D) {question.option_d}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="d-flex gap-2 mt-2">
                          <span className={`badge ${
                            question.difficulty === 'easy' ? 'bg-success' :
                            question.difficulty === 'medium' ? 'bg-warning text-dark' : 'bg-danger'
                          }`}>
                            {question.difficulty}
                          </span>
                         <span className="badge bg-secondary">
                                Chapter {subjectChapters.find(c => c.id === question.chapter_id)?.chapterNo}
                         </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <div className="d-flex justify-content-between">
          <button 
            className="btn btn-secondary" 
            onClick={handleBack}
            disabled={currentStep === 'mcq'}
          >
            Back
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleNext}
            disabled={selected[currentStep].length < requiredCounts[currentStep]}
          >
            {currentStep === 'long' ? 'Finish Selection' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GeneratePaperPage() {
  const [step, setStep] = useState(1);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Record<QuestionType, string[]>>({
    mcq: [],
    short: [],
    long: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingKey, setIsDownloadingKey] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isManualNavigation, setIsManualNavigation] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
const [showDatePicker, setShowDatePicker] = useState(false);
  // Use the UserContext
  const { trialStatus, isLoading: trialLoading, refreshTrialStatus } = useUser();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    getValues,
    reset,
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
      title:'BISE LAHORE',
      shuffleQuestions: true,
       dateOfPaper: new Date().toISOString().split('T')[0],
    },
  });

  const watchedClassId = watch('classId');
  const watchedSubjectId = watch('subjectId');
  const watchedChapterOption = watch('chapterOption');
  const watchedSelectionMethod = watch('selectionMethod');
  const watchedMcqCount = watch('mcqCount');
  const watchedShortCount = watch('shortCount');
  const watchedLongCount = watch('longCount');
 const watchedPaperType = watch('paperType');


   // 🆕 NEW: Function to handle date selection
  const handleDateSelect = (date: string) => {
    setValue('dateOfPaper', date);
    setShowDatePicker(false);
  };

  // 🆕 NEW: Function to format date for display
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return 'Select Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();
  }, []);

  // Check if user can generate paper
  const canGeneratePaper = () => {
    if (!trialStatus) return false;
    
    // Active subscription always allows generation
    if (trialStatus.hasActiveSubscription) return true;
    
    // Trial period: must have valid trial end date
    // Papers are unlimited during trial, so we don't check papersRemaining
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
      try {
        const response = await axios.get('/api/classes');
        setClasses(response.data);
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
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
        const response = await axios.get(`/api/subjects?classId=${watchedClassId}`);
        setSubjects(response.data);
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
        console.log('Fetching chapters for subject:', watchedSubjectId, 'and class:', watchedClassId);
        const response = await axios.get(`/api/chapters?subjectId=${watchedSubjectId}&classId=${watchedClassId}`);
        console.log('Chapters response:', response.data);
        setChapters(response.data);
      } catch (error) {
        console.error('Error fetching chapters:', error);
      }
    };
    fetchChapters();
  }, [watchedSubjectId, watchedClassId]);

  // Auto-advance steps when selections are made
  useEffect(() => {
    if (step === 1 && watchedClassId) {
      setStep(2);
    }
  }, [watchedClassId, step]);

  // Modify your auto-advance useEffect
  useEffect(() => {
    if (step === 2 && watchedSubjectId && !isManualNavigation) {
      setStep(3);
    }
  }, [watchedSubjectId, step, isManualNavigation]);

  // Enhanced back button functionality
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
      
      // Reset the flag after a short delay
      setTimeout(() => {
        setIsManualNavigation(false);
      }, 1000);
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

  // Final submit handler with trial check
  const onSubmit = async (formData: PaperFormData) => {
    // Check trial status before proceeding
    if (!canGeneratePaper()) {
      setShowSubscriptionModal(true);
      return;
    }

    // Check authentication
    if (!isAuthenticated) {
      alert('Please login to generate papers');
      return;
    }

    // Remove the trial papers check since papers are unlimited during trial
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        alert('You must be logged in to generate a paper.');
        setIsLoading(false);
        return;
      }
const user = session.user;
      const accessToken = session.access_token;
      // 🔥 ADD RANDOM SEED TO PREVENT CACHING AND ENSURE RANDOMIZATION
      const randomSeed = Date.now();
      const payload = {
        ...formData,
        userId: user.id,
        randomSeed, // This ensures different results each time
        mcqToAttempt: formData.mcqToAttempt || formData.mcqCount,
        shortToAttempt: formData.shortToAttempt || formData.shortCount,
        longToAttempt: formData.longToAttempt || formData.longCount,
        ...(formData.selectionMethod === 'manual' ? { selectedQuestions } : {}),
        language: formData.language,
        shuffleQuestions: formData.shuffleQuestions,
      };
      
      console.log('Submitting payload with random seed:', randomSeed);
      
      const response = await fetch("/api/generate-paper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") || "";

      console.log('Response status:', response.status);
      console.log('Content-Type:', contentType);
      
      // Update papers count after successful generation
      if (response.ok) {
        const { count: newPapersCount } = await supabase
          .from('papers')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', user.id);

        // Refresh trial status to update the papers count
        await refreshTrialStatus();
      }
      
      if (response.ok && contentType.includes("application/pdf")) {
        console.log('Received PDF response, creating blob...');
        const blob = await response.blob();
        console.log('Blob created, size:', blob.size, 'bytes');
        const url = window.URL.createObjectURL(blob);
        console.log('Created object URL:', url);
        const a = document.createElement("a");
        a.href = url;
        a.download = "paper.pdf";
        document.body.appendChild(a);
        console.log('Triggering download...');
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        console.log('Download triggered');
      } else if (contentType.includes("application/json")) {
        console.log('Received JSON response');
        const result = await response.json();
        console.error('Error from server:', result.error);
        alert(result.error || "Paper generated, but no PDF was returned.");
      } else {
        console.log('Received unknown response type');
        const text = await response.text();
        console.error('Error text:', text);
        alert(text || "Failed to generate paper (unknown error)");
      }
    } catch (error) {
      console.error('Error generating paper:', error);
      alert("Failed to generate paper (client error)");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    reset({
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
      language: 'english',
      shuffleQuestions: true,
    });
    setSubjects([]);
    setChapters([]);
    setSelectedQuestions({
      mcq: [],
      short: [],
      long: [],
    });
  };

  const handleChapterSelection = (chapterId: string) => {
    if (watchedChapterOption === 'single_chapter') {
      setValue('selectedChapters', [chapterId]);
      setStep(4);
    } else if (watchedChapterOption === 'custom') {
      const currentSelected = watch('selectedChapters') || [];
      if (currentSelected.includes(chapterId)) {
        setValue('selectedChapters', currentSelected.filter(id => id !== chapterId));
      } else {
        setValue('selectedChapters', [...currentSelected, chapterId]);
      }
    } else if (watchedChapterOption === 'full_book' || watchedChapterOption === 'half_book') {
      setStep(4);
    }
  };

  return (
    <AcademyLayout>
      <div className="container mx-auto px-4 py-4">
        {/* Show loading state while trial status is being fetched */}
        {trialLoading && (
          <div className="alert alert-info mb-4">
            <div className="spinner-border spinner-border-sm me-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            Loading your account information...
          </div>
        )}

        {/* Add Trial Status Banner */}
        <TrialStatusBanner trialStatus={trialStatus} />
        
        {/* Add Subscription Modal */}
        {showSubscriptionModal && (
          <>
            <div className="modal-backdrop fade show"></div>
            <SubscriptionModal 
              show={showSubscriptionModal} 
              onClose={() => setShowSubscriptionModal(false)}
              trialStatus={trialStatus}
            />
          </>
        )}

        {/* Login prompt for unauthenticated users */}
        {!isAuthenticated && (
          <div className="alert alert-warning mb-4">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Please <a href="/login" className="alert-link">login</a> to generate papers.
          </div>
        )}

        {/* Disable form if trial expired and no subscription or not authenticated */}
        <div style={{ 
          opacity: canGeneratePaper() && isAuthenticated ? 1 : 0.6,
          pointerEvents: canGeneratePaper() && isAuthenticated ? 'auto' : 'none'
        }}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1 className="h2 mb-0">Generate New Paper</h1>
            {step > 1 && (
              <button className="btn btn-outline-secondary" onClick={prevStep}>
                <i className="bi bi-arrow-left me-2"></i>
                {step === 2 && 'Back to Class Selection'}
                {step === 3 && 'Back to Subject Selection'}
                {step === 4 && 'Back to Chapter Selection'}
                {step === 5 && 'Back to Paper Details'}
                {step === 6 && 'Back to Selection Method'}
                {step === 7 && 'Back'}
              </button>
            )}
          </div>

          {/* Step Progress Indicator */}
          <div className="mb-4">
            <div className="progress" style={{ height: "8px" }}>
              <div
                className="progress-bar bg-primary"
                style={{ width: `${(step / 7) * 100}%` }}
              ></div>
            </div>
            <p className="text-muted small mt-2">Step {step} of 7</p>
          </div>

          {/* Step 1: Class selection */}
          {step === 1 && (
            <div className="step-card">
              <h5 className="fw-bold mb-3">🎓 Select Your Class</h5>
              {classes.length === 0 ? (
                <div className="loading-state">
                  <div className="spinner-border text-primary" role="status"></div>
                  <p className="mt-2">Loading classes...</p>
                </div>
              ) : (
                <div className="row row-cols-2 row-cols-md-4 g-4">
                  {classes.map((cls) => (
                    <div key={cls.id} className="col">
                      <div
                        className={`option-card ${
                          watchedClassId === cls.id ? "active" : ""
                        }`}
                        onClick={() => setValue("classId", cls.id)}
                      >
                        <span className="display-6 mb-2">🎓</span>
                        <h6 className="fw-semibold">Class {cls.name}</h6>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {errors.classId && (
                <div className="text-danger small mt-2">{errors.classId.message}</div>
              )}
            </div>
          )}

          {/* Step 2: Subject selection */}
       {step === 2 && (
  <div className="step-card">
    <h5 className="fw-bold mb-3">📚 Select Subject</h5>
    {watchedClassId && subjects.length === 0 ? (
      <div className="loading-state">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-2">Loading subjects...</p>
      </div>
    ) : (
      <div className="row row-cols-2 row-cols-md-4 g-4">
        {subjects.map((subject) => {
          // Enhanced function to get appropriate icon based on subject name
          const getSubjectIcon = (subjectName: string) => {
            const name = subjectName.toLowerCase();
            
            // Computer & IT Subjects
            if (name.includes('computer') || name.includes('programming') || name.includes('coding') || 
                name.includes('it') || name.includes('software') || name.includes('technology')) {
              return '💻';
            }
            
            // Mathematics
            else if (name.includes('math') || name.includes('calculus') || name.includes('algebra') || 
                     name.includes('geometry') || name.includes('statistics') || name.includes('trigonometry')) {
              return '📊';
            }
            
            // Sciences
            else if (name.includes('physics')) {
              return '⚛️';
            } else if (name.includes('chemistry')) {
              return '🧪';
            } else if (name.includes('biology')) {
              return '🧬';
            } else if (name.includes('science') || name.includes('general science')) {
              return '🔬';
            }
            
            // Languages
            else if (name.includes('english') || name.includes('literature')) {
              return '📖';
            } else if (name.includes('urdu')) {
              return '📜';
            } else if (name.includes('arabic')) {
              return '🕌';
            } else if (name.includes('language')) {
              return '🗣️';
            }
            
            // Islamic Studies
            else if (name.includes('islamiyat') || name.includes('islamic') || name.includes('quran') || 
                     name.includes('islam') || name.includes('religious')) {
              return '☪️';
            }
            
            // Social Studies
            else if (name.includes('history')) {
              return '📜';
            } else if (name.includes('geography')) {
              return '🌍';
            } else if (name.includes('civics') || name.includes('citizenship')) {
              return '🏛️';
            } else if (name.includes('social studies') || name.includes('sociology')) {
              return '👥';
            }
            
            // Pakistan Studies
            else if (name.includes('pakistan studies') || name.includes('pak studies')) {
              return '🇵🇰';
            }
            
            // Commerce & Business
            else if (name.includes('accounting') || name.includes('accounts')) {
              return '📈';
            } else if (name.includes('commerce')) {
              return '💼';
            } else if (name.includes('business') || name.includes('business studies')) {
              return '🏢';
            } else if (name.includes('economics') || name.includes('economy')) {
              return '💰';
            }
            
            // Arts & Creative
            else if (name.includes('art') || name.includes('drawing') || name.includes('painting')) {
              return '🎨';
            } else if (name.includes('music')) {
              return '🎵';
            } else if (name.includes('drama') || name.includes('theater')) {
              return '🎭';
            }
            
            // Physical Education
            else if (name.includes('physical') || name.includes('sports') || name.includes('health') || 
                     name.includes('pe') || name.includes('gym')) {
              return '⚽';
            }
            
            // General Knowledge
            else if (name.includes('general knowledge') || name.includes('gk')) {
              return '🧠';
            }
            
            // Environmental Science
            else if (name.includes('environment') || name.includes('ecology')) {
              return '🌱';
            }
            
            // Psychology
            else if (name.includes('psychology')) {
              return '🧠';
            }
            
            // Philosophy
            else if (name.includes('philosophy')) {
              return '🤔';
            }
            
            // Default fallback
            else {
              return '📘';
            }
          };

          const subjectIcon = getSubjectIcon(subject.name);

          return (
            <div key={subject.id} className="col">
              <div
                className={`option-card ${
                  watchedSubjectId === subject.id ? "active" : ""
                }`}
                onClick={() => setValue("subjectId", subject.id)}
              >
                <span className="display-6 mb-2">{subjectIcon}</span>
                <h6 className="fw-semibold">{subject.name}</h6>
              </div>
            </div>
          );
        })}
      </div>
    )}
    {errors.subjectId && (
      <div className="text-danger small mt-2">{errors.subjectId.message}</div>
    )}
  </div>
)}
          {/* Step 3: Chapter selection */}
          {step === 3 && (
            <div>
              <label className="form-label">Select Chapter Coverage</label>
              <div className="row row-cols-1 row-cols-md-2 g-4 mb-4">
                <div className="col">
                  <div className={`card h-100 cursor-pointer p-3 border ${watchedChapterOption === 'full_book' ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary'}`}
                    onClick={() => {
                      setValue('chapterOption', 'full_book');
                      setValue('selectedChapters', []);
                      setStep(4); 
                    }}
                  >
                    <div className="card-body text-center">
                      <span className="display-6 mb-2">📖</span>
                      <h5 className="card-title">Full Book</h5>
                      <p className="card-text">Cover all chapters in the subject</p>
                    </div>
                  </div>
                </div>
                <div className="col">
                  <div 
                    className={`card h-100 cursor-pointer p-3 border ${watchedChapterOption === 'half_book' ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary'}`}
                    onClick={() => {
                      setValue('chapterOption', 'half_book');
                      setValue('selectedChapters', []);
                      setStep(4); 
                    }}
                  >
                    <div className="card-body text-center">
                      <span className="display-6 mb-2">📘</span>
                      <h5 className="card-title">Half Book</h5>
                      <p className="card-text">Cover first half of the chapters</p>
                    </div>
                  </div>
                </div>
                <div className="col">
                  <div 
                    className={`card h-100 cursor-pointer p-3 border ${watchedChapterOption === 'single_chapter' ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary'}`}
                    onClick={() => setValue('chapterOption', 'single_chapter')}
                  >
                    <div className="card-body text-center">
                      <span className="display-6 mb-2">📄</span>
                      <h5 className="card-title">Single Chapter</h5>
                      <p className="card-text">Select one specific chapter</p>
                    </div>
                  </div>
                </div>
                <div className="col">
                  <div 
                    className={`card h-100 cursor-pointer p-3 border ${watchedChapterOption === 'custom' ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary'}`}
                    onClick={() => setValue('chapterOption', 'custom')}
                  >
                    <div className="card-body text-center">
                      <span className="display-6 mb-2">🎛️</span>
                      <h5 className="card-title">Custom Selection</h5>
                      <p className="card-text">Choose multiple chapters</p>
                    </div>
                  </div>
                </div>
              </div>

              {(watchedChapterOption === 'custom' || watchedChapterOption === 'single_chapter') && (
                <>
                  <label className="form-label">
                    {watchedChapterOption === 'single_chapter' ? 'Select Chapter' : 'Select Chapters'}
                  </label>
                  
                  {/* Show loading state while chapters are loading */}
                  {chapters.length === 0 && (
                    <div className="text-center py-4">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading chapters...</span>
                      </div>
                      <p className="mt-2">Loading chapters...</p>
                    </div>
                  )}
                  
                  {/* Show message if no chapters found for this subject */}
                  {chapters.length > 0 && chapters.filter(chapter => chapter.subject_id === watchedSubjectId).length === 0 && (
                    <div className="alert alert-warning">
                      No chapters found for the selected subject.
                    </div>
                  )}
                  
                  <div className="row row-cols-2 row-cols-md-4 g-4">
                    {/* Filter chapters by selected subject */}
                    {chapters
                      .filter(chapter => chapter.subject_id === watchedSubjectId)
                      .map(chapter => {
                        const selectedChapters = watch('selectedChapters') || [];
                        const isSelected = selectedChapters.includes(chapter.id);
                        return (
                          <div key={chapter.id} className="col">
                            <div
                              className={`card h-100 cursor-pointer p-3 border ${isSelected ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary'}`}
                              onClick={() => handleChapterSelection(chapter.id)}
                            >
                              <div className="card-body text-center">
                                <span className="display-6 mb-2">📖</span>
                                <h5 className="card-title">{chapter.chapterNo}. {chapter.name}</h5>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  
                  {watchedChapterOption === 'custom' && (
                    <button 
                      className="btn btn-primary mt-3"
                      onClick={() => setStep(4)}
                      disabled={!watch('selectedChapters')?.length}
                    >
                      Continue
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 4: Paper details and settings */}
          {step === 4 && (
            <div className="step-card">
              <h5 className="fw-bold mb-4">📝 Paper Details & Settings</h5>

              {/* 🔹 Paper Type Selection */}
              <div className="mb-4">
                <div className="row g-4">
                  <div className="col-md-6">
                    <div
                      className={`option-card ${watch("paperType") === "model" ? "active" : ""}`}
                      onClick={() => {
                        setValue("paperType", "model");
                        setValue("language", "bilingual");
                        setValue("mcqCount", 12);
                        setValue("mcqToAttempt", 12);
                        setValue("shortCount", 24);
                        setValue("shortToAttempt", 16);
                        setValue("longCount", 3);
                        setValue("longToAttempt", 2);
                        setValue("mcqMarks", 1);
                        setValue("shortMarks", 2);
                        setValue("longMarks", 8);
                        setValue("mcqPlacement", "separate");
                        setValue("timeMinutes", 180);
                        setValue("easyPercent", 20);
                        setValue("mediumPercent", 50);
                        setValue("hardPercent", 30);
                        setValue("shuffleQuestions", true);
                        setValue("dateOfPaper", undefined);
                      }}
                    >
                      <span className="display-6">🏛️</span>
                      <h5 className="mt-2">Board Paper</h5>
                      <p className="small text-muted">
                        Predefined board style with fixed marks & time distribution.
                      </p>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div
                      className={`option-card ${watch("paperType") === "custom" ? "active" : ""}`}
                      onClick={() => {
                        setValue("paperType", "custom");
                        setValue("mcqCount", 10);
                        setValue("shortCount", 5);
                        setValue("longCount", 3);
                        setValue("mcqMarks", 1);
                        setValue("shortMarks", 2);
                        setValue("longMarks", 5);
                        setValue("mcqPlacement", "separate");
                        setValue("timeMinutes", 60);
                        setValue("easyPercent", 33);
                        setValue("mediumPercent", 34);
                        setValue("hardPercent", 33);
                        setValue("shuffleQuestions", true);
                        setValue("dateOfPaper", new Date().toISOString().split('T')[0]);
                      }}
                    >
                      <span className="display-6">⚙️</span>
                      <h5 className="mt-2">Custom Paper</h5>
                      <p className="small text-muted">
                        Customize marks, sections, difficulty levels, and time.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 🔹 Board Paper Preview */}
              {watch("paperType") === "model" && (
                <div className="preview-card mt-3">
                  <h6 className="fw-bold mb-2">📋 Board Paper Pattern</h6>
                  <div className="row">
                    <div className="col-md-6">
                      <ul className="list-unstyled small">
                        <li><strong>Language:</strong> Bilingual</li>
                        <li><strong>MCQs:</strong> 12 × 1 mark</li>
                        <li><strong>Short:</strong> 24 Qs, 16 to attempt (2 marks)</li>
                      </ul>
                    </div>
                    <div className="col-md-6">
                      <ul className="list-unstyled small">
                        <li><strong>Long:</strong> 3 Qs, attempt 2 (8 marks)</li>
                        <li><strong>Time:</strong> 180 mins</li>
                        <li><strong>Difficulty:</strong> 20% Easy, 50% Medium, 30% Hard</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* 🔹 Custom Paper Settings */}
              {watch("paperType") === "custom" && (
                <div className="custom-settings mt-4">
                  <h6 className="fw-bold mb-3">⚙️ Customize Settings</h6>

                  {/* Paper Title */}
                  <div className="mb-3">
                    <label className="form-label">Paper Title</label>
                    <input
                      type="text"
                      defaultValue="BISE LAHORE"
                      {...register("title")}
                      className={`form-control ${errors.title ? "is-invalid" : ""}`}
                    />
                    {errors.title && <div className="invalid-feedback">{errors.title.message}</div>}
                  </div>

  {/* 🆕 NEW: Date of Paper Field */}
                  <div className="mb-3">
                    <label className="form-label">Date of Paper</label>
                    <div className="position-relative">
                      <button
                        type="button"
                        className="form-control text-start bg-white"
                        onClick={() => setShowDatePicker(!showDatePicker)}
                        style={{ cursor: 'pointer' }}
                      >
                        {formatDateForDisplay(watch('dateOfPaper') || '')}
                        <i className="bi bi-calendar float-end"></i>
                      </button>
                      
                      {/* Date Picker Dropdown */}
                      {showDatePicker && (
                        <div className="card position-absolute top-100 start-0 mt-1 shadow-lg z-3 w-100">
                          <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <h6 className="mb-0">Select Date</h6>
                              <button 
                                type="button" 
                                className="btn-close"
                                onClick={() => setShowDatePicker(false)}
                              ></button>
                            </div>
                            <input
                              type="date"
                              className="form-control"
                              value={watch('dateOfPaper') || ''}
                              onChange={(e) => {
                                setValue('dateOfPaper', e.target.value);
                                setShowDatePicker(false);
                              }}
                            />
                            <div className="mt-2 d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm flex-fill"
                                onClick={() => {
                                  setValue('dateOfPaper', new Date().toISOString().split('T')[0]);
                                  setShowDatePicker(false);
                                }}
                              >
                                Today
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm flex-fill"
                                onClick={() => {
                                  setValue('dateOfPaper', '');
                                  setShowDatePicker(false);
                                }}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="form-text">
                      Select the date for this paper (optional)
                    </div>
                  </div>
                  {/* Language + Source */}
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <label className="form-label d-block">Language</label>
                      {["english", "urdu", "bilingual"].map((lang) => (
                        <div className="form-check form-check-inline" key={lang}>
                          <input
                            className="form-check-input"
                            type="radio"
                            value={lang}
                            {...register("language")}
                            id={`lang-${lang}`}
                          />
                          <label className="form-check-label" htmlFor={`lang-${lang}`}>
                            {lang.charAt(0).toUpperCase() + lang.slice(1)}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Source Type</label>
                      <select {...register("source_type")} className="form-select">
                        <option value="all">All</option>
                        <option value="book">Book</option>
                        <option value="model_paper">Model Paper</option>
                        <option value="past_paper">Past Paper</option>
                      </select>
                    </div>
                  </div>

                  {/* Timing & Placement */}
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <label className="form-label">MCQ Placement</label>
                      <select {...register("mcqPlacement")} className="form-select">
                        <option value="same_page">Same Page</option>
                        <option value="separate">Separate Page</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      {watch("mcqPlacement") === "separate" ? (
                        <div className="row g-2">
                          <div className="col">
                            <label className="form-label">Objective Time (mins)</label>
                            <input
                              type="number"
                              {...register("mcqTimeMinutes", { valueAsNumber: true })}
                              className="form-control"
                            />
                          </div>
                          <div className="col">
                            <label className="form-label">Subjective Time (mins)</label>
                            <input
                              type="number"
                              {...register("subjectiveTimeMinutes", { valueAsNumber: true })}
                              className="form-control"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <label className="form-label">Total Time (mins)</label>
                          <input
                            type="number"
                            {...register("timeMinutes", { valueAsNumber: true })}
                            className="form-control"
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Shuffle Option */}
                  <div className="form-check form-switch mb-4">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="shuffleQuestions"
                      {...register("shuffleQuestions")}
                    />
                    <label className="form-check-label" htmlFor="shuffleQuestions">
                      Shuffle Questions
                    </label>
                    <div className="form-text">
                      Randomize the order of questions in each section
                    </div>
                  </div>

                  {/* Question Distribution */}
                  <div className="distribution-card mt-3 p-3 bg-light rounded shadow-sm">
                    <h6 className="fw-semibold mb-3">📊 Question Distribution</h6>

                    <div className="table-responsive">
                      <table className="table text-center align-middle">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: "20%" }}>Type</th>
                            <th style={{ width: "15%" }}>Total Qs</th>
                            <th style={{ width: "15%" }}>To Attempt</th>
                            <th style={{ width: "15%" }}>Marks Each</th>
                            <th style={{ width: "20%" }}>Difficulty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {["mcq", "short", "long"].map((type) => (
                            <tr key={type}>
                              <td className="fw-bold text-capitalize">
                                {type === "mcq" ? "MCQs" : type === "short" ? "Short" : "Long"}
                              </td>
                              <td className="text-center">
                                <input
                                  type="number"
                                  {...register(`${type}Count`, { valueAsNumber: true })}
                                  className="form-control text-center"
                                  placeholder="Total"
                                  min="0"
                                />
                              </td>
                              <td className="text-center">
                                <input
                                  type="number"
                                  {...register(`${type}ToAttempt`, { valueAsNumber: true })}
                                  className="form-control text-center"
                                  placeholder="Attempt"
                                  min="0"
                                />
                              </td>
                              <td className="text-center">
                                <input
                                  type="number"
                                  {...register(`${type}Marks`, { valueAsNumber: true })}
                                  className="form-control text-center"
                                  placeholder="Marks"
                                  min="1"
                                />
                              </td>
                              <td className="text-center">
                                <select
                                  {...register(`${type}Difficulty`)}
                                  className="form-select text-center"
                                >
                                  <option value="any">Any</option>
                                  <option value="easy">Easy</option>
                                  <option value="medium">Medium</option>
                                  <option value="hard">Hard</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Difficulty Mix */}
                  <div className="row mt-3">
                    {["easy", "medium", "hard"].map((level) => (
                      <div className="col" key={level}>
                        <label className="form-label text-capitalize">{level} %</label>
                        <input
                          type="number"
                          {...register(`${level}Percent`, { valueAsNumber: true })}
                          className="form-control"
                          min="0"
                          max="100"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next button */}
              <div className="mt-4 d-flex justify-content-end">
                <button className="btn btn-primary px-4" onClick={() => setStep(5)}>
                  Next <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Selection method */}
          {step === 5 && (
            <div>
              <label className="form-label">Question Selection Method</label>
              <div className="row row-cols-1 row-cols-md-2 g-4">
                <div className="col">
                  <div 
                    className={`card h-100 cursor-pointer p-3 border ${watchedSelectionMethod === 'auto' ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary'}`}
                    onClick={() => {
                      setValue('selectionMethod', 'auto');
                      setStep(7);
                    }}
                  >
                    <div className="card-body text-center">
                      <span className="display-6 mb-2">🤖</span>
                      <h5 className="card-title">Auto Generate</h5>
                      <p className="card-text">System will automatically select questions randomly based on your criteria</p>
                    </div>
                  </div>
                </div>
                <div className="col">
                  <div 
                    className={`card h-100 cursor-pointer p-3 border ${watchedSelectionMethod === 'manual' ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary'}`}
                    onClick={() => {
                      setValue('selectionMethod', 'manual');
                      setStep(6);
                    }}
                  >
                    <div className="card-body text-center">
                      <span className="display-6 mb-2">✍️</span>
                      <h5 className="card-title">Manual Selection</h5>
                      <p className="card-text">You will manually select each question</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Manual Question Selection */}
          {step === 6 && watchedSelectionMethod === 'manual' && (
            <div>
              <ManualQuestionSelection
                subjectId={watchedSubjectId}
                classId={watchedClassId} 
                chapterOption={watchedChapterOption}
                selectedChapters={watch('selectedChapters') || []}
                chapters={chapters}
                onQuestionsSelected={setSelectedQuestions}
                mcqCount={Number(watchedMcqCount)}
                shortCount={Number(watchedShortCount)}
                longCount={Number(watchedLongCount)}
                language={watch('language')}
                source_type={watch('source_type')}
              />
              <div className="mt-3">
                <button className="btn btn-primary" onClick={() => setStep(7)}>
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 7: Review and Generate */}
          {step === 7 && (
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="card mb-4">
                <div className="card-body">
                  <h2 className="h5 card-title mb-3">Paper Summary</h2>
                  <div className="row">
                    <div className="col-md-6">
                      <p><strong>Title:</strong> {watch('title')}</p>
                      <p><strong>Class:</strong> {classes.find(c => c.id === watch('classId'))?.name}</p>
                      <p><strong>Subject:</strong> {subjects.find(s => s.id === watch('subjectId'))?.name}</p>
                      <p><strong>Paper Type:</strong> {watch('paperType')}</p>
                      <p><strong>Language:</strong> {watch('language')}</p>
                    </div>
                    <div className="col-md-6">
                      <p><strong>Chapter Coverage:</strong> {watch('chapterOption')}</p>
                      <p><strong>Selection Method:</strong> {watch('selectionMethod')}</p>
                      <p><strong>Exam Time:</strong> {watch('timeMinutes')} minutes</p>
                      <p><strong>Shuffle Questions:</strong> {watch('shuffleQuestions') ? 'Yes' : 'No'}</p>
                      <p><strong>Difficulty Distribution:</strong> Easy {watch('easyPercent')}%, Medium {watch('mediumPercent')}%, Hard {watch('hardPercent')}%</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <h3 className="h6">Question Counts & Marks</h3>
                    <ul className="list-group">
                      <li className="list-group-item d-flex justify-content-between align-items-center">
                        MCQs
                        <span className="badge bg-primary rounded-pill">
                          {watch('mcqCount') || 0} questions ({watch('mcqToAttempt') || watch('mcqCount') || 0} to attempt) × {watch('mcqMarks') || 0} marks each
                        </span>
                      </li>
                      <li className="list-group-item d-flex justify-content-between align-items-center">
                        Short Questions
                        <span className="badge bg-primary rounded-pill">
                          {watch('shortCount') || 0} questions ({watch('shortToAttempt') || watch('shortCount') || 0} to attempt) × {watch('shortMarks') || 0} marks each
                        </span>
                      </li>
                      <li className="list-group-item d-flex justify-content-between align-items-center">
                        Long Questions
                        <span className="badge bg-primary rounded-pill">
                          {watch('longCount') || 0} questions ({watch('longToAttempt') || watch('longCount') || 0} to attempt) × {watch('longMarks') || 0} marks each
                        </span>
                      </li>
                      <li className="list-group-item d-flex justify-content-between align-items-center">
                        <strong>Total Marks</strong>
                        <span className="badge bg-success rounded-pill">
                          {(watch('mcqToAttempt') || watch('mcqCount') || 0) * (watch('mcqMarks') || 0) + 
                          (watch('shortToAttempt') || watch('shortCount') || 0) * (watch('shortMarks') || 0) + 
                          (watch('longToAttempt') || watch('longCount') || 0) * (watch('longMarks') || 0)} marks
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-3">
                    <p><strong>MCQ Placement:</strong> {watch('mcqPlacement') === 'separate' ? 'Separate page' : 'Same page as other questions'}</p>
                  </div>

                  {/* 🔥 Add randomization info for auto generation */}
                  {watch('selectionMethod') === 'auto' && watch('shuffleQuestions') && (
                    <div className="alert alert-info mt-3">
                      <i className="bi bi-shuffle me-2"></i>
                      <strong>Auto-randomization enabled:</strong> Questions will be randomly selected each time you generate.
                    </div>
                  )}
                </div>
              </div>

              <div className="d-flex gap-2 flex-wrap">
                <button 
                  className="btn btn-success" 
                  type="submit" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Generating...
                    </>
                  ) : 'Generate Paper'}
                </button>

                <button
                  className="btn btn-info text-white"
                  type="button"
                  onClick={async () => {
                    setIsDownloadingKey(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) {
                        alert('You must be logged in to download the MCQ key.');
                        return;
                      }

                      // Get the current form values
                      const formValues = getValues();
                      const method = formValues.selectionMethod;
                      
                      // Prepare payload with the same parameters used for paper generation
                      const payload = {
                        subjectId: watchedSubjectId,
                        selectedChapters: formValues.selectedChapters || [],
                        mcqCount: formValues.mcqCount,
                        selectionMethod: method,
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
                        // For manual selection, pass the exact question IDs
                        selectedQuestions: method === "manual" ? selectedQuestions : undefined,
                        // Add random seed for randomization
                        randomSeed: Date.now()
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
                        // Try to get error message from JSON response
                        try {
                          const err = await response.json();
                          alert("Failed: " + (err.message || 'Unknown error'));
                        } catch {
                          alert("Failed to generate answer key");
                        }
                      }
                    } catch (error) {
                      console.error("Error downloading MCQ key:", error);
                      alert("Failed to download MCQ key.");
                    } finally {
                      setIsDownloadingKey(false);
                    }
                  }}
                  disabled={isLoading || isDownloadingKey || watchedMcqCount === 0}
                >
                  {isDownloadingKey ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Downloading Key...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-key me-2"></i> Download MCQ Key
                    </>
                  )}
                </button>
                <button 
                  className="btn btn-outline-primary" 
                  type="button" 
                  onClick={resetForm}
                  disabled={isLoading}
                >
                  Generate New Paper
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Show upgrade prompt if trial expired */}
        {!canGeneratePaper() && trialStatus && isAuthenticated && (
          <div className="card mt-4">
            <div className="card-body text-center">
              <h3 className="card-title">Upgrade to Continue</h3>
              <p className="card-text">
                {trialStatus.isTrial 
                  ? "Your free trial has ended." 
                  : "Your free trial has ended."
                } Subscribe to continue generating papers.
              </p>
              <button 
                className="btn btn-primary btn-lg"
                onClick={() => window.location.href = '/dashboard/packages'}
              >
                View Subscription Plans
              </button>
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        .bi-shuffle.spinning {
          animation: spin 0.5s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AcademyLayout>
  );
}