/** app/dashboard/generate-paper/page.tsx */
'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
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
                            <div className="row">
                              {question.option_a && (
                                <div className="col-md-6">
                                  <span className={language === 'urdu' ? 'urdu-text' : language === 'bilingual' ? 'bilingual-text' : ''}>
                                    A) {
                                      language === 'english' && question.option_a
                                    }
                                    {language === 'urdu' && (question.option_a_urdu || question.option_a)}
                                    {language === 'bilingual' && (
                                      <>
                                        <div style={{ direction: 'ltr', textAlign: 'left' }}>
                                          {question.option_a_english || question.option_a}
                                        </div>
                                        <div style={{ direction: 'rtl', textAlign: 'right' }}>
                                          {question.option_a_urdu}
                                        </div>
                                      </>
                                    )}
                                  </span>
                                </div>
                              )}
                              {question.option_b && (
                                <div className="col-md-6">
                                  <span className={language === 'urdu' ? 'urdu-text' : language === 'bilingual' ? 'bilingual-text' : ''}>
                                    B) {
                                      language === 'english' && question.option_b
                                    }
                                    {language === 'urdu' && (question.option_b_urdu || question.option_b)}
                                    {language === 'bilingual' && (
                                      <>
                                        <div style={{ direction: 'ltr', textAlign: 'left' }}>
                                          {question.option_b_english || question.option_b}
                                        </div>
                                        <div style={{ direction: 'rtl', textAlign: 'right' }}>
                                          {question.option_b_urdu}
                                        </div>
                                      </>
                                    )}
                                  </span>
                                </div>
                              )}
                              {question.option_c && (
                                <div className="col-md-6">
                                  <span className={language === 'urdu' ? 'urdu-text' : language === 'bilingual' ? 'bilingual-text' : ''}>
                                    C) {
                                      language === 'english' && question.option_c
                                    }
                                    {language === 'urdu' && (question.option_c_urdu || question.option_c)}
                                    {language === 'bilingual' && (
                                      <>
                                        <div style={{ direction: 'ltr', textAlign: 'left' }}>
                                          {question.option_c_english || question.option_c}
                                        </div>
                                        <div style={{ direction: 'rtl', textAlign: 'right' }}>
                                          {question.option_c_urdu}
                                        </div>
                                      </>
                                    )}
                                  </span>
                                </div>
                              )}
                              {question.option_d && (
                                <div className="col-md-6">
                                  <span className={language === 'urdu' ? 'urdu-text' : language === 'bilingual' ? 'bilingual-text' : ''}>
                                    D) {
                                      language === 'english' && question.option_d
                                    }
                                    {language === 'urdu' && (question.option_d_urdu || question.option_d)}
                                    {language === 'bilingual' && (
                                      <>
                                        <div style={{ direction: 'ltr', textAlign: 'left' }}>
                                          {question.option_d_english || question.option_d}
                                        </div>
                                        <div style={{ direction: 'rtl', textAlign: 'right' }}>
                                          {question.option_d_urdu}
                                        </div>
                                      </>
                                    )}
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

  // Load auto selected questions
// Load auto selected questions - IMPROVED VERSION
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

    // Fetch questions for each type with better handling
    const fetchQuestionsByType = async (
      questionType: QuestionType, 
      count: number,
      chapterIds: string[]
    ) => {
      if (count <= 0) return [];
      
      try {
        console.log(`📥 Fetching ${count} ${questionType} questions`);
        
        const response = await axios.get(`/api/questions`, {
          params: {
            subjectId: watchedSubjectId,
            classId: watchedClassId,
            questionType,
            chapterIds: chapterIds.join(','),
            language,
            includeUrdu: language !== 'english',
            sourceType: sourceType !== 'all' ? sourceType : undefined,
            limit: count * 2, // Fetch more to ensure we have enough
            random: true
          },
        });
        
        const questions = response.data || [];
        console.log(`✅ Got ${questions.length} ${questionType} questions, need ${count}`);
        
        // If we don't have enough questions, try without source type filter
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
              limit: count * 2,
              random: true
            },
          });
          
          const fallbackQuestions = fallbackResponse.data || [];
          console.log(`🔄 Got ${fallbackQuestions.length} ${questionType} questions from fallback`);
          
          // Combine and deduplicate
          const combinedQuestions = [...questions, ...fallbackQuestions];
          const uniqueQuestions = combinedQuestions.filter((q, index, self) => 
            index === self.findIndex(q2 => q2.id === q.id)
          );
          
          return uniqueQuestions.slice(0, count);
        }
        
        return questions.slice(0, count);
      } catch (error) {
        console.error(`❌ Error fetching ${questionType} questions:`, error);
        return [];
      }
    };

    // Fetch all question types in parallel
    const [mcqQuestions, shortQuestions, longQuestions] = await Promise.all([
      fetchQuestionsByType('mcq', formValues.mcqCount, chapterIds),
      fetchQuestionsByType('short', formValues.shortCount, chapterIds),
      fetchQuestionsByType('long', formValues.longCount, chapterIds),
    ]);

    console.log('🎯 Final question counts:', {
      mcq: mcqQuestions.length,
      short: shortQuestions.length,
      long: longQuestions.length,
      expected: {
        mcq: formValues.mcqCount,
        short: formValues.shortCount,
        long: formValues.longCount
      }
    });

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
// Optimized load preview questions when reaching step 7 - FIXED VERSION
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
  // Optimized useEffect for step 7 loading
