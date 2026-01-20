'use client';
import React, { useRef, useEffect } from 'react';
import { Chapter } from '@/types/types';

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

  // Scroll to chapters list when option changes to custom/single_chapter
  useEffect(() => {
    if (watchedChapterOption === 'custom' || watchedChapterOption === 'single_chapter') {
      setTimeout(() => {
        chaptersListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }, [watchedChapterOption]);

  return (
    <div className="step-transition py-3">
      <div className="text-center mb-3">
        <h5 className="fw-bold mb-3">📖 Chapter Coverage</h5>
        <p className="text-muted d-none d-sm-inline">
          Select how you want to cover chapters for {subjects.find(s => s.id === watchedSubjectId)?.name}
        </p>
      </div>

      <div className="row row-cols-2 row-cols-md-2 g-4 mb-4">
        {[
          { value: 'custom', icon: '🎛️', title: 'Chapter Wise', desc: 'Choose multiple chapters' },
          { value: 'single_chapter', icon: '📄', title: 'Single Chapter', desc: 'Select one specific chapter' },
          { value: 'full_book', icon: '📖', title: 'Full Book', desc: 'Cover all chapters in the subject' },
          { value: 'half_book', icon: '📘', title: 'Half Book', desc: 'Cover first half of the chapters' },
        ].map((option) => (
          <div key={option.value} className="col">
            <div
              className={`card h-100 p-0 transition-all border ${
                watchedChapterOption === option.value ? 'border-primary bg-primary bg-opacity-10 shadow' : 'border-light'
              }`}
              onClick={() => {
                setValue('chapterOption', option.value as any);
                if (option.value === 'full_book' || option.value === 'half_book') {
                  setValue('selectedChapters', []);
                  setTimeout(() => setStep(4), 300);
                }
                if (option.value === 'single_chapter') {
                  setValue('selectedChapters', []);
                }
              }}
              style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
            >
              <div className="card-body text-center p-0 py-2 border border-1 border-secondary rounded-2 position-relative">
                <span className="display-6 mb-3 d-block">{option.icon}</span>
                <h5 className="card-title fw-bold">{option.title}</h5>
                <p className="card-text text-muted d-none d-sm-inline">{option.desc}</p>

                {/* Badge with absolute positioning to prevent height jump */}
                <div style={{ minHeight: '1.5rem' }}>
                  {watchedChapterOption === option.value && (
                    <span className="badge bg-primary rounded-pill position-absolute top-0 end-0 mt-2 me-2">
                      <i className="bi bi-check-circle me-1"></i>
                      Selected
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div ref={chaptersListRef}>
        {(watchedChapterOption === 'custom' || watchedChapterOption === 'single_chapter') && (
          <div className="step-transition mt-5">
            <h6 className="fw-bold mb-4 text-center">
              {watchedChapterOption === 'single_chapter' ? 'Select Chapter' : 'Select Chapters'}
            </h6>

            {chapters.length === 0 ? (
              <div className="text-center py-0">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading chapters...</span>
                </div>
                <p className="mt-2 text-muted">Loading chapters...</p>
              </div>
            ) : chapters.filter(ch => ch.subject_id === watchedSubjectId).length === 0 ? (
              <div className="alert alert-warning text-center">
                <i className="bi bi-exclamation-triangle me-2"></i>
                No chapters found for the selected subject.
              </div>
            ) : (
              <>
                <div className="row row-cols-2 row-cols-md-4 g-3">
                  {chapters
                    .filter(ch => ch.subject_id === watchedSubjectId)
                    .map(chapter => {
                      const selectedChapters = watch('selectedChapters') || [];
                      const isSelected = selectedChapters.includes(chapter.id);

                      return (
                        <div key={chapter.id} className="col">
                          <div
                            className={`card h-100 p-2 transition-all border ${
                              isSelected ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary-subtle'
                            }`}
                            onClick={() => {
                              handleChapterSelection(chapter.id);
                              if (watchedChapterOption === 'single_chapter') {
                                setTimeout(() => setStep(4), 300);
                              }
                            }}
                            style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                          >
                            <div className="card-body text-center p-0">
                              <span className="display-6 mb-2 d-block">📖</span>
                              <h6 className="card-title">{chapter.chapterNo}. {chapter.name}</h6>

                              <div style={{ minHeight: '1.5rem' }}>
                                {isSelected && (
                                  <span className="badge bg-success rounded-pill">
                                    <i className="bi bi-check me-1"></i>
                                    Selected
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {watchedChapterOption === 'custom' && (
                  <div className="text-center mt-4">
                    <button
                      className="btn btn-primary px-4"
                      onClick={() => setStep(4)}
                      disabled={!watch('selectedChapters')?.length}
                    >
                      Continue <i className="bi bi-arrow-right ms-2"></i>
                    </button>
                    <div className="mt-2">
                      <small className="text-muted">
                        {watch('selectedChapters')?.length || 0} chapters selected
                      </small>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
