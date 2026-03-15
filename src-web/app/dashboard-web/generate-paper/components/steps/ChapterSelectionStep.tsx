'use client';

import React, { useRef, useEffect } from 'react';
import { Chapter } from '@/types/types';
import { 
  BookOpen, 
  Layers, 
  Settings2, 
  ChevronRight, 
  CheckCircle2, 
  BookMarked,
  Sparkles
} from 'lucide-react';

interface ChapterSelectionStepProps {
  chapters: Chapter[];
  watchedSubjectId: string;
  watchedChapterOption: string;
  selectedChapters: string[];
  subjects: any[];
  setValue: (field: string, value: any) => void;
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
  const chaptersListRef = useRef<HTMLDivElement>(null);
  const subjectChapters = chapters.filter(ch => ch.subject_id === watchedSubjectId);
  const currentSubject = subjects.find(s => s.id === watchedSubjectId);

  const getHalfBookChapters = (half: '1st_half_book' | '2nd_half_book') => {
    const sortedChapters = [...subjectChapters].sort((a, b) => a.chapterNo - b.chapterNo);
    const midIndex = Math.ceil(sortedChapters.length / 2);
    return half === '1st_half_book' ? sortedChapters.slice(0, midIndex) : sortedChapters.slice(midIndex);
  };

  const getChapterRangeText = (half: '1st_half_book' | '2nd_half_book') => {
    const sortedChapters = [...subjectChapters].sort((a, b) => a.chapterNo - b.chapterNo);
    if (sortedChapters.length === 0) return '0 chapters';
    const midIndex = Math.ceil(sortedChapters.length / 2);
    
    if (half === '1st_half_book') {
      return `Ch. ${sortedChapters[0]?.chapterNo} - ${sortedChapters[midIndex - 1]?.chapterNo}`;
    } else {
      return `Ch. ${sortedChapters[midIndex]?.chapterNo} - ${sortedChapters[sortedChapters.length - 1]?.chapterNo}`;
    }
  };

