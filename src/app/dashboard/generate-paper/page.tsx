/** app/dashboard/generate-paper/page.tsx */
'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  message?: string;
}

// 🎨 Modern TrialStatusBanner
const TrialStatusBanner = ({ trialStatus }: { trialStatus: TrialStatus | null }) => {
  if (!trialStatus) return null;

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
                <>{//Renews on {//trialStatus.subscriptionEndDate?.toLocaleDateString()}.
                }</>
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

// 🎨 Generation Progress Modal
const GenerationProgressModal = ({ 
  progress 
}: { 
  progress: { percentage: number; message: string; isVisible: boolean } 
}) => {
  if (!progress.isVisible) return null;

  return (
    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          <div className="modal-body p-5 text-center">
            {/* Animated Spinner with Percentage */}
            <div className="mb-4 position-relative" style={{ height: '100px' }}>
              <div className="position-absolute top-50 start-50 translate-middle">
                <div className="spinner-border text-primary" style={{ 
                  width: '80px', 
                  height: '80px',
                  borderWidth: '8px'
                }} role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                
                {/* Percentage inside spinner */}
                <div className="position-absolute top-50 start-50 translate-middle">
                  <span className="fw-bold fs-2 text-primary">{progress.percentage}%</span>
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="progress" style={{ height: '12px', borderRadius: '6px' }}>
                <div 
                  className="progress-bar progress-bar-striped progress-bar-animated" 
                  role="progressbar" 
                  style={{ 
                    width: `${progress.percentage}%`,
                    backgroundColor: '#0d6efd',
                    backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.3) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.3) 75%, transparent 75%, transparent)'
                  }}
                ></div>
              </div>
            </div>
            
            {/* Progress Message */}
            <h5 className="fw-bold mb-3 text-primary">
              {progress.message}
            </h5>
            
            {/* Animated dots for loading effect */}
            <div className="loading-dots">
              <span className="dot" style={{ 
                animation: 'bounce 1.4s infinite',
                animationDelay: '0s',
                backgroundColor: '#0d6efd'
              }}></span>
              <span className="dot" style={{ 
                animation: 'bounce 1.4s infinite',
                animationDelay: '0.2s',
                backgroundColor: '#0d6efd'
              }}></span>
              <span className="dot" style={{ 
                animation: 'bounce 1.4s infinite',
                animationDelay: '0.4s',
                backgroundColor: '#0d6efd'
              }}></span>
            </div>
            
            {/* Additional info */}
            <p className="text-muted mt-3 small">
              Please wait while we prepare your paper...
            </p>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-10px); }
        }
        
        .loading-dots {
          display: flex;
          justify-content: center;
          gap: 8px;
        }
        
        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }
        
        .progress-bar-animated {
          animation: progress-bar-stripes 1s linear infinite;
        }
        
        @keyframes progress-bar-stripes {
          0% { background-position: 1rem 0; }
          100% { background-position: 0 0; }
        }
      `}</style>
    </div>
  );
};

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

  const subjectChapters = useMemo(() => {
    return chapters.filter(chapter => chapter.subject_id === subjectId);
  }, [chapters, subjectId]);

  const getChapterIdsToUse = useCallback(() => {
    if (!subjectChapters || subjectChapters.length === 0) {
      return [];
    }
    
    const filteredChapters = subjectChapters.filter(chapter => 
      chapter.subject_id === subjectId && chapter.class_id === classId
    );
    
    if (filteredChapters.length === 0) {
      return [];
    }
    
    let selectedChapterIds: string[] = [];
    
    if (chapterOption === 'full_book') {
      selectedChapterIds = filteredChapters.map(c => c.id);
    } else if (chapterOption === 'half_book') {
      const halfIndex = Math.ceil(filteredChapters.length / 2);
      selectedChapterIds = filteredChapters.slice(0, halfIndex).map(c => c.id);
    } else if (chapterOption === 'single_chapter' && selectedChapters && selectedChapters.length > 0) {
      selectedChapterIds = selectedChapters;
    } else if (chapterOption === 'custom' && selectedChapters && selectedChapters.length > 0) {
      selectedChapterIds = selectedChapters;
    } else {
      return [];
    }
    
    return selectedChapterIds;
  }, [chapterOption, selectedChapters, chapters, subjectId, classId]);

  const shuffleQuestions = async (type: QuestionType) => {
    setIsShuffling(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setSelected(prev => {
      const newSelected = { ...prev };
      const availableQuestions = questions[type]
        .filter(q => !newSelected[type].includes(q.id))
        .map(q => q.id);
      
      const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5);
      const needed = requiredCounts[type] - newSelected[type].length;
      const toAdd = shuffled.slice(0, needed);
      
      newSelected[type] = [...newSelected[type], ...toAdd];
      return newSelected;
    });
    
    setIsShuffling(false);
  };

  const shuffleAll = async () => {
    setIsShuffling(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setSelected(prev => {
      const newSelected = { ...prev };
      (['mcq', 'short', 'long'] as QuestionType[]).forEach(type => {
        const availableQuestions = questions[type].map(q => q.id);
        const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5);
        newSelected[type] = shuffled.slice(0, requiredCounts[type]);
      });
      return newSelected;
    });
    
    setIsShuffling(false);
  };

  // Fixed language translation function
  const handleLanguageTranslation = (questions: Question[], language: string) => {
    return questions.map(question => {
      const translatedQuestion = { ...question };
      
      if (language !== 'english') {
        const isBi = language === 'bilingual';
        
        // Handle question text
        if (question.question_text_ur) {
          if (isBi) {
            // For bilingual, keep original English and add Urdu as separate property
            translatedQuestion.question_text_english = question.question_text;
            translatedQuestion.question_text_urdu = question.question_text_ur;
          } else {
            // For Urdu only, replace with Urdu text
            translatedQuestion.question_text = question.question_text_ur;
          }
        }
        
        // Handle MCQ options
        if (question.question_type === 'mcq') {
          const options = ['option_a', 'option_b', 'option_c', 'option_d'];
          options.forEach(opt => {
            const urduField = `${opt}_ur`;
            if (question[urduField]) {
              if (isBi) {
                // For bilingual, keep both versions as separate properties
                translatedQuestion[`${opt}_english`] = question[opt];
                translatedQuestion[`${opt}_urdu`] = question[urduField];
              } else {
                // For Urdu only, replace with Urdu text
                translatedQuestion[opt] = question[urduField];
              }
            }
          });
        }
      }
      
      return translatedQuestion;
    });
  };

  const fetchQuestions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const chapterIds = getChapterIdsToUse();
      
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

      // Use the fixed translation function
      const result = {
        mcq: handleLanguageTranslation(mcqResponse.data, language),
        short: handleLanguageTranslation(shortResponse.data, language),
        long: handleLanguageTranslation(longResponse.data, language),
      };

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
      fetchQuestions();
      setRequiredCounts({
        mcq: mcqCount,
        short: shortCount,
        long: longCount
      });
    }
  }, [subjectId, fetchQuestions, mcqCount, shortCount, longCount, subjectChapters]);

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
    <div className="card mt-4 step-transition">
      <div className="card-body">
        <h2 className="h4 card-title mb-3">Manual Question Selection</h2>
        
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
          .bi-shuffle.spinning {
            animation: spin 0.5s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
        
        <div className="alert alert-info mb-3">
          <strong>Selected Chapters:</strong> {getChapterIdsToUse().length} chapters
          {chapterOption === 'full_book' && ' (Full Book)'}
          {chapterOption === 'half_book' && ' (First Half)'}
          {chapterOption === 'single_chapter' && ' (Single Chapter)'}
          {chapterOption === 'custom' && ' (Custom Selection)'}
          <br />
          <small>{getSelectedChapterNames()}</small>
        </div>
        
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

        <div className="alert alert-info mb-4">
          {currentStep === 'mcq' && `Select ${requiredCounts.mcq} MCQs`}
          {currentStep === 'short' && `Select ${requiredCounts.short} Short Questions`}
          {currentStep === 'long' && `Select ${requiredCounts.long} Long Questions`}
        </div>
        
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
                        {/* Fixed question text display */}
                        <p 
                          className={`mb-1 fw-bold ${
                            language === 'urdu' ? 'urdu-text urdu-rtl' : 
                            language === 'bilingual' ? 'bilingual-text' : ''
                          }`}
                        >
                          {language === 'english' && question.question_text}
                          {language === 'urdu' && (question.question_text_urdu || question.question_text)}
                          {language === 'bilingual' && (
                            <>
                              <div style={{ direction: 'ltr', textAlign: 'left' }}>
                                {question.question_text_english || question.question_text}
                              </div>
                              <div style={{ direction: 'rtl', textAlign: 'right' }}>
                                {question.question_text_urdu}
                              </div>
                            </>
                          )}
                        </p>
                        
                  {currentStep === 'mcq' && (
  <div className={`mt-2 ${language === 'urdu' ? 'urdu-rtl' : ''}`}>
    {/* Options in a single row with bilingual on same line */}
    <div className="row g-1">
      {question.option_a && (
        <div className="col-12 col-md-6 col-lg-3 mb-2">
          <div className="option-container border rounded p-1 bg-light">
            <div className="d-flex justify-content-between align-items-start">
              <span className="badge bg-primary me-1">A)</span>
              <div className="flex-grow-1">
                {language === 'english' && (
                  <span className="d-block" style={{ fontFamily: "'Times New Roman', serif" }}>
                    {question.option_a}
                  </span>
                )}
                {language === 'urdu' && (
                  <span className="d-block urdu-text" style={{ textAlign: 'right' }}>
                    {question.option_a_urdu || question.option_a}
                  </span>
                )}
                {language === 'bilingual' && (
                  <div className="bilingual-same-line">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="english-option" style={{ 
                        fontFamily: "'Times New Roman', serif",
                        fontSize: '12px',
                        flex: 1,
                        paddingRight: '5px'
                      }}>
                        {question.option_a_english || question.option_a}
                      </span>
                      <span className="urdu-option urdu-text" style={{ 
                        fontSize: '12px',
                        flex: 1,
                        textAlign: 'right',
                        paddingLeft: '5px'
                      }}>
                        {question.option_a_urdu}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {question.option_b && (
        <div className="col-12 col-md-6 col-lg-3 mb-2">
          <div className="option-container border rounded p-1 bg-light">
            <div className="d-flex justify-content-between align-items-start">
              <span className="badge bg-primary me-1">B)</span>
              <div className="flex-grow-1">
                {language === 'english' && (
                  <span className="d-block" style={{ fontFamily: "'Times New Roman', serif" }}>
                    {question.option_b}
                  </span>
                )}
                {language === 'urdu' && (
                  <span className="d-block urdu-text" style={{ textAlign: 'right' }}>
                    {question.option_b_urdu || question.option_b}
                  </span>
                )}
                {language === 'bilingual' && (
                  <div className="bilingual-same-line">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="english-option" style={{ 
                        fontFamily: "'Times New Roman', serif",
                        fontSize: '12px',
                        flex: 1,
                        paddingRight: '5px'
                      }}>
                        {question.option_b_english || question.option_b}
                      </span>
                      <span className="urdu-option urdu-text" style={{ 
                        fontSize: '12px',
                        flex: 1,
                        textAlign: 'right',
                        paddingLeft: '5px'
                      }}>
                        {question.option_b_urdu}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {question.option_c && (
        <div className="col-12 col-md-6 col-lg-3 mb-2">
          <div className="option-container border rounded p-1 bg-light">
            <div className="d-flex justify-content-between align-items-start" >
              <span className="badge bg-primary me-1">C)</span>
              <div className="flex-grow-1">
                {language === 'english' && (
                  <span className="d-block" style={{ fontFamily: "'Times New Roman', serif" }}>
                    {question.option_c}
                  </span>
                )}
                {language === 'urdu' && (
                  <span className="d-block urdu-text" style={{ textAlign: 'right' }}>
                    {question.option_c_urdu || question.option_c}
                  </span>
                )}
                {language === 'bilingual' && (
                  <div className="bilingual-same-line">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="english-option" style={{ 
                        fontFamily: "'Times New Roman', serif",
                        fontSize: '12px',
                        flex: 1,
                        paddingRight: '5px'
                      }}>
                        {question.option_c_english || question.option_c}
                      </span>
                      <span className="urdu-option urdu-text" style={{ 
                        fontSize: '12px',
                        flex: 1,
                        textAlign: 'right',
                        paddingLeft: '5px'
                      }}>
                        {question.option_c_urdu}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {question.option_d && (
        <div className="col-12 col-md-6 col-lg-3 mb-2">
          <div className="option-container border rounded p-1 bg-light">
            <div className="d-flex justify-content-between align-items-start">
              <span className="badge bg-primary me-1">D)</span>
              <div className="flex-grow-1">
                {language === 'english' && (
                  <span className="d-block" style={{ fontFamily: "'Times New Roman', serif" }}>
                    {question.option_d}
                  </span>
                )}
                {language === 'urdu' && (
                  <span className="d-block urdu-text" style={{ textAlign: 'right' }}>
                    {question.option_d_urdu || question.option_d}
                  </span>
                )}
                {language === 'bilingual' && (
                  <div className="bilingual-same-line">
                    <div className="d-flex justify-content-between align-items-center" >
                      <span className="english-option" style={{ 
                        fontFamily: "'Times New Roman', serif",
                        fontSize: '12px',
                        flex: 1,
                        paddingRight: '5px'
                      }}>
                        {question.option_d_english || question.option_d}
                      </span>
                      <span className="urdu-option urdu-text" style={{ 
                        fontSize: '12px',
                        flex: 1,
                        textAlign: 'right',
                        paddingLeft: '5px'
                      }}>
                        {question.option_d_urdu}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
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

// Custom debounce hook
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
  
  // New states for paper preview and drag & drop
  const [isEditMode, setIsEditMode] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<Record<QuestionType, Question[]>>({
    mcq: [],
    short: [],
    long: [],
  });
  const [draggedQuestion, setDraggedQuestion] = useState<{ id: string; type: QuestionType } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  // Cache and optimization states
  const [questionsCache, setQuestionsCache] = useState<Record<string, Record<QuestionType, Question[]>>>({});
  const [lastPreviewLoad, setLastPreviewLoad] = useState<{
    subjectId: string;
    classId: string;
    chapterIds: string[];
    selectionMethod: string;
    language: string;
    source_type: string;
  } | null>(null);
  
  // Generation progress state
  const [generationProgress, setGenerationProgress] = useState({
    percentage: 0,
    message: 'Starting generation...',
    isVisible: false
  });

  // Scroll ref for chapter selection
  const chaptersListRef = useRef<HTMLDivElement>(null);

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

  // Use debounced values to prevent rapid reloading
  const debouncedSubjectId = useDebounce(watchedSubjectId, 500);
  const debouncedClassId = useDebounce(watchedClassId, 500);

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

  // Scroll to chapters list when chapter option changes to single_chapter or custom
  useEffect(() => {
    if ((watchedChapterOption === 'custom' || watchedChapterOption === 'single_chapter') && chaptersListRef.current) {
      setTimeout(() => {
        chaptersListRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
  }, [watchedChapterOption]);

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
        const response = await axios.get(`/api/chapters?subjectId=${watchedSubjectId}&classId=${watchedClassId}`);
        setChapters(response.data);
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

  // Fixed language translation function
  const handleLanguageTranslation = (questions: Question[], language: string) => {
    return questions.map(question => {
      const translatedQuestion = { ...question };
      
      if (language !== 'english') {
        const isBi = language === 'bilingual';
        
        // Handle question text
        if (question.question_text_ur) {
          if (isBi) {
            // For bilingual, keep original English and add Urdu as separate property
            translatedQuestion.question_text_english = question.question_text;
            translatedQuestion.question_text_urdu = question.question_text_ur;
          } else {
            // For Urdu only, replace with Urdu text
            translatedQuestion.question_text = question.question_text_ur;
          }
        }
        
        // Handle MCQ options
        if (question.question_type === 'mcq') {
          const options = ['option_a', 'option_b', 'option_c', 'option_d'];
          options.forEach(opt => {
            const urduField = `${opt}_ur`;
            if (question[urduField]) {
              if (isBi) {
                // For bilingual, keep both versions as separate properties
                translatedQuestion[`${opt}_english`] = question[opt];
                translatedQuestion[`${opt}_urdu`] = question[urduField];
              } else {
                // For Urdu only, replace with Urdu text
                translatedQuestion[opt] = question[urduField];
              }
            }
          });
        }
      }
      
      return translatedQuestion;
    });
  };

  // Load manual selected questions
  const loadManualSelectedQuestions = async () => {
    try {
      // Fetch details for each selected question
      const mcqPromises = selectedQuestions.mcq.map(questionId => 
        axios.get(`/api/questions/${questionId}`)
      );
      const shortPromises = selectedQuestions.short.map(questionId => 
        axios.get(`/api/questions/${questionId}`)
      );
      const longPromises = selectedQuestions.long.map(questionId => 
        axios.get(`/api/questions/${questionId}`)
      );

      const [mcqResponses, shortResponses, longResponses] = await Promise.all([
        Promise.all(mcqPromises),
        Promise.all(shortPromises),
        Promise.all(longPromises)
      ]);

      const language = watch('language');
      
      // Use the fixed translation function
      const result = {
        mcq: handleLanguageTranslation(mcqResponses.map(response => response.data), language),
        short: handleLanguageTranslation(shortResponses.map(response => response.data), language),
        long: handleLanguageTranslation(longResponses.map(response => response.data), language),
      };

      return result;
    } catch (error) {
      console.error('Error loading manual questions:', error);
      throw error;
    }
  };

  // FIXED: Load auto selected questions - Randomly from all chapters
  const loadAutoSelectedQuestions = async (chapterIds: string[], formValues: PaperFormData) => {
    try {
      const language = formValues.language;
      const sourceType = formValues.source_type;
      
      console.log('🔍 Loading auto questions with:', {
        mcqCount: formValues.mcqCount,
        shortCount: formValues.shortCount, 
        longCount: formValues.longCount,
        chapterIds: chapterIds.length,
        subjectId: watchedSubjectId,
        classId: watchedClassId
      });

      // Helper function to get random questions from ALL chapters
      const fetchRandomQuestionsByType = async (
        questionType: QuestionType, 
        count: number,
        chapterIds: string[]
      ) => {
        if (count <= 0) return [];
        
        try {
          console.log(`📥 Fetching ${count} ${questionType} questions from ${chapterIds.length} chapters`);
          
          // First, try to get enough questions with all chapters
          const response = await axios.get(`/api/questions`, {
            params: {
              subjectId: watchedSubjectId,
              classId: watchedClassId,
              questionType,
              chapterIds: chapterIds.join(','),
              language,
              includeUrdu: language !== 'english',
              sourceType: sourceType !== 'all' ? sourceType : undefined,
              limit: count * 3, // Fetch more to ensure we have enough for randomization
              random: true,
              shuffle: true // Ensure randomness
            },
          });
          
          let questions = response.data || [];
          console.log(`✅ Got ${questions.length} ${questionType} questions from database`);
          
          // If we don't have enough questions, try without source filter
          if (questions.length < count && sourceType !== 'all') {
            console.log(`🔄 Not enough ${questionType} questions, trying without source filter`);
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
            console.log(`🔄 Got ${fallbackQuestions.length} ${questionType} questions from fallback`);
            
            // Combine and deduplicate
            const combinedQuestions = [...questions, ...fallbackQuestions];
            const uniqueQuestions = combinedQuestions.filter((q, index, self) => 
              index === self.findIndex(q2 => q2.id === q.id)
            );
            
            questions = uniqueQuestions;
          }
          
          // Ensure questions are truly randomized across chapters
          if (questions.length > 0) {
            // Shuffle the array for true randomness
            const shuffled = [...questions].sort(() => Math.random() - 0.5);
            
            // If we have chapters, ensure distribution across chapters
            if (chapterIds.length > 1 && shuffled.length >= count) {
              const questionsByChapter: Record<string, Question[]> = {};
              
              // Group questions by chapter
              shuffled.forEach(question => {
                const chapterId = question.chapter_id;
                if (!questionsByChapter[chapterId]) {
                  questionsByChapter[chapterId] = [];
                }
                questionsByChapter[chapterId].push(question);
              });
              
              // Distribute questions across chapters
              const distributedQuestions: Question[] = [];
              const chaptersWithQuestions = Object.keys(questionsByChapter);
              
              if (chaptersWithQuestions.length > 0) {
                let chapterIndex = 0;
                let attempts = 0;
                const maxAttempts = count * 2; // Prevent infinite loop
                
                while (distributedQuestions.length < count && attempts < maxAttempts) {
                  const chapterId = chaptersWithQuestions[chapterIndex % chaptersWithQuestions.length];
                  const chapterQuestions = questionsByChapter[chapterId] || [];
                  
                  if (chapterQuestions.length > 0) {
                    const question = chapterQuestions.shift(); // Take one question from this chapter
                    if (question) {
                      distributedQuestions.push(question);
                    }
                  }
                  
                  chapterIndex++;
                  attempts++;
                  
                  // If we've gone through all chapters and still need more questions,
                  // take from whatever is left
                  if (chapterIndex >= chaptersWithQuestions.length * 2 && distributedQuestions.length < count) {
                    const remainingQuestions = shuffled.filter(q => 
                      !distributedQuestions.some(dq => dq.id === q.id)
                    );
                    distributedQuestions.push(...remainingQuestions.slice(0, count - distributedQuestions.length));
                    break;
                  }
                }
              }
              
              // If distribution didn't work, fall back to random selection
              if (distributedQuestions.length >= count) {
                return distributedQuestions.slice(0, count);
              }
            }
            
            // Fallback: just take the first 'count' shuffled questions
            return shuffled.slice(0, count);
          }
          
          return questions.slice(0, count);
        } catch (error) {
          console.error(`❌ Error fetching ${questionType} questions:`, error);
          return [];
        }
      };

      // Fetch all question types in parallel with improved randomization
      const [mcqQuestions, shortQuestions, longQuestions] = await Promise.all([
        fetchRandomQuestionsByType('mcq', formValues.mcqCount, chapterIds),
        fetchRandomQuestionsByType('short', formValues.shortCount, chapterIds),
        fetchRandomQuestionsByType('long', formValues.longCount, chapterIds),
      ]);

      console.log('🎯 Final question distribution:', {
        mcq: mcqQuestions.length,
        short: shortQuestions.length,
        long: longQuestions.length,
        totalChaptersUsed: [...new Set([
          ...mcqQuestions.map(q => q.chapter_id),
          ...shortQuestions.map(q => q.chapter_id),
          ...longQuestions.map(q => q.chapter_id)
        ])].length,
        expected: {
          mcq: formValues.mcqCount,
          short: formValues.shortCount,
          long: formValues.longCount
        }
      });

      // Log chapter distribution for debugging
      if (chapterIds.length > 1) {
        const chapterDistribution: Record<string, number> = {};
        [...mcqQuestions, ...shortQuestions, ...longQuestions].forEach(q => {
          const chapterNo = chapters.find(c => c.id === q.chapter_id)?.chapterNo || 'Unknown';
          chapterDistribution[chapterNo] = (chapterDistribution[chapterNo] || 0) + 1;
        });
        console.log('📊 Chapter distribution:', chapterDistribution);
      }

      // Use the fixed translation function
      const result = {
        mcq: handleLanguageTranslation(mcqQuestions, language),
        short: handleLanguageTranslation(shortQuestions, language),
        long: handleLanguageTranslation(longQuestions, language),
      };

      return result;
    } catch (error) {
      console.error('❌ Error loading auto questions:', error);
      throw error;
    }
  };

  // Optimized load preview questions when reaching step 7
  const loadPreviewQuestions = async () => {
    try {
      setIsLoadingPreview(true);
      
      // Get selected chapter IDs
      const chapterIds = getChapterIdsToUse();
      
      console.log('🔄 Loading preview questions...', {
        chapterIds: chapterIds.length,
        subjectId: watchedSubjectId,
        classId: watchedClassId,
        selectionMethod: watch('selectionMethod'),
        paperType: watch('paperType')
      });

      if (chapterIds.length === 0) {
        console.error('❌ No chapters selected');
        setPreviewQuestions({ mcq: [], short: [], long: [] });
        return;
      }

      const formValues = getValues();
      
      console.log('📋 Form values for preview:', {
        mcqCount: formValues.mcqCount,
        shortCount: formValues.shortCount,
        longCount: formValues.longCount,
        mcqMarks: formValues.mcqMarks,
        shortMarks: formValues.shortMarks,
        longMarks: formValues.longMarks,
        selectionMethod: formValues.selectionMethod
      });

      // Fetch real questions based on selection method
      let result: Record<QuestionType, Question[]>;
      
      if (formValues.selectionMethod === 'manual' && Object.keys(selectedQuestions).some(type => selectedQuestions[type as QuestionType].length > 0)) {
        console.log('🔧 Using manual selection');
        // For manual selection, fetch the specific selected questions
        result = await loadManualSelectedQuestions();
      } else {
        console.log('🤖 Using auto selection');
        // For auto selection, fetch questions based on criteria
        result = await loadAutoSelectedQuestions(chapterIds, formValues);
      }
      
      console.log('✅ Preview questions loaded:', {
        mcq: result.mcq.length,
        short: result.short.length,
        long: result.long.length
      });

      setPreviewQuestions(result);
      
    } catch (error) {
      console.error('❌ Error loading preview questions:', error);
      alert('Failed to load questions for preview. Please try again.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Force refresh preview when paper type changes
  useEffect(() => {
    if (step === 7 && watchedPaperType) {
      // Clear cache and reload when paper type changes
      setQuestionsCache({});
      setLastPreviewLoad(null);
      loadPreviewQuestions();
    }
  }, [watchedPaperType]);

  // Fixed useEffect for step 7 loading - FORCE RELOAD
  useEffect(() => {
    if (step === 7 && watchedSubjectId && watchedClassId) {
      console.log('🎯 Step 7 activated - FORCE loading preview');
      
      // Clear any cached data to force fresh load
      setQuestionsCache({});
      setLastPreviewLoad(null);
      
      const chapterIds = getChapterIdsToUse();
      
      if (chapterIds.length > 0) {
        // Small delay to ensure form values are updated
        setTimeout(() => {
          loadPreviewQuestions();
        }, 100);
      } else {
        console.warn('⚠️ No chapters selected, skipping preview load');
        setPreviewQuestions({ mcq: [], short: [], long: [] });
      }
    }
  }, [step, watchedSubjectId, watchedClassId]);

  // Listen for form value changes and reload preview
  useEffect(() => {
    if (step === 7) {
      console.log('📊 Form values changed in step 7:', {
        mcqCount: watchedMcqCount,
        shortCount: watchedShortCount,
        longCount: watchedLongCount,
        paperType: watchedPaperType
      });
      
      const timer = setTimeout(() => {
        loadPreviewQuestions();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [watchedMcqCount, watchedShortCount, watchedLongCount, watchedPaperType, step]);

  // Additional effect to reload when question counts change while on step 7
  useEffect(() => {
    if (step === 7) {
      console.log('🔄 Question counts changed, reloading preview', {
        mcq: watchedMcqCount,
        short: watchedShortCount,
        long: watchedLongCount
      });
      
      // Debounce the reload to prevent too many requests
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

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, questionId: string, questionType: QuestionType) => {
    setDraggedQuestion({ id: questionId, type: questionType });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetType: QuestionType) => {
    e.preventDefault();
    
    if (!draggedQuestion) return;

    // Only allow reordering within the same section
    if (draggedQuestion.type === targetType) {
      const questions = [...previewQuestions[targetType]];
      const draggedIndex = questions.findIndex(q => q.id === draggedQuestion.id);
      
      if (draggedIndex !== -1) {
        // Get drop position
        const dropIndex = getDropIndex(e.currentTarget as HTMLElement, e.clientY, questions);
        
        if (dropIndex !== -1) {
          // Remove dragged item from current position
          const [draggedItem] = questions.splice(draggedIndex, 1);
          
          // Insert at new position (below the target)
          let newIndex = dropIndex;
          if (draggedIndex < dropIndex) {
            newIndex = dropIndex - 1; // Adjust index since we removed an item before this position
          }
          
          questions.splice(newIndex, 0, draggedItem);
          
          setPreviewQuestions(prev => ({
            ...prev,
            [targetType]: questions
          }));
        }
      }
    }
    
    setDraggedQuestion(null);
  };

  const getDropIndex = (container: HTMLElement, y: number, questions: Question[]): number => {
    const questionElements = container.querySelectorAll('.question-item');
    if (questionElements.length === 0) return questions.length; // Add to end

    for (let i = 0; i < questionElements.length; i++) {
      const element = questionElements[i];
      const rect = element.getBoundingClientRect();
      const middle = rect.top + rect.height / 2;
      
      if (y < middle) {
        return i; // Drop above this element
      }
    }
    
    return questions.length; // Drop at the end
  };

  const handleDragEnd = () => {
    setDraggedQuestion(null);
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

  // FIXED: onSubmit with comprehensive auth error handling
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

    // Show progress modal
    setGenerationProgress({
      percentage: 0,
      message: 'Starting paper generation...',
      isVisible: true
    });

    setIsLoading(true);

    try {
      // 1. Get current session with error handling
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        setGenerationProgress(prev => ({ ...prev, isVisible: false }));
        setIsLoading(false);
        alert('Authentication error. Please try logging in again.');
        window.location.href = '/login';
        return;
      }

      if (!session) {
        console.error('No session found');
        setGenerationProgress(prev => ({ ...prev, isVisible: false }));
        setIsLoading(false);
        alert('Your session has expired. Please log in again.');
        window.location.href = '/login';
        return;
      }

      const user = session.user;
      let accessToken = session.access_token;

      // Update progress
      setGenerationProgress({
        percentage: 10,
        message: 'Preparing paper data...',
        isVisible: true
      });

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
          setGenerationProgress(prev => ({ ...prev, isVisible: false }));
          setIsLoading(false);
          alert('Your session has expired. Please log in again.');
          window.location.href = '/login';
          return;
        }
      }

      // 3. Validate token format
      if (!accessToken || accessToken.split('.').length !== 3) {
        console.error('Invalid token format');
        setGenerationProgress(prev => ({ ...prev, isVisible: false }));
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
        setGenerationProgress(prev => ({ ...prev, isVisible: false }));
        setIsLoading(false);
        alert('No chapters found for the selected subject and class. Please check your selection.');
        return;
      }

      // Validate we're requesting questions
      if (formData.mcqCount === 0 && formData.shortCount === 0 && formData.longCount === 0) {
        setGenerationProgress(prev => ({ ...prev, isVisible: false }));
        setIsLoading(false);
        alert('Please select at least one question type with count greater than 0.');
        return;
      }

      // Validate attempt counts
      if (
        formData.mcqToAttempt > formData.mcqCount ||
        formData.shortToAttempt > formData.shortCount ||
        formData.longToAttempt > formData.longCount
      ) {
        setGenerationProgress(prev => ({ ...prev, isVisible: false }));
        setIsLoading(false);
        alert("Please fix the 'To Attempt' values. They cannot exceed 'Total Qs'.");
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

      // Update progress
      setGenerationProgress({
        percentage: 25,
        message: 'Validating question selection...',
        isVisible: true
      });

      // Prepare selected questions based on current preview order
      const selectedQuestionsFromPreview = {
        mcq: previewQuestions.mcq.map(q => q.id),
        short: previewQuestions.short.map(q => q.id),
        long: previewQuestions.long.map(q => q.id)
      };

      // Calculate total time based on layout
      let totalTimeMinutes = formData.timeMinutes;
      if (formData.mcqPlacement === 'separate') {
        // For separate layout, sum objective and subjective times
        totalTimeMinutes = (formData.mcqTimeMinutes || 0) + (formData.subjectiveTimeMinutes || 0);
      }

      // Prepare questions with custom marks for PDF generation
      const questionsWithCustomMarks = {
        mcq: previewQuestions.mcq.map(q => ({
          ...q,
          marks: q.customMarks || formData.mcqMarks,
          defaultMarks: formData.mcqMarks
        })),
        short: previewQuestions.short.map(q => ({
          ...q,
          marks: q.customMarks || formData.shortMarks,
          defaultMarks: formData.shortMarks
        })),
        long: previewQuestions.long.map(q => ({
          ...q,
          marks: q.customMarks || formData.longMarks,
          defaultMarks: formData.longMarks
        }))
      };

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
        mcqToAttempt: formData.mcqToAttempt || formData.mcqCount,
        shortToAttempt: formData.shortToAttempt || formData.shortCount,
        longToAttempt: formData.longToAttempt || formData.longCount,
        selectedQuestions: selectedQuestionsFromPreview,
        language: formData.language,
        shuffleQuestions: formData.shuffleQuestions,
        reorderedQuestions: questionsWithCustomMarks,
        questionOrder: {
          mcq: previewQuestions.mcq.map((q, index) => ({ 
            id: q.id, 
            order: index + 1,
            marks: q.customMarks || formData.mcqMarks 
          })),
          short: previewQuestions.short.map((q, index) => ({ 
            id: q.id, 
            order: index + 1,
            marks: q.customMarks || formData.shortMarks 
          })),
          long: previewQuestions.long.map((q, index) => ({ 
            id: q.id, 
            order: index + 1,
            marks: q.customMarks || formData.longMarks 
          }))
        },
        customMarksData: {
          mcq: previewQuestions.mcq.map(q => ({
            questionId: q.id,
            marks: q.customMarks || formData.mcqMarks
          })),
          short: previewQuestions.short.map(q => ({
            questionId: q.id,
            marks: q.customMarks || formData.shortMarks
          })),
          long: previewQuestions.long.map(q => ({
            questionId: q.id,
            marks: q.customMarks || formData.longMarks
          }))
        }
      };

      // Update progress
      setGenerationProgress({
        percentage: 40,
        message: 'Sending request to server...',
        isVisible: true
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
        setGenerationProgress(prev => ({ ...prev, isVisible: false }));
        setIsLoading(false);
        alert('Authentication token missing. Please log in again.');
        window.location.href = '/login';
        return;
      }

      // Log the payload for debugging
      console.log('📤 Submitting payload to API:', {
        mcqPlacement: payload.mcqPlacement,
        totalQuestions: payload.mcqCount + payload.shortCount + payload.longCount,
        attemptQuestions: payload.mcqToAttempt + payload.shortToAttempt + payload.longToAttempt,
        timeMinutes: payload.timeMinutes,
        layoutType: payload.mcqPlacement === 'two_papers' ? 'Two Papers Layout' : 
                   payload.mcqPlacement === 'separate' ? 'Separate Layout' : 'Single Page Layout',
        hasToken: !!accessToken
      });

      // Update progress
      setGenerationProgress({
        percentage: 60,
        message: 'Generating PDF content...',
        isVisible: true
      });

      // Perform the fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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
        
        if (fetchError.name === 'AbortError') {
          console.error('Request timeout');
          alert('Request timeout. Please try again.');
        } else {
          console.error('Fetch error:', fetchError);
          alert('Network error. Please check your connection and try again.');
        }
        
        setGenerationProgress(prev => ({ ...prev, isVisible: false }));
        setIsLoading(false);
        return;
      }
      
      clearTimeout(timeoutId);
      
      const contentType = response.headers.get("content-type") || "";
      
      if (response.ok) {
        // Update progress
        setGenerationProgress({
          percentage: 80,
          message: 'Finalizing PDF...',
          isVisible: true
        });
        
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
        
        if (contentType.includes('application/json')) {
          try {
            const json = await response.json();
            console.error('API error response JSON:', json);
            
            // Handle authentication errors
            if (response.status === 401 || response.status === 403) {
              if (json.message?.includes('session') || json.error?.includes('Auth') || Object.keys(json).length === 0) {
                alert('Your session has expired. Please log in again.');
                window.location.href = '/login';
              } else {
                alert(json.error || json.message || 'Authentication failed.');
              }
            } else {
              alert(json.error || json.message || `Server error (${response.status})`);
            }
          } catch (jsonError) {
            console.error('Failed to parse JSON error:', jsonError);
            alert(`Server error (${response.status}). Please try again.`);
          }
        } else {
          try {
            const text = await response.text();
            console.error('API error response text:', text);
            
            if (response.status === 401 || response.status === 403) {
              alert('Authentication failed. Please log in again.');
              window.location.href = '/login';
            } else if (text) {
              alert(text);
            } else {
              alert(`Server error (${response.status}). Please try again.`);
            }
          } catch (textError) {
            console.error('Failed to read error text:', textError);
            alert(`Server error (${response.status}). Please try again.`);
          }
        }
        
        setGenerationProgress(prev => ({ ...prev, isVisible: false }));
        setIsLoading(false);
        return;
      }
      
      // Handle successful PDF response
      if (response.ok && contentType.includes("application/pdf")) {
        setGenerationProgress({
          percentage: 95,
          message: 'Downloading PDF...',
          isVisible: true
        });
        
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
          
          setGenerationProgress({
            percentage: 100,
            message: 'Paper generated successfully!',
            isVisible: true
          });
          
          setTimeout(() => {
            setGenerationProgress(prev => ({ ...prev, isVisible: false }));
          }, 1000);
          
        } catch (blobError) {
          console.error('Error processing PDF blob:', blobError);
          alert('Failed to download PDF. Please try again.');
          setGenerationProgress(prev => ({ ...prev, isVisible: false }));
        }
      } else if (contentType.includes("application/json")) {
        try {
          const result = await response.json();
          alert(result.error || result.message || "Paper generated, but no PDF was returned.");
        } catch (jsonError) {
          console.error('Failed to parse JSON response:', jsonError);
          alert('Server returned unexpected response.');
        }
      } else {
        try {
          const text = await response.text();
          alert(text || "Failed to generate paper (unknown error)");
        } catch (textError) {
          console.error('Failed to read response text:', textError);
          alert('Server error occurred. Please try again.');
        }
      }
    } catch (error) {
      console.error('Unexpected error generating paper:', error);
      alert("An unexpected error occurred. Please try again.");
      
      setGenerationProgress(prev => ({ ...prev, isVisible: false }));
    } finally {
      setIsLoading(false);
      
      setTimeout(() => {
        setGenerationProgress(prev => ({ ...prev, isVisible: false }));
      }, 2000);
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
    setPreviewQuestions({
      mcq: [],
      short: [],
      long: [],
    });
    setIsEditMode(false);
    setQuestionsCache({});
    setLastPreviewLoad(null);
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

  const getSubjectIcon = (subjectName: string) => {
    const name = subjectName.toLowerCase();
    if (name.includes('computer') || name.includes('it')) return '💻';
    else if (name.includes('math')) return '📊';
    else if (name.includes('physics')) return '⚛️';
    else if (name.includes('chemistry')) return '🧪';
    else if (name.includes('biology')) return '🧬';
    else if (name.includes('english')) return '📖';
    else if (name.includes('urdu')) return '📜';
    else if (name.includes('islamiyat')) return '☪️';
    else if (name.includes('pakistan')) return '🇵🇰';
    else return '📘';
  };

  // Helper function to calculate total marks based on "To Attempt" values
  const calculateTotalMarks = () => {
    const formValues = getValues();
    
    // Calculate marks for each section based on "To Attempt" values
    const mcqAttempt = formValues.mcqToAttempt || formValues.mcqCount;
    const shortAttempt = formValues.shortToAttempt || formValues.shortCount;
    const longAttempt = formValues.longToAttempt || formValues.longCount;
    
    // Use custom marks if available, otherwise use default marks
    const mcqMarks = previewQuestions.mcq.length > 0 
      ? previewQuestions.mcq.slice(0, mcqAttempt).reduce((total, q) => total + (q.customMarks || formValues.mcqMarks), 0)
      : mcqAttempt * formValues.mcqMarks;
    
    const shortMarks = previewQuestions.short.length > 0
      ? previewQuestions.short.slice(0, shortAttempt).reduce((total, q) => total + (q.customMarks || formValues.shortMarks), 0)
      : shortAttempt * formValues.shortMarks;
    
    const longMarks = previewQuestions.long.length > 0
      ? previewQuestions.long.slice(0, longAttempt).reduce((total, q) => total + (q.customMarks || formValues.longMarks), 0)
      : longAttempt * formValues.longMarks;
    
    return {
      mcq: mcqMarks,
      short: shortMarks,
      long: longMarks,
      total: mcqMarks + shortMarks + longMarks
    };
  };

  return (
    <AcademyLayout>
      <div className="container mx-auto px-0 py-4">
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
          .answer-space {
            border: 1px dashed #dee2e6;
            background: repeating-linear-gradient(
              0deg,
              transparent,
              transparent 20px,
              #f8f9fa 20px,
              #f8f9fa 21px
            );
          }
          .modal-backdrop {
            z-index: 1050 !important;
          }
          .modal {
            z-index: 1055 !important;
          }
          
          /* Mobile Responsive Styles */
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

        {trialLoading && (
          <div className="alert alert-info mb-4">
            <div className="spinner-border spinner-border-sm me-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            Loading your account information...
          </div>
        )}

        <TrialStatusBanner trialStatus={trialStatus} />
        
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

        {/* Generation Progress Modal */}
        <GenerationProgressModal progress={generationProgress} />

        {!isAuthenticated && (
          <div className="alert alert-warning mb-4">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Please <a href="/login" className="alert-link">login</a> to generate papers.
          </div>
        )}

        <div style={{ 
          opacity: canGeneratePaper() && isAuthenticated ? 1 : 0.6,
          pointerEvents: canGeneratePaper() && isAuthenticated ? 'auto' : 'none'
        }}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1 className="h2 mb-0">Generate <span className='d-none d-sm-inline'>New</span> Paper</h1>
            {step > 1 && (
              <button className="btn btn-outline-primary btn-lg" onClick={prevStep}>
                <i className="bi bi-arrow-left me-2"></i>

                {/* Mobile text (visible only on xs screens) */}
                <span className="d-inline d-sm-none">Back</span>

                {/* Desktop text (hidden on xs screens) */}
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

          {/* Enhanced Step Progress Indicator */}
          <div className="mb-3">
            <div 
              className="d-flex justify-content-between align-items-center mb-3 progress-scroll"
            >
              {[
                { step: 1, label: 'Select Class', icon: '🎓' },
                { step: 2, label: 'Select Subject', icon: '📚' },
                { step: 3, label: 'Select Chapters', icon: '📖' },
                { step: 4, label: 'Select Paper Type', icon: '📝' },
                { step: 5, label: 'Select Method', icon: '🤖' },
                { step: 6, label: 'Question Selection', icon: '✍️' },
                { step: 7, label: 'Review', icon: '👁️' }
              ].map((item, index) => (
                <div key={item.step} className="d-flex flex-column align-items-center position-relative me-4">
                  <span>{index+1}</span>
                  {index > 0 && (
                    <div 
                      className={`position-absolute top-50 start-0 w-100 h-2 ${
                        step > item.step ? 'bg-primary' : 'bg-light'
                      }`}
                      style={{ zIndex: 1, transform: 'translateY(-50%)' }}
                    ></div>
                  )}

                  <div 
                    className={`rounded-circle d-flex align-items-center justify-content-center position-relative ${
                      step >= item.step ? 'bg-primary text-white' : 'bg-light text-muted'
                    }`}
                    style={{ 
                      width: '50px', 
                      height: '50px', 
                      zIndex: 2,
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {step > item.step ? (
                      <i className="bi bi-check-lg fs-6"></i>
                    ) : (
                      <span className="fs-5">{item.icon}</span>
                    )}
                  </div>
                  
                  <small className={`mt-2 fw-semibold ${step >= item.step ? 'text-primary' : 'text-muted'}`}>
                    {item.label}
                  </small>
                </div>
              ))}
            </div>

            <div className="text-center">
              <small className="text-muted">
                Step {step} of 7 - {
                  step === 1 ? 'Selecting Class' :
                  step === 2 ? 'Choosing Subject' :
                  step === 3 ? 'Setting Chapter Coverage' :
                  step === 4 ? 'Configuring Paper Type' :
                  step === 5 ? 'Selection Method' :
                  step === 6 ? 'Manual Question Selection' :
                  'Final Review & Generation'
                }
              </small>
            </div>
          </div>

          {/* Step 1: Class selection */}
          {step === 1 && (
            <div className="step-card step-transition">
              <div className="text-center mb-3">
                <h5 className="fw-bold mb-3">🎓 Select Your Class</h5>
                <p className="text-muted">Choose the class for which you want to generate the paper</p>
              </div>
              
              {classes.length === 0 ? (
                <div className="loading-state text-center py-5">
                  <div className="spinner-border text-primary mb-3" role="status" style={{width: '3rem', height: '3rem'}}>
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="fs-5 text-muted">Loading classes...</p>
                </div>
              ) : (
                <div className="row row-cols-2 row-cols-md-4 g-4">
                  {classes.map((cls) => (
                    <div key={cls.id} className="col">
                      <div
                        className={`option-card card h-20 text-center p-2 cursor-pointer ${
                          watchedClassId === cls.id ? "active border-primary" : "border-light"
                        }`}
                        onClick={() => setValue("classId", cls.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="card-body d-flex flex-column justify-content-center p-2 p-sm-1">
                          <span className="display-6 mb-3">🎓</span>
                          <h6 className="fw-semibold mb-2">Class {cls.name}</h6>
                          <small className="text-muted d-none d-sm-inline">Select to continue</small>
                          
                          {watchedClassId === cls.id && (
                            <div className="mt-3">
                              <span className="badge bg-primary rounded-pill">
                                <i className="bi bi-check-circle me-1"></i>
                                Selected
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {errors.classId && (
                <div className="alert alert-danger mt-3" role="alert">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {errors.classId.message}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Subject selection */}
          {step === 2 && (
            <div className="step-card step-transition">
              <div className="text-center mb-3">
                <h5 className="fw-bold mb-3">📚 Select Subject</h5>
                <p className="text-muted">Choose the subject for your paper</p>
              </div>
              
              {watchedClassId && subjects.length === 0 ? (
                <div className="loading-state text-center py-5">
                  <div className="spinner-border text-primary mb-3" role="status" style={{width: '3rem', height: '3rem'}}>
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="fs-5 text-muted">Loading subjects for Class {classes.find(c => c.id === watchedClassId)?.name}...</p>
                </div>
              ) : (
                <div className="row row-cols-2 row-cols-md-4 g-4">
                  {subjects.map((subject) => {
                    const subjectIcon = getSubjectIcon(subject.name);

                    return (
                      <div key={subject.id} className="col px-1">
                        <div
                          className={`option-card card h-10 text-center p-0 cursor-pointer ${
                            watchedSubjectId === subject.id ? "active border-primary" : "border-light"
                          }`}
                          onClick={() => setValue("subjectId", subject.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="card-body d-flex flex-column justify-content-center p-2">
                            <span className="display-6 mb-3">{subjectIcon}</span>
                            <h6 className="fw-semibold mb-2">{subject.name}</h6>
                            <small className="text-muted d-none d-sm-inline">Click to select</small>
                            
                            {watchedSubjectId === subject.id && (
                              <div className="mt-3">
                                <span className="badge bg-primary rounded-pill">
                                  <i className="bi bi-check-circle me-1"></i>
                                  Selected
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {errors.subjectId && (
                <div className="alert alert-danger mt-3" role="alert">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {errors.subjectId.message}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Chapter selection - WITH AUTO-SCROLL FIX */}
          {step === 3 && (
            <div className="step-transition">
              <div className="text-center mb-3">
                <h5 className="fw-bold mb-3">📖 Chapter Coverage</h5>
                <p className="text-muted">Select how you want to cover chapters for {subjects.find(s => s.id === watchedSubjectId)?.name}</p>
              </div>

              <div className="row row-cols-1 row-cols-md-2 g-4 mb-4">
                {[
                  { value: 'full_book', icon: '📖', title: 'Full Book', desc: 'Cover all chapters in the subject' },
                  { value: 'half_book', icon: '📘', title: 'Half Book', desc: 'Cover first half of the chapters' },
                  { value: 'single_chapter', icon: '📄', title: 'Single Chapter', desc: 'Select one specific chapter' },
                  { value: 'custom', icon: '🎛️', title: 'Custom Selection', desc: 'Choose multiple chapters' }
                ].map((option) => (
                  <div key={option.value} className="col">
                    <div 
                      className={`card h-100 cursor-pointer p-4 transition-all ${
                        watchedChapterOption === option.value ? 'border-primary bg-primary bg-opacity-10 shadow' : 'border-light'
                      }`}
                      onClick={() => {
                        setValue('chapterOption', option.value as any);
                        if (option.value === 'full_book' || option.value === 'half_book') {
                          setValue('selectedChapters', []);
                          setTimeout(() => setStep(4), 300);
                        }
                        // For single_chapter, reset selected chapters
                        if (option.value === 'single_chapter') {
                          setValue('selectedChapters', []);
                        }
                      }}
                      style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                    >
                      <div className="card-body text-center">
                        <span className="display-6 mb-3">{option.icon}</span>
                        <h5 className="card-title fw-bold">{option.title}</h5>
                        <p className="card-text text-muted">{option.desc}</p>
                        
                        {watchedChapterOption === option.value && (
                          <div className="mt-3">
                            <span className="badge bg-primary rounded-pill">
                              <i className="bi bi-check-circle me-1"></i>
                              Selected
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add ref to this section for auto-scroll */}
              <div ref={chaptersListRef}>
                {(watchedChapterOption === 'custom' || watchedChapterOption === 'single_chapter') && (
                  <div className="step-transition mt-5">
                    <h6 className="fw-bold mb-4 text-center">
                      {watchedChapterOption === 'single_chapter' ? 'Select Chapter' : 'Select Chapters'}
                    </h6>
                    
                    {chapters.length === 0 ? (
                      <div className="text-center py-4">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading chapters...</span>
                        </div>
                        <p className="mt-2 text-muted">Loading chapters...</p>
                      </div>
                    ) : chapters.filter(chapter => chapter.subject_id === watchedSubjectId).length === 0 ? (
                      <div className="alert alert-warning text-center">
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        No chapters found for the selected subject.
                      </div>
                    ) : (
                      <>
                        <div className="row row-cols-2 row-cols-md-4 g-3">
                          {chapters
                            .filter(chapter => chapter.subject_id === watchedSubjectId)
                            .map(chapter => {
                              const selectedChapters = watch('selectedChapters') || [];
                              const isSelected = selectedChapters.includes(chapter.id);
                              
                              // For single_chapter, auto-move to step 4 when a chapter is selected
                              const handleClick = () => {
                                handleChapterSelection(chapter.id);
                                if (watchedChapterOption === 'single_chapter') {
                                  setTimeout(() => setStep(4), 300);
                                }
                              };
                              
                              return (
                                <div key={chapter.id} className="col">
                                  <div
                                    className={`card h-100 cursor-pointer p-3 transition-all ${
                                      isSelected ? 'border-primary bg-primary bg-opacity-10' : 'border-light'
                                    }`}
                                    onClick={handleClick}
                                    style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                                  >
                                    <div className="card-body text-center">
                                      <span className="display-6 mb-2">📖</span>
                                      <h6 className="card-title">{chapter.chapterNo}. {chapter.name}</h6>
                                      
                                      {isSelected && (
                                        <div className="mt-2">
                                          <span className="badge bg-success rounded-pill">
                                            <i className="bi bi-check me-1"></i>
                                            Selected
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                        
                        {watchedChapterOption === 'custom' && (
                          <div className="text-center mt-4">
                            <button 
                              className="btn btn-primary px-4"
                              onClick={() => setStep(4)}
                              disabled={!watch('selectedChapters')?.length}
                            >
                              Continue to Paper Type <i className="bi bi-arrow-right ms-2"></i>
                            </button>
                            <div className="mt-2">
                              <small className="text-muted">
                                {watch('selectedChapters')?.length || 0} chapters selected
                              </small>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Paper Type Selection */}
          {step === 4 && (
            <div className="step-card step-transition">
              <div className="text-center mb-3">
                <h5 className="fw-bold mb-3">📝 Select Paper Type</h5>
                <p className="text-muted">Choose between predefined board pattern or customize your own paper</p>
              </div>

              <div className="row g-4">
                {/* Board Paper Card */}
                <div className="col-md-6">
                  <div
                    className={`option-card card h-100 p-2 cursor-pointer ${
                      watch("paperType") === "model" ? "active border-primary shadow" : "border-light"
                    }`}
                    onClick={() => {
                      // First clear everything
                      setSelectedQuestions({ mcq: [], short: [], long: [] });
                      setPreviewQuestions({ mcq: [], short: [], long: [] });
                      setQuestionsCache({});
                      setLastPreviewLoad(null);
                      
                      // Then set values with a small delay between them
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
                      setValue("source_type", "all");
                      setValue("selectionMethod", "auto");
                      
                      console.log('🏛️ Board Paper selected with values:', {
                        mcqCount: 12,
                        shortCount: 24,
                        longCount: 3,
                        mcqToAttempt: 12,
                        shortToAttempt: 16,
                        longToAttempt: 2
                      });
                      
                      // Force state update and then proceed
                      setTimeout(() => {
                        setStep(5);
                      }, 100);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="card-body p-0">
                      <div className="text-center mb-4">
                        <span className="display-6">🏛️</span>
                        <h4 className="mt-3 fw-bold">Board Paper</h4>
                        <p className="text-muted mb-4">Predefined board style with fixed marks & time distribution</p>
                      </div>

                      {/* Question Details */}
                      <div className="bg-light rounded p-0 mb-4">
                        <div className="row text-center g-3">
                          <div className="col-4">
                            <div className="fw-bold text-primary">MCQs</div>
                            <div className="fs-6 fw-bold">12 Qs</div>
                            <small className="text-muted">12 to attempt × 1</small>
                            <div className="fw-bold text-success">12 marks</div>
                          </div>
                          <div className="col-4">
                            <div className="fw-bold text-primary">Short</div>
                            <div className="fs-6 fw-bold">24 Qs</div>
                            <small className="text-muted">16 to attempt × 2</small>
                            <div className="fw-bold text-success">32 marks</div>
                          </div>
                          <div className="col-4">
                            <div className="fw-bold text-primary">Long</div>
                            <div className="fs-6 fw-bold">3 Qs</div>
                            <small className="text-muted">2 to attempt × 8</small>
                            <div className="fw-bold text-success">16 marks</div>
                          </div>
                        </div>
                        <div className="text-center mt-3 pt-2 border-top">
                          <div className="fw-bold text-primary">Total: 60 marks</div>
                          <small className="text-muted">
                            <i className="bi bi-clock me-1"></i>180 mins • 
                            <i className="bi bi-translate ms-2 me-1"></i>Bilingual
                          </small>
                        </div>
                      </div>

                      <div className="text-center">
                        <span className="badge bg-primary px-3 py-2">
                          <i className="bi bi-lightning me-2"></i>
                         <span className="d-none d-sm-inline"> Quick Setup - </span>Click to Continue
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Paper Card */}
                <div className="col-md-6">
                  <div
                    className={`option-card card h-100 p-2 cursor-pointer ${
                      watch("paperType") === "custom" ? "active border-primary shadow" : "border-light"
                    }`}
                    onClick={() => {
                      setValue("paperType", "custom");
                      
                      // Set reasonable custom paper defaults
                      setValue("mcqCount", 5);
                      setValue("shortCount", 5);
                      setValue("longCount", 2);
                      setValue("mcqToAttempt", 5);
                      setValue("shortToAttempt", 5);
                      setValue("longToAttempt", 2);
                      setValue("mcqMarks", 1);
                      setValue("shortMarks", 2);
                      setValue("longMarks", 5);
                      setValue("mcqPlacement", "same_page");
                      setValue("timeMinutes", 60);
                      setValue("shuffleQuestions", true);
                      setValue("dateOfPaper", new Date().toISOString().split('T')[0]);
                      setValue("source_type", "all");
                      
                      // Clear selections and cache
                      setSelectedQuestions({
                        mcq: [],
                        short: [],
                        long: [],
                      });
                      setQuestionsCache({});
                      setLastPreviewLoad(null);
                      setPreviewQuestions({
                        mcq: [],
                        short: [],
                        long: [],
                      });
                      
                      // Scroll to custom settings after a short delay to allow DOM update
                      setTimeout(() => {
                        const customSettings = document.querySelector('.custom-settings');
                        if (customSettings) {
                          customSettings.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start' 
                          });
                        }
                      }, 300);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="card-body p-0">
                      <div className="text-center mb-4">
                        <span className="display-6">⚙️</span>
                        <h4 className="mt-3 fw-bold">Custom Paper</h4>
                        <p className="text-muted mb-4">Full control over marks, sections, difficulty, and timing</p>
                      </div>

                      {/* Features List */}
                      <div className="bg-light rounded p-0 mb-4">
                        <div className="row g-2">
                          {[
                            { icon: '🎯', text: 'Flexible marks distribution' },
                            { icon: '⏱️', text: 'Custom timing options' },
                            { icon: '🌐', text: 'Multiple language support' },
                            { icon: '📊', text: 'Adjustable difficulty levels' },
                            { icon: '🔀', text: 'Question shuffling' },
                            { icon: '📝', text: 'Custom paper title' }
                          ].map((feature, index) => (
                            <div key={index} className="col-6">
                              <div className="d-flex align-items-center mb-2">
                                <span className="me-2">{feature.icon}</span>
                                <small>{feature.text}</small>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="text-center">
                        <span className="badge bg-success px-3 py-2">
                          <i className="bi bi-sliders me-2"></i>
                          <span className="d-none d-sm-inline"> Full Customization - </span>Click to Configure
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Paper Settings */}
              {watch("paperType") === "custom" && (
                <div className="custom-settings mt-5 p-4 border rounded bg-light step-transition" id="custom-settings">
                  <h6 className="fw-bold mb-3">⚙️ Customize Paper Settings</h6>

                  {/* TOP ROW: MCQ Placement Cards */}
                  <div className="row mb-4">
                    <div className="col-12">
                      <label className="form-label mb-3">📄 Question Paper Layout</label>
                      <div className="row g-3">
                        {/* Option 1: Objective & Subjective on Separate Page */}
                        <div className="col-md-4">
                          <div 
                            className={`card h-100 cursor-pointer p-3 ${watch("mcqPlacement") === "separate" ? "border-primary bg-primary bg-opacity-10 shadow" : "border-light"}`}
                            onClick={() => {
                              setValue("mcqPlacement", "separate");
                              // Enforce limits for separate layout
                              const currentMcq = watch("mcqCount") || 0;
                              const currentShort = watch("shortCount") || 0;
                              const currentLong = watch("longCount") || 0;
                              
                              // MCQs max 15 for separate layout
                              if (currentMcq > 15) {
                                setValue("mcqCount", 15);
                                setValue("mcqToAttempt", Math.min(watch("mcqToAttempt") || 0, 15));
                              }
                              
                              // Short+Long max 30 for separate layout
                              const subjectiveTotal = currentShort + currentLong;
                              if (subjectiveTotal > 30) {
                                const ratio = 30 / subjectiveTotal;
                                const newShort = Math.min(Math.round(currentShort * ratio), 30);
                                const newLong = Math.min(30 - newShort, currentLong);
                                
                                setValue("shortCount", newShort);
                                setValue("longCount", newLong);
                                setValue("shortToAttempt", Math.min(watch("shortToAttempt") || 0, newShort));
                                setValue("longToAttempt", Math.min(watch("longToAttempt") || 0, newLong));
                              }
                            }}
                            style={{ 
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              minHeight: '180px'
                            }}
                          >
                            <div className="card-body text-center">
                              <div className="mb-2">
                                <div className="position-relative" style={{ height: '60px' }}>
                                  <div className="position-absolute start-0 top-0 bg-info rounded p-2" style={{ width: '45%', height: '100%' }}>
                                    <div className="text-white small">MCQs</div>
                                    <div className="text-white fw-bold">Max 15</div>
                                  </div>
                                  <div className="position-absolute end-0 top-0 bg-success rounded p-2" style={{ width: '45%', height: '100%' }}>
                                    <div className="text-white small">Subjective</div>
                                    <div className="text-white fw-bold">Max 30</div>
                                  </div>
                                </div>
                              </div>
                              <h6 className="fw-bold mb-1">Separate Pages</h6>
                              <p className="small text-muted mb-0">
                                Objective and subjective on different pages
                              </p>
                              <div className="mt-2">
                                <span className="badge bg-info">MCQs: Max 15</span>
                                <span className="badge bg-success ms-1">Subjective: Max 30</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Option 2: Objective & Subjective Same Page */}
                        <div className="col-md-4">
                          <div 
                            className={`card h-100 cursor-pointer p-3 ${watch("mcqPlacement") === "same_page" ? "border-primary bg-primary bg-opacity-10 shadow" : "border-light"}`}
                            onClick={() => {
                              setValue("mcqPlacement", "same_page");
                              // Enforce limits for single page layout
                              const currentMcq = watch("mcqCount") || 0;
                              const currentShort = watch("shortCount") || 0;
                              const currentLong = watch("longCount") || 0;
                              
                              // MCQs max 5 for single page layout
                              if (currentMcq > 5) {
                                setValue("mcqCount", 5);
                                setValue("mcqToAttempt", Math.min(watch("mcqToAttempt") || 0, 5));
                              }
                              
                              // Short+Long max 15 for single page layout
                              const subjectiveTotal = currentShort + currentLong;
                              if (subjectiveTotal > 15) {
                                const ratio = 15 / subjectiveTotal;
                                const newShort = Math.min(Math.round(currentShort * ratio), 15);
                                const newLong = Math.min(15 - newShort, currentLong);
                                
                                setValue("shortCount", newShort);
                                setValue("longCount", newLong);
                                setValue("shortToAttempt", Math.min(watch("shortToAttempt") || 0, newShort));
                                setValue("longToAttempt", Math.min(watch("longToAttempt") || 0, newLong));
                              }
                            }}
                            style={{ 
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              minHeight: '180px'
                            }}
                          >
                            <div className="card-body text-center">
                              <div className="mb-2">
                                <div className="bg-light rounded p-2" style={{ height: '60px' }}>
                                  <div className="d-flex justify-content-between align-items-center h-100">
                                    <div className="text-center">
                                      <div className="text-primary fw-bold">MCQs: Max 5</div>
                                      <small className="text-muted">Subjective: Max 15</small>
                                    </div>
                                    <div className="vr"></div>
                                    <div className="text-center">
                                      <div className="text-success fw-bold">Single Page</div>
                                      <small className="text-muted">Combined layout</small>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <h6 className="fw-bold mb-1">Single Page</h6>
                              <p className="small text-muted mb-0">
                                All questions combined on a single page
                              </p>
                              <div className="mt-2">
                                <span className="badge bg-primary">MCQs: Max 5</span>
                                <span className="badge bg-success ms-1">Subjective: Max 15</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Option 3: Two Papers Per Page (Front/Back) */}
                        <div className="col-md-4">
                          <div 
                            className={`card h-100 cursor-pointer p-3 ${watch("mcqPlacement") === "two_papers" ? "border-primary bg-primary bg-opacity-10 shadow" : "border-light"}`}
                            onClick={() => {
                              setValue("mcqPlacement", "two_papers");
                              // Enforce limits for two-paper layout
                              const currentMcq = watch("mcqCount") || 0;
                              const currentShort = watch("shortCount") || 0;
                              const currentLong = watch("longCount") || 0;
                              
                              // MCQs max 5 for two papers layout
                              if (currentMcq > 5) {
                                setValue("mcqCount", 5);
                                setValue("mcqToAttempt", Math.min(watch("mcqToAttempt") || 0, 5));
                              }
                              
                              // Short+Long max 10 for two papers layout
                              const subjectiveTotal = currentShort + currentLong;
                              if (subjectiveTotal > 10) {
                                const ratio = 10 / subjectiveTotal;
                                const newShort = Math.min(Math.round(currentShort * ratio), 10);
                                const newLong = Math.min(10 - newShort, currentLong);
                                
                                setValue("shortCount", newShort);
                                setValue("longCount", newLong);
                                setValue("shortToAttempt", Math.min(watch("shortToAttempt") || 0, newShort));
                                setValue("longToAttempt", Math.min(watch("longToAttempt") || 0, newLong));
                              }
                            }}
                            style={{ 
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              minHeight: '180px'
                            }}
                          >
                            <div className="card-body text-center">
                              <div className="mb-2">
                                <div className="position-relative" style={{ height: '60px' }}>
                                  {/* Front side */}
                                  <div className="position-absolute start-0 top-0 border rounded p-2" style={{ 
                                    width: '45%', 
                                    height: '100%',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white'
                                  }}>
                                    <div className="small">MCQs</div>
                                    <div className="fw-bold">Max 5</div>
                                  </div>
                                  {/* Back side */}
                                  <div className="position-absolute end-0 top-0 border rounded p-2" style={{ 
                                    width: '45%', 
                                    height: '100%',
                                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                    color: 'white'
                                  }}>
                                    <div className="small">Subjective</div>
                                    <div className="fw-bold">Max 10</div>
                                  </div>
                                </div>
                              </div>
                              <h6 className="fw-bold mb-1">Two Papers Layout</h6>
                              <p className="small text-muted mb-0">
                                Optimized for printing two papers per page
                              </p>
                              <div className="mt-2">
                                <span className="badge bg-purple">MCQs: Max 5</span>
                                <span className="badge bg-pink ms-1">Subjective: Max 10</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Layout Description */}
                      <div className="mt-2">
                        <small className="text-muted">
                          <i className="bi bi-info-circle me-1"></i>
                          {watch("mcqPlacement") === "separate" && 
                            "MCQs on separate page (max 15), subjective questions (max 30) on following pages"}
                          {watch("mcqPlacement") === "same_page" && 
                            "Single page layout: MCQs (max 5), subjective questions (max 15)"}
                          {watch("mcqPlacement") === "two_papers" && 
                            "Two papers per page: MCQs (max 5), subjective questions (max 10)"}
                        </small>
                      </div>
                    </div>
                  </div>

                  {/* SECOND ROW: Paper Title, Date, and Time ALL on same row */}
                  <div className="row mb-3 g-3">
                    {/* Paper Title - Mobile: full width, Desktop: 3 columns */}
                    <div className="col-12 col-lg-3">
                      <label className="form-label">Paper Title</label>
                      <input
                        type="text"
                        defaultValue="BISE LAHORE"
                        {...register("title")}
                        className={`form-control ${errors.title ? "is-invalid" : ""}`}
                        placeholder="Enter paper title"
                      />
                      {errors.title && <div className="invalid-feedback">{errors.title.message}</div>}
                    </div>

                    {/* Date of Paper - Mobile: full width, Desktop: 3 columns */}
                    <div className="col-12 col-lg-3">
                      <label className="form-label">Date of Paper</label>
                      <div className="position-relative">
                        <button
                          type="button"
                          className="form-control text-start bg-white d-flex justify-content-between align-items-center"
                          onClick={() => setShowDatePicker(!showDatePicker)}
                          style={{ cursor: 'pointer' }}
                        >
                          <span>{formatDateForDisplay(watch('dateOfPaper') || '')}</span>
                          <i className="bi bi-calendar"></i>
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
                    </div>

                    {/* Time Fields - Dynamic based on placement */}
                    {watch("mcqPlacement") === "separate" ? (
                      <>
                        {/* Objective Time - Mobile: half width, Desktop: 3 columns */}
                        <div className="col-6 col-lg-3">
                          <label className="form-label">Objective Time</label>
                          <div className="input-group">
                            <input
                              type="number"
                              {...register("mcqTimeMinutes", { valueAsNumber: true })}
                              className="form-control no-spinner"
                              placeholder="Min"
                              style={{ textAlign: 'center' }}
                            />
                            <span className="input-group-text" style={{ padding: '0.375rem 0.5rem' }}>min</span>
                          </div>
                        </div>
                        
                        {/* Subjective Time - Mobile: half width, Desktop: 3 columns */}
                        <div className="col-6 col-lg-3">
                          <label className="form-label">Subjective Time</label>
                          <div className="input-group">
                            <input
                              type="number"
                              {...register("subjectiveTimeMinutes", { valueAsNumber: true })}
                              className="form-control no-spinner"
                              placeholder="Min"
                              style={{ textAlign: 'center' }}
                            />
                            <span className="input-group-text" style={{ padding: '0.375rem 0.5rem' }}>min</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Single Time Field for same_page and two_papers layouts */
                      <div className="col-12 col-lg-3">
                        <label className="form-label">Total Time</label>
                        <div className="input-group">
                          <input
                            type="number"
                            {...register("timeMinutes", { valueAsNumber: true })}
                            className="form-control no-spinner"
                            placeholder="Minutes"
                            style={{ textAlign: 'center' }}
                          />
                          <span className="input-group-text" style={{ padding: '0.375rem 0.5rem' }}>min</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Language + Source */}
                  <div className="row mb-3 g-3">
                    <div className="col-md-6">
                      <label className="form-label d-block">Language</label>
                      <div className="d-flex flex-wrap gap-3">
                        {["english", "urdu", "bilingual"].map((lang) => (
                          <div className="form-check" key={lang}>
                            <input
                              className="form-check-input"
                              type="radio"
                              value={lang}
                              {...register("language")}
                              id={`lang-${lang}`}
                            />
                            <label className="form-check-label" htmlFor={`lang-${lang}`}>
                              {lang === "english" ? "🇬🇧 English" : 
                               lang === "urdu" ? "🇵🇰 Urdu" : 
                               "🌐 Bilingual"}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Source Type</label>
                      <select {...register("source_type")} className="form-select">
                        <option value="all">📚 All Sources</option>
                        <option value="book">📖 Book Only</option>
                        <option value="model_paper">📋 Model Papers</option>
                        <option value="past_paper">📜 Past Papers</option>
                      </select>
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
                      🔀 Shuffle Questions
                    </label>
                    <div className="form-text">
                      Randomize the order of questions in each section
                    </div>
                  </div>

                  {/* Question Distribution with Validation - Fixed for Mobile */}
                  <div className="distribution-card mt-3 p-3 bg-white rounded shadow-sm">
                    <h6 className="fw-semibold mb-3">📊 Question Distribution</h6>
                    
                    {/* Validation Alert */}
                    {(watch("mcqToAttempt") > watch("mcqCount") || 
                      watch("shortToAttempt") > watch("shortCount") || 
                      watch("longToAttempt") > watch("longCount")) && (
                      <div className="alert alert-warning mb-3">
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        "To Attempt" values cannot exceed "Total Qs". Please adjust.
                      </div>
                    )}

                    {/* Layout-specific Validation Alerts */}
                    {watch("mcqPlacement") === "separate" && (
                      <div className="alert alert-info mb-3">
                        <i className="bi bi-info-circle me-2"></i>
                        <strong>Separate Pages Layout Limits:</strong>
                        <div className="mt-1 small">
                          • MCQs: Maximum 15 questions
                          <br/>
                          • Subjective (Short + Long): Maximum 30 questions total
                          {((watch("shortCount") || 0) + (watch("longCount") || 0) > 30) && (
                            <div className="text-danger">
                              Current subjective: {(watch("shortCount") || 0) + (watch("longCount") || 0)} questions
                            </div>
                          )}
                          {((watch("mcqCount") || 0) > 15) && (
                            <div className="text-danger">
                              Current MCQs: {watch("mcqCount")} questions
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {watch("mcqPlacement") === "same_page" && (
                      <div className="alert alert-info mb-3">
                        <i className="bi bi-info-circle me-2"></i>
                        <strong>Single Page Layout Limits:</strong>
                        <div className="mt-1 small">
                          • MCQs: Maximum 5 questions
                          <br/>
                          • Subjective (Short + Long): Maximum 15 questions total
                          {((watch("shortCount") || 0) + (watch("longCount") || 0) > 15) && (
                            <div className="text-danger">
                              Current subjective: {(watch("shortCount") || 0) + (watch("longCount") || 0)} questions
                            </div>
                          )}
                          {((watch("mcqCount") || 0) > 5) && (
                            <div className="text-danger">
                              Current MCQs: {watch("mcqCount")} questions
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {watch("mcqPlacement") === "two_papers" && (
                      <div className="alert alert-info mb-3">
                        <i className="bi bi-info-circle me-2"></i>
                        <strong>Two Papers Layout Limits:</strong>
                        <div className="mt-1 small">
                          • MCQs: Maximum 5 questions
                          <br/>
                          • Subjective (Short + Long): Maximum 10 questions total
                          {((watch("shortCount") || 0) + (watch("longCount") || 0) > 10) && (
                            <div className="text-danger">
                              Current subjective: {(watch("shortCount") || 0) + (watch("longCount") || 0)} questions
                            </div>
                          )}
                          {((watch("mcqCount") || 0) > 5) && (
                            <div className="text-danger">
                              Current MCQs: {watch("mcqCount")} questions
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Mobile-friendly table */}
                    <div className="table-responsive">
                      <table className="table text-center align-middle" style={{ minWidth: '600px' }}>
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: "20%", minWidth: "80px" }}>Type</th>
                            <th style={{ width: "15%", minWidth: "70px" }}>Total Qs</th>
                            <th style={{ width: "15%", minWidth: "70px" }}>To Attempt</th>
                            <th style={{ width: "15%", minWidth: "70px" }}>Marks Each</th>
                            <th style={{ width: "20%", minWidth: "80px" }}>Difficulty</th>
                            <th style={{ width: "15%", minWidth: "70px" }}>Section Marks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {["mcq", "short", "long"].map((type) => {
                            const totalField = `${type}Count`;
                            const attemptField = `${type}ToAttempt`;
                            const marksField = `${type}Marks`;
                            const difficultyField = `${type}Difficulty`;
                            
                            // Get current values
                            const totalValue = watch(totalField) || 0;
                            const attemptValue = watch(attemptField) || 0;
                            const marksValue = watch(marksField) || 0;
                            
                            // Calculate section marks based on "To Attempt"
                            const sectionMarks = attemptValue * marksValue;
                            
                            return (
                              <tr key={type}>
                                <td className="fw-bold text-capitalize">
                                  {type === "mcq" ? "❓ MCQs" : type === "short" ? "📝 Short" : "📋 Long"}
                                </td>
                                <td className="text-center">
                                  <div className="position-relative" style={{ maxWidth: '100px', margin: '0 auto' }}>
                                    <input
                                      type="number"
                                      {...register(totalField, { 
                                        valueAsNumber: true,
                                        onChange: (e) => {
                                          const newTotal = parseInt(e.target.value) || 0;
                                          const currentAttempt = watch(attemptField) || 0;
                                          
                                          // If total is reduced below current attempt, adjust attempt value
                                          if (currentAttempt > newTotal) {
                                            setValue(attemptField, newTotal);
                                          }
                                          
                                          // Enforce layout-specific limits
                                          const placement = watch("mcqPlacement");
                                          const currentMcq = watch("mcqCount") || 0;
                                          const currentShort = watch("shortCount") || 0;
                                          const currentLong = watch("longCount") || 0;
                                          
                                          // Handle MCQs limits
                                          if (type === "mcq") {
                                            let maxMcq = 0;
                                            if (placement === "separate") maxMcq = 15;
                                            if (placement === "same_page") maxMcq = 5;
                                            if (placement === "two_papers") maxMcq = 5;
                                            
                                            if (newTotal > maxMcq) {
                                              setValue("mcqCount", maxMcq);
                                              setValue("mcqToAttempt", Math.min(watch("mcqToAttempt") || 0, maxMcq));
                                              alert(`MCQs: Maximum ${maxMcq} questions allowed for ${placement === "separate" ? "Separate Pages" : placement === "same_page" ? "Single Page" : "Two Papers"} layout.`);
                                            }
                                          }
                                          
                                          // Handle subjective limits
                                          if (type === "short" || type === "long") {
                                            const subjectiveTotal = (type === "short" ? newTotal : currentShort) + 
                                                                   (type === "long" ? newTotal : currentLong);
                                            
                                            let maxSubjective = 0;
                                            if (placement === "separate") maxSubjective = 30;
                                            if (placement === "same_page") maxSubjective = 15;
                                            if (placement === "two_papers") maxSubjective = 10;
                                            
                                            if (subjectiveTotal > maxSubjective) {
                                              // Adjust proportionally
                                              if (type === "short") {
                                                const maxShort = maxSubjective - currentLong;
                                                setValue("shortCount", maxShort);
                                                setValue("shortToAttempt", Math.min(watch("shortToAttempt") || 0, maxShort));
                                              } else {
                                                const maxLong = maxSubjective - currentShort;
                                                setValue("longCount", maxLong);
                                                setValue("longToAttempt", Math.min(watch("longToAttempt") || 0, maxLong));
                                              }
                                              
                                              alert(`Subjective questions: Maximum ${maxSubjective} total questions allowed for ${placement === "separate" ? "Separate Pages" : placement === "same_page" ? "Single Page" : "Two Papers"} layout.`);
                                            }
                                          }
                                        }
                                      })}
                                      className={`form-control text-center no-spinner ${attemptValue > totalValue ? "is-invalid" : ""}`}
                                      placeholder="0"
                                      min="0"
                                      max={100}
                                      style={{ 
                                        padding: '0.375rem 0.25rem',
                                        fontSize: '0.875rem',
                                        width: '100%'
                                      }}
                                    />
                                  </div>
                                  {type === "mcq" && (
                                    <small className="text-muted d-block mt-1">
                                      Max: {
                                        watch("mcqPlacement") === "separate" ? "15" :
                                        watch("mcqPlacement") === "same_page" ? "5" :
                                        watch("mcqPlacement") === "two_papers" ? "5" : ""
                                      }
                                    </small>
                                  )}
                                  {(type === "short" || type === "long") && (
                                    <small className="text-muted d-block mt-1">
                                      Max total: {
                                        watch("mcqPlacement") === "separate" ? "30" :
                                        watch("mcqPlacement") === "same_page" ? "15" :
                                        watch("mcqPlacement") === "two_papers" ? "10" : ""
                                      }
                                    </small>
                                  )}
                                </td>
                                <td className="text-center">
                                  <div className="position-relative" style={{ maxWidth: '100px', margin: '0 auto' }}>
                                    <input
                                      type="number"
                                      {...register(attemptField, { 
                                        valueAsNumber: true,
                                        onChange: (e) => {
                                          const newAttempt = parseInt(e.target.value) || 0;
                                          const total = watch(totalField) || 0;
                                          
                                          // Ensure attempt doesn't exceed total
                                          if (newAttempt > total) {
                                            setValue(attemptField, total);
                                          }
                                        }
                                      })}
                                      className={`form-control text-center no-spinner ${attemptValue > totalValue ? "is-invalid" : ""}`}
                                      placeholder="0"
                                      min="0"
                                      max={totalValue}
                                      style={{ 
                                        padding: '0.375rem 0.25rem',
                                        fontSize: '0.875rem',
                                        width: '100%'
                                      }}
                                    />
                                  </div>
                                  {attemptValue > totalValue && (
                                    <div className="invalid-feedback d-block small">
                                      Exceeds total
                                    </div>
                                  )}
                                </td>
                                <td className="text-center">
                                  <div className="position-relative" style={{ maxWidth: '100px', margin: '0 auto' }}>
                                    <input
                                      type="number"
                                      {...register(marksField, { valueAsNumber: true })}
                                      className="form-control text-center no-spinner"
                                      placeholder="1"
                                      min="1"
                                      style={{ 
                                        padding: '0.375rem 0.25rem',
                                        fontSize: '0.875rem',
                                        width: '100%'
                                      }}
                                    />
                                  </div>
                                </td>
                                <td className="text-center">
                                  <select
                                    {...register(difficultyField)}
                                    className="form-select text-center"
                                    style={{ 
                                      padding: '0.375rem 0.25rem',
                                      fontSize: '0.875rem',
                                      minWidth: '80px'
                                    }}
                                  >
                                    <option value="any">🎲 Any</option>
                                    <option value="easy">😊 Easy</option>
                                    <option value="medium">😐 Medium</option>
                                    <option value="hard">😰 Hard</option>
                                  </select>
                                </td>
                                <td className="text-center fw-bold text-success">
                                  {sectionMarks} marks
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Summary - Mobile friendly - FIXED: Shows marks based on "To Attempt" */}
                    <div className="row mt-3 text-center g-2">
                      <div className="col-4">
                        <div className="fw-bold text-primary small">📋 MCQs</div>
                        <div className="fs-6 fw-bold">
                          {watch("mcqToAttempt") || 0}/{watch("mcqCount") || 0}
                        </div>
                        <div className="fw-bold text-success">
                          {(watch("mcqToAttempt") || 0) * (watch("mcqMarks") || 0)} marks
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="fw-bold text-success small">🎯 Subjective</div>
                        <div className="fs-6 fw-bold">
                          {(watch("shortToAttempt") || 0) + (watch("longToAttempt") || 0)}/
                          {(watch("shortCount") || 0) + (watch("longCount") || 0)}
                        </div>
                        <div className="fw-bold text-success">
                          {((watch("shortToAttempt") || 0) * (watch("shortMarks") || 0)) +
                           ((watch("longToAttempt") || 0) * (watch("longMarks") || 0))} marks
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="fw-bold text-danger small">⭐ Total Marks</div>
                        <div className="fs-6 fw-bold">
                          {((watch("mcqToAttempt") || 0) * (watch("mcqMarks") || 0)) +
                           ((watch("shortToAttempt") || 0) * (watch("shortMarks") || 0)) +
                           ((watch("longToAttempt") || 0) * (watch("longMarks") || 0))}
                        </div>
                        <small className="text-muted">Based on To Attempt</small>
                      </div>
                    </div>
                  </div>

                  {/* Continue Button for Custom Paper */}
                  <div className="text-center mt-4 pt-3 border-top">
                    <button 
                      className="btn btn-primary btn-lg px-4 px-sm-5" 
                      onClick={() => {
                        // Validate before proceeding
                        if (watch("mcqToAttempt") > watch("mcqCount") || 
                            watch("shortToAttempt") > watch("shortCount") || 
                            watch("longToAttempt") > watch("longCount")) {
                          alert("Please fix the 'To Attempt' values. They cannot exceed 'Total Qs'.");
                          return;
                        }
                        
                        // Validate layout-specific limits
                        const placement = watch("mcqPlacement");
                        const mcqCount = watch("mcqCount") || 0;
                        const shortCount = watch("shortCount") || 0;
                        const longCount = watch("longCount") || 0;
                        const subjectiveTotal = shortCount + longCount;
                        
                        if (placement === "separate") {
                          if (mcqCount > 15) {
                            alert(`Separate Pages Layout: Maximum 15 MCQs allowed. You have ${mcqCount}.`);
                            return;
                          }
                          if (subjectiveTotal > 30) {
                            alert(`Separate Pages Layout: Maximum 30 subjective questions allowed. You have ${subjectiveTotal}.`);
                            return;
                          }
                        }
                        
                        if (placement === "same_page") {
                          if (mcqCount > 5) {
                            alert(`Single Page Layout: Maximum 5 MCQs allowed. You have ${mcqCount}.`);
                            return;
                          }
                          if (subjectiveTotal > 15) {
                            alert(`Single Page Layout: Maximum 15 subjective questions allowed. You have ${subjectiveTotal}.`);
                            return;
                          }
                        }
                        
                        if (placement === "two_papers") {
                          if (mcqCount > 5) {
                            alert(`Two Papers Layout: Maximum 5 MCQs allowed. You have ${mcqCount}.`);
                            return;
                          }
                          if (subjectiveTotal > 10) {
                            alert(`Two Papers Layout: Maximum 10 subjective questions allowed. You have ${subjectiveTotal}.`);
                            return;
                          }
                        }
                        
                        setStep(5);
                      }}
                    >
                      Continue to Selection Method <i className="bi bi-arrow-right ms-2"></i>
                    </button>
                    
                    <div className="mt-2">
                      <small className="text-muted">
                        <i className="bi bi-info-circle me-1"></i>
                        You can always come back and adjust these settings
                      </small>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Selection method */}
          {step === 5 && (
            <div className="step-transition">
              <div className="text-center mb-3">
                <h5 className="fw-bold mb-3">🎯 Selection Method</h5>
                <p className="text-muted">Choose how you want to select questions for your paper</p>
              </div>

              <div className="row row-cols-1 row-cols-md-2 g-4">
                <div className="col">
                  <div 
                    className={`card h-100 cursor-pointer p-4 transition-all ${
                      watchedSelectionMethod === 'auto' ? 'border-primary bg-primary bg-opacity-10 shadow' : 'border-light'
                    }`}
                    onClick={() => {
                      setValue('selectionMethod', 'auto');
                      setTimeout(() => setStep(7), 400);
                    }}
                    style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                  >
                    <div className="card-body text-center">
                      <span className="display-6 mb-3">🤖</span>
                      <h4 className="card-title fw-bold">Auto Generate</h4>
                      <p className="card-text text-muted">
                        System will automatically select questions randomly from ALL chapters based on your criteria. 
                        Perfect for quick paper generation with balanced difficulty distribution.
                      </p>
                      <div className="mt-4">
                        <span className="badge bg-primary px-3 py-2">
                          <i className="bi bi-lightning me-2"></i>
                          Fast & Automated
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col">
                  <div 
                    className={`card h-100 cursor-pointer p-4 transition-all ${
                      watchedSelectionMethod === 'manual' ? 'border-primary bg-primary bg-opacity-10 shadow' : 'border-light'
                    }`}
                    onClick={() => {
                      setValue('selectionMethod', 'manual');
                      setTimeout(() => setStep(6), 400);
                    }}
                    style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                  >
                    <div className="card-body text-center">
                      <span className="display-6 mb-3">✍️</span>
                      <h4 className="card-title fw-bold">Manual Selection</h4>
                      <p className="card-text text-muted">
                        You will manually select each question from available pool. 
                        Perfect for when you want full control over question selection.
                      </p>
                      <div className="mt-4">
                        <span className="badge bg-success px-3 py-2">
                          <i className="bi bi-eye me-2"></i>
                          Full Control
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Manual Question Selection */}
          {step === 6 && watchedSelectionMethod === 'manual' && (
            <div className="step-transition">
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
              <div className="text-center mt-4">
                <button className="btn btn-primary btn-lg px-5" onClick={() => setStep(7)}>
                  Continue to Review <i className="bi bi-arrow-right ms-2"></i>
                </button>
              </div>
            </div>
          )}

          {/* Step 7: PDF-like Review with Exact PDF Design - FIXED HTML STRUCTURE */}
          {step === 7 && (
            <form onSubmit={handleSubmit(onSubmit)} className="step-transition">
              {/* Mobile Floating Action Buttons - Only shown on mobile */}
              <div className="d-lg-none mobile-action-buttons">
                <div className="container">
                  <div className="row g-2">
                    <div className="col-6">
                      <button 
                        className="btn btn-success w-100" 
                        type="submit" 
                        disabled={isLoading || isLoadingPreview}
                      >
                        {isLoading ? (
                          <span className="spinner-border spinner-border-sm me-1"></span>
                        ) : (
                          <i className="bi bi-file-earmark-pdf me-1"></i>
                        )}
                        <span className=" d-sm-inline"> Paper</span>
                      </button>
                    </div>
                    <div className="col-6">
                      <button
                        className="btn btn-info w-100 text-white"
                        type="button"
                        onClick={async () => {
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
                              // Pass reordered questions to MCQ key generation
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
                        }}
                        disabled={isLoading || isDownloadingKey || watchedMcqCount === 0 || isLoadingPreview}
                      >
                        {isDownloadingKey ? (
                          <span className="spinner-border spinner-border-sm me-1"></span>
                        ) : (
                          <i className="bi bi-key me-1"></i>
                        )}
                         <span className=" d-sm-inline">  Key</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className='row'>
                <div className="col-12 mb-3">
                  {/* Edit Mode Instructions */}
                  {isEditMode && (
                    <div className="alert alert-warning mt-4 mx-3">
                      <h6 className="fw-bold mb-2">
                        <i className="bi bi-magic me-2"></i>
                        Paper Editing Mode - Active
                      </h6>
                      <div className="row">
                        <div className="col-md-6">
                          <ul className="mb-2 small">
                            <li>📝 Drag questions within sections to reorder them</li>
                            <li>🎯 Adjust individual question marks using the input fields</li>
                            <li>🔢 Question numbers update automatically</li>
                          </ul>
                        </div>
                        <div className="col-md-6">
                          <ul className="mb-0 small">
                            <li>💾 Changes are saved for PDF generation</li>
                            <li>🔄 Use "Reset Order" to revert to original arrangement</li>
                            <li>👁️ Toggle off Edit Mode to see final paper layout</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="row">
                {/* PDF-like Paper Preview */}
                <div className="col-lg-8">

                  <div className="card mb-4 border-0 shadow-sm">
                   <div className="card-header bg-primary text-white">
  {/* Mobile header layout - stacked */}
  <div className="d-lg-none">
    {/* Top row: Title and Edit mode toggle */}
    <div className="d-flex justify-content-between align-items-center mb-2">
      <h2 className="h5 card-title mb-0">📋 Review</h2>
      <div className="d-flex align-items-center gap-2">
        <div className="form-check form-switch m-0">
          <input
            className="form-check-input"
            type="checkbox"
            id="editModeToggleMobile"
            checked={isEditMode}
            onChange={(e) => setIsEditMode(e.target.checked)}
          />
          <label className="form-check-label text-white small" htmlFor="editModeToggleMobile">
            {isEditMode ? '✏️' : '👁️'}
          </label>
        </div>
        {isEditMode && (
          <button
            type="button"
            className="btn btn-warning btn-sm p-1"
            onClick={loadPreviewQuestions}
            title="Reset Order"
          >
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        )}
      </div>
    </div>
    
    {/* Middle row: Action buttons */}
    <div className="d-flex justify-content-between mb-2">
      <div className="d-flex gap-2">
        <button 
          className="btn btn-success btn-sm flex-fill" 
          type="submit" 
          disabled={isLoading || isLoadingPreview}
        >
          {isLoading ? (
            <span className="spinner-border spinner-border-sm"></span>
          ) : (
            <>
              <i className="bi bi-file-earmark-pdf me-1"></i>
              Generate PDF
            </>
          )}
        </button>
        <button
          className="btn btn-info btn-sm text-white flex-fill"
          type="button"
          onClick={async () => {
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
          }}
          disabled={isLoading || isDownloadingKey || watchedMcqCount === 0 || isLoadingPreview}
        >
          {isDownloadingKey ? (
            <span className="spinner-border spinner-border-sm"></span>
          ) : (
            <>
              <i className="bi bi-key me-1"></i>
              Answer Key
            </>
          )}
        </button>
      </div>
    </div>
  </div>

  {/* Desktop header layout - inline */}
  <div className="d-none d-lg-flex justify-content-between align-items-center">
    <h2 className="h4 card-title mb-0">📋 Paper Preview - Final Review</h2>
    <div className="d-flex align-items-center gap-3">
      <div className="form-check form-switch">
        <input
          className="form-check-input"
          type="checkbox"
          id="editModeToggleDesktop"
          checked={isEditMode}
          onChange={(e) => setIsEditMode(e.target.checked)}
        />
        <label className="form-check-label text-white" htmlFor="editModeToggleDesktop">
          {isEditMode ? '✏️ Edit Mode' : '👁️ Preview'}
        </label>
      </div>
      {isEditMode && (
        <button
          type="button"
          className="btn btn-warning btn-sm"
          onClick={loadPreviewQuestions}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>
          Reset Order
        </button>
      )}
    </div>
  </div>
</div>
                    
                    <div className="card-body p-0">
                      {/* Loading State */}
                      {isLoadingPreview ? (
                        <div className="text-center py-5">
                          <div className="spinner-border text-primary mb-3" style={{width: '3rem', height: '3rem'}}>
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          <h5>Loading Questions...</h5>
                          <p className="text-muted">Preparing your paper preview</p>
                        </div>
                      ) : (
                        <div 
                          className="paper-preview" 
                          style={{ 
                            fontFamily: 'Arial, sans-serif',
                            padding: '20px',
                            background: 'white',
                            minHeight: '800px',
                            maxWidth: '900px',
                            margin: '0 auto'
                          }}
                        >
                          {/* Header matching PDF design exactly */}
                          <div className="header text-center mb-1" style={{ fontSize: '13px' }}>
                            <div className="mb-3">
                              <h1 className="text-center mb-2" style={{
                                fontFamily: "'Times New Roman', serif",
                                direction: 'ltr'
                              }}>
                                <img src="/examly.jpg" className="header-img" height="40" width="100" alt="Examly"/>
                                <span style={{
                                  fontFamily: "'algerian', 'Times New Roman', serif",
                                  fontSize: '14px',
                                  display:'block',
                                }}>
                                  {watch('title') || 'BOARD OF INTERMEDIATE AND SECONDARY EDUCATION'}
                                </span>
                              </h1>
                             
                              {watch('dateOfPaper') && (
                                <p className="mb-0 text-muted" style={{ 
                                  fontSize: '12px',
                                  fontFamily: "'Times New Roman', serif",
                                  direction: 'ltr'
                                }}>
                                  Date: {formatDateForDisplay(watch('dateOfPaper'))}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Student Info Table - FIXED HTML STRUCTURE */}
                          <div className=' table-responsive'>
                          <table style={{
                            width: '100%', 
                            borderCollapse: 'collapse', 
                            border: 'none !important', 
                            fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Noto Sans',Arial,sans-serif",
                            marginBottom: '20px',
                            direction: watch('language') === 'bilingual' || watch('language') === 'urdu' ? 'rtl' : 'ltr'
                          }}>
                            <tbody>
                              {/* Row 1 */}
                              <tr style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1.5 }}>
                                  {watch('language') !== 'english' && (
                                    <span style={{
                                      fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                      direction: 'rtl',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>نام طالبعلم:۔۔۔۔۔۔۔۔۔۔</span>
                                  )}
                                  {watch('language') !== 'urdu' && (
                                    <span style={{
                                      fontFamily: "'Noto Sans',Arial,sans-serif",
                                      direction: 'ltr',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>Student Name:_________</span>
                                  )}
                                </td>
                                <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                                  {watch('language') !== 'english' && (
                                    <span style={{
                                      fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                      direction: 'rtl',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>رول نمبر:۔۔۔۔۔۔</span>
                                  )}
                                  {watch('language') !== 'urdu' && (
                                    <span style={{
                                      fontFamily: "'Noto Sans',Arial,sans-serif",
                                      direction: 'ltr',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>Roll No:_________</span>
                                  )}
                                </td>
                                <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                                  {watch('language') !== 'english' && (
                                    <span style={{
                                      fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                      direction: 'rtl',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>سیکشن:۔۔۔۔۔۔</span>
                                  )}
                                  {watch('language') !== 'urdu' && (
                                    <span style={{
                                      fontFamily: "'Noto Sans',Arial,sans-serif",
                                      direction: 'ltr',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>Section:_______</span>
                                  )}
                                </td>
                              </tr>

                              {/* Row 2 */}
                              <tr style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1.5 }}>
                                  {watch('language') !== 'english' && (
                                    <span style={{
                                      fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                      direction: 'rtl',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}><strong>کلاس: {classes.find(c => c.id === watch('classId'))?.name}</strong></span>
                                  )}
                                  {watch('language') !== 'urdu' && (
                                    <span style={{
                                      fontFamily: "'Noto Sans',Arial,sans-serif",
                                      direction: 'ltr',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>Class: {classes.find(c => c.id === watch('classId'))?.name}</span>
                                  )}
                                </td>
                                <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                                  {watch('language') !== 'english' && (
                                    <span style={{
                                      fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                      direction: 'rtl',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>مضمون: {subjects.find(s => s.id === watch('subjectId'))?.name}</span>
                                  )}
                                  {watch('language') !== 'urdu' && (
                                    <span style={{
                                      fontFamily: "'Noto Sans',Arial,sans-serif",
                                      direction: 'ltr',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>Subject: {subjects.find(s => s.id === watch('subjectId'))?.name}</span>
                                  )}
                                </td>
                                <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                                  {watch('language') !== 'english' && (
                                    <span style={{
                                      fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                      direction: 'rtl',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>تاریخ: {formatDateForDisplay(watch('dateOfPaper') || '')}</span>
                                  )}
                                  {watch('language') !== 'urdu' && (
                                    <span style={{
                                      fontFamily: "'Noto Sans',Arial,sans-serif",
                                      direction: 'ltr',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>Date: {formatDateForDisplay(watch('dateOfPaper') || '')}</span>
                                  )}
                                </td>
                              </tr>

                              {/* Row 3 */}
                              <tr style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1.5 }}>
                                  {watch('language') !== 'english' && (
                                    <span style={{
                                      fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                      direction: 'rtl',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>وقت: {watch('timeMinutes')} منٹ</span>
                                  )}
                                  {watch('language') !== 'urdu' && (
                                    <span style={{
                                      fontFamily: "'Noto Sans',Arial,sans-serif",
                                      direction: 'ltr',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>Time Allowed: {watch('timeMinutes')} Minutes</span>
                                  )}
                                </td>
                                <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                                  {watch('language') !== 'english' && (
                                    <span style={{
                                      fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                      direction: 'rtl',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>کل نمبر: {calculateTotalMarks().total}</span>
                                  )}
                                  {watch('language') !== 'urdu' && (
                                    <span style={{
                                      fontFamily: "'Noto Sans',Arial,sans-serif",
                                      direction: 'ltr',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>Maximum Marks: {calculateTotalMarks().total}</span>
                                  )}
                                </td>
                                <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                                  {watch('language') !== 'english' && (
                                    <span style={{
                                      fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                      direction: 'rtl',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>حصہ انشائیہ</span>
                                  )}
                                  {watch('language') !== 'urdu' && (
                                    <span style={{
                                      fontFamily: "'Noto Sans',Arial,sans-serif",
                                      direction: 'ltr',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>Subjective Part</span>
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                    </div>
                          <hr style={{ borderColor: '#000', margin: '20px 0' }} />

                          {/* Questions Preview */}
                          <div className="questions-preview">
                            {/* MCQs Section */}
                            {previewQuestions.mcq.length > 0 && (
                              <div className="section mb-3">
                                <div className="section-header mb-4">
                                  <h5 className="fw-bold mb-2" style={{ 
                                    fontSize: '14px', 
                                    color: '#2c3e50',
                                    fontFamily: "'Times New Roman', serif",
                                    direction: 'ltr'
                                  }}>
                                    SECTION A - MULTIPLE CHOICE QUESTIONS
                                    {watch('mcqPlacement') === 'separate' && ' (ON SEPARATE PAGE)'}
                                  </h5>
                                  <div className="note p-3 bg-light rounded border" style={{ padding: '10px', margin: '10px 0', fontSize: '12px', lineHeight: '1.2' }}>
                                    {watch('language') !== 'english' && (
                                      <p className="mb-1" style={{
                                        fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                        direction: 'rtl',
                                        fontSize: '14px',
                                        lineHeight: '1.8'
                                      }}>
                                        نوٹ: ہر سوال کے چار ممکنہ جوابات A,B,C اور D دیئے گئے ہیں۔ درست جواب کے مطابق دائرہ پُر کریں۔ ایک سے زیادہ دائروں کو پُر کرنے کی صورت میں جواب غلط تصور ہوگا۔
                                      </p>
                                    )}
                                    {watch('language') !== 'urdu' && (
                                      <p className="mb-0" style={{
                                        fontFamily: "'Times New Roman', serif",
                                        direction: 'ltr',
                                        fontSize: '14px',
                                        lineHeight: '1.4'
                                      }}>
                                        Note: Four possible answers A, B, C and D to each question are given. Fill the correct option's circle. More than one filled circle will be treated wrong.
                                      </p>
                                    )}
                                  </div>
                                  <div className="mt-2">
                                    <small className="text-muted" style={{
                                      fontFamily: "'Times New Roman', serif",
                                      direction: 'ltr'
                                    }}>
                                      Attempt ALL {watch('mcqToAttempt') || watch('mcqCount')} questions. Each question carries {watch('mcqMarks')} mark.
                                    </small>
                                    <span className="badge bg-primary ms-2">
                                      {watch('mcqToAttempt') || watch('mcqCount')} × {watch('mcqMarks')} = {(watch('mcqToAttempt') || watch('mcqCount') || 0) * (watch('mcqMarks') || 0)} marks
                                    </span>
                                  </div>
                                </div>
                                
                                <div 
                                  className="questions-list"
                                  onDragOver={(e) => handleDragOver(e)}
                                  onDrop={(e) => handleDrop(e, 'mcq')}
                                >
                                  <table style={{ 
                                    width: '100%', 
                                    borderCollapse: 'collapse', 
                                    margin: '10px 0', 
                                    fontSize: '14px',
                                    direction: watch('language') === 'english' ? 'ltr' : 'rtl'
                                  }}>
                                    <tbody>
                                      {previewQuestions.mcq.map((question, index) => (
                                        <tr 
                                          key={question.id}
                                          className={`question-item ${isEditMode ? 'cursor-grab' : ''} ${
                                            draggedQuestion?.id === question.id ? 'dragging' : ''
                                          }`}
                                          draggable={isEditMode}
                                          onDragStart={(e) => handleDragStart(e, question.id, 'mcq')}
                                          onDragEnd={handleDragEnd}
                                          style={{ 
                                            transition: 'all 0.3s ease',
                                            position: 'relative',
                                            cursor: isEditMode ? 'grab' : 'default'
                                          }}
                                        >
                                          <td className="qnum" style={{ 
                                            width: '40px', 
                                            textAlign: 'center', 
                                            fontWeight: 'bold',
                                            border: '1px solid #000',
                                            padding: '8px',
                                            verticalAlign: 'top',
                                            position: 'relative'
                                          }}>
                                            {/* Drag handle */}
                                            {isEditMode && (
                                              <div className="position-absolute top-0 start-0 m-1 text-muted" style={{ cursor: 'grab' }}>
                                                <i className="bi bi-grip-vertical fs-6"></i>
                                              </div>
                                            )}
                                            {index + 1}
                                          </td>
                                          <td style={{ 
                                            border: '1px solid #000',
                                            padding: '8px',
                                            verticalAlign: 'top'
                                          }}>
                                            {/* Question Text - FIXED BILINGUAL DISPLAY */}
                                            <div className="question" style={{ 
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              margin: '0 0 10px 0'
                                            }}>
                                              <div className="flex-grow-1">
                                                {watch('language') === 'english' && (
                                                  <span className="fw-bold" style={{
                                                    fontFamily: "'Times New Roman', serif",
                                                    direction: 'ltr',
                                                    fontSize: '14px',
                                                    lineHeight: '1.4'
                                                  }}>{question.question_text}</span>
                                                )}
                                                
                                                {watch('language') === 'urdu' && (
                                                  <span className="fw-bold" style={{
                                                    fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                    direction: 'rtl',
                                                    fontSize: '14px',
                                                    lineHeight: '1.8'
                                                  }}>{question.question_text_urdu || question.question_text}</span>
                                                )}
                                                
                                                {watch('language') === 'bilingual' && (
                                                  <div className="d-flex justify-content-between">
                                                    {/* Urdu version */}
                                                    <div className="fw-bold" style={{
                                                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                      direction: 'rtl',
                                                      fontSize: '14px',
                                                      lineHeight: '1.8'
                                                    }}>{question.question_text_urdu}</div>
                                                    {/* English version */}
                                                    <div className="fw-bold" style={{
                                                      fontFamily: "'Times New Roman', serif",
                                                      direction: 'ltr',
                                                      fontSize: '14px',
                                                      lineHeight: '1.4',
                                                      marginBottom: '8px'
                                                    }}>{question.question_text_english || question.question_text}</div>
                                                  </div>
                                                )}
                                              </div>
                                              <div className="d-flex align-items-center gap-2 ms-3">
                                                {isEditMode && (
                                                  <div className="individual-marks-input">
                                                    <small className="text-muted me-2">Marks:</small>
                                                    <input
                                                      type="number"
                                                      className="form-control form-control-sm"
                                                      style={{ width: '70px' }}
                                                      value={question.customMarks || watch('mcqMarks')}
                                                      onChange={(e) => {
                                                        const newMarks = parseInt(e.target.value) || 1;
                                                        setPreviewQuestions(prev => ({
                                                          ...prev,
                                                          mcq: prev.mcq.map(q => 
                                                            q.id === question.id 
                                                              ? { ...q, customMarks: newMarks }
                                                              : q
                                                          )
                                                        }));
                                                      }}
                                                      min="1"
                                                    />
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            
                                            {/* Options - FIXED BILINGUAL DISPLAY */}
                                            <div className="options" style={{ 
                                              marginTop: '8px', 
                                              display: 'flex', 
                                              justifyContent: 'space-between', 
                                              fontSize: '12px',
                                              flexWrap: 'wrap',
                                              gap: '15px'
                                            }}>
                                              {question.option_a && (
                                                <span className="option-item d-flex justify-content-between">
                                                  <span> (A).  </span> 
                                                  {watch('language') === 'english' && (
                                                    <span style={{
                                                      fontFamily: "'Times New Roman', serif",
                                                      direction: 'ltr'
                                                    }}> {question.option_a}</span>
                                                  )}
                                                  {watch('language') === 'urdu' && (
                                                    <span style={{
                                                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                      direction: 'rtl'
                                                    }}> {question.option_a_urdu || question.option_a}</span>
                                                  )}
                                                  {watch('language') === 'bilingual' && (
                                                    <span className="d-flex justify-content-between">
                                                      <span className="d-block" style={{
                                                        fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                        direction: 'rtl'
                                                      }}> {question.option_a_urdu}</span> &nbsp; 
                                                      <span className="d-block" style={{
                                                        fontFamily: "'Times New Roman', serif",
                                                        direction: 'ltr',
                                                        marginBottom: '2px'
                                                      }}> {question.option_a_english || question.option_a}</span>
                                                    </span>
                                                  )}
                                                </span>
                                              )}
                                              {question.option_b && (
                                                <span className="option-item d-flex justify-content-between">
                                                  <span>(B). </span> 
                                                  {watch('language') === 'english' && (
                                                    <span style={{
                                                      fontFamily: "'Times New Roman', serif",
                                                      direction: 'ltr'
                                                    }}> {question.option_b}</span>
                                                  )}
                                                  {watch('language') === 'urdu' && (
                                                    <span style={{
                                                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                      direction: 'rtl'
                                                    }}> {question.option_b_urdu || question.option_b}</span>
                                                  )}
                                                  {watch('language') === 'bilingual' && (
                                                    <span className="d-flex justify-content-between">
                                                      <span className="d-block" style={{
                                                        fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                        direction: 'rtl'
                                                      }}> {question.option_b_urdu}</span> &nbsp;
                                                      <span className="d-block" style={{
                                                        fontFamily: "'Times New Roman', serif",
                                                        direction: 'ltr',
                                                        marginBottom: '2px'
                                                      }}> {question.option_b_english || question.option_b}</span>
                                                    </span>
                                                  )}
                                                </span>
                                              )}
                                              {question.option_c && (
                                                <span className="option-item d-flex justify-content-between">
                                                  <span> (C). </span>  
                                                  {watch('language') === 'english' && (
                                                    <span style={{
                                                      fontFamily: "'Times New Roman', serif",
                                                      direction: 'ltr'
                                                    }}> {question.option_c}</span>
                                                  )}
                                                  {watch('language') === 'urdu' && (
                                                    <span style={{
                                                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                      direction: 'rtl'
                                                    }}> {question.option_c_urdu || question.option_c}</span>
                                                  )}
                                                  {watch('language') === 'bilingual' && (
                                                    <span className="d-flex justify-content-between">
                                                      <span className="d-block" style={{
                                                        fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                        direction: 'rtl'
                                                      }}> {question.option_c_urdu}.</span> &nbsp;
                                                      <span className="d-block" style={{
                                                        fontFamily: "'Times New Roman', serif",
                                                        direction: 'ltr',
                                                        marginBottom: '2px'
                                                      }}> {question.option_c_english || question.option_c}</span>
                                                    </span>
                                                  )}
                                                </span>
                                              )}
                                              {question.option_d && (
                                                <span className="option-item d-flex justify-content-between">
                                                  <span>(D). </span>  
                                                  {watch('language') === 'english' && (
                                                    <span style={{
                                                      fontFamily: "'Times New Roman', serif",
                                                      direction: 'ltr'
                                                    }}> {question.option_d}</span>
                                                  )}
                                                  {watch('language') === 'urdu' && (
                                                    <span style={{
                                                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                      direction: 'rtl'
                                                    }}> {question.option_d_urdu || question.option_d}</span>
                                                  )}
                                                  {watch('language') === 'bilingual' && (
                                                    <span className="d-flex justify-content-between">
                                                      <span className="d-block" style={{
                                                        fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                        direction: 'rtl'
                                                      }}> {question.option_d_urdu}.</span> &nbsp;
                                                      <span className="d-block" style={{
                                                        fontFamily: "'Times New Roman', serif",
                                                        direction: 'ltr',
                                                        marginBottom: '2px'
                                                      }}> {question.option_d_english || question.option_d}.</span>
                                                    </span>
                                                  )}
                                                </span>
                                              )}
                                            </div>
                                            
                                            <div className="mt-2 pt-2 border-top text-start">
                                              <small className="text-muted" style={{
                                                fontFamily: "'Times New Roman', serif",
                                                direction: 'ltr', textAlign: 'left'
                                              }}>
                                                <i className="bi bi-tag me-1"></i>
                                                Chapter {chapters.find(c => c.id === question.chapter_id)?.chapterNo || '1'}
                                                {question.topic && ` • ${question.topic}`}
                                              </small>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Short Questions Section - PDF Design */}
                            {previewQuestions.short.length > 0 && (
                              <div className="section mb-3">
                                <div className="section-header mb-4">
                                  <h5 className="fw-bold mb-2 text-center" style={{ 
                                    fontSize: '14px', 
                                    color: '#2c3e50',
                                    fontFamily: "'Times New Roman', serif",
                                    direction: 'ltr'
                                  }}>
                                    (<span className="english">{(watch('language') === 'english' || watch('language') === 'bilingual') ? 'Part - I' : ''}</span>
                                    <span className="urdu"> {(watch('language') === 'urdu' || watch('language') === 'bilingual') ? 'حصہ اول' : ''}</span>)
                                  </h5>
                                  
                                  {/* Instructions */}
                                  <div className="instructions mb-3" style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    marginBottom: '15px', 
                                    fontWeight: 'bold',
                                    fontSize: '14px'
                                  }}>
                                    {watch('language') === 'english' || watch('language') === 'bilingual' ? (
                                      <div className="eng" style={{
                                        fontFamily: "'Times New Roman', serif",
                                        direction: 'ltr'
                                      }}>
                                        <strong>Part I.</strong> Write short answers. Attempt any {watch('shortToAttempt') || watch('shortCount')} question(s).
                                      </div>
                                    ) : null}
                                    
                                    {watch('language') === 'urdu' || watch('language') === 'bilingual' ? (
                                      <div className="urdu" style={{
                                        fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                        direction: 'rtl',
                                        textAlign: 'right'
                                      }}>
                                        <strong>حصہ اول:</strong> مختصر جوابات لکھیں۔ کوئی {watch('shortToAttempt') || watch('shortCount')} سوالات حل کریں۔
                                      </div>
                                    ) : null}
                                  </div>
                                  
                                  <div className="mt-2">
                                    <small className="text-muted" style={{
                                      fontFamily: "'Times New Roman', serif",
                                      direction: 'ltr'
                                    }}>
                                      Attempt {watch('shortToAttempt') || watch('shortCount')} out of {watch('shortCount')} questions. Each question carries {watch('shortMarks')} marks.
                                    </small>
                                    <span className="badge bg-success ms-2">
                                      {watch('shortToAttempt') || watch('shortCount')} × {watch('shortMarks')} = {(watch('shortToAttempt') || watch('shortCount') || 0) * (watch('shortMarks') || 0)} marks
                                    </span>
                                  </div>
                                </div>
                                
                                <div 
                                  className="questions-list"
                                  onDragOver={(e) => handleDragOver(e)}
                                  onDrop={(e) => handleDrop(e, 'short')}
                                >
                                  {previewQuestions.short.map((question, index) => (
                                    <div
                                      key={question.id}
                                      className={`question-item mb-4 p-3 border rounded ${isEditMode ? 'cursor-grab bg-light' : ''} ${
                                        draggedQuestion?.id === question.id ? 'dragging border-primary' : ''
                                      }`}
                                      draggable={isEditMode}
                                      onDragStart={(e) => handleDragStart(e, question.id, 'short')}
                                      onDragEnd={handleDragEnd}
                                      style={{ 
                                        transition: 'all 0.3s ease',
                                        position: 'relative',
                                        cursor: isEditMode ? 'grab' : 'default'
                                      }}
                                    >
                                      {/* Drag handle */}
                                      {isEditMode && (
                                        <div className="position-absolute top-0 start-0 m-2 text-muted" style={{ cursor: 'grab' }}>
                                          <i className="bi bi-grip-vertical fs-5"></i>
                                        </div>
                                      )}
                                      
                                      <div className="d-flex justify-content-between align-items-start">
                                        <div style={{ flex: 1 }}>
                                          {/* Question Number and Text */}
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
                                            <div style={{ minWidth: '35px', lineHeight: '1.0' }}>
                                              {watch('language') === 'english' ? (
                                                <strong style={{
                                                  fontFamily: "'Times New Roman', serif",
                                                  direction: 'ltr',
                                                  fontSize: '14px'
                                                }}>
                                                  ({index + 1})
                                                </strong>
                                              ) : watch('language') === 'urdu' ? (
                                                <strong style={{
                                                  fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                  direction: 'rtl',
                                                  fontSize: '14px',
                                                  textAlign: 'right'
                                                }}>
                                                  ({index + 1})
                                                </strong>
                                              ) : (
                                                <strong style={{
                                                  fontFamily: "'Times New Roman', serif",
                                                  direction: 'ltr',
                                                  fontSize: '14px'
                                                }}>
                                                  ({index + 1})
                                                </strong>
                                              )}
                                            </div>
                                            
                                            <div style={{ flex: 1 }}>
                                              {/* Question Text - FIXED BILINGUAL DISPLAY */}
                                              {watch('language') === 'english' && (
                                                <span style={{
                                                  fontFamily: "'Times New Roman', serif",
                                                  direction: 'ltr',
                                                  fontSize: '14px',
                                                  lineHeight: '1.4'
                                                }}>
                                                  {question.question_text}
                                                </span>
                                              )}
                                              
                                              {watch('language') === 'urdu' && (
                                                <span style={{
                                                  fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                  direction: 'rtl',
                                                  fontSize: '14px',
                                                  lineHeight: '1.8',
                                                  textAlign: 'right'
                                                }}>
                                                  {question.question_text_urdu || question.question_text}
                                                </span>
                                              )}
                                              
                                              {watch('language') === 'bilingual' && (
                                                <div className="bilingual-stacked d-flex justify-content-between">
                                                  {/* Mobile view - stacked */}
                                                  <div className="d-md-none w-100">
                                                    <div className="urdu-version mb-2" style={{
                                                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                      direction: 'rtl',
                                                      fontSize: '14px',
                                                      lineHeight: '1.8',
                                                      textAlign: 'right'
                                                    }}>
                                                      {question.question_text_urdu}
                                                    </div>
                                                    <div className="english-version" style={{
                                                      fontFamily: "'Times New Roman', serif",
                                                      direction: 'ltr',
                                                      fontSize: '14px',
                                                      lineHeight: '1.4'
                                                    }}>
                                                      {question.question_text_english || question.question_text}
                                                    </div>
                                                  </div>
                                                  
                                                  {/* Desktop view - side by side */}
                                                  <div className="d-none d-md-flex w-100">
                                                    <div className="english-version" style={{
                                                      fontFamily: "'Times New Roman', serif",
                                                      direction: 'ltr',
                                                      fontSize: '14px',
                                                      lineHeight: '1.4',
                                                      flex: 1,
                                                      paddingRight: '15px'
                                                    }}>
                                                      {question.question_text_english || question.question_text}
                                                    </div>
                                                    <div className="urdu-version" style={{
                                                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                      direction: 'rtl',
                                                      fontSize: '14px',
                                                      lineHeight: '1.8',
                                                      textAlign: 'right',
                                                      flex: 1,
                                                      paddingLeft: '15px'
                                                    }}>
                                                      {question.question_text_urdu}
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Marks and Difficulty */}
                                        <div className="d-flex align-items-center gap-2 ms-3" style={{ minWidth: '20px' }}>
                                          {isEditMode && (
                                            <div className="individual-marks-input">
                                              <small className="text-muted me-1">Marks:</small>
                                              <input
                                                type="number"
                                                className="form-control form-control-sm"
                                                style={{ width: '70px' }}
                                                value={question.customMarks || watch('shortMarks')}
                                                onChange={(e) => {
                                                  const newMarks = parseInt(e.target.value) || 2;
                                                  setPreviewQuestions(prev => ({
                                                    ...prev,
                                                    short: prev.short.map(q => 
                                                      q.id === question.id 
                                                        ? { ...q, customMarks: newMarks }
                                                        : q
                                                    )
                                                  }));
                                                }}
                                                min="1"
                                              />
                                            </div>
                                          )}
                                          <span className="badge bg-secondary me-1">{question.customMarks || watch('shortMarks')} marks</span>
                                        </div>
                                      </div>
                                      
                                      <div className="mt-2 pt-2 border-top">
                                        <small className="text-muted" style={{
                                          fontFamily: "'Times New Roman', serif",
                                          direction: 'ltr'
                                        }}>
                                          <i className="bi bi-tag me-1"></i>
                                          Chapter {chapters.find(c => c.id === question.chapter_id)?.chapterNo || '1'}
                                          {question.topic && ` • ${question.topic}`}
                                        </small>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Long Questions Section - PDF Design */}
                            {previewQuestions.long.length > 0 && (
                              <div className="section mb-3">
                                <div className="section-header mb-4">
                                  <h5 className="fw-bold mb-2 text-center" style={{ 
                                    fontSize: '14px', 
                                    color: '#2c3e50',
                                    fontFamily: "'Times New Roman', serif",
                                    direction: 'ltr'
                                  }}>
                                    (<span className="english">{(watch('language') === 'english' || watch('language') === 'bilingual') ? 'Part - II' : ''}</span>
                                    <span className="urdu"> {(watch('language') === 'urdu' || watch('language') === 'bilingual') ? 'حصہ دوم' : ''}</span>)
                                  </h5>
                                  
                                  {/* Instructions */}
                                  <div className="instructions mb-3 d-flex justify-content-between" style={{ 
                                    fontWeight: 'bold',
                                    fontSize: '14px'
                                  }}>
                                    {watch('language') === 'english' || watch('language') === 'bilingual' ? (
                                      <div className="eng" style={{
                                        fontFamily: "'Times New Roman', serif",
                                        direction: 'ltr'
                                      }}>
                                        <strong>Note:</strong> Attempt any {watch('longToAttempt') || watch('longCount')} question(s).
                                      </div>
                                    ) : null}
                                    
                                    {watch('language') === 'urdu' || watch('language') === 'bilingual' ? (
                                      <div className="urdu" style={{
                                        fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                        direction: 'rtl',
                                        textAlign: 'right'
                                      }}>
                                        <strong>نوٹ:</strong> کوئی {watch('longToAttempt') || watch('longCount')} سوالات حل کریں۔
                                      </div>
                                    ) : null}
                                  </div>
                                  
                                  <div className="mt-2">
                                    <small className="text-muted" style={{
                                      fontFamily: "'Times New Roman', serif",
                                      direction: 'ltr'
                                    }}>
                                      Attempt {watch('longToAttempt') || watch('longCount')} out of {watch('longCount')} questions. Each question carries {watch('longMarks')} marks.
                                    </small>
                                    <span className="badge bg-danger ms-2">
                                      {watch('longToAttempt') || watch('longCount')} × {watch('longMarks')} = {(watch('longToAttempt') || watch('longCount') || 0) * (watch('longMarks') || 0)} marks
                                    </span>
                                  </div>
                                </div>
                                
                                <div 
                                  className="questions-list"
                                  onDragOver={(e) => handleDragOver(e)}
                                  onDrop={(e) => handleDrop(e, 'long')}
                                >
                                  {previewQuestions.long.map((question, index) => (
                                    <div
                                      key={question.id}
                                      className={`question-item mb-4 p-3 border rounded ${isEditMode ? 'cursor-grab bg-light' : ''} ${
                                        draggedQuestion?.id === question.id ? 'dragging border-primary' : ''
                                      }`}
                                      draggable={isEditMode}
                                      onDragStart={(e) => handleDragStart(e, question.id, 'long')}
                                      onDragEnd={handleDragEnd}
                                      style={{ 
                                        transition: 'all 0.3s ease',
                                        position: 'relative',
                                        cursor: isEditMode ? 'grab' : 'default'
                                      }}
                                    >
                                      {/* Drag handle */}
                                      {isEditMode && (
                                        <div className="position-absolute top-0 start-0 m-2 text-muted" style={{ cursor: 'grab' }}>
                                          <i className="bi bi-grip-vertical fs-5"></i>
                                        </div>
                                      )}
                                      
                                      <div className="d-flex justify-content-between align-items-start">
                                        <div style={{ flex: 1 }}>
                                          {/* Question Number and Text */}
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
                                            <div style={{ minWidth: '35px', lineHeight: '1.0' }}>
                                              {watch('language') === 'english' ? (
                                                <strong style={{
                                                  fontFamily: "'Times New Roman', serif",
                                                  direction: 'ltr',
                                                  fontSize: '14px'
                                                }}>
                                                  Q.{index + 1}.
                                                </strong>
                                              ) : watch('language') === 'urdu' ? (
                                                <strong style={{
                                                  fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                  direction: 'rtl',
                                                  fontSize: '14px',
                                                  textAlign: 'right'
                                                }}>
                                                  سوال {index + 1}:
                                                </strong>
                                              ) : (
                                                <strong style={{
                                                  fontFamily: "'Times New Roman', serif",
                                                  direction: 'ltr',
                                                  fontSize: '14px'
                                                }}>
                                                  Q.{index + 1}.
                                                </strong>
                                              )}
                                            </div>
                                            
                                            <div style={{ flex: 1 }}>
                                              {/* Question Text - FIXED BILINGUAL DISPLAY */}
                                              {watch('language') === 'english' && (
                                                <span style={{
                                                  fontFamily: "'Times New Roman', serif",
                                                  direction: 'ltr',
                                                  fontSize: '14px',
                                                  lineHeight: '1.4'
                                                }}>
                                                  {question.question_text}
                                                </span>
                                              )}
                                              
                                              {watch('language') === 'urdu' && (
                                                <span style={{
                                                  fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                  direction: 'rtl',
                                                  fontSize: '14px',
                                                  lineHeight: '1.8',
                                                  textAlign: 'right'
                                                }}>
                                                  {question.question_text_urdu || question.question_text}
                                                </span>
                                              )}
                                              
                                              {watch('language') === 'bilingual' && (
                                                <div className="bilingual-stacked d-flex justify-content-between">
                                                  {/* Mobile view - stacked */}
                                                  <div className="d-md-none w-100">
                                                    <div className="urdu-version mb-2" style={{
                                                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                      direction: 'rtl',
                                                      fontSize: '14px',
                                                      lineHeight: '1.8',
                                                      textAlign: 'right'
                                                    }}>
                                                      {question.question_text_urdu}
                                                    </div>
                                                    <div className="english-version" style={{
                                                      fontFamily: "'Times New Roman', serif",
                                                      direction: 'ltr',
                                                      fontSize: '14px',
                                                      lineHeight: '1.4'
                                                    }}>
                                                      {question.question_text_english || question.question_text}
                                                    </div>
                                                  </div>
                                                  
                                                  {/* Desktop view - side by side */}
                                                  <div className="d-none d-md-flex w-100">
                                                    <div className="english-version" style={{
                                                      fontFamily: "'Times New Roman', serif",
                                                      direction: 'ltr',
                                                      fontSize: '14px',
                                                      lineHeight: '1.4',
                                                      flex: 1,
                                                      paddingRight: '15px'
                                                    }}>
                                                      {question.question_text_english || question.question_text}
                                                    </div>
                                                    <div className="urdu-version" style={{
                                                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                      direction: 'rtl',
                                                      fontSize: '14px',
                                                      lineHeight: '1.8',
                                                      textAlign: 'right',
                                                      flex: 1,
                                                      paddingLeft: '15px'
                                                    }}>
                                                      {question.question_text_urdu}
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Marks and Difficulty */}
                                        <div className="d-flex align-items-center gap-2 ms-3" style={{ minWidth: '20px' }}>
                                          {isEditMode && (
                                            <div className="individual-marks-input">
                                              <small className="text-muted me-1">Marks:</small>
                                              <input
                                                type="number"
                                                className="form-control form-control-sm"
                                                style={{ width: '70px' }}
                                                value={question.customMarks || watch('longMarks')}
                                                onChange={(e) => {
                                                  const newMarks = parseInt(e.target.value) || 5;
                                                  setPreviewQuestions(prev => ({
                                                    ...prev,
                                                    long: prev.long.map(q => 
                                                      q.id === question.id 
                                                        ? { ...q, customMarks: newMarks }
                                                        : q
                                                    )
                                                  }));
                                                }}
                                                min="1"
                                              />
                                            </div>
                                          )}
                                          <span className="badge bg-secondary me-1">{question.customMarks || watch('longMarks')} marks</span>
                                        </div>
                                      </div>
                                      
                                      <div className="mt-2 pt-2 border-top">
                                        <small className="text-muted" style={{
                                          fontFamily: "'Times New Roman', serif",
                                          direction: 'ltr'
                                        }}>
                                          <i className="bi bi-tag me-1"></i>
                                          Chapter {chapters.find(c => c.id === question.chapter_id)?.chapterNo || '1'}
                                          {question.topic && ` • ${question.topic}`}
                                        </small>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* No Questions Message */}
                            {previewQuestions.mcq.length === 0 && 
                             previewQuestions.short.length === 0 && 
                             previewQuestions.long.length === 0 && (
                              <div className="text-center py-5">
                                <i className="bi bi-inbox display-1 text-muted mb-3"></i>
                                <h5 style={{
                                  fontFamily: "'Times New Roman', serif",
                                  direction: 'ltr'
                                }}>No Questions Found</h5>
                                <p className="text-muted" style={{
                                  fontFamily: "'Times New Roman', serif",
                                  direction: 'ltr'
                                }}>
                                  No questions match your current criteria. Try adjusting your chapter selection or difficulty settings.
                                </p>
                                <button 
                                  className="btn btn-primary"
                                  onClick={() => setStep(3)}
                                >
                                  <i className="bi bi-arrow-left me-2"></i>
                                  Adjust Chapter Selection
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Footer matching PDF */}
                          <div className="footer no-break" style={{ 
                            marginTop: '30px', 
                            textAlign: 'center', 
                            fontSize: '12px', 
                            color: '#666', 
                            borderTop: '1px solid #ccc', 
                            paddingTop: '10px' 
                          }}>
                            <p style={{
                              fontFamily: "'Times New Roman', serif",
                              direction: 'ltr'
                            }}>
                              Generated on {new Date().toLocaleDateString()} | www.examly.pk | Generate papers Save Time
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Controls Sidebar */}
                <div className="col-lg-4">
                  <div className="card mb-4 border-0 shadow-sm sticky-top" style={{ top: '50px', zIndex: '1' }}>
                    <div className="card-header bg-primary text-white">
                      <h3 className="h5 card-title mb-0">🎯 Paper Controls</h3>
                    </div>
                    <div className="card-body">
                      {/* Real-time Marks Calculator - FIXED: Uses "To Attempt" values */}
                      <div className="mb-4 p-3 bg-light rounded">
                        <h6 className="fw-bold text-primary mb-3">📊 Live Marks Calculator</h6>
                        <div className="row text-center g-3">
                          <div className="col-4">
                            <div className="fw-bold text-primary">MCQs</div>
                            <div className="fs-5 fw-bold">{watch('mcqToAttempt') || 0}/{previewQuestions.mcq.length}</div>
                            <div className="small text-muted">
                              {watch('mcqToAttempt') || 0} to attempt
                            </div>
                            <div className="fw-bold text-success">
                              = {calculateTotalMarks().mcq} marks
                            </div>
                          </div>
                          <div className="col-4">
                            <div className="fw-bold text-success">Short</div>
                            <div className="fs-5 fw-bold">{watch('shortToAttempt') || 0}/{previewQuestions.short.length}</div>
                            <div className="small text-muted">
                              {watch('shortToAttempt') || 0} to attempt
                            </div>
                            <div className="fw-bold text-success">
                              = {calculateTotalMarks().short} marks
                            </div>
                          </div>
                          <div className="col-4">
                            <div className="fw-bold text-danger">Long</div>
                            <div className="fs-5 fw-bold">{watch('longToAttempt') || 0}/{previewQuestions.long.length}</div>
                            <div className="small text-muted">
                              {watch('longToAttempt') || 0} to attempt
                            </div>
                            <div className="fw-bold text-success">
                              = {calculateTotalMarks().long} marks
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-center mt-3 pt-3 border-top">
                          <div className="fw-bold fs-4 text-primary">
                            Total: {calculateTotalMarks().total} Marks
                          </div>
                          <small className="text-muted">
                            Based on "To Attempt" values
                          </small>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="action-buttons">
                        <button 
                          className="btn btn-success w-100 btn-lg mb-3" 
                          type="submit" 
                          disabled={isLoading || isLoadingPreview}
                        >
                          {isLoading ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                              Generating PDF...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-file-earmark-pdf me-2"></i>
                              Generate Paper PDF
                            </>
                          )}
                        </button>

                        <button
                          className="btn btn-info w-100 text-white btn-lg mb-3"
                          type="button"
                          onClick={async () => {
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
                                // Pass reordered questions to MCQ key generation
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
                          }}
                          disabled={isLoading || isDownloadingKey || watchedMcqCount === 0 || isLoadingPreview}
                        >
                          {isDownloadingKey ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                              Generating Key...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-key me-2"></i> Download Answer Key
                            </>
                          )}
                        </button>
                        
                        <div className="row g-2 mb-3">
                          <div className="col-6">
                            <button 
                              className="btn btn-outline-primary w-100" 
                              type="button" 
                              onClick={resetForm}
                              disabled={isLoading}
                            >
                              <i className="bi bi-plus-circle me-2"></i>
                              New Paper
                            </button>
                          </div>
                          <div className="col-6">
                            <button 
                              className="btn btn-outline-secondary w-100" 
                              type="button" 
                              onClick={() => setStep(5)}
                              disabled={isLoading}
                            >
                              <i className="bi bi-arrow-left me-2"></i>
                              Back
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Quick Stats - FIXED: Shows marks based on "To Attempt" */}
                      <div className="quick-stats mt-4 p-3 border rounded">
                        <h6 className="fw-bold text-primary mb-3">📈 Question Statistics</h6>
                        <div className="row text-center g-3">
                          <div className="col-4">
                            <div className="fw-bold text-primary">{watch('mcqToAttempt') || 0}/{previewQuestions.mcq.length}</div>
                            <small className="text-muted">MCQs (Attempt/Total)</small>
                            <div className="small text-success">
                              {calculateTotalMarks().mcq} marks
                            </div>
                          </div>
                          <div className="col-4">
                            <div className="fw-bold text-success">{(watch('shortToAttempt') || 0) + (watch('longToAttempt') || 0)}/{(previewQuestions.short.length + previewQuestions.long.length)}</div>
                            <small className="text-muted">Subjective (Attempt/Total)</small>
                            <div className="small text-success">
                              {calculateTotalMarks().short + calculateTotalMarks().long} marks
                            </div>
                          </div>
                          <div className="col-4">
                            <div className="fw-bold text-danger">{(watch('mcqToAttempt') || 0) + (watch('shortToAttempt') || 0) + (watch('longToAttempt') || 0)}</div>
                            <small className="text-muted">Total to Attempt</small>
                            <div className="fw-bold text-success fs-6">
                              {calculateTotalMarks().total} Total Marks
                            </div>
                          </div>
                          <div className="col-12">
                            <div className="fw-bold text-info fs-5">
                              Total: {calculateTotalMarks().total} Marks
                            </div>
                            <small className="text-muted">Based on "To Attempt" values</small>
                          </div>
                        </div>
                      </div>

                      {/* Edit Mode Tips */}
                      {isEditMode && (
                        <div className="edit-tips mt-3 p-3 bg-warning bg-opacity-10 rounded border">
                          <h6 className="fw-bold mb-2">
                            <i className="bi bi-lightbulb me-2"></i>
                            Editing Tips
                          </h6>
                          <ul className="small mb-0">
                            <li>Drag questions to reorder within sections</li>
                            <li>Adjust marks for each question type</li>
                            <li>Changes reflect in real-time PDF</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>
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
}