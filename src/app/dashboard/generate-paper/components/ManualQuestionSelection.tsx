// dashboard/generate-paper/components/ManualQuestionSelection.tsx
'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { Subject, Chapter, Question } from '@/types/types';
import Loading from '../loading';

interface ManualQuestionSelectionProps {
  subjectId: string;
  classId: string;
  selectedTopics: string[];
  chapterOption: string;
  selectedChapters: string[];
  chapters: Chapter[];
  subjects?: Subject[];
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
  chapter_no?: string | number;
  chapter_name?: string;
  topic_name?: string;
  source_type?: string;
}

// ─── MathJax loader (loads once globally) ────────────────────────────────────
let mathJaxLoaded = false;
let mathJaxLoading = false;
const mathJaxCallbacks: Array<() => void> = [];

const loadMathJax = (): Promise<void> => {
  return new Promise((resolve) => {
    if (mathJaxLoaded) { resolve(); return; }
    mathJaxCallbacks.push(resolve);
    if (mathJaxLoading) return;
    mathJaxLoading = true;

    // Configure MathJax before loading
    (window as any).MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true,
      },
      svg: { fontCache: 'global' },
      options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'] },
      startup: {
        ready() {
          (window as any).MathJax.startup.defaultReady();
          mathJaxLoaded = true;
          mathJaxLoading = false;
          mathJaxCallbacks.forEach(cb => cb());
          mathJaxCallbacks.length = 0;
        }
      }
    };

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
    script.async = true;
    document.head.appendChild(script);
  });
};

