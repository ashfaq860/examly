'use client';
import React from 'react';
import { Subject } from '@/types/types';

interface SubjectSelectionStepProps {
  subjects: Subject[];
  watchedSubjectId: string;
  watchedClassId: string;
  classes: any[];
  setValue: (field: string, value: any) => void;
  errors: any;
}

export const SubjectSelectionStep: React.FC<SubjectSelectionStepProps> = ({
  subjects,
  watchedSubjectId,
  watchedClassId,
  classes,
  setValue,
  errors
}) => {
  const getSubjectIcon = (subjectName: string) => {
    const name = subjectName.toLowerCase();
    if (name.includes('computer') || name.includes('it')) return '💻';
    else if (name.includes('math')) return '📊';
    else if (name.includes('physics')) return '⚛️';
    else if (name.includes('chemistry')) return '🧪';
    else if (name.includes('biology')) return '🧬';
    else if (name.includes('english')) return '📖';
    else if (name.includes('urdu')) return '📜';
    else if (name.includes('islamiyat')) return '☪️';
    else if (name.includes('pakistan')) return '🇵🇰';
    else return '📘';
  };

  return (
    <div className="step-card step-transition">
      <div className="text-center mb-3">
        <h5 className="fw-bold mb-3">📚 Select Subject</h5>
        <p className="text-muted d-none d-sm-inline">Choose the subject for your paper</p>
      </div>
      
      {watchedClassId && subjects.length === 0 ? (
        <div className="loading-state text-center py-5">
          <div className="spinner-border text-primary mb-3" role="status" style={{width: '3rem', height: '3rem'}}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="fs-5 text-muted">Loading subjects for Class {classes.find(c => c.id === watchedClassId)?.name}...</p>
        </div>
      ) : (
        <div className="row row-cols-2 row-cols-md-4 g-4">
          {subjects.map((subject) => {
            const subjectIcon = getSubjectIcon(subject.name);

            return (
              <div key={subject.id} className="col px-1">
                <div
                  className={`option-card card h-10 text-center p-0 cursor-pointer ${
                    watchedSubjectId === subject.id ? "active border-primary" : "border-light"
                  }`}
                  onClick={() => setValue("subjectId", subject.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="card-body d-flex flex-column justify-content-center p-2">
                    <span className="display-6 mb-3">{subjectIcon}</span>
                    <h6 className="fw-semibold mb-2">{subject.name}</h6>
                    <small className="text-muted d-none d-sm-inline">Click to select</small>
                    
                    {watchedSubjectId === subject.id && (
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
            );
          })}
        </div>
      )}
      {errors.subjectId && (
        <div className="alert alert-danger mt-3" role="alert">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {errors.subjectId.message}
        </div>
      )}
    </div>
  );
};