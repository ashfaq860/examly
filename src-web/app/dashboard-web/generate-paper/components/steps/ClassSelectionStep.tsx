'use client';

import React from 'react';
import { Class } from '@/types/types';
import { GraduationCap, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface ClassSelectionStepProps {
  classes: Class[];
  watchedClassId: string;
  setValue: (field: string, value: any) => void;
  errors: any;
}

export const ClassSelectionStep: React.FC<ClassSelectionStepProps> = ({
  classes,
  watchedClassId,
  setValue,
  errors
}) => {
  const getClassTheme = (index: number) => {
    const themes = [
      { color: '#6366f1', bg: '#f5f3ff' },
      { color: '#0ea5e9', bg: '#f0f9ff' },
      { color: '#8b5cf6', bg: '#f5f3ff' },
      { color: '#ec4899', bg: '#fdf2f8' },
      { color: '#f59e0b', bg: '#fffbeb' },
      { color: '#10b981', bg: '#ecfdf5' },
    ];
    return themes[index % themes.length];
  };

  return (
    <div className="w-100 py-2 animate-fade-in">
      {/* Header Section */}
      <div className="text-center mb-5">
        <div className="d-inline-flex align-items-center justify-content-center p-2 mb-3 rounded-pill bg-primary bg-opacity-10 text-primary fw-bold small px-3">
          <Sparkles size={16} className="me-2" />
          Step 1: Academic Level
        </div>
        <h2 className="display-5 fw-bold text-dark mb-2">Select Your <span className="text-gradient">Class</span></h2>
        <p className="text-muted mx-auto fs-6" style={{ maxWidth: '500px' }}>
          Pick your grade level to unlock personalized question banks and smart paper generation.
        </p>
      </div>

      {/* Grid Section */}
      <div className="row g-4 justify-content-center">
        {classes.length === 0 ? (
          // Premium Loading State (Skeletons)
          [1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="col-6 col-md-4 col-lg-3">
              <div className="skeleton-card-container">
                <div className="skeleton-orb" />
                <div className="skeleton-text short" />
                <div className="skeleton-text long" />
              </div>
            </div>
          ))
        ) : (
          // Actual Data State
          classes.map((cls, index) => {
            const isActive = watchedClassId === cls.id;
            const theme = getClassTheme(index);
            
            return (
              <div key={cls.id} className="col-6 col-md-4 col-lg-3">
                <div
                  onClick={() => setValue("classId", cls.id)}
                  className={`class-card ${isActive ? 'active' : ''}`}
                  style={{ 
                    '--theme-color': theme.color,
                    '--theme-bg': theme.bg 
                  } as React.CSSProperties}
                >
                  <div className="glow-effect"></div>
                  <div className="card-content-wrapper">
                    <div className={`icon-orb ${isActive ? 'active' : ''}`}>
                      <GraduationCap size={32} strokeWidth={1.5} />
                    </div>
                    
                    <div className="mt-4">
                      <h4 className="class-number mb-0">Class</h4>
                      <h2 className={`display-6 fw-black mb-0 ${isActive ? 'text-white' : 'text-dark'}`}>
                        {cls.name}
                      </h2>
                    </div>

                    <div className={`selection-pill mt-3 ${isActive ? 'visible' : ''}`}>
                      <CheckCircle2 size={14} className="me-1" /> Selected
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Error Message */}
      {errors.classId && (
        <div className="mt-5 d-flex justify-content-center">
          <div className="error-badge-premium">
            <AlertCircle size={20} className="me-2" />
            <span>{errors.classId.message}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .text-gradient {
          background: linear-gradient(135deg, #0d6efd 0%, #6610f2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* Loading Skeletons */
        .skeleton-card-container {
          background: #ffffff;
          border-radius: 28px;
          padding: 2.5rem 1.5rem;
          border: 1px solid #f1f5f9;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
        }

        .skeleton-orb {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: #f1f5f9;
          position: relative;
          overflow: hidden;
        }

        .skeleton-text {
          height: 15px;
          background: #f1f5f9;
          border-radius: 4px;
          margin-top: 20px;
          position: relative;
          overflow: hidden;
        }

        .skeleton-text.short { width: 40%; }
        .skeleton-text.long { width: 70%; height: 25px; margin-top: 10px; }

        .skeleton-orb::after, .skeleton-text::after {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }

        /* Class Cards */
        .class-card {
          position: relative;
          background: #ffffff;
          border-radius: 28px;
          padding: 2.5rem 1.5rem;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          border: 1px solid #f0f0f0;
          overflow: hidden;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);
        }

        .class-card:hover {
          transform: translateY(-10px);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
          border-color: var(--theme-color);
        }

        .class-card.active {
          background: var(--theme-color);
          border-color: var(--theme-color);
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.2);
        }

        .icon-orb {
          width: 80px;
          height: 80px;
          background: var(--theme-bg);
          color: var(--theme-color);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .class-card.active .icon-orb {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          transform: scale(1.1);
        }

        .class-number {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 2px;
          font-weight: 800;
          color: #94a3b8;
        }

        .class-card.active .class-number { color: rgba(255,255,255,0.7); }
        .fw-black { font-weight: 900; }

        .selection-pill {
          background: rgba(255,255,255,0.2);
          color: white;
          padding: 4px 12px;
          border-radius: 100px;
          font-size: 0.75rem;
          font-weight: 600;
          opacity: 0;
          transition: 0.3s;
        }

        .selection-pill.visible { opacity: 1; }

        .error-badge-premium {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
          padding: 12px 28px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          animation: slideUp 0.4s ease-out;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fadeIn 0.6s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};