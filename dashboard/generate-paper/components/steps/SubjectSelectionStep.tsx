'use client';
import React from 'react';
import { UseFormSetValue } from 'react-hook-form';
import Loading from '../../loading';

// Updated to match the optimized 'public.subjects' table
interface Subject {
  id: string;
  name: string;
  name_ur?: string; 
  description?: string;
}

interface SubjectSelectionStepProps {
  subjects: Subject[];
  watchedSubjectId: string;
  watchedClassId: string;
  classes: any[];
  setValue: UseFormSetValue<any>;
  errors: any;
  isLoading?: boolean;
}

export const SubjectSelectionStep: React.FC<SubjectSelectionStepProps> = ({
  subjects,
  watchedSubjectId,
  watchedClassId,
  classes,
  setValue,
  errors,
  isLoading = false,
}) => {
  
  const getSubjectIcon = (subjectName: string) => {
    const name = subjectName.toLowerCase();
    if (name.includes('computer')) return '💻';
    if (name.includes('math')) return '📊';
    if (name.includes('physics')) return '⚛️';
    if (name.includes('chemistry')) return '🧪';
    if (name.includes('english')) return '📖';
    if (name.includes('urdu')) return '🖊️';
    if (name.includes('islamiat')) return '🕌';
    if (name.includes('pakistan')) return '🇵🇰';
    if (name.includes('biology')) return '🧬';
    return '📘';
  };

  const selectedClassName = classes.find((c) => c.id === watchedClassId)?.name;

  const renderSkeletons = () => {
    return Array(4).fill(0).map((_, i) => (
      <div key={`skeleton-${i}`} className="col-6 col-md-4 col-lg-3">
        <div className="skeleton-card shadow-sm border-0">
          <div className="skeleton-icon mb-3"></div>
          <div className="skeleton-text"></div>
        </div>
      </div>
    ));
  };

  return (
    <div className="container py-4">
      {/* Font Face Declaration for Nastaleeq */}
      <style jsx global>{`
        @font-face {
          font-family: 'JameelNoori';
          src: url('/fonts/JameelNooriNastaleeqKasheeda.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
      `}</style>

      <div className="text-center mb-5 animate-premium-fade">
        <h2 className="fw-black text-dark mb-1 tracking-tight">Select Subject</h2>
        <div className="mx-auto bg-primary rounded-pill mb-3" style={{ width: '40px', height: '4px' }}></div>
        <p className="text-secondary opacity-75">
          {isLoading ? 'Fetching curriculum...' : `Available subjects for Class ${selectedClassName || 'Selected'}`}
        </p>
      </div>

      <div className="row g-4 justify-content-center perspective-stage">
        {isLoading ? (
          renderSkeletons()
        ) : subjects.length === 0 ? (
             <Loading /> 
          
        ) : (
          subjects.map((subject, index) => {
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
                  onClick={() => setValue('subjectId', subject.id, { shouldValidate: true })}
                >
                  {/* FRONT SIDE: Modern Glassmorphism Look */}
                  <div className="flip-card-front card shadow-sm border-0">
                    <div className="card-body d-flex flex-column align-items-center justify-content-center p-4">
                      <div className="icon-wrapper mb-3">
                        <span className="fs-1">{subjectIcon}</span>
                      </div>
                      <h6 className="fw-bold text-dark mb-1 text-center">{subject.name}</h6>
                      
                      {subject.name_ur && (
                        <span className="urdu-text text-primary text-center">
                          {subject.name_ur}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* BACK SIDE: Premium Brand Colors */}
                  <div className="flip-card-back card shadow-lg text-white border-0">
                    <div className="card-body d-flex flex-column align-items-center justify-content-center">
                      <div className="check-ring mb-2">
                        <i className="bi bi-check-lg"></i>
                      </div>
                      <h6 className="fw-bold mb-0">Confirm Selection</h6>
                      <small className="opacity-75">Click to proceed</small>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {errors.subjectId && (
        <div className="mt-5 text-center animate-shake">
          <div className="d-inline-flex align-items-center gap-2 bg-danger-subtle text-danger px-4 py-2 rounded-pill border border-danger-subtle">
            <i className="bi bi-exclamation-circle-fill"></i>
            <span className="fw-semibold small">{errors.subjectId.message}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .perspective-stage { perspective: 2000px; }
        
        .flip-container {
          height: 200px;
          opacity: 0;
          animation: slideUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          animation-delay: var(--delay);
        }

        .flip-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          cursor: pointer;
          transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
        }

        .flip-container:hover .flip-card-inner,
        .flip-card-inner.is-active {
          transform: rotateY(180deg) scale(1.05);
        }

        .flip-card-front, .flip-card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          border-radius: 28px;
        }

        .flip-card-front {
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.04);
        }

        .icon-wrapper {
          width: 70px;
          height: 70px;
          background: #f0f4ff;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s ease;
        }

        .urdu-text {
          font-family: 'JameelNoori', serif;
          font-size: 1.4rem;
          line-height: 1.4;
          display: block;
          margin-top: 4px;
        }

        .flip-card-back {
          transform: rotateY(180deg);
          background: linear-gradient(135deg, #0d6efd 0%, #0046af 100%);
        }

        .check-ring {
          width: 50px;
          height: 50px;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(4px);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          border: 1px solid rgba(255,255,255,0.3);
        }

        /* Skeleton Shimmer */
        .skeleton-card {
          height: 200px;
          background: #fdfdfd;
          border-radius: 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
        }

        .skeleton-icon {
          width: 70px;
          height: 70px;
          background: #f2f2f2;
          border-radius: 20px;
        }

        .skeleton-text {
          width: 50%;
          height: 14px;
          background: #f2f2f2;
          border-radius: 7px;
        }

        .skeleton-card::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
          animation: shimmer 1.8s infinite;
        }

        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }

        @keyframes shake {
          10, 90% { transform: translate3d(-1px, 0, 0); }
          20, 80% { transform: translate3d(2px, 0, 0); }
          30, 50, 70% { transform: translate3d(-4px, 0, 0); }
          40, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
};