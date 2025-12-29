'use client';
import React, { useRef } from 'react';
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

  return (
    <div className="step-transition py-3">
      <div className="text-center mb-3">
        <h5 className="fw-bold mb-3">📖 Chapter Coverage</h5>
        <p className="text-muted d-none d-sm-inline">Select how you want to cover chapters for {subjects.find(s => s.id === watchedSubjectId)?.name}</p>
      </div>

      <div className="row row-cols-1 row-cols-md-2 g-4 mb-4">
        {[
          { value: 'full_book', icon: '📖', title: 'Full Book', desc: 'Cover all chapters in the subject' },
          { value: 'half_book', icon: '📘', title: 'Half Book', desc: 'Cover first half of the chapters' },
          { value: 'single_chapter', icon: '📄', title: 'Single Chapter', desc: 'Select one specific chapter' },
          { value: 'custom', icon: '🎛️', title: 'Custom Selection', desc: 'Choose multiple chapters' }
        ].map((option) => (
          <div key={option.value} className="col">
            <div 
              className={`card h-100 cursor-pointer p-4 transition-all ${
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
              <div className="card-body text-center">
                <span className="display-6 mb-3">{option.icon}</span>
                <h5 className="card-title fw-bold">{option.title}</h5>
                <p className="card-text text-muted">{option.desc}</p>
                
                {watchedChapterOption === option.value && (
                  <div className="mt-3">
                    <span className="badge bg-primary rounded-pill">
                      <i className="bi bi-check-circle me-1"></i>
                      Selected
                    </span>
                  </div>
                )}
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
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading chapters...</span>
                </div>
                <p className="mt-2 text-muted">Loading chapters...</p>
              </div>
            ) : chapters.filter(chapter => chapter.subject_id === watchedSubjectId).length === 0 ? (
              <div className="alert alert-warning text-center">
                <i className="bi bi-exclamation-triangle me-2"></i>
                No chapters found for the selected subject.
              </div>
            ) : (
              <>
                <div className="row row-cols-2 row-cols-md-4 g-3">
                  {chapters
                    .filter(chapter => chapter.subject_id === watchedSubjectId)
                    .map(chapter => {
                      const selectedChapters = watch('selectedChapters') || [];
                      const isSelected = selectedChapters.includes(chapter.id);
                      
                      const handleClick = () => {
                        handleChapterSelection(chapter.id);
                        if (watchedChapterOption === 'single_chapter') {
                          setTimeout(() => setStep(4), 300);
                        }
                      };
                      
                      return (
                        <div key={chapter.id} className="col">
                          <div
                            className={`card h-100 cursor-pointer p-3 transition-all ${
                              isSelected ? 'border-primary bg-primary bg-opacity-10' : 'border-light'
                            }`}
                            onClick={handleClick}
                            style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                          >
                            <div className="card-body text-center">
                              <span className="display-6 mb-2">📖</span>
                              <h6 className="card-title">{chapter.chapterNo}. {chapter.name}</h6>
                              
                              {isSelected && (
                                <div className="mt-2">
                                  <span className="badge bg-success rounded-pill">
                                    <i className="bi bi-check me-1"></i>
                                    Selected
                                  </span>
                                </div>
                              )}
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
                      Continue to Paper Type <i className="bi bi-arrow-right ms-2"></i>
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