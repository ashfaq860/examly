'use client';
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Chapter, Topic } from '@/types/types';
import { 
  CheckCircle2, BookOpen, Layers, LayoutGrid, 
  ArrowRight, X, Check, Sparkles 
} from 'lucide-react';
import { UseFormSetValue } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';

interface ChapterSelectionStepProps {
  chapters: (Chapter & { topics?: Topic[] })[];
  watchedSubjectId: string;
  watchedChapterOption: string;
  selectedChapters: string[];
  subjects: any[];
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
  setValue,
  setStep,
  watch,
  handleChapterSelection
}) => {
  const [activeChapterForPopup, setActiveChapterForPopup] = useState<any | null>(null);
  const watchedTopics: string[] = watch('selectedTopics') || [];

  const currentSubject = useMemo(() => 
    subjects.find(s => s.id === watchedSubjectId), 
  [subjects, watchedSubjectId]);

  const isUrduMedium = useMemo(() => {
    const name = (currentSubject?.name || '').toLowerCase();
    return name.includes('urdu') || name.includes('pak study') || name.includes('islamyat') || name.includes('islamiat');
  }, [currentSubject]);

  const sortedChapters = useMemo(() => {
    return [...chapters].sort((a, b) => (Number(a.chapterNo) || 0) - (Number(b.chapterNo) || 0));
  }, [chapters]);

  // Helper logic for Half Book selections
  const getHalfBookChapters = (half: '1st_half_book' | '2nd_half_book') => {
    const midIndex = Math.ceil(sortedChapters.length / 2);
    return half === '1st_half_book' 
      ? sortedChapters.slice(0, midIndex) 
      : sortedChapters.slice(midIndex);
  };

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

    // Smooth auto-advance
    setTimeout(() => setStep(4), 600);
  };

  const handleCustomChapterToggle = (chapter: any) => {
    const isCurrentlySelected = selectedChapters.includes(chapter.id);
    handleChapterSelection(chapter.id);

    const chapterTopicIds = chapter.topics?.map((t: any) => t.id) || [];
    let updatedTopics = [...watchedTopics];

    if (!isCurrentlySelected) {
      updatedTopics = Array.from(new Set([...updatedTopics, ...chapterTopicIds]));
    } else {
      updatedTopics = updatedTopics.filter(id => !chapterTopicIds.includes(id));
    }
    setValue('selectedTopics', updatedTopics);
  };

  const handleTopicToggle = (topicId: string) => {
    const current = [...watchedTopics];
    const index = current.indexOf(topicId);
    if (index > -1) current.splice(index, 1);
    else current.push(topicId);
    setValue('selectedTopics', current);
  };

  const getChapterRangeText = (half: '1st_half_book' | '2nd_half_book') => {
    if (sortedChapters.length === 0) return 'No chapters';
    const midIndex = Math.ceil(sortedChapters.length / 2);
    const slice = half === '1st_half_book' ? sortedChapters.slice(0, midIndex) : sortedChapters.slice(midIndex);
    return slice.length > 0 ? `Ch. ${slice[0]?.chapterNo} - ${slice[slice.length - 1]?.chapterNo}` : 'N/A';
  };

  const options = [
    { value: '1st_half_book', icon: <Layers size={24} className="text-primary" />, title: '1st Half', range: getChapterRangeText('1st_half_book') },
    { value: '2nd_half_book', icon: <Layers size={24} className="text-success" />, title: '2nd Half', range: getChapterRangeText('2nd_half_book') },
    { value: 'custom', icon: <LayoutGrid size={24} className="text-warning" />, title: 'Custom Selection', range: 'Manual' },
    { value: 'full_book', icon: <BookOpen size={24} className="text-info" />, title: 'Full Book', range: `${sortedChapters.length} Chapters` },
  ];

  return (
    <div className="container-fluid px-0">
      <style jsx global>{`
        .urdu-font-style { font-family: 'JameelNoori', serif !important; font-size: 1.3rem !important; }
        
        /* Premium Selection Cards */
        .selection-card {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          min-height: 160px;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          cursor: pointer;
          position: relative;
          background: #f8fafc;
        }

        .selection-card:hover {
          transform: translateY(-5px) scale(1.02);
          background: white !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05) !important;
          border-color: #0d6efd !important;
        }

        .selection-card.active {
          border-color: #0d6efd !important;
          background: white !important;
          box-shadow: 0 10px 15px -3px rgba(13, 110, 253, 0.1) !important;
        }

        .icon-box {
          transition: transform 0.3s ease;
          background: white;
        }

        .selection-card:hover .icon-box {
          transform: scale(1.1);
        }

        /* Popup Styles */
        .popup-overlay { 
          position: fixed; inset: 0; 
          background: rgba(15, 23, 42, 0.4); 
          display: flex; align-items: center; justify-content: center; 
          z-index: 9999; backdrop-filter: blur(6px); 
        }
        .popup-content { 
          background: white; width: 92%; max-width: 450px; 
          border-radius: 24px; padding: 24px; max-height: 80vh; 
          overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.2); 
        }
        
        .topic-item { cursor: pointer; border: 1.5px solid #f1f5f9; transition: 0.2s; background: #fff; }
        .topic-item.deselected { background: #fff5f5; color: #ef4444; border-color: #fee2e2; text-decoration: line-through; opacity: 0.7; }
        .topic-item.selected { border-color: #0d6efd; background: #f0f7ff; color: #0d6efd; }
        
        .skip-btn-small { 
          font-size: 10px; font-weight: 700; color: #64748b; 
          padding: 6px 12px; border-radius: 8px; background: #f1f5f9; 
          border: none; text-transform: uppercase; transition: 0.2s; 
        }
        .skip-btn-small:hover { background: #e2e8f0; color: #0d6efd; }
        
        @media (max-width: 576px) {
          .selection-card { min-height: 140px; padding: 1rem !important; }
        }
      `}</style>

      {/* Main Mode Selection */}
      <div className="row g-3 g-md-4 mb-4">
        {options.map((opt) => (
          <div key={opt.value} className="col-6 col-md-3">
            <div
              onClick={() => handleOptionSelect(opt.value)}
              className={`selection-card h-100 rounded-5 border-2 border ${
                watchedChapterOption === opt.value ? 'active shadow-premium' : 'border-transparent opacity-75'
              }`}
            >
              <div className="icon-box mb-3 d-inline-flex p-3 rounded-4 shadow-sm">
                {opt.icon}
              </div>
              <div className="px-2">
                <h6 className="fw-black mb-1 small text-dark">{opt.title}</h6>
                <span className="small text-muted d-block" style={{ fontSize: '10px' }}>{opt.range}</span>
              </div>
              
              {watchedChapterOption === opt.value && (
                <div className="position-absolute top-0 end-0 m-3 text-primary">
                  <CheckCircle2 size={16} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Custom Selection List */}
      <AnimatePresence mode="wait">
        {watchedChapterOption === 'custom' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2"
          >
            <div className="row g-3">
              {sortedChapters.map((chapter) => {
                const isSelected = selectedChapters.includes(chapter.id);
                const topics = chapter.topics || [];
                const selectedCount = topics.filter(t => watchedTopics.includes(t.id)).length;

                return (
                  <div key={chapter.id} className="col-12 col-md-6">
                    <div className={`rounded-4 border-2 transition-all p-3 h-100 bg-white shadow-sm d-flex align-items-center justify-content-between ${isSelected ? 'border-primary' : 'border-light'}`}>
                      <div className="d-flex align-items-center gap-3 flex-grow-1 cursor-pointer" onClick={() => handleCustomChapterToggle(chapter)}>
                        <div className={`rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0 ${isSelected ? 'bg-primary text-white' : 'bg-light text-primary'}`} style={{width: '32px', height: '32px', fontSize: '12px'}}>
                          {chapter.chapterNo}
                        </div>
                        <div className="text-truncate" style={{ maxWidth: '70%' }}>
                          <div className={`${isUrduMedium ? 'urdu-font-style' : 'small fw-bold'} text-truncate text-dark`}>
                            {chapter.name}
                          </div>
                          {isSelected && (
                            <div className="text-primary fw-bold" style={{fontSize: '9px'}}>
                              <Check size={10} className="me-1" /> {selectedCount}/{topics.length} Topics Active
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {isSelected && topics.length > 0 && (
                        <button className="skip-btn-small" onClick={(e) => { e.stopPropagation(); setActiveChapterForPopup(chapter); }}>
                          Skip Topic
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="text-center mt-5 mb-4">
              <button 
                className="btn btn-primary btn-lg rounded-pill px-5 py-3 shadow-lg d-inline-flex align-items-center gap-2 border-0" 
                onClick={() => setStep(4)} 
                disabled={!selectedChapters.length} 
                style={{ background: 'linear-gradient(135deg, #0d6efd 0%, #0046af 100%)' }}
              >
                Confirm Syllabus <ArrowRight size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Topic Selection Modal */}
{activeChapterForPopup && (
  <div className="popup-overlay" onClick={() => setActiveChapterForPopup(null)}>
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }} 
      animate={{ scale: 1, opacity: 1 }}
      className="popup-content" 
      onClick={e => e.stopPropagation()}
    >
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h5 className="mb-0 fw-bold">Select Topics</h5>
          <small className="text-muted">Chapter {activeChapterForPopup.chapterNo}</small>
        </div>
        <button className="btn-close" onClick={() => setActiveChapterForPopup(null)} />
      </div>

      <div className="topic-list d-flex flex-column gap-2">
        {activeChapterForPopup.topics?.map((topic: any) => {
          const isSelected = watchedTopics.includes(topic.id);
          return (
            <div 
              key={topic.id}
              className={`topic-item p-3 rounded-4 d-flex align-items-center justify-content-between ${!isSelected ? 'bg-light opacity-75' : 'border-primary'}`}
              onClick={() => handleTopicToggle(topic.id)}
            >
              <div className="d-flex align-items-center gap-3">
                <div className={`status-dot ${isSelected ? 'bg-primary' : 'bg-secondary'}`} style={{width:8, height:8, borderRadius:'50%'}} />
                <span className={`fw-semibold ${isUrduMedium ? 'urdu-font-style' : ''}`}>
                  {topic.name}
                </span>
              </div>
              {isSelected ? <CheckCircle2 size={18} className="text-primary" /> : <X size={18} className="text-muted" />}
            </div>
          );
        })}
      </div>
      
      <button 
        className="btn btn-primary w-100 mt-4 py-3 rounded-4 fw-bold"
        onClick={() => setActiveChapterForPopup(null)}
      >
        Done Selection
      </button>
    </motion.div>
  </div>
)}
    </div>
  );
};