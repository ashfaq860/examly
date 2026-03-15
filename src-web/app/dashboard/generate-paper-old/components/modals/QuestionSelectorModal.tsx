'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Settings2, Layers, Search, Database, Languages, X, ChevronDown,
  Sparkles, MousePointer2, Check, Calculator,
  Shuffle, Eye, Layout as LayoutIcon
} from 'lucide-react';
import { ManualQuestionSelection } from '../ManualQuestionSelection';
import { toast } from 'react-hot-toast';
import Loading from '../../loading';

export const QuestionSelectorModal: React.FC<any> = ({
  isOpen, onClose, onAddQuestions, subjectId, classId, chapterOption,
  selectedChapters, chapters, subjects = [],
  language: initialLanguage, getQuestionTypes, watch, setValue, currentSubject
}) => {
  // --- States ---
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedSources, setSelectedSources] = useState<string[]>(['all']); 
  const [currentLanguage, setCurrentLanguage] = useState(initialLanguage || 'english');
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const [marksEach, setMarksEach] = useState<number>(0);
  const [useManualSelection, setUseManualSelection] = useState<boolean>(false);
  const [manualSelectionComplete, setManualSelectionComplete] = useState<boolean>(false);
  const [selectedQuestions, setSelectedQuestions] = useState<Record<string, any[]>>({});
  const [showSourceDropdown, setShowSourceDropdown] = useState<boolean>(false);
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [questionsShuffled, setQuestionsShuffled] = useState<boolean>(false);
  const [showSelectedQuestions, setShowSelectedQuestions] = useState<boolean>(false);
  const [paperData, setPaperData] = useState<{layout: string, language: string, sections: any[]}>({
    layout: watch('mcqPlacement') || 'separate',
    language: initialLanguage || 'english',
    sections: []
  });
  const [autoSelectSeed, setAutoSelectSeed] = useState<number>(0);
  const [manualShuffleTrigger, setManualShuffleTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const sourceDropdownRef = useRef<HTMLDivElement>(null);
  const layoutDropdownRef = useRef<HTMLDivElement>(null);
  
  const questionTypes = getQuestionTypes ? getQuestionTypes() : [];
  
  // Disable layout/lang if any sections exist
  const isGlobalConfigDisabled = paperData.sections.length > 0;

  // --- Layout & Limits Logic ---
  const getLimitsForLayout = (layoutValue: string) => {
    switch (layoutValue) {
      case "two_papers": return { maxMcq: 5, maxSubjective: 15 };
      case "three_papers": return { maxMcq: 5, maxSubjective: 10 };
      default: return { maxMcq: 0, maxSubjective: 0 };
    }
  };

  const updateLocalState = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questionPapers');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Handle legacy array format or new object format
        if (Array.isArray(parsed)) {
          setPaperData({ layout: 'separate', language: 'english', sections: parsed });
        } else {
          setPaperData(parsed);
          // Sync watch value with stored layout
          setValue('mcqPlacement', parsed.layout);
        }
      }
    }
  };

  useEffect(() => { updateLocalState(); }, []);

  const processAndSave = (type: string, questions: any[], attempt: number, marks: number) => {
    const { maxMcq, maxSubjective } = getLimitsForLayout(paperData.layout);
    const subjectName = currentSubject?.name || 'General';

    const existingCount = paperData.sections
      .filter((p: any) => p.subject === subjectName && (type === 'mcq' ? p.type === 'mcq' : p.type !== 'mcq'))
      .reduce((sum: number, p: any) => sum + p.questions.length, 0);

    const newCount = questions.length;
    
    if (type === 'mcq' && maxMcq > 0 && (existingCount + newCount) > maxMcq) {
      toast.error(`Limit exceeded: Layout allows max ${maxMcq} MCQs.`);
      return false;
    }
    if (type !== 'mcq' && maxSubjective > 0 && (existingCount + newCount) > maxSubjective) {
      toast.error(`Limit exceeded: Layout allows max ${maxSubjective} questions.`);
      return false;
    }

    const newSection = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type, 
      questions, 
      totalQuestions: newCount,
      attemptCount: attempt, 
      marksEach: marks, 
      totalMarks: attempt * marks,
      subject: subjectName, 
      timestamp: new Date().toISOString()
    };

    const updatedPaper = {
      ...paperData,
      sections: [...paperData.sections, newSection]
    };

    localStorage.setItem('questionPapers', JSON.stringify(updatedPaper));
    setPaperData(updatedPaper);
    return true;
  };

  const handleAutoAdd = () => {
    if (!selectedType || totalQuestions === 0) {
      toast.error("Select type & total questions");
      return;
    }
    setUseManualSelection(false);
    setAutoSelectSeed(Date.now());
  };

  useEffect(() => {
    if (!selectedType || totalQuestions === 0 || useManualSelection || autoSelectSeed === 0) return;

    const fetchAuto = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/questions/random', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectId, classId, chapterIds: selectedChapters,
            questionType: selectedType, language: paperData.language,
            sourceTypes: selectedSources, limit: totalQuestions, seed: autoSelectSeed
          })
        });
        const data = await res.json();
        if (!data || data.length === 0) {
          setIsLoading(false);
          return toast.error('No questions found');
        }

        if (processAndSave(selectedType, data, totalQuestions, marksEach || 1)) {
          setSelectedQuestions({ [selectedType]: data });
          setManualSelectionComplete(true);
          setIsLoading(false);
          toast.success('Questions added! 🎯');
        }
      } catch (err) {
        setIsLoading(false);
        toast.error('Failed to auto-select');
      }
    };
    fetchAuto();
  }, [autoSelectSeed]);

  const handleDiscard = () => {
    if (paperData.sections.length === 0 && !selectedType) return;
    
    if (window.confirm("Are you sure you want to discard all selected questions?")) {
      localStorage.removeItem('questionPapers');
      setPaperData(prev => ({ ...prev, sections: [] }));
      setSelectedQuestions({});
      setManualSelectionComplete(false);
      setSelectedType('');
      setTotalQuestions(0);
      setMarksEach(0);
      toast.success("All Questions are cleared!");
    }
  };

  const handleTotalChange = (val: number) => {
    const { maxMcq, maxSubjective } = getLimitsForLayout(paperData.layout);
    let finalVal = val;
    if (selectedType === 'mcq' && maxMcq > 0) finalVal = Math.min(val, maxMcq);
    else if (selectedType !== 'mcq' && selectedType !== '' && maxSubjective > 0) finalVal = Math.min(val, maxSubjective);
    setTotalQuestions(finalVal);
    setAttemptCount(finalVal);
  };

  const handleLayoutChange = (val: string) => {
    setPaperData(prev => ({ ...prev, layout: val }));
    setValue('mcqPlacement', val);
    setShowLayoutDropdown(false);
  };

  const handleLanguageChange = (val: string) => {
    setPaperData(prev => ({ ...prev, language: val }));
    setCurrentLanguage(val);
  };

  const handleAddPaperManual = () => {
    const questions = selectedQuestions[selectedType] || [];
    if (questions.length === 0) return toast.error("Select questions first");
    if (processAndSave(selectedType, questions, attemptCount, marksEach)) {
      setSelectedQuestions({});
      setManualSelectionComplete(false);
      setSelectedType('');
      toast.success("New section added to paper!");
    }
  };

  const handleQuestionsSelected = useCallback((newSelection: Record<string, any[]>) => {
    setSelectedQuestions(newSelection);
    setManualSelectionComplete(Object.values(newSelection).flat().length > 0);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(e.target as Node)) setShowSourceDropdown(false);
      if (layoutDropdownRef.current && !layoutDropdownRef.current.contains(e.target as Node)) setShowLayoutDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;
  const isInputDisabled = !selectedType;

  return (
    <>
      <div className="app-modal-overlay">
        <div className="app-modal-container">
          {/* Header */}
          <div className="app-modal-header">
            <div className="header-left">
              <div className="icon-badge"><Settings2 size={16} /></div>
              <div className="header-text">
                <h3>Paper Configuration</h3>
                <p>
                  Subject: <span className="subject-tag">{(currentSubject?.name || 'General')}</span>
                  {paperData.sections.length > 0 && (
                    <span className="section-count">
                      ({paperData.sections.length} sections added)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button className="close-ghost-btn" onClick={onClose}><X size={20} /></button>
          </div>

          <div className="app-toolbar">
            <div className="toolbar-row-top">
              {/* Layout Dropdown */}
              <div className="tool-box" ref={layoutDropdownRef}>
                <label><span className="full-lbl">Paper Layout</span><span className="short-lbl">Layout</span></label>
                <div 
                  className={`mini-input clickable ${isGlobalConfigDisabled ? 'disabled-cfg' : ''}`} 
                  onClick={() => !isGlobalConfigDisabled && setShowLayoutDropdown(!showLayoutDropdown)}
                >
                  <span className="truncate-text">{paperData.layout.replace('_', ' ')}</span>
                  {!isGlobalConfigDisabled && <ChevronDown size={14} />}
                  {showLayoutDropdown && (
                    <div className="floating-dropdown">
                      {[
                        { label: 'Separate MCQ/subjective', value: 'separate' },
                        { label: 'Same Page MCQ/subjective', value: 'same_page' },
                        { label: '2 paper Per Page', value: 'two_papers' },
                        { label: '3 paper Per Page', value: 'three_papers' }
                      ].map(opt => (
                        <div key={opt.value} className="drop-item" onClick={() => handleLayoutChange(opt.value)}>
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Question Type */}
              <div className="tool-box">
                <label><span className="full-lbl">Question Type</span><span className="short-lbl">Qs Type</span></label>
                <select className="mini-input" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                  <option value=''>Type</option>
                  {questionTypes.map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Source Dropdown */}
              <div className="tool-box" ref={sourceDropdownRef}>
                <label><span className="full-lbl">Source</span><span className="short-lbl">Source</span></label>
                <div className="mini-input clickable" onClick={() => setShowSourceDropdown(!showSourceDropdown)}>
                  <span className="truncate-text">{selectedSources.includes('all') ? 'All' : `${selectedSources.length} Sel`}</span>
                  <ChevronDown size={14} />
                  {showSourceDropdown && (
                    <div className="floating-dropdown">
                      {['all', 'book', 'model_paper', 'past_paper'].map(opt => (
                        <div key={opt} className={`drop-item ${selectedSources.includes(opt) ? 'active' : ''}`}
                          onClick={() => {
                            if (opt === 'all') setSelectedSources(['all']);
                            else setSelectedSources(prev => prev.includes(opt) ? prev.filter(s => s !== opt) : [...prev.filter(s => s !== 'all'), opt]);
                          }}>
                          {opt.replace('_', ' ')}
                          {selectedSources.includes(opt) && <Check size={12} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Language */}
              <div className="tool-box">
                <label><span className="full-lbl">Language</span><span className="short-lbl">Lang</span></label>
                <select 
                  className={`mini-input ${isGlobalConfigDisabled ? 'disabled-cfg' : ''}`} 
                  value={paperData.language} 
                  disabled={isGlobalConfigDisabled}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                >
                  <option value="english">Eng</option>
                  <option value="urdu">Urdu</option>
                  <option value="bilingual">Both</option>
                </select>
              </div>
            </div>

            <div className="toolbar-row-bottom">
              <div className="horizontal-scroll-container">
                <div className="metrics-group">
                  <div className={`metric-box ${isInputDisabled ? 'disabled-opacity' : ''}`}>
                    <label>Total Qs</label>
                    <input type="number" className="no-spinner-input" value={totalQuestions} disabled={isInputDisabled}
                      onChange={(e) => handleTotalChange(Number(e.target.value))} />
                  </div>
                  <div className={`metric-box ${isInputDisabled ? 'disabled-opacity' : ''}`}>
                    <label>Attempt</label>
                    <input type="number" className="no-spinner-input" value={attemptCount} disabled={isInputDisabled}
                      onChange={(e) => setAttemptCount(Math.min(Number(e.target.value), totalQuestions))} />
                  </div>
                  <div className={`metric-box ${isInputDisabled ? 'disabled-opacity' : ''}`}>
                    <label>MarksEach</label>
                    <input type="number" className="no-spinner-input" value={marksEach} disabled={isInputDisabled}
                      onChange={(e) => setMarksEach(Number(e.target.value))} />
                  </div>
                  <div className="metric-box">
                    <label>Total</label>
                    <div className="sum-display"><Calculator size={12} className="d-none d-sm-inline" /><span>{attemptCount * marksEach}</span></div>
                  </div>
                </div>

                <div className="action-btns">
                  <button className={`btn-action outline ${!useManualSelection ? 'active' : ''}`}
                    onClick={() => { if (!isInputDisabled) { handleAutoAdd(); } }} disabled={isInputDisabled}>
                    <Sparkles size={14} /> <span className="d-none d-sm-inline">Auto </span><span>Add</span>
                  </button>
                  <button className={`btn-action outline ${useManualSelection ? 'active' : ''}`}
                    onClick={() => !isInputDisabled && setUseManualSelection(!useManualSelection)} disabled={isInputDisabled}>
                    <Search size={14} /> <span className="d-none d-sm-inline">Find</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
      
          <div className="app-modal-body">
            {useManualSelection ? (
              <ManualQuestionSelection
                subjectId={subjectId} classId={classId} chapterOption={chapterOption} 
                selectedChapters={selectedChapters} chapters={chapters} language={paperData.language}
                source_type={selectedSources} typeCounts={{ [selectedType]: totalQuestions }}
                onQuestionsSelected={handleQuestionsSelected} shuffleTrigger={manualShuffleTrigger}
                showSelectedOnly={showSelectedQuestions} selectedQuestions={selectedQuestions}
              />
            ) : (
              isLoading ? (<Loading />) : (
                <div className="empty-state">
                  <img src="/examly.jpg" alt="Logo" className="opacity-25" style={{ width: "120px" }} />
                  <h4>{isInputDisabled ? "Select Question Type" : "Ready to build?"}</h4>
                  <p>Configure settings above to generate questions.</p>
                  
                  {paperData.sections.length > 0 && (
                    <div className="added-sections-list">
                      <strong>Added Sections ({paperData.language}):</strong>
                      <ul style={{ listStyle: 'none', padding: 0 }}>
                        {paperData.sections.map((p, idx) => (
                          <li key={p.id} style={{ color: '#10b981' }}>Section {idx + 1}: {p.questions.length} x {p.type}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          <div className="app-modal-footer">
            <div className="footer-left">
              <button className="btn-ghost" onClick={handleDiscard}>Discard</button>
              <div className="v-divider"></div>
              <button className={`btn-icon-text ${questionsShuffled ? 'active-shuffle' : ''}`} 
                onClick={() => setManualShuffleTrigger(prev => prev + 1)}
                disabled={!selectedType || totalQuestions === 0}>
                <Shuffle size={14} /> Shuffle
              </button>
              {manualSelectionComplete && (
                <button className={`btn-icon-text ${showSelectedQuestions ? 'highlight' : ''}`} 
                  onClick={() => setShowSelectedQuestions(!showSelectedQuestions)}>
                  <Eye size={14} /> {showSelectedQuestions ? 'Show All' : 'Show Selected'}
                </button>
              )}
            </div>
            <div className="footer-right">
              {useManualSelection && manualSelectionComplete && (
                <button className="btn btn-primary btn-save" onClick={handleAddPaperManual}>
                    <span> <MousePointer2 size={14} /> Add</span>
                    <span className="d-none d-sm-inline"> to Paper</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        :global(#react-hot-toast) { z-index: 999999 !important; }
        .app-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 12px; }
        .app-modal-container { background: #fff; width: 100%; max-width: 950px; height: 85vh; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
        .app-modal-header { padding: 12px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #fff; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .icon-badge { padding: 8px; background: #f1f5f9; border-radius: 8px; color: #64748b; }
        .header-text h3 { margin: 0; font-size: 15px; font-weight: 800; color: #1e293b; }
        .header-text p { margin: 0; font-size: 11px; color: #64748b; display: flex; align-items: center; }
        .section-count { font-size: 10px; color: #10b981; margin-left: 8px; font-weight: 700; }
        .subject-tag { color: #2563eb; font-weight: 700; margin-left: 4px; }
        .close-ghost-btn { background: none; border: none; color: #94a3b8; cursor: pointer; }
        .app-toolbar { background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .toolbar-row-top { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 12px 20px; }
        .tool-box { display: flex; flex-direction: column; gap: 4px; position: relative; }
        .tool-box label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        
        /* Input & Global Config Styles */
        .mini-input { height: 36px; background: #fff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 0 10px; font-size: 12px; font-weight: 600; outline: none; width: 100%; color: #334155; }
        .mini-input.clickable { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
        .mini-input.disabled-cfg { background: #f1f5f9; cursor: not-allowed; opacity: 0.7; border-color: #e2e8f0; }
        .mini-input:disabled { background: #f1f5f9; cursor: not-allowed; }
        
        /* Hiding Number Spinners */
        .no-spinner-input::-webkit-outer-spin-button,
        .no-spinner-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .no-spinner-input[type=number] { -moz-appearance: textfield; }
        .no-spinner-input { width: 50px; height: 34px; border: 1.5px solid #e2e8f0; border-radius: 6px; text-align: center; font-size: 13px; font-weight: 700; color: #1e293b; outline: none; }

        .short-lbl { display: none; }
        .toolbar-row-bottom { background: #fff; border-top: 1px solid #e2e8f0; padding: 8px 20px; }
        .horizontal-scroll-container { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
        .metrics-group { display: flex; align-items: center; gap: 12px; }
        .metric-box { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .metric-box label { font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
        .disabled-opacity { opacity: 0.5; pointer-events: none; }
        .sum-display { height: 34px; padding: 0 10px; background: #ecfdf5; border: 1px solid #10b981; color: #065f46; border-radius: 6px; display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 800; }
        .floating-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); z-index: 50; margin-top: 4px; padding: 4px; }
        .drop-item { padding: 8px 10px; font-size: 12px; cursor: pointer; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; }
        .drop-item:hover { background: #f1f5f9; }
        .drop-item.active { background: #eff6ff; color: #2563eb; font-weight: 700; }
        .action-btns { display: flex; gap: 8px; }
        .btn-action { height: 34px; padding: 0 16px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; border: 1.5px solid #e2e8f0; background: #fff; }
        .btn-action.outline.active { background: #eff6ff; color: #2563eb; border-color: #2563eb; }
        .app-modal-body { flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; }
        .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; text-align: center; }
        .added-sections-list { marginTop: 20px; textAlign: left; fontSize: 12px; color: #334155; }
        .app-modal-footer { padding: 12px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
        .footer-left { display: flex; align-items: center; gap: 5px; }
        .v-divider { width: 1px; height: 20px; background: #cbd5e1; }
        .btn-icon-text { background: none; border: none; font-size: 12px; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 5px; font-weight: 600; }
        .btn-icon-text.active-shuffle { color: #2563eb; font-weight: 700; }
        .btn-icon-text.highlight { background: #eff6ff; color: #2563eb; padding: 6px 12px; border-radius: 6px; font-weight: 700; }
        .btn-save { background: #10b981; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px; }
        .btn-ghost { background: none; border: none; color: #ef4444; font-weight: 600; cursor: pointer; }
        
        @media (max-width: 640px) {
          .app-modal-overlay { padding: 0px; }
          .app-modal-container { height: 100vh; border-radius: 0; }
          .full-lbl { display: none; }
          .short-lbl { display: inline; }
          .toolbar-row-top { padding: 10px; }
          .toolbar-row-bottom { padding: 8px 0; }
          .horizontal-scroll-container { overflow-x: auto; padding: 0 10px; scrollbar-width: none; gap:2px; }
          .metrics-group, .action-btns { flex-shrink: 0; gap:2px; }
          .btn-action{ padding:0 12px;}
          .app-modal-footer{padding:2px 2px !important;}    
          .no-spinner-input {width: 40px; }   
        }
      `}</style>
    </>
  );
};