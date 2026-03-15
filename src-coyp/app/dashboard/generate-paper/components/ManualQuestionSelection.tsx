'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Subject, Chapter, Question } from '@/types/types';
import Loading from '../loading';

interface ManualQuestionSelectionProps {
  subjectId: string;
  classId: string;
  chapterOption: string;
  selectedChapters: string[];
  chapters: Chapter[];
  subjects: Subject[];
  onQuestionsSelected: (questions: Record<string, QuestionWithOptions[]>) => void;
  language: 'english' | 'urdu' | 'bilingual';
  source_type: string | string[];
  typeCounts?: Record<string, number>;
  shuffleTrigger?: boolean;
  showSelectedOnly?: boolean;
  selectedQuestions?: Record<string, any[]>;
}

interface QuestionWithOptions extends Question {
  option_a?: string; option_b?: string; option_c?: string; option_d?: string;
  option_a_ur?: string; option_b_ur?: string; option_c_ur?: string; option_d_ur?: string;
  question_text_ur?: string;
  chapter_id?: string;
  source_type?: string;
}

const HtmlContent: React.FC<{ content?: string; className?: string; dir?: 'rtl' | 'ltr' }> = ({ content, className, dir }) => {
  if (!content) return null;

  const decoded = useMemo(() => {
    if (typeof document === 'undefined') return content;
    const txt = document.createElement('textarea');
    txt.innerHTML = content.replace(/<p([^>]*)>/gi, '<p$1 style="margin:0;display:inline;">');
    return txt.value;
  }, [content]);

  return <div dir={dir} className={className} dangerouslySetInnerHTML={{ __html: decoded }} />;
};

export const ManualQuestionSelection: React.FC<ManualQuestionSelectionProps> = ({
  subjectId,
  classId,
  selectedChapters,
  chapters,
  onQuestionsSelected,
  language,
  source_type,
  typeCounts,
  shuffleTrigger = false,
  showSelectedOnly = false,
  selectedQuestions = {}
}) => {
  const [questionsByType, setQuestionsByType] = useState<Record<string, QuestionWithOptions[]>>({});
  const [selectedByType, setSelectedByType] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [shuffledQuestions, setShuffledQuestions] = useState<Record<string, QuestionWithOptions[]>>({});
  const [prevSelectedQuestions, setPrevSelectedQuestions] = useState<Record<string, any[]>>({});

  const activeTypes = useMemo(() => {
    if (!typeCounts) return [];
    return Object.entries(typeCounts)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => ({
        value: type,
        label: type.replace(/_/g, ' ').toUpperCase(),
        required: count
      }));
  }, [typeCounts]);

  const currentType = activeTypes[0];

  // Reset states when core filters change
  useEffect(() => {
    setQuestionsByType({});
    setSelectedByType({});
    setShuffledQuestions({});
    setHasAttempted(false);
    setPrevSelectedQuestions({});
  }, [source_type, subjectId, classId, selectedChapters, language]);

  // Sync selectedByType from parent selectedQuestions (with comparison)
  useEffect(() => {
    // Convert selectedQuestions (full objects) to IDs for internal state
    const idsFromParent: Record<string, string[]> = {};
    
    Object.keys(selectedQuestions).forEach(typeKey => {
      const questions = selectedQuestions[typeKey] || [];
      idsFromParent[typeKey] = questions.map((q: any) => q.id);
    });

    // Only update if different to prevent loops
    if (JSON.stringify(idsFromParent) !== JSON.stringify(selectedByType)) {
      setSelectedByType(idsFromParent);
    }
  }, [selectedQuestions]);