  useEffect(() => {
    if (watchedChapterOption === 'custom') {
      setTimeout(() => {
        chaptersListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);
    }
  }, [watchedChapterOption]);

  const handleOptionSelect = (optionValue: string) => {
    setValue('chapterOption', optionValue);
    
    if (optionValue === 'full_book') {
      setValue('selectedChapters', subjectChapters.map(ch => ch.id));
      setTimeout(() => setStep(4), 600);
    } else if (optionValue.includes('half')) {
      const halfChapters = getHalfBookChapters(optionValue as any);
      setValue('selectedChapters', halfChapters.map(ch => ch.id));
      setTimeout(() => setStep(4), 600);
    } else {
      setValue('selectedChapters', []);
    }
  };

  const quickOptions = [
    { value: '1st_half_book', icon: <Layers size={28} />, title: '1st Half', color: '#6366f1', range: getChapterRangeText('1st_half_book') },
    { value: '2nd_half_book', icon: <Layers size={28} />, title: '2nd Half', color: '#10b981', range: getChapterRangeText('2nd_half_book') },
    { value: 'custom', icon: <Settings2 size={28} />, title: 'Custom', color: '#f59e0b', range: 'Pick manually' },
    { value: 'full_book', icon: <BookOpen size={28} />, title: 'Full Book', color: '#ec4899', range: `${subjectChapters.length} Chapters` },
  ];

  return (
    <div className="w-100 py-2 animate-in">
      {/* Header Section */}
      <div className="text-center mb-5">
        <div className="d-inline-flex align-items-center justify-content-center p-2 mb-3 rounded-pill bg-primary bg-opacity-10 text-primary fw-bold small px-3">
          <Sparkles size={16} className="me-2" />
          Selected: {currentSubject?.name}
        </div>
        <h2 className="display-6 fw-bold text-dark mb-2">Chapter <span className="text-primary-gradient">Coverage</span></h2>
        <p className="text-muted fs-6">Define the syllabus scope for this question paper.</p>
      </div>

      {/* Quick Select Grid with Staggered Animation */}
      <div className="row g-3 mb-5">
        {quickOptions.map((opt, index) => {
          const isActive = watchedChapterOption === opt.value;
          return (
            <div 
              key={opt.value} 
              className="col-6 col-md-3 animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div 
                className={`quick-card ${isActive ? 'active' : ''}`}
                style={{ '--opt-color': opt.color } as React.CSSProperties}
                onClick={() => handleOptionSelect(opt.value)}
              >
                <div className="icon-sphere">{opt.icon}</div>
                <h6 className="fw-bold mb-1 mt-3">{opt.title}</h6>
                <span className="badge-range">{opt.range}</span>
                {isActive && <div className="active-dot" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Selection Area */}
      <div ref={chaptersListRef}>
        {watchedChapterOption === 'custom' && (
          <div className="custom-section animate-slide-up">
            <div className="glass-header d-flex align-items-center justify-content-between mb-4 p-3 rounded-4">
              <h5 className="fw-bold m-0 d-flex align-items-center">
                <BookMarked className="me-2 text-primary" /> Select Specific Chapters
              </h5>
              <span className="badge rounded-pill bg-primary px-3 py-2">
                {watch('selectedChapters')?.length || 0} Selected
              </span>
            </div>

            <div className="row g-3">
              {subjectChapters.map((chapter, index) => {
                const isSelected = (watch('selectedChapters') || []).includes(chapter.id);
                return (
                  <div 
                    key={chapter.id} 
                    className="col-12 col-md-6 col-lg-4 animate-slide-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div 
                      className={`chapter-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleChapterSelection(chapter.id)}
                    >
                      <div className="chapter-number">{chapter.chapterNo}</div>
                      <div className="chapter-info text-start">
                        <p className="chapter-name mb-0">{chapter.name}</p>
                      </div>
                      <div className="checkbox-wrapper">
                        {isSelected ? (
                          <div className="check-animated">
                             <CheckCircle2 size={22} fill="#0d6efd" color="white" />
                          </div>
                        ) : (
                          <div className="empty-check" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-5 pb-4">
              <button
                className="btn-premium"
                onClick={() => setStep(4)}
                disabled={!watch('selectedChapters')?.length}
              >
                Continue to Layout <ChevronRight size={20} className="ms-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .text-primary-gradient {
          background: linear-gradient(135deg, #0d6efd 0%, #6610f2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .quick-card {
          background: white;
          border-radius: 24px;
          padding: 1.5rem 1rem;
          text-align: center;
          cursor: pointer;
          border: 2px solid #f1f5f9;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          position: relative;
        }

        .quick-card:hover {
          transform: translateY(-8px);
          border-color: var(--opt-color);
          box-shadow: 0 15px 30px -10px rgba(0,0,0,0.1);
        }

        .quick-card.active {
          background: var(--opt-color);
          color: white;
          border-color: var(--opt-color);
          box-shadow: 0 15px 30px -10px rgba(var(--opt-color), 0.4);
        }

        .icon-sphere {
          width: 56px;
          height: 56px;
          margin: 0 auto;
          background: #f8fafc;
          color: var(--opt-color);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: 0.3s;
        }

        .quick-card.active .icon-sphere {
          background: rgba(255,255,255,0.2);
          color: white;
          transform: scale(1.1);
        }

        .badge-range {
          font-size: 0.75rem;
          background: #f1f5f9;
          color: #64748b;
          padding: 2px 10px;
          border-radius: 100px;
          font-weight: 600;
        }

        .quick-card.active .badge-range {
          background: rgba(0,0,0,0.1);
          color: white;
        }

        .active-dot {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 5px;
          height: 5px;
          background: white;
          border-radius: 50%;
        }

        .glass-header {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .chapter-item {
          display: flex;
          align-items: center;
          background: white;
          padding: 1.1rem;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .chapter-item:hover {
          background: #fdfdfd;
          transform: translateX(5px);
          border-color: #0d6efd;
        }

        .chapter-item.selected {
          border-color: #0d6efd;
          background: #f0f7ff;
          box-shadow: 0 4px 12px rgba(13, 110, 253, 0.08);
        }

        .chapter-number {
          width: 36px;
          height: 36px;
          background: #f1f5f9;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: #64748b;
          margin-right: 14px;
          flex-shrink: 0;
        }

        .chapter-item.selected .chapter-number {
          background: #0d6efd;
          color: white;
        }

        .chapter-name {
          font-weight: 600;
          font-size: 0.95rem;
          color: #1e293b;
        }

        .empty-check {
          width: 22px;
          height: 22px;
          border: 2px solid #cbd5e1;
          border-radius: 50%;
        }

        .check-animated {
          animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .btn-premium {
          background: linear-gradient(135deg, #0d6efd 0%, #0052cc 100%);
          color: white;
          border: none;
          padding: 14px 44px;
          border-radius: 100px;
          font-weight: 700;
          box-shadow: 0 10px 25px -5px rgba(13, 110, 253, 0.4);
          transition: 0.3s;
          display: inline-flex;
          align-items: center;
        }

        .btn-premium:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 15px 30px -5px rgba(13, 110, 253, 0.5);
        }

        .btn-premium:disabled {
          opacity: 0.5;
          background: #94a3b8;
          box-shadow: none;
        }

        @keyframes popIn {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-in {
          animation: fadeIn 0.5s ease-out;
        }

        .animate-slide-up {
          animation: slideUp 0.5s ease-out forwards;
          opacity: 0;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};