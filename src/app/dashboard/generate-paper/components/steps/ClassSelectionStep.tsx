//generate-paper/components/steps/ClassSelectionStep.tsx
'use client';
import React from 'react';
import { Class } from '@/types/types';
import { UseFormSetValue } from 'react-hook-form';
import Loading from '../../loading'; // for potential loading components or utilities
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
  return (
    <div className="container py-4">
      {/* Header Section */}
      <div className="text-center mb-5 animate-slide-down">
        <h2 className="fw-black text-dark mb-1 tracking-tight">Select Your Class</h2>
        <div className="mx-auto bg-primary rounded-pill mb-3" style={{ width: '40px', height: '4px' }}></div>
        <p className="text-secondary opacity-75">Choose the target grade level to begin generating your paper</p>
      </div>
      
      {classes.length === 0 ? (
        <div className="text-center py-5 fade-in">
        { <Loading /> }
      
        </div>
      ) : (
        <div className="row g-4 justify-content-center perspective-stage">
          {classes.map((cls, index) => {
            const isActive = watchedClassId === cls.id;
            return (
              <div 
                key={cls.id} 
                className="col-6 col-md-4 col-lg-3 animate-staggered"
                style={{ '--delay': `${index * 0.1}s` } as React.CSSProperties}
              >
                <div
                  onClick={() => setValue("classId", cls.id)}
                  className={`card h-100 selection-card ${
                    isActive ? "active-card shadow-lg" : "shadow-sm"
                  }`}
                >
                  <div className="card-body d-flex flex-column align-items-center text-center p-4">
                    {/* Icon with Z-axis lift */}
                    <div className={`icon-wrapper mb-3 ${isActive ? "bg-primary text-white shadow-primary" : "bg-light text-primary"}`}>
                       <span className="fs-3">🎓</span>
                    </div>
                    
                    <h5 className="fw-bold mb-1 card-title-text">Class {cls.name}</h5>
                    <p className="small text-muted mb-0 opacity-50">Academic Level</p>
                    
                    {/* Active Selection Indicator */}
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
        /* 1. The Perspective Stage */
        .perspective-stage {
          perspective: 1200px; /* Essential for 3D depth */
        }

        /* 2. Cubic Card Styling */
        .selection-card {
          cursor: pointer;
          border-radius: 24px;
          border: 1px solid rgba(0,0,0,0.05);
          background: #ffffff;
          transform-style: preserve-3d;
          transition: 
            transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1),
            box-shadow 0.5s ease,
            border-color 0.3s ease;
          position: relative;
        }

        /* 3. The Mouse-Over Cubic Tilt Effect */
        .selection-card:hover {
          /* Rotates forward and tilts slightly left */
          transform: rotateX(12deg) rotateY(-8deg) translateY(-10px) translateZ(20px);
          border-color: #0d6efd44;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15) !important;
        }

        /* Inner elements pop out more than the card itself */
        .selection-card:hover .icon-wrapper {
          transform: translateZ(40px);
          box-shadow: 0 10px 20px rgba(13, 110, 253, 0.2);
        }

        .selection-card:hover .card-title-text {
          transform: translateZ(30px);
        }

        .selection-card:active {
          transform: scale(0.95) rotateX(0) rotateY(0);
        }

        /* 4. Active & Visual states */
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