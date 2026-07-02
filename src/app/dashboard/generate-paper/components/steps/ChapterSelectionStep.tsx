'use client';
import React, { useState, useMemo, useCallback } from 'react';
import { Chapter, Topic } from '@/types/types';
import { 
  CheckCircle2, BookOpen, Layers, LayoutGrid, 
  ArrowRight, X, Check 
} from 'lucide-react';
import { UseFormSetValue } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';

interface ChapterSelectionStepProps {
  chapters: (Chapter & { topics?: Topic[] })[];
  watchedSubjectId: string;
  watchedChapterOption: string;
  selectedChapters: string[];
  subjects: any[];
  classes: any[];
  watchedClassId: string;
  setValue: UseFormSetValue<any>;
  setStep: (step: number) => void;
  watch: any;
  handleChapterSelection: (chapterId: string) => void;
}

export const ChapterSelectionStep: React.FC<ChapterSelectionStepProps> = ({
  chapters,
  watchedSubjectId,
  watchedChapterOption,
  selectedChapters,
  subjects,
  classes,
  watchedClassId,
  setValue,
  setStep,
  watch,
  handleChapterSelection
}) => {
  const [activeChapterForPopup, setActiveChapterForPopup] = useState<any | null>(null);
  
  // 1. PERFORMANCE: watch('selectedTopics') triggers re-renders. 
  // Convert to a Set immediately for O(1) lookups in the UI.
  const watchedTopicsArr: string[] = watch('selectedTopics') || [];
  const watchedTopicsSet = useMemo(() => new Set(watchedTopicsArr), [watchedTopicsArr]);

  const currentSubject = useMemo(() =>
    subjects.find(s => s.id === watchedSubjectId),
  [subjects, watchedSubjectId]);

  const currentClass = useMemo(() =>
    classes.find(c => c.id === watchedClassId),
  [classes, watchedClassId]);

  const isUrduMedium = useMemo(() => {
    const name = (currentSubject?.name || '').toLowerCase();
    const urduKeywords = ['urdu', 'pak study', 'islamyat', 'islamiat'];
    return urduKeywords.some(key => name.includes(key));
  }, [currentSubject]);

  const sortedChapters = useMemo(() => {
    return [...chapters].sort((a, b) => (Number(a.chapterNo) || 0) - (Number(b.chapterNo) || 0));
  }, [chapters]);

  // 2. PERFORMANCE: Memoize Topic Counts per chapter to avoid O(n^2) operations in JSX
  const chapterTopicStats = useMemo(() => {
    const stats: Record<string, number> = {};
    sortedChapters.forEach(ch => {
      if (!ch.topics) return;
      stats[ch.id] = ch.topics.filter(t => watchedTopicsSet.has(t.id)).length;
    });
    return stats;
  }, [sortedChapters, watchedTopicsSet]);

  const getHalfBookChapters = useCallback((half: '1st_half_book' | '2nd_half_book') => {
    const midIndex = Math.ceil(sortedChapters.length / 2);
    return half === '1st_half_book' 
      ? sortedChapters.slice(0, midIndex) 
      : sortedChapters.slice(midIndex);
  }, [sortedChapters]);

  // 3. PERFORMANCE: Memoize option labels so they don't recalculate on every click
  const options = useMemo(() => {
    const getRange = (half: '1st_half_book' | '2nd_half_book') => {
      if (sortedChapters.length === 0) return '';
      const slice = getHalfBookChapters(half);
      return slice.length > 0 
        ? `Ch. ${slice[0]?.chapterNo} - ${slice[slice.length - 1]?.chapterNo}` 
        : 'N/A';
    };

    return [
      { value: 'full_book',     icon: <BookOpen   size={24} className="text-info"    />, title: 'Full Book',        range: `${sortedChapters.length ? `${sortedChapters.length} Chapters` : ''}` },
      { value: '1st_half_book', icon: <Layers     size={24} className="text-primary" />, title: '1st Half',         range: getRange('1st_half_book') },
      { value: '2nd_half_book', icon: <Layers     size={24} className="text-success" />, title: '2nd Half',         range: getRange('2nd_half_book') },
      { value: 'custom',        icon: <LayoutGrid size={24} className="text-warning" />, title: 'Manual Selection', range: 'Custom' },
    ];
  }, [sortedChapters, getHalfBookChapters]);

  const handleOptionSelect = (optionValue: string) => {
    setValue('chapterOption', optionValue);
    
    if (optionValue === 'custom') {
      setValue('selectedChapters', []);
      setValue('selectedTopics', []);
      return;
    }

    const selectedList = optionValue === 'full_book' 
      ? sortedChapters 
      : getHalfBookChapters(optionValue as '1st_half_book' | '2nd_half_book');

    const chapterIds = selectedList.map(ch => ch.id);
    const allTopicIds = selectedList.flatMap(ch => ch.topics?.map(t => t.id) || []);

    setValue('selectedChapters', chapterIds);
    setValue('selectedTopics', allTopicIds);
    setTimeout(() => setStep(4), 600);
  };

  const handleCustomChapterToggle = (chapter: any) => {
    const isCurrentlySelected = selectedChapters.includes(chapter.id);
    handleChapterSelection(chapter.id);

    const chapterTopicIds = chapter.topics?.map((t: any) => t.id) || [];
    let updatedTopics = [...watchedTopicsArr];

    if (!isCurrentlySelected) {
      updatedTopics = Array.from(new Set([...updatedTopics, ...chapterTopicIds]));
    } else {
      updatedTopics = updatedTopics.filter(id => !chapterTopicIds.includes(id));
    }
    setValue('selectedTopics', updatedTopics);
  };

  const handleTopicToggle = (topicId: string) => {
    const current = [...watchedTopicsArr];
    const index = current.indexOf(topicId);
    if (index > -1) current.splice(index, 1);
    else current.push(topicId);
    setValue('selectedTopics', current);
  };

  return (
    <div className="container py-4">
    

      <div className="text-center mb-3 mb-md-5 animate-slide-down">
        <h2 className="fw-black text-dark mb-1 tracking-tight">Select Your Chapters</h2>
        <div className="mx-auto bg-primary rounded-pill mb-3" style={{ width: '40px', height: '4px' }}></div>
        <p className="text-secondary opacity-75 mb-3 d-none d-md-block">Choose the chapters to include in your paper</p>

        {(currentClass || currentSubject) && (
          <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
            {currentClass && (
              <span className="badge rounded-pill px-3 py-2 fw-semibold"
                style={{ background: '#eff6ff', color: '#1d4ed8', border: '1.5px solid #bfdbfe', fontSize: '0.8rem' }}>
                🎓 Class {currentClass.name}
              </span>
            )}
            {currentClass && currentSubject && (
              <span className="text-muted fw-bold">›</span>
            )}
            {currentSubject && (
              <span className="badge rounded-pill px-3 py-2 fw-semibold"
                style={{ background: '#f0fdf4', color: '#15803d', border: '1.5px solid #bbf7d0', fontSize: '0.8rem' }}>
                📖 {currentSubject.name}
                {currentSubject.name_ur && (
                  <span style={{ fontFamily: "'JameelNoori', serif", fontSize: '1rem', marginLeft: '6px', opacity: 0.8 }}>
                    {currentSubject.name_ur}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .urdu-font-style { font-family: 'JameelNoori', serif !important; font-size: 1.3rem !important; }

        /* ── Header animation ── */
        .animate-slide-down {
          animation: slideDown 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Option cards (Full Book / 1st Half / 2nd Half / Custom) ── */
        .chapter-opt-card {
          background: #ffffff;
          border-radius: 24px;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 4px 8px -2px rgba(0,0,0,0.07);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px 16px;
          min-height: 150px;
        }
        .chapter-opt-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 32px -8px rgba(0,0,0,0.11) !important;
        }
        .chapter-opt-card.active-opt {
          box-shadow: inset 0 0 0 2px #0d6efd, 0 12px 24px -6px rgba(13,110,253,0.15);
          background: linear-gradient(145deg, #ffffff 0%, #f0f7ff 100%);
        }

        /* ── Icon wrapper inside option cards ── */
        .opt-icon-wrap {
          width: 60px;
          height: 60px;
          border-radius: 18px;
          background: #f0f4ff;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s ease, background 0.3s ease;
        }
        .chapter-opt-card:hover .opt-icon-wrap {
          transform: scale(1.08);
        }
        .chapter-opt-card.active-opt .opt-icon-wrap {
          background: rgba(13,110,253,0.1);
          transform: scale(1.08);
        }

        /* ── Custom chapter list items ── */
        .chapter-item {
          border-radius: 16px;
          border: 2px solid #f1f5f9;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .chapter-item.chapter-item-selected {
          border-color: #0d6efd;
          background: linear-gradient(to right, #f8fbff, #ffffff) !important;
          box-shadow: 0 4px 12px rgba(13,110,253,0.08);
        }

        /* ── Chapter number badge ── */
        .chapter-num {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
          background: #f0f4ff;
          color: #0d6efd;
          transition: all 0.2s ease;
        }
        .chapter-num.chapter-num-active {
          background: #0d6efd;
          color: #ffffff;
        }

        /* ── Topic popup ── */
        .popup-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(4px);
        }
        .popup-content {
          background: white;
          width: 92%;
          max-width: 450px;
          border-radius: 24px;
          padding: 24px;
          max-height: 80vh;
          overflow-y: auto;
        }
        .topic-item {
          cursor: pointer;
          border: 1.5px solid #f1f5f9;
          border-radius: 16px;
          transition: all 0.2s ease;
        }
        .topic-item.selected { border-color: #0d6efd; background: #f0f7ff; }
        .skip-btn-small {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          padding: 6px 12px;
          border-radius: 8px;
          background: #f1f5f9;
          border: none;
          white-space: nowrap;
        }
        .skip-btn-small:hover { background: #e2e8f0; }
      `}</style>

      {/* Main Mode Selection */}
      <div className="row g-3 g-md-4 mb-4">
        {options.map((opt) => (
          <div key={opt.value} className="col-6 col-md-3">
            <div
              onClick={() => handleOptionSelect(opt.value)}
              className={`chapter-opt-card h-100 ${
                watchedChapterOption === opt.value ? 'active-opt' : ''
              }`}
            >
              <div className="opt-icon-wrap mb-3">{opt.icon}</div>
              <div className="text-center">
                <h6 className="fw-bold mb-1 small">{opt.title}</h6>
                <span className="text-muted d-block" style={{ fontSize: '10px' }}>{opt.range}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Custom Selection List */}
      <AnimatePresence mode="wait">
        {watchedChapterOption === 'custom' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="row g-3 mt-2">
            {sortedChapters.map((chapter) => {
              const isSelected = selectedChapters.includes(chapter.id);
              const activeCount = chapterTopicStats[chapter.id] || 0;
              const totalTopics = chapter.topics?.length || 0;

              return (
                <div key={chapter.id} className="col-12 col-md-6">
                  <div className={`chapter-item p-3 h-100 bg-white d-flex align-items-center justify-content-between ${isSelected ? 'chapter-item-selected' : ''}`}>
                    <div className="d-flex align-items-center gap-3 flex-grow-1 cursor-pointer" onClick={() => handleCustomChapterToggle(chapter)}>
                      <div className={`chapter-num ${isSelected ? 'chapter-num-active' : ''}`}>
                        {chapter.chapterNo}
                      </div>
                      <div className="text-truncate" style={{ maxWidth: '70%' }}>
                        <div className={`${isUrduMedium ? 'urdu-font-style' : 'small fw-bold'} text-truncate text-dark`}>
                          {chapter.name}
                        </div>
                        {isSelected && (
                          <div className="text-primary fw-bold" style={{fontSize: '9px'}}>
                            <Check size={10} /> {activeCount}/{totalTopics} Topics Active
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {isSelected && totalTopics > 0 && (
                      <button className="skip-btn-small" onClick={(e) => { e.stopPropagation(); setActiveChapterForPopup(chapter); }}>
                      Skip Topics
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="col-12 text-center mt-4">
               <button className="btn btn-primary btn-lg rounded-pill px-5" onClick={() => setStep(4)} disabled={!selectedChapters.length}>
                 Confirm Syllabus <ArrowRight size={18} className="ms-2" />
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Topic Selection Modal */}
      {activeChapterForPopup && (
        <div className="popup-overlay" onClick={() => setActiveChapterForPopup(null)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="popup-content" onClick={e => e.stopPropagation()}>
            <div className="d-flex justify-content-between mb-4">
              <h5 className="fw-bold m-0">Topic Management</h5>
              <button className="btn-close" onClick={() => setActiveChapterForPopup(null)} />
            </div>

            <div className="d-flex flex-column gap-2">
              {activeChapterForPopup.topics?.map((topic: any) => {
                const isSelected = watchedTopicsSet.has(topic.id);
                return (
                  <div key={topic.id} className={`topic-item p-3 d-flex align-items-center justify-content-between ${isSelected ? 'selected' : 'opacity-50'}`} onClick={() => handleTopicToggle(topic.id)}>
                    <span className={`fw-semibold ${isUrduMedium ? 'urdu-font-style' : ''}`}>{topic.name}</span>
                    {isSelected ? <CheckCircle2 size={18} className="text-primary" /> : <X size={18} className="text-muted" />}
                  </div>
                );
              })}
            </div>
            <button className="btn btn-primary w-100 mt-4 py-3 rounded-4 fw-bold" onClick={() => setActiveChapterForPopup(null)}>Done</button>
          </motion.div>
        </div>
      )}
    </div>
  );
};