//dashboard/generate-paper/components/modals/QuestionSelectorModal.tsx
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
import { getBucket } from '@/lib/paperQuestionBuckets';

export const QuestionSelectorModal: React.FC<any> = ({
  isOpen, onClose, onAddQuestions, subjectId, classId, chapterOption,
  selectedChapters, chapters, subjects = [],
  language: initialLanguage, getQuestionTypes, watch, setValue, currentSubject, currentClass,
  editingSection
}) => {
  // --- States ---
  // When editingSection is passed, this modal opens pre-loaded with that
  // section's own type/count/questions and every save replaces that section
  // in place instead of appending a new one. This component remounts fresh
  // each time it opens (see PaperBuilderApp's `{showQuestionSelector && ...}`),
  // so seeding state straight from the prop here is enough — no reset effect needed.
  const [selectedType, setSelectedType] = useState<string>(editingSection?.type || '');
  const [selectedSources, setSelectedSources] = useState<string[]>(['all']);
  const [currentLanguage, setCurrentLanguage] = useState(initialLanguage || 'english');
  const [totalQuestions, setTotalQuestions] = useState<number | ''>(editingSection?.totalQuestions ?? '');
  const [attemptCount, setAttemptCount] = useState<number | ''>(editingSection?.attemptCount ?? '');
  const [marksEach, setMarksEach] = useState<number | ''>(editingSection?.marksEach ?? '');
  const [useManualSelection, setUseManualSelection] = useState<boolean>(!!editingSection);
  const [manualSelectionComplete, setManualSelectionComplete] = useState<boolean>(!!editingSection);
  const [selectedQuestions, setSelectedQuestions] = useState<Record<string, any[]>>(
    editingSection ? { [editingSection.type]: editingSection.questions } : {}
  );
  const [showSourceDropdown, setShowSourceDropdown] = useState<boolean>(false);
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [questionsShuffled, setQuestionsShuffled] = useState<boolean>(false);
  const [showSelectedQuestions, setShowSelectedQuestions] = useState<boolean>(false);
  const [paperData, setPaperData] = useState<{ layout: string, language: string, sections: any[] }>({
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

  // Urdu/English subjects are single-language by nature — lock the
  // Language dropdown to that language, matching the same subject-name
  // check PaperBuilderApp already uses to force `currentLanguage`.
  const isUrduSubject = currentSubject?.name === 'Urdu';
  const isEnglishSubject = currentSubject?.name === 'English';

  // --- Layout & Limits Logic ---
  // NOTE: four_papers uses maxShort/maxLong (bucketed caps) instead of
  // maxMcq/maxSubjective, since short and long types have different,
  // independent caps rather than a single combined "subjective" pool.
  const getLimitsForLayout = (layoutValue: string) => {
    switch (layoutValue) {
      case "two_papers": return { maxMcq: 5, maxSubjective: 15 };
      case "three_papers": return { maxMcq: 5, maxSubjective: 10 };
      case "four_papers": return { maxMcq: 0, maxShort: 7, maxLong: 5 };
      default: return { maxMcq: 0, maxSubjective: 0 };
    }
  };

  const updateLocalState = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questionPapers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setPaperData({ layout: 'separate', language: 'english', sections: parsed });
        } else {
          setPaperData(parsed);
          setValue('mcqPlacement', parsed.layout);
        }
      }
    }
  };

  useEffect(() => { updateLocalState(); }, []);

  // When replaceSectionId is set, the given section is swapped out with the
  // new questions/counts in place (used when editing an existing section)
  // instead of appending a brand-new section. The section being replaced is
  // excluded from its own cap check — otherwise its current questions would
  // double-count against the layout limit it's about to be replaced under.
  const processAndSave = (type: string, questions: any[], attempt: number, marks: number, replaceSectionId?: string) => {
    const limits = getLimitsForLayout(paperData.layout);
    const subjectName = currentSubject?.name || 'General';
    let finalQuestions = questions;
    const sectionsForCapCheck = replaceSectionId
      ? paperData.sections.filter((p: any) => p.id !== replaceSectionId)
      : paperData.sections;

    if (paperData.layout === 'four_papers') {
      // four_papers: bucket by short/long classification (covers all
      // English/Urdu-specific types like idiom_phrases, gazal, etc.)
      const bucket = getBucket(type);

      if (bucket === 'mcq') {
        toast.error("MCQ sections aren't supported in the 4-papers layout.");
        return false;
      }
      if (bucket === 'other') {
        toast.error(`"${type}" isn't supported in the 4-papers layout.`);
        return false;
      }

      const cap = bucket === 'short' ? (limits as any).maxShort : (limits as any).maxLong;
      const existingCount = sectionsForCapCheck
        .filter((p: any) => p.subject === subjectName && getBucket(p.type) === bucket)
        .reduce((sum: number, p: any) => sum + p.questions.length, 0);
      const remaining = cap - existingCount;

      if (remaining <= 0) {
        toast.error(`Limit reached: max ${cap} ${bucket}-type questions for 4-papers layout.`);
        return false;
      }
      if (existingCount + questions.length > cap) {
        finalQuestions = questions.slice(0, remaining);
        toast(`Only ${remaining} question(s) added — layout cap is ${cap} ${bucket}-type questions.`, { icon: '⚠️' });
      }
    } else {
      // two_papers / three_papers: unchanged — mcq vs everything-else
      const { maxMcq, maxSubjective } = limits as any;
      const isMcq = type === 'mcq';
      const cap = isMcq ? maxMcq : maxSubjective;

      if (cap > 0) {
        const existingCount = sectionsForCapCheck
          .filter((p: any) => p.subject === subjectName && (isMcq ? p.type === 'mcq' : p.type !== 'mcq'))
          .reduce((sum: number, p: any) => sum + p.questions.length, 0);
        const remaining = cap - existingCount;

        if (remaining <= 0) {
          toast.error(`Limit reached: max ${cap} ${isMcq ? 'MCQ' : 'subjective'} questions for this layout.`);
          return false;
        }
        if (existingCount + questions.length > cap) {
          finalQuestions = questions.slice(0, remaining);
          toast(`Only ${remaining} question(s) added — layout cap is ${cap}.`, { icon: '⚠️' });
        }
      }
    }

    const finalAttempt = Math.min(attempt, finalQuestions.length);
    const sectionPayload = {
      type,
      questions: finalQuestions,
      totalQuestions: finalQuestions.length,
      attemptCount: finalAttempt,
      marksEach: marks,
      totalMarks: finalAttempt * marks,
      subject: subjectName,
      timestamp: new Date().toISOString()
    };

    const updatedSections = replaceSectionId
      ? paperData.sections.map((s: any) => s.id === replaceSectionId ? { ...s, ...sectionPayload } : s)
      : [...paperData.sections, { id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, ...sectionPayload }];

    const updatedPaper = { ...paperData, sections: updatedSections };
    localStorage.setItem('questionPapers', JSON.stringify(updatedPaper));
    setPaperData(updatedPaper);
    return true;
  };

  const handleAutoAdd = () => {
    if (!selectedType || !totalQuestions || totalQuestions === 0) {
      toast.error("Select type & total questions");
      return;
    }
    setUseManualSelection(false);
    setAutoSelectSeed(Date.now());
  };

  const selectedTopics = watch('selectedTopics') || [];
  useEffect(() => {
    if (!selectedType || totalQuestions === 0 || useManualSelection || autoSelectSeed === 0) return;

    const fetchAuto = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/questions/random', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectId, classId, chapterIds: selectedChapters, topicIds: selectedTopics,
            questionType: selectedType, language: paperData.language,
            sourceTypes: selectedSources, limit: totalQuestions, seed: autoSelectSeed
          })
        });
        const data = await res.json();
        if (!data || data.length === 0) {
          setIsLoading(false);
          return toast.error('No questions found');
        }

        if (processAndSave(selectedType, data, attemptCount, marksEach || 1, editingSection?.id)) {
          setSelectedQuestions({ [selectedType]: data });
          setManualSelectionComplete(true);
          setIsLoading(false);
          if (editingSection) {
            toast.success('Section updated! 🎯');
            onClose();
          } else {
            toast.success('Questions added! 🎯');
          }
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

  const handleTotalChange = (val: number | '') => {
    if (val === '') {
      setTotalQuestions('');
      setAttemptCount('');
      return;
    }

    const limits = getLimitsForLayout(paperData.layout);
    let cap = 0;

    if (paperData.layout === 'four_papers') {
      const bucket = getBucket(selectedType);
      if (bucket === 'short') cap = (limits as any).maxShort ?? 0;
      else if (bucket === 'long') cap = (limits as any).maxLong ?? 0;
      // bucket === 'mcq' or 'other' is already blocked at the type-select level
    } else {
      const { maxMcq, maxSubjective } = limits as any;
      if (selectedType === 'mcq') cap = maxMcq;
      else if (selectedType !== '') cap = maxSubjective;
    }

    const finalVal = cap > 0 ? Math.min(val, cap) : val;

    if (cap > 0 && val > cap) {
      toast.error(`Max ${cap} ${selectedType || ''} questions allowed for this layout.`);
    }

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

  // Urdu/English subjects are single-language by nature. If the language
  // ever comes in mismatched (e.g. a stale value restored from the
  // 'questionPapers' localStorage snapshot in updateLocalState above),
  // force it back to the one language the dropdown now allows.
  useEffect(() => {
    if (isUrduSubject && paperData.language !== 'urdu') {
      handleLanguageChange('urdu');
    } else if (isEnglishSubject && paperData.language !== 'english') {
      handleLanguageChange('english');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUrduSubject, isEnglishSubject, paperData.language]);

  const handleAddPaperManual = () => {
    const questions = selectedQuestions[selectedType] || [];
    if (questions.length === 0) return toast.error("Select questions first");
    if (processAndSave(selectedType, questions, attemptCount, marksEach, editingSection?.id)) {
      if (editingSection) {
        toast.success("Section updated!");
        onClose();
        return;
      }
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

  // Re-cap totalQuestions if the user changes type or layout after already setting a value
  useEffect(() => {
    if (!selectedType || totalQuestions === '' || totalQuestions === 0) return;

    const limits = getLimitsForLayout(paperData.layout);
    let cap = 0;

    if (paperData.layout === 'four_papers') {
      const bucket = getBucket(selectedType);
      if (bucket === 'short') cap = (limits as any).maxShort ?? 0;
      else if (bucket === 'long') cap = (limits as any).maxLong ?? 0;
    } else {
      const { maxMcq, maxSubjective } = limits as any;
      cap = selectedType === 'mcq' ? maxMcq : maxSubjective;
    }

    if (cap > 0 && (totalQuestions as number) > cap) {
      setTotalQuestions(cap);
      setAttemptCount(cap);
      toast.error(`Max ${cap} questions for this layout. Value capped to ${cap}.`);
    }
  }, [paperData.layout, selectedType]);

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
                <h3>{editingSection ? `Edit Section — ${editingSection.type.toUpperCase()}` : 'Paper Configuration'}</h3>
                <p>
                  <span className="meta-item">Class: <span className="subject-tag">{(currentClass?.name || 'General')}</span></span>
                  <span className="p-divider">|</span>
                  <span className="meta-item">Subject: <span className="subject-tag">{(currentSubject?.name || 'General')}</span></span>
                  {paperData.sections.length > 0 && (
                    <span className="section-count">
                      {editingSection ? 'Changing this section\'s questions only' : `(${paperData.sections.length} sections added)`}
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
                        { label: '3 paper Per Page', value: 'three_papers' },
                        { label: '4 paper Per Page (Short/Long only)', value: 'four_papers' }
                      ].map(opt => (
                        <div key={opt.value} className="drop-item" onClick={() => handleLayoutChange(opt.value)}>
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Source Dropdown */}
              <div className="tool-box" ref={sourceDropdownRef}>
                <label><span className="full-lbl">Source</span><span className="short-lbl">Source</span></label>
                <div className="mini-input clickable" onClick={() => setShowSourceDropdown(!showSourceDropdown)}>
                  <span className="truncate-text">
                    {selectedSources.includes('all')
                      ? 'All'
                      : selectedSources.length === 1
                        ? { book: 'Book Exercise', model_paper: 'Model Paper', past_paper: 'Past Paper', custom: 'Additional Questions', conceptual: 'Conceptual' }[selectedSources[0]]
                        : `${selectedSources.length} Selected`}
                  </span> <ChevronDown size={14} />
                  {showSourceDropdown && (
                    <div className="floating-dropdown">
                      {[
                        { value: 'all', label: 'All' },
                        { value: 'book', label: 'Book Exercise' },
                        { value: 'custom', label: 'Additional Questions' },
                        { value: 'conceptual', label: 'Conceptual' },
                        { value: 'model_paper', label: 'Model Paper' },
                        { value: 'past_paper', label: 'Past Paper' },
                      ].map(opt => (
                        <div
                          key={opt.value}
                          className={`drop-item ${selectedSources.includes(opt.value) ? 'active' : ''}`}
                          onClick={() => {
                            if (opt.value === 'all') setSelectedSources(['all']);
                            else setSelectedSources(prev =>
                              prev.includes(opt.value)
                                ? prev.filter(s => s !== opt.value)
                                : [...prev.filter(s => s !== 'all'), opt.value]
                            );
                          }}
                        >
                          {opt.label}
                          {selectedSources.includes(opt.value) && <Check size={12} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Question Type */}
              <div className="tool-box">
                <label><span className="full-lbl">Question Type</span><span className="short-lbl">Qs Type</span></label>
                <select className={`mini-input ${editingSection ? 'disabled-cfg' : ''}`} disabled={!!editingSection} style={{
  fontFamily:currentSubject?.name?.toLowerCase() === 'urdu'? "'JameelNoori', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu'": 'inherit',
}} value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                  <option value=''>Select Type</option>
                  {questionTypes
                    .filter((t: any) => {
                      if (paperData.layout !== 'four_papers') return true;
                      const bucket = getBucket(t.value);
                      return bucket === 'short' || bucket === 'long';
                    })
                    .map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
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
                  {isUrduSubject ? (
                    <option value="urdu">Urdu</option>
                  ) : isEnglishSubject ? (
                    <option value="english">Eng</option>
                  ) : (
                    <>
                      <option value="english">Eng</option>
                      <option value="urdu">Urdu</option>
                      <option value="bilingual">Both</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="toolbar-row-bottom">
              <div className="horizontal-scroll-container">
                <div className="metrics-group">
                  <div className={`metric-box ${isInputDisabled ? 'disabled-opacity' : ''}`}>
                    <label>Total Qs</label>
                    <input
                      type="number"
                      className="no-spinner-input"
                      value={totalQuestions}
                      disabled={isInputDisabled}
                      placeholder="0"
                      onChange={(e) => handleTotalChange(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>
                  <div className={`metric-box ${isInputDisabled ? 'disabled-opacity' : ''}`}>
                    <label>Attempt</label>
                    <input
                      type="number"
                      className="no-spinner-input"
                      value={attemptCount}
                      disabled={isInputDisabled}
                      placeholder="0"
                      onChange={(e) => {
                        const v = e.target.value === '' ? '' : Number(e.target.value);
                        setAttemptCount(v === '' ? '' : Math.min(v, totalQuestions || 0));
                      }}
                    />
                  </div>
                  <div className={`metric-box ${isInputDisabled ? 'disabled-opacity' : ''}`}>
                    <label>MarksEach</label>
                    <input
                      type="number"
                      className="no-spinner-input"
                      value={marksEach}
                      placeholder="0"
                      disabled={isInputDisabled}
                      onChange={(e) => setMarksEach(e.target.value === '' ? '' : Number(e.target.value))}
                    />
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
                    onClick={() => {
                      if (isInputDisabled) return;
                      if (!totalQuestions || totalQuestions === 0) {
                        toast.error("Enter total questions first");
                        return;
                      }
                      setUseManualSelection(!useManualSelection);
                    }}
                    disabled={isInputDisabled}
                  >
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
                selectedChapters={selectedChapters} selectedTopics={selectedTopics} chapters={chapters} language={paperData.language}
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
              {editingSection ? (
                <button className="btn-ghost" style={{ color: '#64748b' }} onClick={onClose}>Cancel</button>
              ) : (
                <button className="btn-ghost" onClick={handleDiscard}>Discard</button>
              )}
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
                  {editingSection ? (
                    <span><MousePointer2 size={14} /> Update Section</span>
                  ) : (
                    <>
                      <span> <MousePointer2 size={14} /> Add</span>
                      <span className="d-none d-sm-inline"> to Paper</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        :global(#react-hot-toast) { z-index: 999999 !important; }
        .app-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 12px; }
        .app-modal-container { background: #fff; width: 100%; max-width: 950px; height: 85dvh; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        transform: translateZ(0);
        backface-visibility: hidden;
        will-change: transform;
        }
        .app-modal-header { padding: 12px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; background: #fff; }
        .header-left { display: flex; align-items: flex-start; gap: 12px; min-width: 0; flex: 1 1 auto; }
        .icon-badge { padding: 8px; background: #f1f5f9; border-radius: 8px; color: #64748b; flex-shrink: 0; }
        .header-text { min-width: 0; flex: 1 1 auto; }
        .header-text h3 { margin: 0; font-size: 15px; font-weight: 800; color: #1e293b; word-break: break-word; }
        .header-text p { margin: 4px 0 0; font-size: 11px; color: #64748b; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
        .meta-item { white-space: nowrap; }
        .p-divider { color: #cbd5e1; }
        .section-count { font-size: 10px; color: #10b981; font-weight: 700; white-space: nowrap; }
        .subject-tag { color: #2563eb; font-weight: 700; margin-left: 4px; }
        .close-ghost-btn { background: none; border: none; color: #94a3b8; cursor: pointer; flex-shrink: 0; }
        .app-toolbar { background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .toolbar-row-top { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 12px 20px; }
        .tool-box { display: flex; flex-direction: column; gap: 4px; position: relative; }
        .tool-box label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }

        .mini-input { height: 36px; background: #fff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 0 10px; font-size: 12px; font-weight: 600; outline: none; width: 100%; color: #334155; }
        .mini-input.clickable { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
        .mini-input.disabled-cfg { background: #f1f5f9; cursor: not-allowed; opacity: 0.7; border-color: #e2e8f0; }
        .mini-input:disabled { background: #f1f5f9; cursor: not-allowed; }

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
        .app-modal-body { flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; contain: layout style;}
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
          .app-modal-container { height: 100dvh; border-radius: 0; }
          .full-lbl { display: none; }
          .short-lbl { display: inline; }
          .toolbar-row-top { padding: 10px; }
          .toolbar-row-bottom { padding: 8px 0; }
          .horizontal-scroll-container { overflow-x: auto; padding: 0 10px; scrollbar-width: none; gap:2px; }
          .metrics-group, .action-btns { flex-shrink: 0; gap:2px; }
          .btn-action{ padding:0 12px;}
          .app-modal-footer{padding:2px 2px !important;}
          .no-spinner-input {width: 40px; }
          .floating-dropdown {width:175px;}
        }
      `}</style>
    </>
  );
};