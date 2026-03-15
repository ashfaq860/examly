//generate-paper/components/steps/ChapterSelectionStep.tsx
'use client';
import React, { useRef, useEffect } from 'react';
import { Chapter } from '@/types/types';
import { CheckCircle2, BookOpen, Layers, LayoutGrid, ArrowRight } from 'lucide-react';
import { UseFormSetValue } from 'react-hook-form';

interface ChapterSelectionStepProps {
  chapters: Chapter[];
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
  const chaptersListRef = useRef<HTMLDivElement>(null);
  const subjectChapters = chapters
    .filter(ch => ch.subject_id === watchedSubjectId)
    .sort((a, b) => a.chapterNo - b.chapterNo);

  const getHalfBookChapters = (half: '1st_half_book' | '2nd_half_book') => {
    const midIndex = Math.ceil(subjectChapters.length / 2);
    return half === '1st_half_book' 
      ? subjectChapters.slice(0, midIndex) 
      : subjectChapters.slice(midIndex);
  };

  const getChapterRangeText = (half: '1st_half_book' | '2nd_half_book') => {
    if (subjectChapters.length === 0) return '';
    const midIndex = Math.ceil(subjectChapters.length / 2);
    
    if (half === '1st_half_book') {
      return `Ch. ${subjectChapters[0]?.chapterNo} - ${subjectChapters[midIndex - 1]?.chapterNo}`;
    } else {
      return `Ch. ${subjectChapters[midIndex]?.chapterNo} - ${subjectChapters[subjectChapters.length - 1]?.chapterNo}`;
    }
  };

  useEffect(() => {
    if (watchedChapterOption === 'custom') {
      setTimeout(() => {
        chaptersListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [watchedChapterOption]);

  const handleOptionSelect = (optionValue: string) => {
    setValue('chapterOption', optionValue);
    
    if (optionValue === 'custom') {
      setValue('selectedChapters', []);
      return;
    }

    const selections = {
      full_book: subjectChapters.map(ch => ch.id),
      '1st_half_book': getHalfBookChapters('1st_half_book').map(ch => ch.id),
      '2nd_half_book': getHalfBookChapters('2nd_half_book').map(ch => ch.id),
    };

    setValue('selectedChapters', selections[optionValue as keyof typeof selections]);
    setTimeout(() => setStep(4), 500); // Slight delay for visual feedback
  };

  const options = [
    { value: '1st_half_book', icon: <Layers className="text-primary" />, title: '1st Half', range: getChapterRangeText('1st_half_book') },
    { value: '2nd_half_book', icon: <Layers className="text-success" />, title: '2nd Half', range: getChapterRangeText('2nd_half_book') },
    { value: 'custom', icon: <LayoutGrid className="text-warning" />, title: 'Custom Selection', range: 'Choose manually' },
    { value: 'full_book', icon: <BookOpen className="text-info" />, title: 'Full Book', range: `${subjectChapters.length} Chapters` },
  ];

  return (
    <div className="container-fluid px-0">
      <div className="text-center mb-5">
        <h3 className="fw-bold text-dark mb-2">Scope of Examination</h3>
        <p className="text-muted small text-uppercase ls-wide">
          Select coverage for <span className="text-primary fw-bold">{subjects.find(s => s.id === watchedSubjectId)?.name}</span>
        </p>
      </div>

      <div className="row g-3 g-md-4 mb-5">
        {options.map((opt) => (
          <div key={opt.value} className="col-6 col-md-3">
            <div
              onClick={() => handleOptionSelect(opt.value)}
              className={`h-100 rounded-4 p-4 text-center transition-all cursor-pointer border-2 border ${
                watchedChapterOption === opt.value 
                ? 'border-primary bg-white shadow-lg scale-up' 
                : 'border-light bg-light opacity-hover'
              }`}
              style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              <div className="mb-3 d-inline-flex p-3 rounded-circle bg-white shadow-sm">
                {opt.icon}
              </div>
              <h6 className="fw-bold mb-1">{opt.title}</h6>
              <span className="badge bg-light text-muted border rounded-pill">{opt.range}</span>
              
              {watchedChapterOption === opt.value && (
                <div className="mt-2 text-primary">
                  <CheckCircle2 size={18} className="mx-auto" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div ref={chaptersListRef}>
        {watchedChapterOption === 'custom' && (
          <div className="animate-in mt-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="fw-bold mb-0">Select Specific Chapters</h5>
              <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill">
                {watch('selectedChapters')?.length || 0} Selected
              </span>
            </div>

            <div className="row g-2 g-md-3">
              {subjectChapters.map((chapter) => {
                const isSelected = watch('selectedChapters')?.includes(chapter.id);
                return (
                  <div key={chapter.id} className="col-6 col-md-4 col-lg-3">
                    <div
                      onClick={() => handleChapterSelection(chapter.id)}
                      className={`p-3 rounded-3 border transition-all cursor-pointer h-100 d-flex align-items-center ${
                        isSelected 
                        ? 'border-primary bg-primary text-white shadow-sm' 
                        : 'border-secondary-subtle bg-white hover-light'
                      }`}
                    >
                      <div className={`me-2 rounded-circle d-flex align-items-center justify-content-center ${isSelected ? 'bg-white text-primary' : 'bg-light text-muted'}`} style={{width: '24px', height: '24px', fontSize: '12px'}}>
                        {chapter.chapterNo}
                      </div>
                      <span className="small fw-medium text-truncate">{chapter.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-5 pb-4">
              <button
                className="btn btn-primary btn-lg rounded-pill px-5 shadow-sm d-inline-flex align-items-center gap-2"
                onClick={() => setStep(4)}
                disabled={!watch('selectedChapters')?.length}
              >
                Confirm Chapters <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .cursor-pointer { cursor: pointer; }
        .scale-up { transform: translateY(-5px); }
        .opacity-hover:hover { background-color: #f8f9fa !important; border-color: #dee2e6 !important; }
        .ls-wide { letter-spacing: 0.05em; }
        .animate-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};