// ─── LaTeX helpers ────────────────────────────────────────────────────────────
const hasLatex = (content: string): boolean => {
  if (!content) return false;
  return /\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$|\\[\(\[]|\\frac|\\sqrt|\\sum|\\int|\\alpha|\\beta|\\gamma|\\delta|\\epsilon|\\theta|\\lambda|\\mu|\\pi|\\sigma|\\phi|\\omega/.test(content);
};

// Strip outer <p> tags so inline content doesn't add margins
const normalizeHtml = (html: string): string => {
  if (!html) return '';
  return html.replace(/<p([^>]*)>/gi, '<span$1 style="display:inline;">').replace(/<\/p>/gi, '</span>');
};

// ─── HtmlContent: renders HTML + LaTeX without iframes ───────────────────────
const HtmlContent: React.FC<{
  content?: string;
  className?: string;
  dir?: 'rtl' | 'ltr';
}> = ({ content, className, dir = 'ltr' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  const normalizedHtml = useMemo(() => normalizeHtml(content || ''), [content]);
  const needsMath = useMemo(() => hasLatex(content || ''), [content]);

  // Set innerHTML then typeset with MathJax if needed
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.innerHTML = normalizedHtml;
    setRendered(false);

    if (!needsMath) {
      setRendered(true);
      return;
    }

    let cancelled = false;

    loadMathJax().then(() => {
      if (cancelled || !containerRef.current) return;
      const mj = (window as any).MathJax;
      if (mj?.typesetPromise) {
        mj.typesetPromise([containerRef.current])
          .then(() => { if (!cancelled) setRendered(true); })
          .catch(() => { if (!cancelled) setRendered(true); });
      } else {
        setRendered(true);
      }
    });

    return () => { cancelled = true; };
  }, [normalizedHtml, needsMath]);

  if (!content) return null;

  return (
    <div
      ref={containerRef}
      className={className}
      dir={dir}
      style={{
        opacity: needsMath && !rendered ? 0 : 1,
        transition: 'opacity 0.15s ease',
      }}
    />
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
export const ManualQuestionSelection: React.FC<ManualQuestionSelectionProps> = ({
  subjectId, classId, selectedChapters, selectedTopics, chapters,
  onQuestionsSelected, language, source_type, typeCounts,
  shuffleTrigger = false, showSelectedOnly = false, selectedQuestions = {}
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
  const typeKey = currentType?.value;

  const resolvedSourceType = useMemo(() => {
    if (Array.isArray(source_type)) {
      return source_type.includes('all') ? 'all' : source_type.join(',');
    }
    return source_type || 'all';
  }, [source_type]);

  useEffect(() => {
    setQuestionsByType({});
    setSelectedByType({});
    setShuffledQuestions({});
    setPrevSelectedQuestions({});
    setHasAttempted(false);
    setIsLoading(false);
  }, [resolvedSourceType, subjectId, classId, selectedChapters, language]);

  useEffect(() => {
    const idsFromParent: Record<string, string[]> = {};
    Object.keys(selectedQuestions).forEach(typeKey => {
      idsFromParent[typeKey] = (selectedQuestions[typeKey] || []).map((q: any) => q.id);
    });
    if (JSON.stringify(idsFromParent) !== JSON.stringify(selectedByType)) {
      setSelectedByType(idsFromParent);
    }
  }, [selectedQuestions]);

  useEffect(() => {
    if (!shuffleTrigger || !typeKey) return;
    const pool = questionsByType[typeKey] || [];
    if (pool.length === 0) return;
    const pickedIds = [...pool]
      .sort(() => Math.random() - 0.5)
      .slice(0, currentType.required)
      .map(q => q.id);
    setSelectedByType(prev => ({ ...prev, [typeKey]: pickedIds }));
  }, [shuffleTrigger, typeKey]);

  useEffect(() => {
    if (typeKey && questionsByType[typeKey]?.length > 0) {
      const shuffled = [...questionsByType[typeKey]].sort(() => Math.random() - 0.5);
      setShuffledQuestions(prev => ({ ...prev, [typeKey]: shuffled }));
    }
  }, [shuffleTrigger, typeKey, questionsByType]);

  useEffect(() => {
    const fullObjectsSelection: Record<string, QuestionWithOptions[]> = {};
    Object.keys(selectedByType).forEach(tk => {
      const ids = selectedByType[tk];
      const pool = questionsByType[tk] || [];
      fullObjectsSelection[tk] = pool.filter(q => ids.includes(q.id));
    });
    const prevStr = JSON.stringify(prevSelectedQuestions);
    const newStr = JSON.stringify(fullObjectsSelection);
    if (newStr !== prevStr) {
      onQuestionsSelected(fullObjectsSelection);
      setPrevSelectedQuestions(fullObjectsSelection);
    }
  }, [selectedByType, questionsByType, onQuestionsSelected, prevSelectedQuestions]);

  useEffect(() => {
    if (!subjectId || !classId || !typeKey) return;

    const controller = new AbortController();
    
    const executeFetch = async () => {
      setIsLoading(true);
      setHasAttempted(false);
      
      try {
        const res = await axios.get('/api/questions', {
          signal: controller.signal,
          params: {
            subjectId, 
            classId,
            questionType: typeKey,
            chapterIds: selectedChapters.join(','),
            topicIds: selectedTopics.join(','),
            language,
            source_type: resolvedSourceType
          }
        });
        
        const questions = res.data || [];
        setQuestionsByType({ [typeKey]: questions });
        setShuffledQuestions({ [typeKey]: [...questions].sort(() => Math.random() - 0.5) });
        setHasAttempted(true);
      } catch (e: any) {
        if (!axios.isCancel(e)) {
          console.error('Question fetch failed', e);
          setHasAttempted(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    executeFetch();
    return () => { controller.abort(); };
  }, [subjectId, classId, typeKey, selectedChapters, selectedTopics, language, resolvedSourceType]);

  if (!activeTypes.length) return <div className="loading-state">No question types selected.</div>;

  const allQuestions = (typeKey && questionsByType[typeKey]) || [];
  const displayedQuestions = shuffleTrigger ? ((typeKey && shuffledQuestions[typeKey]) || []) : allQuestions;
  const selectedIds = (typeKey && selectedByType[typeKey]) || [];
  const finalQuestions = showSelectedOnly
    ? displayedQuestions.filter(q => selectedIds.includes(q.id))
    : displayedQuestions;

  const toggleSelection = (id: string) => {
    if (!currentType || !typeKey) return;
    const limit = currentType.required;
    setSelectedByType(prev => {
      const current = prev[typeKey] || [];
      const exists = current.includes(id);
      if (!exists && current.length >= limit) return prev;
      return { ...prev, [typeKey]: exists ? current.filter(q => q !== id) : [...current, id] };
    });
  };

  return (
    <div className="paper-container">
      {isLoading ? (
        <div className="loading-state-overlay"><Loading /></div>
      ) : (
        <div className="paper-body">
          {showSelectedOnly && selectedIds.length === 0 ? (
            <div className="empty-state-container">
              <div className="empty-icon">👁️</div>
              <h5>No Questions Selected</h5>
              <p>Select questions first to view them here.</p>
            </div>
          ) : hasAttempted && finalQuestions.length === 0 ? (
            <div className="empty-state-container">
              <div className="empty-icon">📭</div>
              <h5>No Questions Found</h5>
              <p>No <strong>{currentType.label}</strong> found for selected filters.</p>
              <span className="source-pill">Source: {resolvedSourceType}</span>
            </div>
          ) : (
            <>
              {showSelectedOnly && (
                <div className="selected-info">
                  <div className="selected-badge">{selectedIds.length} / {currentType.required} selected</div>
                  <p className="selected-hint">Viewing selected questions only</p>
                </div>
              )}

              {finalQuestions.map((q, idx) => {
                const isSelected = selectedIds.includes(q.id);
                const isUrdu = language === 'urdu';
                const isBilingual = language === 'bilingual';
                const isMcq = typeKey === 'mcq';

                return (
                  <div
                    key={q.id}
                    className={`paper-row ${isSelected ? 'selected' : ''} ${isUrdu ? 'urdu-mode' : ''}`}
                    onClick={() => toggleSelection(q.id)}
                  >
                    <div className="q-num">
                      {isUrdu
                        ? <span className="num-urdu">.{idx + 1}</span>
                        : <span>{idx + 1}.</span>
                      }
                    </div>

                    <div className="q-body">
                      {isBilingual ? (
                        <div className="q-bilingual-block">
                          <div className="q-bilingual-en">
                            <HtmlContent content={q.question_text} className="eng-text" dir="ltr" />
                          </div>
                          <div className="q-bilingual-ur">
                            <HtmlContent content={q.question_text_ur || q.question_text} className="urdu-text bilingual-ur-text" dir="rtl" />
                          </div>
                        </div>
                      ) : isUrdu ? (
                        <HtmlContent content={q.question_text_ur || q.question_text} className="urdu-text full-width" dir="rtl" />
                      ) : (
                        <HtmlContent content={q.question_text} className="eng-text full-width" dir="ltr" />
                      )}

                      {isMcq && (
                        <>
                          {isBilingual ? (
                            <div className="opts-bilingual-wrap">
                              {(['a', 'b', 'c', 'd'] as const).map(opt => {
                                const en = (q as any)[`option_${opt}`];
                                const ur = (q as any)[`option_${opt}_ur`];
                                if (!en && !ur) return null;
                                return (
                                  <div key={opt} className="opt-bilingual-row">
                                    <span className="opt-key">({opt})</span>
                                    <HtmlContent content={en} className="eng-opt" dir="ltr" />
                                    <HtmlContent content={ur || en} className="urdu-opt" dir="rtl" />
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className={`opts-wrap ${isUrdu ? 'opts-rtl' : ''}`}>
                              {(['a', 'b', 'c', 'd'] as const).map(opt => {
                                const en = (q as any)[`option_${opt}`];
                                const ur = (q as any)[`option_${opt}_ur`];
                                if (!en && !ur) return null;
                                return (
                                  <div key={opt} className={`opt-row ${isUrdu ? 'opt-row-rtl' : ''}`}>
                                    {isUrdu ? (
                                      <>
                                        <HtmlContent content={ur || en} className="urdu-opt" dir="rtl" />
                                        <span className="opt-key">({opt})</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="opt-key">({opt})</span>
                                        <HtmlContent content={en} className="eng-opt" dir="ltr" />
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}

                      <div className={`q-meta ${isUrdu ? 'q-meta-rtl' : ''}`}>
                        <span>Ch:{q.chapterNo || 'N/A'} <span className="d-none d-md-inline">{q.chapterName || ''}</span></span>
                        <span className="dot">•</span>
                        <span>Topic: {q.topicName || 'N/A'}</span>
                        <span className="dot">•</span>
                        <span className="src-tag">{q.source_type || 'book'}</span>
                        {isSelected && <span className="chk">✓</span>}
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
        .paper-container { background: #fff; width: 100%; position: relative; min-height: 250px; }
        .paper-body { contain: layout style; width: 100%; }

        /* ── Row ── */
        .paper-row {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 4px;
          padding: 2px 5px;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
          transition: background .12s;
          position: relative;
        }
        .paper-row:hover { background: #f8fafc; }
        .paper-row.selected { background: #eff6ff !important; }
        .paper-row.selected::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: #2563eb;
          border-radius: 0 2px 2px 0;
        }
        .paper-row.urdu-mode { flex-direction: row-reverse; }
        .paper-row.urdu-mode.selected::before {
          left: auto; right: 0;
          border-radius: 2px 0 0 2px;
        }

        /* ── Index ── */
        .q-num {
          min-width: 24px;
          font-size: 13px;
          font-weight: 700;
          color: #94a3b8;
          flex-shrink: 0;
          display: flex;
          align-items: flex-start;
        }
        .num-urdu {
          display: block;
          text-align: left;
          direction: ltr;
          unicode-bidi: embed;
          margin-top: 10px;
        }

        /* ── Body ── */
        .q-body { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }

        /* ── Text ── */
        .eng-text { font-size: 14px; font-weight: 500; color: #1e293b; line-height: 1.5; }
        .urdu-text {
          font-family: 'JameelNoori', 'Norinastaliq', 'Noto Nastaliq Urdu', serif !important;
          font-size: 17px;
          line-height: 2;
          color: #1e293b;
          text-align: right;
          direction: rtl;
        }
        .full-width { width: 100%; }

        .q-bilingual-block {
          display: flex;
          flex-direction: row;
          gap: 2px;
          width: 100%;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .q-bilingual-en { flex: 1 1 auto; min-width: 200px; }
        .q-bilingual-ur { flex: 1 1 auto; min-width: 150px; text-align: right; }
        .bilingual-ur-text { margin: 0; text-align: right; direction: rtl; }

        /* ── Options ── */
        .opts-wrap {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px 6px;
          margin-top: 3px;
        }
        @media (max-width: 1200px) { .opts-wrap { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px)  { .opts-wrap { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px)  { .opts-wrap { grid-template-columns: repeat(1, 1fr); } }
        .opts-rtl { direction: rtl; }

        .opt-row {
          display: flex;
          align-items: baseline;
          gap: 3px;
          padding: 1px 0;
          min-width: 0;
        }
        .opt-row-rtl { flex-direction: row-reverse; justify-content: flex-end; }
        .opt-key { font-size: 11px; font-weight: 800; color: #2563eb; min-width: 18px; flex-shrink: 0; line-height: 1; }

        .eng-opt { font-size: 12px; color: #334155; line-height: 1.4; font-weight: 400; min-width: 0; word-break: break-word; }
        .urdu-opt {
          font-family: 'JameelNoori', 'Norinastaliq', 'Noto Nastaliq Urdu', serif !important;
          font-size: 14px; line-height: 1.6; color: #1e293b;
          text-align: right; direction: rtl; min-width: 0; word-break: break-word;
        }

        .opts-bilingual-wrap {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0px;
          margin-top: 4px;
          width: 100%;
        }
        @media (max-width: 1024px) { .opts-bilingual-wrap { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px)  { .opts-bilingual-wrap { grid-template-columns: repeat(1, 1fr); } }
        .opt-bilingual-row { display: flex; align-items: baseline; gap: 4px; min-width: 0; }
        .opt-bilingual-row .eng-opt,
        .opt-bilingual-row .urdu-opt { flex: 1 1 auto; min-width: 0; white-space: normal; overflow-wrap: anywhere; }
        .opt-bilingual-row .urdu-opt { text-align: right; }

        /* ── Meta ── */
        .q-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 2px;
          font-size: 8px;
          color: #94a3b8;
          font-family: monospace;
          text-transform: uppercase;
          margin-top: 0px;
        }
        .q-meta-rtl { direction: rtl; justify-content: flex-end; }
        .dot { color: #cbd5e1; }
        .src-tag { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 0 5px; font-size: 9px; color: #64748b; }
        .chk { color: #10b981; font-weight: 700; margin-left: auto; }

        /* ── Loading / Empty ── */
        .loading-state-overlay { display: flex; align-items: center; justify-content: center; padding: 80px 0; width: 100%; }
        .empty-state-container { padding: 80px 20px; text-align: center; color: #94a3b8; }
        .empty-icon { font-size: 36px; margin-bottom: 12px; }
        .source-pill { display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 10px; border-radius: 20px; font-size: 11px; color: #64748b; margin-top: 8px; }
        .selected-info { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 10px; margin-bottom: 12px; text-align: center; }
        .selected-badge { display: inline-block; background: #2563eb; color: #fff; padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 4px; }
        .selected-hint { font-size: 12px; color: #64748b; margin: 0; }

        /* ── MathJax ── */
        mjx-container {
          direction: ltr !important;
          display: inline-block !important;
          margin: 0 2px;
          vertical-align: middle;
        }
        .MathJax {
          direction: ltr !important;
          display: inline-block !important;
        }
      `}</style>
    </div>
  );
};