useEffect(() => {
  if (!shuffleTrigger || !currentType) return;

  const typeKey = currentType.value;
  const pool = questionsByType[typeKey] || [];
  const limit = currentType.required;

  if (pool.length === 0) return;

  // 🔀 Randomly select NEW questions
  const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
  const pickedIds = shuffledPool.slice(0, limit).map(q => q.id);

  setSelectedByType(prev => ({
    ...prev,
    [typeKey]: pickedIds
  }));
}, [shuffleTrigger]);

  // Send selection updates to parent (only when selection changes)
  useEffect(() => {
    const fullObjectsSelection: Record<string, QuestionWithOptions[]> = {};
    
    Object.keys(selectedByType).forEach(typeKey => {
      const ids = selectedByType[typeKey];
      const sourcePool = questionsByType[typeKey] || [];
      
      // Filter the full objects that match the selected IDs
      fullObjectsSelection[typeKey] = sourcePool.filter(q => ids.includes(q.id));
    });

    // Only call parent if selection actually changed
    const prevSelectionString = JSON.stringify(prevSelectedQuestions);
    const newSelectionString = JSON.stringify(fullObjectsSelection);
    
    if (newSelectionString !== prevSelectionString) {
      onQuestionsSelected(fullObjectsSelection);
      setPrevSelectedQuestions(fullObjectsSelection);
    }
  }, [selectedByType, questionsByType, onQuestionsSelected, prevSelectedQuestions]);

  // Shuffle questions when shuffleTrigger changes
  useEffect(() => {
    if (currentType?.value && questionsByType[currentType.value]?.length > 0) {
      const typeKey = currentType.value;
      const questions = questionsByType[typeKey];
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      setShuffledQuestions(prev => ({
        ...prev,
        [typeKey]: shuffled
      }));
    }
  }, [shuffleTrigger, currentType?.value, questionsByType]);

  const getChapterMeta = (id?: string) => {
    const chap = chapters.find(c => c.id === id);
    if (!chap) return 'Ch. N/A';
    return `Ch.${chap.chapterNo ?? ''} ${chap.name ?? ''}`;
  };

  const fetchQuestions = useCallback(async () => {
    const typeKey = currentType?.value;
    if (!subjectId || !classId || !typeKey || hasAttempted || questionsByType[typeKey]) return;

    setIsLoading(true);
    try {
      const res = await axios.get('/api/questions', {
        params: {
          subjectId,
          classId,
          questionType: typeKey,
          chapterIds: selectedChapters.join(','),
          language,
          source_type: source_type !== 'all' ? (Array.isArray(source_type) ? source_type.join(',') : source_type) : undefined
        }
      });

      const questions = res.data || [];
      setQuestionsByType(prev => ({
        ...prev,
        [typeKey]: questions
      }));
      
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      setShuffledQuestions(prev => ({
        ...prev,
        [typeKey]: shuffled
      }));
    } catch (e) {
      console.error('Question fetch failed', e);
    } finally {
      setIsLoading(false);
      setHasAttempted(true);
    }
  }, [subjectId, classId, currentType?.value, selectedChapters, language, source_type, hasAttempted, questionsByType]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const toggleSelection = (id: string) => {
    if (!currentType) return;
    const typeKey = currentType.value;
    const limit = currentType.required;

    setSelectedByType(prev => {
      const current = prev[typeKey] || [];
      const exists = current.includes(id);
      
      if (!exists && current.length >= limit) return prev;

      const updated = exists 
        ? current.filter(q => q !== id) 
        : [...current, id];
      
      return { ...prev, [typeKey]: updated };
    });
  };

  if (!activeTypes.length) return <div className="loading-state">No question types selected.</div>;

  const typeKey = currentType?.value;
  const allQuestions = questionsByType[typeKey] || [];
  const displayedQuestions = shuffleTrigger ? (shuffledQuestions[typeKey] || []) : allQuestions;
  const selectedIds = selectedByType[typeKey] || [];
  
  const finalQuestions = showSelectedOnly 
    ? displayedQuestions.filter(q => selectedIds.includes(q.id))
    : displayedQuestions;

  return (
    <div className="paper-container">
      {isLoading ? (
        <div className="loading-state">
          <div className="pulse-text"><Loading /></div>
        </div>
      ) : (
        <div className="paper-body">
          {showSelectedOnly && selectedIds.length === 0 ? (
            <div className="empty-state-container">
              <div className="empty-state-icon">👁️</div>
              <h5>No Questions Selected</h5>
              <p>Select questions first to view them here.</p>
              <button 
                className="back-to-all-btn"
                onClick={() => window.location.reload()} 
              >
                ← Back to All Questions
              </button>
            </div>
          ) : hasAttempted && finalQuestions.length === 0 ? (
            <div className="empty-state-container">
              <div className="empty-state-icon">📭</div>
              <h5>No Questions Found</h5>
              <p>We couldn't find any <strong>{currentType.label}</strong> for the selected filters.</p>
              <span className="source-pill">Source: {Array.isArray(source_type) ? source_type.join(', ') : source_type}</span>
            </div>
          ) : (
            <>
              {showSelectedOnly && (
                <div className="selected-info">
                  <div className="selected-badge">
                    {selectedIds.length} / {currentType.required} selected
                  </div>
                  <p className="selected-hint">Viewing selected questions only</p>
                </div>
              )}
              
              {finalQuestions.map((q, idx) => {
                const isSelected = selectedIds.includes(q.id);
                const isUrduMode = language === 'urdu';
                const isBilingual = language === 'bilingual';

                return (
                  <div
                    key={q.id}
                    className={`paper-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleSelection(q.id)}
                    style={{ direction: isUrduMode ? 'rtl' : 'ltr' }}
                  >
                    <div className="q-index" style={{ paddingTop: isUrduMode ? '0px' : '' }}>{idx + 1}.</div>

                    <div className="q-main-content">
                      <div className={`question-text-container ${isBilingual ? 'bilingual-layout' : ''}`}>
                        {(language === 'english' || isBilingual) && (
                          <HtmlContent content={q.question_text} className="eng-text" dir="ltr" />
                        )}
                        
                        {(isUrduMode || isBilingual) && (
                          <HtmlContent 
                            content={q.question_text_ur || q.question_text} 
                            className="urdu-text" 
                            dir="rtl" 
                          />
                        )}
                      </div>

                      {currentType.value === 'mcq' && (
                        <div className="options-grid">
                          {(['a', 'b', 'c', 'd'] as const).map(opt => {
                            const optEn = (q as any)[`option_${opt}`];
                            const optUr = (q as any)[`option_${opt}_ur`];

                            return (
                              <div key={opt} className={`opt-box ${isBilingual ? 'bilingual-opt' : ''}`}>
                                <span className="opt-label" style={{ paddingTop: isUrduMode || isBilingual ? '3px' : '2px' }}>({opt})</span>
                                <div className="opt-content">
                                   {(language === 'english' || isBilingual) && (
                                     <HtmlContent content={optEn} className="eng-opt" dir="ltr" />
                                   )}
                                   {(isUrduMode || isBilingual) && (
                                     <HtmlContent content={optUr || optEn} className="urdu-opt" dir="rtl" />
                                   )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className={`q-meta-tiny ${isUrduMode ? 'justify-start' : ''}`}>
                        <span>{getChapterMeta(q.chapter_id)}</span>
                        <span className="sep">|</span>
                        <span className="source-text">{q.source_type || 'standard'}</span>
                        {isSelected && <span className="selected-indicator">✓ Selected</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      <style jsx global>{`
        .paper-container { background:#fff; width:100%; }
        .paper-row { display:flex; padding:8px 12px; border-bottom:1px solid #f4f4f5; cursor:pointer; transition:.15s; }
        .paper-row:hover { background: #fafafa; }
        .paper-row.selected { background:#eff6ff; position:relative; }
        .paper-row.selected::before { content:''; position:absolute; left:0; top:0; bottom:0; width:4px; background:#2563eb; }
        .q-index { width:25px; font-weight:700; color:#a1a1aa; flex-shrink: 0; font-size: 13px; }
        .q-main-content { flex:1; display: flex; flex-direction: column; gap: 4px; }
        .question-text-container { display: flex; width: 100%; gap: 20px; }
        .bilingual-layout { justify-content: space-between; }
        .bilingual-layout .eng-text { flex: 1; text-align: left; }
        .bilingual-layout .urdu-text { flex: 1; text-align: right; }
        .eng-text, .eng-opt { font-size:15px; color:#18181b; line-height: 1.5; font-weight: 500; }
        .urdu-text, .urdu-opt { font-family:'Jameel Noori Nastaleeq', serif; font-size:17px; line-height:1.6; text-align: right; width: 100%; }
        .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
        .opt-box { display: flex; gap: 8px; align-items: flex-start; }
        .opt-label { font-weight: 700; color: #71717a; font-size: 12px; }
        .opt-content { flex: 1; }
        .bilingual-opt .opt-content { display: flex; gap: 10px; }
        .bilingual-opt .opt-content > * { flex: 1; min-width: 0; }
        .q-meta-tiny { font-size:10px; color:#a1a1aa; font-family:monospace; margin-top: 6px; display:flex; gap:8px; text-transform: uppercase; align-items: center; }
        .selected-indicator { color: #10b981; font-weight: 700; margin-left: auto; }
        .selected-info { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px; margin-bottom: 16px; text-align: center; }
        .selected-badge { display: inline-block; background: #2563eb; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
        .selected-hint { font-size: 12px; color: #64748b; margin: 0; }
        .back-to-all-btn { background: #f1f5f9; border: 1px solid #cbd5e1; color: #64748b; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; margin-top: 12px; transition: all 0.2s; }
        .loading-state { padding:100px 0; text-align:center; }
        .pulse-text { color:#2563eb; font-weight:600; animation:pulse 1.5s infinite; font-size: 14px; }
        .empty-state-container { padding: 80px 20px; text-align: center; }
        .empty-state-icon { font-size: 40px; margin-bottom: 16px; }
        @keyframes pulse { 0%,100% { opacity:.5 } 50% { opacity:1 } }
        @media (max-width: 768px) {
          .options-grid { grid-template-columns: 1fr; }
          .bilingual-layout { flex-direction: column; }
        }
      `}</style>
    </div>
  );
};