// Optimized useEffect for step 7 loading// Fixed useEffect for step 7 loading
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

 const onSubmit = async (formData: PaperFormData) => {
  if (!canGeneratePaper()) {
    setShowSubscriptionModal(true);
    return;
  }

  if (!isAuthenticated) {
    alert('Please login to generate papers');
    return;
  }

  setIsLoading(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      alert('You must be logged in to generate a paper.');
      setIsLoading(false);
      return;
    }

    const user = session?.user;
    let  accessToken = session?.access_token;
// If there's no token, re-check session once (helps when session is stale or not hydrated)
/*if (!accessToken) {
  const refreshed = await supabase.auth.getSession(); // re-check
  accessToken = refreshed?.data?.session?.access_token || refreshed?.session?.access_token || null;
}
// If still no token, fail with a helpful message and do NOT call the API with an undefined token
if (!accessToken) {
  console.warn('No Supabase access token found for current session. Aborting paper generation.');
  alert('Session problem: we could not obtain an authentication token. Please logout and login again (use Google login once more) and try again.');
  setIsLoading(false);
  return;
}
  */
 // If there's no token, try to refresh the session
if (!accessToken) {
  const { data: refreshedSession } = await supabase.auth.refreshSession();
  if (refreshedSession?.session) {
    accessToken = refreshedSession.session.access_token;
  }
}

// Final validation
if (!accessToken) {
  console.warn('No access token available');
  alert('Authentication issue. Please try logging in again.');
  setIsLoading(false);
  return;
}
    const randomSeed = Date.now();
    
    // Get chapter IDs for validation
    const chapterIds = getChapterIdsToUse();
    
    // Validate we have chapters
    if (chapterIds.length === 0) {
      alert('No chapters found for the selected subject and class. Please check your selection.');
      setIsLoading(false);
      return;
    }

    // Validate we're requesting questions
    if (formData.mcqCount === 0 && formData.shortCount === 0 && formData.longCount === 0) {
      alert('Please select at least one question type with count greater than 0.');
      setIsLoading(false);
      return;
    }

    console.log('🎯 Sending request to API with data:', {
      subjectId: formData.subjectId,
      classId: formData.classId,
      chapterIds: chapterIds,
      mcqCount: formData.mcqCount,
      shortCount: formData.shortCount,
      longCount: formData.longCount,
      source_type: formData.source_type,
      selectionMethod: formData.selectionMethod
    });
    
    // Prepare selected questions based on current preview order
    const selectedQuestionsFromPreview = {
      mcq: previewQuestions.mcq.map(q => q.id),
      short: previewQuestions.short.map(q => q.id),
      long: previewQuestions.long.map(q => q.id)
    };

    // CRITICAL FIX: Prepare questions with custom marks for PDF generation
    const questionsWithCustomMarks = {
      mcq: previewQuestions.mcq.map(q => ({
        ...q,
        // Include the custom marks in the question object itself
        marks: q.customMarks || formData.mcqMarks,
        // Ensure the default marks are also available
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

    const payload = {
      ...formData,
      userId: user.id,
      randomSeed,
      mcqToAttempt: formData.mcqToAttempt || formData.mcqCount,
      shortToAttempt: formData.shortToAttempt || formData.shortCount,
      longToAttempt: formData.longToAttempt || formData.longCount,
      selectedQuestions: selectedQuestionsFromPreview,
      language: formData.language,
      shuffleQuestions: formData.shuffleQuestions,
      // CRITICAL: Pass questions WITH CUSTOM MARKS embedded in each question
      reorderedQuestions: questionsWithCustomMarks,
      // Add explicit ordering information with marks
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
      // Add custom marks as a separate object for backup
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
    
    console.log('📦 Payload with custom marks:', {
      mcqMarks: payload.reorderedQuestions.mcq.map(q => ({ id: q.id, marks: q.marks })),
      shortMarks: payload.reorderedQuestions.short.map(q => ({ id: q.id, marks: q.marks })),
      longMarks: payload.reorderedQuestions.long.map(q => ({ id: q.id, marks: q.marks }))
    });
/*
    const response = await fetch("/api/generate-paper", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
*/
const headers: Record<string,string> = {
  "Content-Type": "application/json"
};
if (accessToken && typeof accessToken === 'string' && accessToken.split('.').length === 3) {
  headers.Authorization = `Bearer ${accessToken}`;
} else {
  // debug log to help triage in future
  console.warn('No valid access token for API call; not sending Authorization header.');
}

// perform the fetch with valid headers
const response = await fetch("/api/generate-paper", {
  method: "POST",
  headers,
  body: JSON.stringify(payload),
});
    const contentType = response.headers.get("content-type") || "";
    
    if (response.ok) {
      await refreshTrialStatus();
    }
    
    if (response.ok && contentType.includes("application/pdf")) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "paper.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } else if (contentType.includes("application/json")) {
      const result = await response.json();
      alert(result.error || "Paper generated, but no PDF was returned.");
    } else {
      const text = await response.text();
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

  return (
    <AcademyLayout>
      <div className="container mx-auto px-4 py-4">
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
            <h1 className="h2 mb-0">Generate New Paper</h1>
            {step > 1 && (
              <button className="btn btn-outline-primary btn-lg" onClick={prevStep}>
                <i className="bi bi-arrow-left me-2"></i>
                {step === 2 && 'Back to Class Selection'}
                {step === 3 && 'Back to Subject Selection'}
                {step === 4 && 'Back to Chapter Selection'}
                {step === 5 && 'Back to Paper Type'}
                {step === 6 && 'Back to Selection Method'}
                {step === 7 && 'Back to Previous Step'}
              </button>
            )}
          </div>

          {/* Enhanced Step Progress Indicator */}
          <div className="mb-5">
            <div className="d-flex justify-content-between align-items-center mb-3">
              {[
                { step: 1, label: 'Class', icon: '🎓' },
                { step: 2, label: 'Subject', icon: '📚' },
                { step: 3, label: 'Chapters', icon: '📖' },
                { step: 4, label: 'Paper Type', icon: '📝' },
                { step: 5, label: 'Method', icon: '🤖' },
                { step: 6, label: 'Selection', icon: '✍️' },
                { step: 7, label: 'Review', icon: '👁️' }
              ].map((item, index) => (
                <div key={item.step} className="d-flex flex-column align-items-center position-relative">
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
              <div className="text-center mb-5">
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
                        className={`option-card card h-100 text-center p-4 cursor-pointer ${
                          watchedClassId === cls.id ? "active border-primary" : "border-light"
                        }`}
                        onClick={() => setValue("classId", cls.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="card-body d-flex flex-column justify-content-center">
                          <span className="display-6 mb-3">🎓</span>
                          <h6 className="fw-semibold mb-2">Class {cls.name}</h6>
                          <small className="text-muted">Select to continue</small>
                          
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
              <div className="text-center mb-5">
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
                      <div key={subject.id} className="col">
                        <div
                          className={`option-card card h-100 text-center p-4 cursor-pointer ${
                            watchedSubjectId === subject.id ? "active border-primary" : "border-light"
                          }`}
                          onClick={() => setValue("subjectId", subject.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="card-body d-flex flex-column justify-content-center">
                            <span className="display-6 mb-3">{subjectIcon}</span>
                            <h6 className="fw-semibold mb-2">{subject.name}</h6>
                            <small className="text-muted">Click to select</small>
                            
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

          {/* Step 3: Chapter selection */}
          {step === 3 && (
            <div className="step-transition">
              <div className="text-center mb-5">
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
                            return (
                              <div key={chapter.id} className="col">
                                <div
                                  className={`card h-100 cursor-pointer p-3 transition-all ${
                                    isSelected ? 'border-primary bg-primary bg-opacity-10' : 'border-light'
                                  }`}
                                  onClick={() => handleChapterSelection(chapter.id)}
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
          )}

          {/* Step 4: Paper Type Selection */}
          {step === 4 && (
            <div className="step-card step-transition">
              <div className="text-center mb-5">
                <h5 className="fw-bold mb-3">📝 Select Paper Type</h5>
                <p className="text-muted">Choose between predefined board pattern or customize your own paper</p>
              </div>

              <div className="row g-4">
                {/* Board Paper Card */}
                <div className="col-md-6">
                  <div
                    className={`option-card card h-100 p-4 cursor-pointer ${
                      watch("paperType") === "model" ? "active border-primary shadow" : "border-light"
                    }`}
               // In your Board Paper card onClick handler, replace with this:
// Enhanced Board Paper selection
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
    longCount: 3
  });
  
  // Force state update and then proceed
  setTimeout(() => {
    setStep(5);
  }, 100);
}}                    style={{ cursor: 'pointer' }}
                  >
                    <div className="card-body">
                      <div className="text-center mb-4">
                        <span className="display-6">🏛️</span>
                        <h4 className="mt-3 fw-bold">Board Paper</h4>
                        <p className="text-muted mb-4">Predefined board style with fixed marks & time distribution</p>
                      </div>

                      {/* Question Details */}
                      <div className="bg-light rounded p-3 mb-4">
                        <div className="row text-center g-3">
                          <div className="col-4">
                            <div className="fw-bold text-primary">MCQs</div>
                            <div className="fs-6 fw-bold">12 × 1</div>
                            <small className="text-muted">All to attempt</small>
                          </div>
                          <div className="col-4">
                            <div className="fw-bold text-primary">Short</div>
                            <div className="fs-6 fw-bold">24 Qs</div>
                            <small className="text-muted">16 to attempt × 2</small>
                          </div>
                          <div className="col-4">
                            <div className="fw-bold text-primary">Long</div>
                            <div className="fs-6 fw-bold">3 Qs</div>
                            <small className="text-muted">2 to attempt × 8</small>
                          </div>
                        </div>
                        <div className="text-center mt-3 pt-2 border-top">
                          <small className="text-muted">
                            <i className="bi bi-clock me-1"></i>180 mins • 
                            <i className="bi bi-translate ms-2 me-1"></i>Bilingual • 
                            <i className="bi bi-star ms-2 me-1"></i>60 marks
                          </small>
                        </div>
                      </div>

                      <div className="text-center">
                        <span className="badge bg-primary px-3 py-2">
                          <i className="bi bi-lightning me-2"></i>
                          Quick Setup - Click to Continue
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Paper Card */}
                <div className="col-md-6">
                  <div
                    className={`option-card card h-100 p-4 cursor-pointer ${
                      watch("paperType") === "custom" ? "active border-primary shadow" : "border-light"
                    }`}
                  // In your Custom Paper card onClick handler, replace with:
onClick={() => {
  setValue("paperType", "custom");
  
  // Set reasonable custom paper defaults instead of zeros
  setValue("mcqCount", 10);
  setValue("shortCount", 5);
  setValue("longCount", 3);
  setValue("mcqToAttempt", 10);
  setValue("shortToAttempt", 5);
  setValue("longToAttempt", 3);
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
}}                    style={{ cursor: 'pointer' }}
                  >
                    <div className="card-body">
                      <div className="text-center mb-4">
                        <span className="display-6">⚙️</span>
                        <h4 className="mt-3 fw-bold">Custom Paper</h4>
                        <p className="text-muted mb-4">Full control over marks, sections, difficulty, and timing</p>
                      </div>

                      {/* Features List */}
                      <div className="bg-light rounded p-3 mb-4">
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
                          Full Customization - Click to Configure
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Paper Settings */}
              {watch("paperType") === "custom" && (
                <div className="custom-settings mt-5 p-4 border rounded bg-light step-transition">
                  <h6 className="fw-bold mb-3">⚙️ Customize Paper Settings</h6>

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

                  {/* Date of Paper Field */}
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
                  <div className="distribution-card mt-3 p-3 bg-white rounded shadow-sm">
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

                  {/* Continue Button for Custom Paper */}
                  <div className="text-center mt-4 pt-3 border-top">
                    <button 
                      className="btn btn-primary btn-lg px-5" 
                      onClick={() => setStep(5)}
                    >
                      Continue to Selection Method <i className="bi bi-arrow-right ms-2"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Selection method */}
          {step === 5 && (
            <div className="step-transition">
              <div className="text-center mb-5">
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
                        System will automatically select questions randomly based on your criteria. 
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
                    <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                      <h2 className="h4 card-title mb-0">📋 Paper Preview - Final Review</h2>
                      <div className="d-flex align-items-center gap-3">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="editModeToggle"
                            checked={isEditMode}
                            onChange={(e) => setIsEditMode(e.target.checked)}
                          />
                          <label className="form-check-label text-white" htmlFor="editModeToggle">
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
                                    }}>کل نمبر: {
                                      ((watch('mcqToAttempt') || watch('mcqCount') || 0) * (watch('mcqMarks') || 0) + 
                                      (watch('shortToAttempt') || watch('shortCount') || 0) * (watch('shortMarks') || 0) + 
                                      (watch('longToAttempt') || watch('longCount') || 0) * (watch('longMarks') || 0))
                                    }</span>
                                  )}
                                  {watch('language') !== 'urdu' && (
                                    <span style={{
                                      fontFamily: "'Noto Sans',Arial,sans-serif",
                                      direction: 'ltr',
                                      fontSize: '12px',
                                      verticalAlign: 'middle'
                                    }}>Maximum Marks: {
                                      ((watch('mcqToAttempt') || watch('mcqCount') || 0) * (watch('mcqMarks') || 0) + 
                                      (watch('shortToAttempt') || watch('shortCount') || 0) * (watch('shortMarks') || 0) + 
                                      (watch('longToAttempt') || watch('longCount') || 0) * (watch('longMarks') || 0))
                                    }</span>
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

                          <hr style={{ borderColor: '#000', margin: '20px 0' }} />

                          {/* Questions Preview */}
                          <div className="questions-preview">
                            {/* MCQs Section */}
                            {previewQuestions.mcq.length > 0 && (
                              <div className="section mb-5">
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
                                               {/* <span className={`badge ${
                                                  question.difficulty === 'easy' ? 'bg-success' :
                                                  question.difficulty === 'medium' ? 'bg-warning text-dark' : 'bg-danger'
                                                }`}>
                                                  {question.difficulty}
                                                </span>         */}
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
                              <div className="section mb-5">
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
                                                <div className='d-flex justify-content-between'>
                                                     <div style={{
                                                    fontFamily: "'Times New Roman', serif",
                                                    direction: 'ltr',
                                                    fontSize: '14px',
                                                    lineHeight: '1.4'
                                                  }}>
                                                    {question.question_text_english || question.question_text}
                                                  </div>
                                                  <div style={{
                                                    fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                    direction: 'rtl',
                                                    fontSize: '14px',
                                                    lineHeight: '1.8',
                                                    textAlign: 'right',
                                                    marginBottom: '8px'
                                                  }}>
                                                    {question.question_text_urdu}
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
                                        {/*  <span className={`badge ${
                                            question.difficulty === 'easy' ? 'bg-success' :
                                            question.difficulty === 'medium' ? 'bg-warning text-dark' : 'bg-danger'
                                          }`}>
                                            {question.difficulty}
                                          </span>*/}
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
                              <div className="section mb-5">
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
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>

                                                  <div style={{ flex: 1 }}>
                                                    <div style={{
                                                      fontFamily: "'Times New Roman', serif",
                                                      direction: 'ltr',
                                                      fontSize: '14px',
                                                      lineHeight: '1.4'
                                                    }}>
                                                      {question.question_text_english || question.question_text}
                                                    </div>
                                                  </div>
                                                  <div style={{ flex: 1 }}>
                                                    <div style={{
                                                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                                                      direction: 'rtl',
                                                      fontSize: '14px',
                                                      lineHeight: '1.8',
                                                      textAlign: 'right'
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
                                        {/*  <span className={`badge ${
                                            question.difficulty === 'easy' ? 'bg-success' :
                                            question.difficulty === 'medium' ? 'bg-warning text-dark' : 'bg-danger'
                                          }`}>
                                            {question.difficulty}
                                          </span>
                                          */}
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
                  <div className="card mb-4 border-0 shadow-sm sticky-top" style={{ top: '50px',zIndex:'1' }}>
                    <div className="card-header bg-primary text-white">
                      <h3 className="h5 card-title mb-0">🎯 Paper Controls</h3>
                    </div>
                    <div className="card-body">
                  

{/* Real-time Marks Calculator - FIXED TO SHOW CUSTOM MARKS */}
<div className="mb-4 p-3 bg-light rounded">
  <h6 className="fw-bold text-primary mb-3">📊 Live Marks Calculator</h6>
  <div className="row text-center g-3">
    <div className="col-4">
      <div className="fw-bold text-primary">MCQs</div>
      <div className="fs-5 fw-bold">{previewQuestions.mcq.length}</div>
      <div className="small text-muted">
        {previewQuestions.mcq.length} × Individual Marks
      </div>
      <div className="fw-bold text-success">
        = {previewQuestions.mcq.reduce((total, q) => total + (q.customMarks || watch('mcqMarks') || 0), 0)} marks
      </div>
    </div>
    <div className="col-4">
      <div className="fw-bold text-success">Short</div>
      <div className="fs-5 fw-bold">{previewQuestions.short.length}</div>
      <div className="small text-muted">
        {previewQuestions.short.length} × Individual Marks
      </div>
      <div className="fw-bold text-success">
        = {previewQuestions.short.reduce((total, q) => total + (q.customMarks || watch('shortMarks') || 0), 0)} marks
      </div>
    </div>
    <div className="col-4">
      <div className="fw-bold text-danger">Long</div>
      <div className="fs-5 fw-bold">{previewQuestions.long.length}</div>
      <div className="small text-muted">
        {previewQuestions.long.length} × Individual Marks
      </div>
      <div className="fw-bold text-success">
        = {previewQuestions.long.reduce((total, q) => total + (q.customMarks || watch('longMarks') || 0), 0)} marks
      </div>
    </div>
  </div>
  
  <div className="text-center mt-3 pt-3 border-top">
    <div className="fw-bold fs-4 text-primary">
      Total: {
        previewQuestions.mcq.reduce((total, q) => total + (q.customMarks || watch('mcqMarks') || 0), 0) +
        previewQuestions.short.reduce((total, q) => total + (q.customMarks || watch('shortMarks') || 0), 0) +
        previewQuestions.long.reduce((total, q) => total + (q.customMarks || watch('longMarks') || 0), 0)
      } Marks
    </div>
    <small className="text-muted">
      {previewQuestions.mcq.some(q => q.customMarks) || 
       previewQuestions.short.some(q => q.customMarks) || 
       previewQuestions.long.some(q => q.customMarks) 
        ? "Includes custom marks adjustments" 
        : "Using default marks"}
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

                      {/* Quick Stats */}
                      {/* Quick Stats - FIXED TO SHOW CUSTOM MARKS */}
                <div className="quick-stats mt-4 p-3 border rounded">
                  <h6 className="fw-bold text-primary mb-3">📈 Question Statistics</h6>
                  <div className="row text-center g-3">
                    <div className="col-4">
                      <div className="fw-bold text-primary">{previewQuestions.mcq.length}</div>
                      <small className="text-muted">MCQs</small>
                      <div className="small text-success">
                        {previewQuestions.mcq.reduce((total, q) => total + (q.customMarks || watch('mcqMarks') || 0), 0)} marks
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="fw-bold text-success">{previewQuestions.short.length}</div>
                      <small className="text-muted">Short</small>
                      <div className="small text-success">
                        {previewQuestions.short.reduce((total, q) => total + (q.customMarks || watch('shortMarks') || 0), 0)} marks
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="fw-bold text-danger">{previewQuestions.long.length}</div>
                      <small className="text-muted">Long</small>
                      <div className="small text-success">
                        {previewQuestions.long.reduce((total, q) => total + (q.customMarks || watch('longMarks') || 0), 0)} marks
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="fw-bold text-info fs-5">
                        {previewQuestions.mcq.length + previewQuestions.short.length + previewQuestions.long.length}
                      </div>
                      <small className="text-muted">Total Questions</small>
                      <div className="fw-bold text-success fs-6">
                        {
                          previewQuestions.mcq.reduce((total, q) => total + (q.customMarks || watch('mcqMarks') || 0), 0) +
                          previewQuestions.short.reduce((total, q) => total + (q.customMarks || watch('shortMarks') || 0), 0) +
                          previewQuestions.long.reduce((total, q) => total + (q.customMarks || watch('longMarks') || 0), 0)
                        } Total Marks
                      </div>
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