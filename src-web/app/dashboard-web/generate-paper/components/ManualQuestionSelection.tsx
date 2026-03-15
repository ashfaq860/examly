// src/app/dashboard/generate-paper/components/ManualQuestionSelection.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { 
  CheckCircle2, 
  Shuffle, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle, 
  Sparkles, 
  LayoutList,
  Filter,
  Check,
  Zap
} from 'lucide-react';
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
  option_a?: string; option_b?: string; option_c?: string; option_d?: string;
  option_a_ur?: string; option_b_ur?: string; option_c_ur?: string; option_d_ur?: string;
  option_a_urdu?: string; option_b_urdu?: string; option_c_urdu?: string; option_d_urdu?: string;
  option_a_english?: string; option_b_english?: string; option_c_english?: string; option_d_english?: string;
  question_text_english?: string; question_text_urdu?: string;
}

const HtmlContent: React.FC<{ content: string | undefined; className?: string; style?: React.CSSProperties }> = ({ content, className, style }) => {
  if (!content) return null;
  const processContent = (html: string) => html.replace(/<p([^>]*)>/gi, '<p$1 style="margin-bottom: 0 !important;">');
  const hasHtmlTags = /<[^>]*>/g.test(content);
  
  const txt = document.createElement('textarea');
  txt.innerHTML = hasHtmlTags ? processContent(content) : content;
  const decoded = txt.value;

  return hasHtmlTags ? (
    <div className={className} style={style} dangerouslySetInnerHTML={{ __html: decoded }} />
  ) : (
    <div className={className} style={style}>{decoded}</div>
  );
};

