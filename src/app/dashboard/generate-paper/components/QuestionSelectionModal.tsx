'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { Question, Chapter, Subject } from '@/types/types';
import { Layout, CheckCircle } from 'lucide-react';

interface QuestionSelectionModalProps {
  subjectId: string;
  classId: string;
  chapterOption: string;
  selectedChapters: string[];
  chapters: Chapter[];
  subjects: Subject[];
  onQuestionsSelected: (questions: Record<string, string[]>) => void;
  onClose: () => void;
  language: string;
  source_type: string;
  getQuestionTypes: () => { value: string; label: string }[];
  watch: any;      // Added from PaperBuilderApp
  setValue: any;   // Added from PaperBuilderApp
}

export const QuestionSelectionModal: React.FC<QuestionSelectionModalProps> = ({
  subjectId,
  classId,
  selectedChapters,
  onQuestionsSelected,
  onClose,
  language,
  getQuestionTypes,
  watch,
  setValue
}) => {
  /* -------------------- STATE & CONSTANTS -------------------- */
  const [questionsCache, setQuestionsCache] = useState<Record<string, Question[]>>({});
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [selectedType, setSelectedType] = useState('mcq');
  const [selectedSource, setSelectedSource] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [marksEach, setMarksEach] = useState(1);

  const lastFetchedKey = useRef<string>('');
  const questionTypes = useMemo(() => getQuestionTypes(), [getQuestionTypes]);
  const currentLayout = watch('mcqPlacement') || 'separate';

  const layoutOptions = [
    { label: 'Separate MCQ & Subjective', value: 'separate' },
    { label: 'On Same Page', value: 'combined' },
    { label: 'Two Papers per Page', value: 'two_paper' },
    { label: 'Three Papers per Page', value: 'three_paper' },
  ];

  const currentRequestKey = useMemo(() => {
    return `${selectedType}-${selectedSource}-${language}-${selectedChapters.sort().join(',')}`;
  }, [selectedType, selectedSource, language, selectedChapters]);

  /* -------------------- LOAD QUESTIONS -------------------- */
  const loadQuestions = useCallback(async () => {
    if (!subjectId || !classId || selectedChapters.length === 0) return;
    if (isLoading || lastFetchedKey.current === currentRequestKey) return;

    setIsLoading(true);
    try {
      const params: any = {
        subjectId,
        classId,
        questionType: selectedType,
        chapterIds: selectedChapters.join(','),
        language,
        limit: 100,
        random: true,
      };
      if (selectedSource !== 'all') params.source_type = selectedSource;

      const response = await axios.get('/api/questions', { params });
      setQuestionsCache(prev => ({ ...prev, [currentRequestKey]: response.data || [] }));
      lastFetchedKey.current = currentRequestKey;
    } catch (error) {
      console.error('Error loading questions:', error);
      lastFetchedKey.current = currentRequestKey;
    } finally {
      setIsLoading(false);
    }
  }, [currentRequestKey, subjectId, classId, selectedType, selectedSource, language, isLoading, selectedChapters]);

  useEffect(() => {
    loadQuestions();
  }, [selectedType, selectedSource]);

  const currentQuestions = questionsCache[currentRequestKey] || [];
  const hasLoadedCurrent = lastFetchedKey.current === currentRequestKey;

  const toggleQuestionSelection = (questionId: string) => {
    setSelected(prev => {
      const currentIds = prev[selectedType] || [];
      if (currentIds.includes(questionId)) {
        return { ...prev, [selectedType]: currentIds.filter(id => id !== questionId) };
      }
      if (currentIds.length < totalQuestions) {
        return { ...prev, [selectedType]: [...currentIds, questionId] };
      }
      return prev;
    });
  };

  const handleAutoAdd = () => {
    const ids = currentQuestions.slice(0, totalQuestions).map(q => q.id);
    setSelected(prev => ({ ...prev, [selectedType]: ids }));
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1050 }}>
      <div className="modal-dialog modal-xl border-0">
        <div className="modal-content shadow-lg">
          <div className="modal-header bg-white border-bottom-0">
            <h5 className="modal-title fw-bold">Paper Configuration</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body pt-0">
            
            {/* SECTION 1: LAYOUT SELECTION */}
            <div className="mb-4">
              <label className="form-label small fw-bold text-uppercase text-muted mb-2">
                <Layout size={14} className="me-1" /> 1. Select Paper Layout
              </label>
              <div className="row g-2">
                {layoutOptions.map(opt => (
                  <div className="col-md-3" key={opt.value}>
                    <div 
                      onClick={() => setValue('mcqPlacement', opt.value)}
                      className={`p-2 border rounded text-center cursor-pointer position-relative ${
                        currentLayout === opt.value ? 'border-primary bg-primary-subtle' : 'bg-white'
                      }`}
                      style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <span className="small fw-semibold" style={{ fontSize: '12px' }}>{opt.label}</span>
                      {currentLayout === opt.value && (
                        <CheckCircle size={14} className="position-absolute top-0 end-0 m-1 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <hr className="my-4 opacity-10" />

            {/* SECTION 2: QUESTION SELECTION FILTERS */}
            <label className="form-label small fw-bold text-uppercase text-muted mb-2">
               2. Question Type & Source
            </label>
            <div className="row g-3 mb-4 bg-light p-3 rounded border">
              <div className="col-md-3">
                <label className="form-label small fw-bold">Question Type</label>
                <select className="form-select" value={selectedType} onChange={e => setSelectedType(e.target.value)}>
                  {questionTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-bold">Source</label>
                <select className="form-select" value={selectedSource} onChange={e => setSelectedSource(e.target.value)}>
                  <option value="all">All Sources</option>
                  <option value="book">Book</option>
                  <option value="model_paper">Model Paper</option>
                  <option value="past_paper">Past Paper</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-bold">Required Qs</label>
                <input type="number" className="form-control" value={totalQuestions} onChange={e => setTotalQuestions(Number(e.target.value))} />
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-bold">Marks Each</label>
                <input type="number" className="form-control" value={marksEach} onChange={e => setMarksEach(Number(e.target.value))} />
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <button className="btn btn-outline-primary w-100 fw-bold" onClick={handleAutoAdd} disabled={isLoading || currentQuestions.length === 0}>
                  Auto Select
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="question-container border rounded bg-white overflow-hidden" style={{ minHeight: '350px' }}>
              {isLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status"></div>
                  <p className="mt-2 text-muted">Fetching Questions...</p>
                </div>
              ) : hasLoadedCurrent && currentQuestions.length === 0 ? (
                <div className="text-center py-5">
                  <h5 className="text-danger">No Questions Found</h5>
                  <p className="text-muted small">Try changing the type or source filter.</p>
                </div>
              ) : (
                <div className="list-group list-group-flush" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {currentQuestions.map((q, i) => {
                    const isSelected = (selected[selectedType] || []).includes(q.id);
                    return (
                      <button
                        key={q.id}
                        className={`list-group-item list-group-item-action text-start border-bottom py-3 ${isSelected ? 'bg-light' : ''}`}
                        onClick={() => toggleQuestionSelection(q.id)}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <span className="badge bg-secondary"># {i + 1}</span>
                          {isSelected && <span className="badge bg-success">Selected</span>}
                        </div>
                        <div 
                          className="question-text text-wrap" 
                          style={{ fontSize: '14px' }}
                          dangerouslySetInnerHTML={{ __html: q.question_text || '' }} 
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer bg-light border-top d-flex justify-content-between">
            <div className="fw-bold">
              Total Selected: <span className="text-primary">{selected[selectedType]?.length || 0}</span> / {totalQuestions}
            </div>
            <div>
              <button className="btn btn-link text-decoration-none text-muted me-3" onClick={onClose}>Close</button>
              <button 
                className="btn btn-primary px-5 fw-bold" 
                disabled={!Object.values(selected).some(arr => arr.length > 0)}
                onClick={() => { onQuestionsSelected(selected); onClose(); }}
              >
                Confirm & Add Questions
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};