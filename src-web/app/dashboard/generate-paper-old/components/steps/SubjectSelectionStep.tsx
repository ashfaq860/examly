'use client';
import React from 'react';
import { Subject } from '@/types/types';
import { UseFormSetValue } from 'react-hook-form';

interface SubjectSelectionStepProps {
  subjects: Subject[];
  watchedSubjectId: string;
  watchedClassId: string;
  classes: any[];
  setValue: UseFormSetValue<any>;
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
    if (name.includes('computer')) return '💻';
    if (name.includes('math')) return '📊';
    if (name.includes('physics')) return '⚛️';
    if (name.includes('chemistry')) return '🧪';
    if (name.includes('english')) return '📖';
    return '📘';
  };

  const selectedClassName = classes.find(c => c.id === watchedClassId)?.name;

  return (
    <div className="container py-4">
      <div className="text-center mb-5 animate-premium-fade">
        <h2 className="fw-bold text-dark mb-1 tracking-tight">Select Subject</h2>
        <p className="text-muted">Class {selectedClassName} Curriculum</p>
      </div>
      
      <div className="row g-4 justify-content-center perspective-stage">
        {subjects.map((subject, index) => {
          const isActive = watchedSubjectId === subject.id;
          const subjectIcon = getSubjectIcon(subject.name);

          return (
            <div 
              key={subject.id} 
              className="col-6 col-md-4 col-lg-3 flip-container"
              style={{ '--delay': `${index * 0.08}s` } as React.CSSProperties}
            >
              <div 
                className={`flip-card-inner ${isActive ? 'is-active' : ''}`}
                onClick={() => setValue("subjectId", subject.id)}
              >
                {/* FRONT SIDE */}
                <div className="flip-card-front card shadow-sm border-light-subtle">
                  <div className="card-body d-flex flex-column align-items-center justify-content-center">
                    <span className="display-4 mb-3">{subjectIcon}</span>
                    <h6 className="fw-bold text-dark mb-0">{subject.name}</h6>
                  </div>
                </div>

                {/* BACK SIDE (The "Over" State) */}
                <div className="flip-card-back card shadow-lg bg-primary text-white">
                  <div className="card-body d-flex flex-column align-items-center justify-content-center">
                    <i className="bi bi-check2-circle display-4 mb-2"></i>
                    <h6 className="fw-bold">Select {subject.name}</h6>
                    <small className="opacity-75">Click to confirm</small>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .perspective-stage {
          perspective: 1500px;
          -webkit-perspective: 1500px;
        }

        .flip-container {
          height: 180px;
          opacity: 0;
          animation: slideUp 0.6s ease-out forwards;
          animation-delay: var(--delay);
        }

        .flip-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          cursor: pointer;
          transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
          transform-style: preserve-3d;
          -webkit-transform-style: preserve-3d;
        }

        /* Hover & Active Rotation */
        .flip-container:hover .flip-card-inner,
        .flip-card-inner.is-active {
          transform: rotateY(180deg) translateX(-10px); /* The Slider Slide + Flip */
        }

        .flip-card-front, .flip-card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid transparent;
        }

        .flip-card-back {
          transform: rotateY(180deg);
          border-color: #0d6efd;
        }

        .flip-card-front {
          background: #ffffff;
          border-color: rgba(0,0,0,0.05);
        }

        .is-active .flip-card-back {
          background: linear-gradient(135deg, #0d6efd, #0a58ca);
          box-shadow: 0 10px 30px rgba(13, 110, 253, 0.3);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-premium-fade {
          animation: fadeIn 0.8s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};