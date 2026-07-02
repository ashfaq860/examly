'use client';
import React from 'react';
import { UseFormSetValue } from 'react-hook-form';
import Loading from '../../loading'; 

interface Class {
  id: string;
  name: string;
  description?: string;
}

interface ClassSelectionStepProps {
  classes: Class[];
  watchedClassId: string;
  setValue: UseFormSetValue<any>;
  errors: any;
}

export const ClassSelectionStep: React.FC<ClassSelectionStepProps> = ({
  classes,
  watchedClassId,
  setValue,
  errors
}) => {

  const sortedClasses = React.useMemo(() => {
    return [...classes].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [classes]);

  return (
    <div className="container py-4">
      <div className="text-center mb-3 mb-md-5 animate-slide-down">
        <h2 className="fw-black text-dark mb-1 tracking-tight">Select Your Class</h2>
        <div className="mx-auto bg-primary rounded-pill mb-3" style={{ width: '40px', height: '4px' }}></div>
        <p className="text-secondary opacity-75 d-none d-md-block">Choose the target grade level to begin generating your paper</p>
      </div>
      
      {sortedClasses.length === 0 ? (
        <div className="text-center py-5 fade-in">
          <Loading />
        </div>
      ) : (
        <div className="row g-4 justify-content-center perspective-stage">
          {sortedClasses.map((cls, index) => {
            const isActive = watchedClassId === cls.id;
            return (
              <div 
                key={cls.id} 
                className="col-6 col-md-4 col-lg-3 animate-staggered"
                style={{ '--delay': `${index * 0.1}s` } as React.CSSProperties}
              >
                <div
                  onClick={() => setValue("classId", cls.id, { shouldValidate: true })}
                  className={`card h-100 selection-card border-0 ${
                    isActive ? "active-card shadow-lg" : "shadow-sm"
                  }`}
                >
                  <div className="card-body d-flex flex-column align-items-center text-center p-4">
                    <div className={`icon-wrapper mb-3 ${isActive ? "bg-primary text-white shadow-primary" : "bg-light text-primary"}`}>
                       <span className="fs-3">🎓</span>
                    </div>
                    
                    <h5 className="fw-bold mb-1 card-title-text">Class {cls.name}</h5>
                    <p className="small text-muted mb-0 opacity-75">
                        {cls.description || 'Academic Level'}
                    </p>
                    
                    <div className={`selection-indicator ${isActive ? 'visible' : ''}`}>
                        <i className="bi bi-check-circle-fill"></i>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {errors.classId && (
        <div className="mt-5 text-center shake">
          <div className="d-inline-flex align-items-center gap-2 bg-danger-subtle text-danger px-4 py-2 rounded-pill border border-danger-subtle">
            <span className="fw-semibold small">! {errors.classId.message}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .perspective-stage { 
          perspective: 1200px; 
        }

        .selection-card {
          cursor: pointer;
          border-radius: 24px;
          background: #ffffff;
          transform-style: preserve-3d;
          transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
          overflow: hidden; /* Prevents internal content or borders from triggering scrollbars */
          position: relative;
        }

        /* Default subtle border using shadow to prevent layout shift */
        .selection-card:not(.active-card) {
          box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 4px 6px -1px rgba(0,0,0,0.1);
        }

        .selection-card:hover {
          transform: rotateX(8deg) rotateY(-5deg) translateY(-10px);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15) !important;
        }

        .active-card {
          /* Using inset shadow instead of border to prevent the "vertical bar" scroll issue */
          box-shadow: inset 0 0 0 2px #0d6efd, 0 20px 25px -5px rgba(0, 0, 0, 0.1) !important;
          background: linear-gradient(145deg, #ffffff 0%, #f0f7ff 100%) !important;
        }

        .icon-wrapper {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.4s ease, background 0.3s ease;
        }

        .shadow-primary {
          box-shadow: 0 8px 15px rgba(13, 110, 253, 0.2);
        }

        .animate-staggered {
          opacity: 0;
          animation: fadeInUp 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          animation-delay: var(--delay);
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px) rotateX(-10deg); }
          to { opacity: 1; transform: translateY(0) rotateX(0); }
        }

        .selection-indicator {
          position: absolute;
          top: 15px;
          right: 15px;
          color: #0d6efd;
          font-size: 1.3rem;
          opacity: 0;
          transform: scale(0);
          transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          z-index: 10;
        }

        .selection-indicator.visible {
          opacity: 1;
          transform: scale(1);
        }

        .animate-slide-down {
          animation: slideDown 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }

        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
};