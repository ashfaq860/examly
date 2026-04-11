//generate-paper/components/steps/ClassSelectionStep.tsx
'use client';
import React from 'react';
import { UseFormSetValue } from 'react-hook-form';
import Loading from '../../loading'; 

// Updated interface to match public.classes table
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

  // Add this line to sort classes naturally (1, 2, 10 instead of 1, 10, 2)
  const sortedClasses = React.useMemo(() => {
    return [...classes].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [classes]);
  return (
    <div className="container py-4">
      <div className="text-center mb-5 animate-slide-down">
        <h2 className="fw-black text-dark mb-1 tracking-tight">Select Your Class</h2>
        <div className="mx-auto bg-primary rounded-pill mb-3" style={{ width: '40px', height: '4px' }}></div>
        <p className="text-secondary opacity-75">Choose the target grade level to begin generating your paper</p>
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
                  className={`card h-100 selection-card ${
                    isActive ? "active-card shadow-lg" : "shadow-sm"
                  }`}
                >
                  <div className="card-body d-flex flex-column align-items-center text-center p-4">
                    <div className={`icon-wrapper mb-3 ${isActive ? "bg-primary text-white shadow-primary" : "bg-light text-primary"}`}>
                       <span className="fs-3">🎓</span>
                    </div>
                    
                    <h5 className="fw-bold mb-1 card-title-text">Class {cls.name}</h5>
                    <p className="small text-muted mb-0 opacity-50">
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
        /* Keep your existing premium CSS here - it remains compatible */
        .perspective-stage { perspective: 1200px; }
        .selection-card {
          cursor: pointer;
          border-radius: 24px;
          border: 1px solid rgba(0,0,0,0.05);
          background: #ffffff;
          transform-style: preserve-3d;
          transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.5s ease;
        }
        .selection-card:hover {
          transform: rotateX(12deg) rotateY(-8deg) translateY(-10px) translateZ(20px);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15) !important;
        }
        .active-card {
          border: 2px solid #0d6efd !important;
          background: linear-gradient(145deg, #ffffff 0%, #f0f7ff 100%);
        }

        .icon-wrapper {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.4s ease, background 0.3s ease;
          transform-style: preserve-3d;
        }

        .shadow-primary {
          box-shadow: 0 8px 15px rgba(13, 110, 253, 0.2);
        }

        /* 5. Animations */
        .animate-staggered {
          opacity: 0;
          animation: fadeInUp 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          animation-delay: var(--delay);
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(40px) rotateX(-20deg); }
          to { opacity: 1; transform: translateY(0) rotateX(0); }
        }

        .selection-indicator {
          position: absolute;
          top: 15px;
          right: 15px;
          color: #0d6efd;
          font-size: 1.3rem;
          opacity: 0;
          transform: scale(0) translateZ(50px);
          transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .selection-indicator.visible {
          opacity: 1;
          transform: scale(1) translateZ(50px);
        }

        .animate-slide-down {
          animation: slideDown 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};