export const ManualQuestionSelection: React.FC<ManualQuestionSelectionProps> = ({
  subjectId, classId, chapterOption, selectedChapters, chapters, subjects,
  onQuestionsSelected, onAllComplete, mcqCount, shortCount, longCount,
  language, source_type, typeCounts, autoAdvance = true,
}) => {
  const [questions, setQuestions] = useState<Record<string, QuestionWithOptions[]>>({});
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [filters, setFilters] = useState({ difficulty: 'all', chapter: 'all' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTypeIndex, setCurrentTypeIndex] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);

  const fetchInProgressRef = useRef(false);

  const questionTypes = useMemo(() => {
    const defaultTypes = [
      { value: 'mcq', label: 'MCQ' }, { value: 'short', label: 'Short' }, { value: 'long', label: 'Long' },
    ];
    const englishTypes = [
      { value: 'mcq', label: 'MCQ' }, { value: 'short', label: 'Short' }, 
      { value: 'translate_urdu', label: 'Translation (Urdu)' }, { value: 'long', label: 'Long' },
      { value: 'idiom_phrases', label: 'Idioms' }, { value: 'passage', label: 'Passage' },
      { value: 'directInDirect', label: 'Direct/Indirect' }, { value: 'activePassive', label: 'Active/Passive' }
    ];
    const urduTypes = [
      { value: 'mcq', label: 'MCQ' }, { value: 'poetry_explanation', label: 'Poetry' },
      { value: 'prose_explanation', label: 'Prose' }, { value: 'short', label: 'Short' },
      { value: 'long', label: 'Long' }
    ];

    const sName = subjects.find(s => s.id === subjectId)?.name.toLowerCase() || '';
    if (sName.includes('english')) return englishTypes;
    if (sName.includes('urdu')) return urduTypes;
    return defaultTypes;
  }, [subjectId, subjects]);

  const requiredCounts = useMemo(() => {
    const counts: Record<string, number> = { mcq: mcqCount || 0, short: shortCount || 0, long: longCount || 0 };
    if (typeCounts) Object.keys(typeCounts).forEach(k => counts[k] = typeCounts[k]);
    return counts;
  }, [mcqCount, shortCount, longCount, typeCounts]);

  const activeTypes = useMemo(() => questionTypes.filter(t => (requiredCounts[t.value] || 0) > 0), [questionTypes, requiredCounts]);
  const currentType = activeTypes[currentTypeIndex];

  const getStatus = (type: string) => {
    const req = requiredCounts[type] || 0;
    const sel = selected[type]?.length || 0;
    return { completed: sel >= req, text: `${sel}/${req}`, remaining: Math.max(0, req - sel) };
  };

  const fetchQuestions = useCallback(async () => {
    if (fetchInProgressRef.current || !subjectId || !classId) return;
    const cIds = chapterOption === 'full_book' ? chapters.filter(c => c.subject_id === subjectId).map(c => c.id) : selectedChapters;
    if (!cIds.length) { setError('No chapters selected'); return; }

    try {
      setIsLoading(true);
      fetchInProgressRef.current = true;
      const result: Record<string, QuestionWithOptions[]> = {};
      
      for (const type of activeTypes) {
        const res = await axios.get(`/api/questions`, {
          params: { subjectId, classId, questionType: type.value, chapterIds: cIds.join(','), language, limit: 100 }
        });
        result[type.value] = res.data || [];
      }
      setQuestions(result);
    } catch (e) { setError('Failed to load question bank'); }
    finally { setIsLoading(false); fetchInProgressRef.current = false; }
  }, [subjectId, classId, chapterOption, selectedChapters, activeTypes, language, chapters]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const toggleSelection = (qId: string, type: string) => {
    setSelected(prev => {
      const currentSel = prev[type] || [];
      const isSelected = currentSel.includes(qId);
      const req = requiredCounts[type] || 0;

      if (isSelected) return { ...prev, [type]: currentSel.filter(id => id !== qId) };
      if (currentSel.length < req) return { ...prev, [type]: [...currentSel, qId] };
      return prev;
    });
  };

  const filteredData = useMemo(() => {
    if (!currentType) return [];
    return (questions[currentType.value] || []).filter(q => {
      const dMatch = filters.difficulty === 'all' || q.difficulty === filters.difficulty;
      const cMatch = filters.chapter === 'all' || q.chapter_id === filters.chapter;
      return dMatch && cMatch;
    });
  }, [questions, currentType, filters]);

  return (
    <div className="manual-selection-container animate-fade-in">
      {/* Header Strategy Block */}
      <div className="selection-header-premium mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h2 className="h3 fw-bold text-dark mb-1">Question Bank <span className="text-primary-gradient">Curation</span></h2>
            <p className="text-muted small mb-0">Review and select specific questions for your customized paper.</p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn-premium-outline" onClick={() => { setSelected({}); fetchQuestions(); }}>
              <RotateCcw size={16} className="me-2" /> Reset All
            </button>
            <button className="btn-premium-primary" onClick={onAllComplete} disabled={!activeTypes.every(t => getStatus(t.value).completed)}>
              <Zap size={16} className="me-2" /> Finalize Paper
            </button>
          </div>
        </div>
      </div>

      {/* Modern Stepper */}
      <div className="type-stepper-container mb-4">
        {activeTypes.map((type, idx) => {
          const status = getStatus(type.value);
          const isActive = idx === currentTypeIndex;
          return (
            <div key={type.value} 
              className={`step-pill ${isActive ? 'active' : ''} ${status.completed ? 'completed' : ''}`}
              onClick={() => setCurrentTypeIndex(idx)}
            >
              <div className="step-icon">
                {status.completed ? <Check size={14} /> : <span>{idx + 1}</span>}
              </div>
              <div className="step-label">
                <span className="name">{type.label}</span>
                <span className="count">{status.text}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="row g-4">
        {/* Sidebar Filters */}
        <div className="col-lg-3">
          <div className="filter-card-premium sticky-top" style={{ top: '20px' }}>
            <div className="d-flex align-items-center mb-3 text-primary fw-bold">
              <Filter size={18} className="me-2" /> Selection Filters
            </div>
            
            <div className="mb-3">
              <label className="filter-label">Difficulty Level</label>
              <select className="form-select-premium" value={filters.difficulty} onChange={e => setFilters(f => ({...f, difficulty: e.target.value}))}>
                <option value="all">All Challenges</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="filter-label">Filter by Chapter</label>
              <select className="form-select-premium" value={filters.chapter} onChange={e => setFilters(f => ({...f, chapter: e.target.value}))}>
                <option value="all">Entire Selected Scope</option>
                {chapters.filter(c => c.subject_id === subjectId).map(c => (
                  <option key={c.id} value={c.id}>Ch {c.chapterNo}: {c.name}</option>
                ))}
              </select>
            </div>

            <div className="quick-actions">
              <button className="btn-action w-100 mb-2" onClick={() => {
                const req = requiredCounts[currentType.value] || 0;
                setSelected(p => ({ ...p, [currentType.value]: filteredData.slice(0, req).map(q => q.id) }));
              }}>
                <LayoutList size={14} /> Auto-Fill Type
              </button>
              <button className="btn-action w-100" onClick={() => {
                const shuffled = [...filteredData].sort(() => 0.5 - Math.random());
                const req = requiredCounts[currentType.value] || 0;
                setSelected(p => ({ ...p, [currentType.value]: shuffled.slice(0, req).map(q => q.id) }));
              }}>
                <Shuffle size={14} /> Magic Shuffle
              </button>
            </div>
          </div>
        </div>

        {/* Main Question Area */}
        <div className="col-lg-9">
          {isLoading ? (
            <div className="loading-state-premium">
              <div className="spinner-grow text-primary" role="status"></div>
              <span className="ms-3 fw-bold">Analyzing Question Bank...</span>
            </div>
          ) : (
            <div className="questions-scroll-area">
              {filteredData.length === 0 ? (
                <div className="empty-state">
                  <AlertCircle size={48} className="text-muted mb-3" />
                  <h5>No matching questions found</h5>
                  <p>Try adjusting your difficulty or chapter filters.</p>
                </div>
              ) : (
                filteredData.map((q, index) => {
                  const isSelected = selected[currentType.value]?.includes(q.id);
                  return (
                    <div key={q.id} 
                      className={`question-card-premium animate-slide-up ${isSelected ? 'selected' : ''}`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                      onClick={() => toggleSelection(q.id, currentType.value)}
                    >
                      <div className="card-selector">
                        <div className={`checkbox-orb ${isSelected ? 'checked' : ''}`}>
                          {isSelected && <Check size={14} />}
                        </div>
                      </div>

                      <div className="card-body-content">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <span className="q-index">QUESTION #{index + 1}</span>
                          <div className="d-flex gap-2">
                            <span className={`badge-difficulty ${q.difficulty}`}>{q.difficulty}</span>
                            <span className="badge-chapter">Ch. {q.chapterNo || 'N/A'}</span>
                          </div>
                        </div>

                        {/* Content rendering based on language */}
                        <div className={`question-text-wrapper ${language === 'urdu' || language === 'bilingual' ? 'urdu-font' : ''}`}>
                          {language === 'bilingual' ? (
                            <>
                              <HtmlContent content={q.question_text} className="eng-content mb-2" />
                              <HtmlContent content={q.question_text_ur || q.question_text_urdu} className="ur-content rtl text-end" />
                            </>
                          ) : (
                            <HtmlContent content={language === 'urdu' ? (q.question_text_ur || q.question_text_urdu) : q.question_text} />
                          )}
                        </div>

                        {/* Options if MCQ */}
                        {currentType.value === 'mcq' && (
                          <div className="options-grid mt-4">
                            {['a', 'b', 'c', 'd'].map(opt => (
                              <div key={opt} className="option-item">
                                <span className="option-label">{opt.toUpperCase()}</span>
                                <div className="option-text">
                                  <HtmlContent content={q[`option_${opt}` as keyof QuestionWithOptions] as string} />
                                  {(language === 'urdu' || language === 'bilingual') && (
                                    <HtmlContent content={q[`option_${opt}_ur` as keyof QuestionWithOptions] as string} className="rtl text-end mt-1 opacity-75 small" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Type Navigation Footer */}
          <div className="navigation-footer-premium mt-5">
            <button className="nav-btn prev" disabled={currentTypeIndex === 0} onClick={() => setCurrentTypeIndex(v => v - 1)}>
              <ChevronLeft size={20} /> Previous Section
            </button>
            <div className="nav-progress-text">
              Section <strong>{currentTypeIndex + 1}</strong> of {activeTypes.length}
            </div>
            <button className="nav-btn next" onClick={() => currentTypeIndex < activeTypes.length - 1 ? setCurrentTypeIndex(v => v + 1) : onAllComplete()}>
              {currentTypeIndex === activeTypes.length - 1 ? 'Finish Selection' : 'Next Section'} <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .text-primary-gradient {
          background: linear-gradient(135deg, #0d6efd 0%, #6610f2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .type-stepper-container {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding: 10px 5px;
          scrollbar-width: none;
        }

        .step-pill {
          display: flex;
          align-items: center;
          background: white;
          padding: 8px 16px;
          border-radius: 100px;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          white-space: nowrap;
          min-width: fit-content;
        }

        .step-pill.active {
          border-color: #0d6efd;
          background: #eff6ff;
          box-shadow: 0 4px 12px rgba(13, 110, 253, 0.15);
        }

        .step-pill.completed {
          background: #f0fdf4;
          border-color: #22c55e;
        }

        .step-icon {
          width: 24px; height: 24px;
          border-radius: 50%;
          background: #f1f5f9;
          display: flex; align-items: center; justify-content: center;
          margin-right: 10px; font-size: 11px; font-weight: 800;
        }

        .active .step-icon { background: #0d6efd; color: white; }
        .completed .step-icon { background: #22c55e; color: white; }

        .step-label .name { font-size: 13px; font-weight: 600; color: #475569; margin-right: 8px; }
        .step-label .count { font-size: 11px; font-weight: 700; color: #94a3b8; }
        .active .step-label .name { color: #0d6efd; }

        /* Question Cards */
        .question-card-premium {
          background: white;
          border-radius: 20px;
          border: 2px solid #f1f5f9;
          margin-bottom: 20px;
          display: flex;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .question-card-premium:hover {
          border-color: #cbd5e1;
          transform: translateX(5px);
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
        }

        .question-card-premium.selected {
          border-color: #0d6efd;
          background: #f8faff;
        }

        .card-selector {
          width: 60px;
          border-right: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fafafa;
        }

        .selected .card-selector { background: #eff6ff; border-color: #dbeafe; }

        .checkbox-orb {
          width: 24px; height: 24px;
          border-radius: 50%;
          border: 2px solid #cbd5e1;
          display: flex; align-items: center; justify-content: center;
          transition: 0.2s;
        }

        .checkbox-orb.checked {
          background: #0d6efd;
          border-color: #0d6efd;
          color: white;
        }

        .card-body-content { padding: 1.5rem; flex: 1; }

        .q-index { font-size: 10px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; }

        .badge-difficulty { padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .badge-difficulty.easy { background: #dcfce7; color: #166534; }
        .badge-difficulty.medium { background: #fef9c3; color: #854d0e; }
        .badge-difficulty.hard { background: #fee2e2; color: #991b1b; }

        .badge-chapter { background: #f1f5f9; color: #475569; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; }

        /* Urdu Support */
        .urdu-font {
          font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif;
          line-height: 2.2;
        }
        .rtl { direction: rtl; }

        /* Options */
        .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .option-item {
          display: flex;
          align-items: flex-start;
          background: #f8fafc;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }
        .selected .option-item { background: white; border-color: #dbeafe; }
        .option-label {
          min-width: 28px; height: 28px;
          background: #e2e8f0;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 800; color: #475569; margin-right: 12px;
        }

        /* Nav Footer */
        .navigation-footer-premium {
          background: white;
          padding: 1.5rem;
          border-radius: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 -10px 25px -5px rgba(0,0,0,0.03);
          border: 1px solid #f1f5f9;
        }

        .nav-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 24px; border-radius: 12px;
          font-weight: 700; font-size: 14px;
          transition: 0.2s; border: none;
        }

        .nav-btn.prev { background: #f1f5f9; color: #475569; }
        .nav-btn.next { background: #0d6efd; color: white; }
        .nav-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); }
        .nav-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Filters */
        .form-select-premium {
          width: 100%; padding: 10px 15px; border-radius: 12px;
          border: 1.5px solid #e2e8f0; font-size: 14px; font-weight: 500;
          outline: none; transition: 0.2s;
        }
        .form-select-premium:focus { border-color: #0d6efd; box-shadow: 0 0 0 4px rgba(13,110,253,0.1); }
        .filter-label { font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 8px; display: block; }

        .btn-action {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 10px; border-radius: 12px; border: 1.5px dashed #cbd5e1;
          background: transparent; color: #64748b; font-size: 13px; font-weight: 600;
          transition: 0.2s;
        }
        .btn-action:hover { border-color: #0d6efd; color: #0d6efd; background: #f8faff; }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slideUp 0.5s ease forwards; opacity: 0; }

        @media (max-width: 768px) {
          .options-grid { grid-template-columns: 1fr; }
          .navigation-footer-premium { flex-direction: column; gap: 15px; text-align: center; }
        }
      `}</style>
    </div>
  );
};