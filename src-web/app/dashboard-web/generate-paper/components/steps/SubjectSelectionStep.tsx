'use client';

import React from 'react';
import { Subject } from '@/types/types';
import { 
  Book, Binary, Calculator, Atom, FlaskConical, 
  Dna, Languages, History, Globe2, Check, AlertCircle, Sparkles
} from 'lucide-react';

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
  
  const getSubjectTheme = (subjectName: string) => {
    const name = subjectName.toLowerCase();
    if (name.includes('computer')) return { icon: <Binary />, color: '#6366f1', bg: '#f5f3ff' };
    if (name.includes('math')) return { icon: <Calculator />, color: '#f59e0b', bg: '#fffbeb' };
    if (name.includes('physics')) return { icon: <Atom />, color: '#3b82f6', bg: '#eff6ff' };
    if (name.includes('chemistry')) return { icon: <FlaskConical />, color: '#10b981', bg: '#ecfdf5' };
    if (name.includes('biology')) return { icon: <Dna />, color: '#ec4899', bg: '#fdf2f8' };
    if (name.includes('english')) return { icon: <Languages />, color: '#8b5cf6', bg: '#f5f3ff' };
    if (name.includes('pakistan') || name.includes('geo')) return { icon: <Globe2 />, color: '#059669', bg: '#f0fdf4' };
    if (name.includes('islamiyat')) return { icon: <History />, color: '#0891b2', bg: '#ecfeff' };
    return { icon: <Book />, color: '#64748b', bg: '#f8fafc' };
  };

  const selectedClassName = classes.find(c => c.id === watchedClassId)?.name;

  return (
    <div className="w-100 py-2 animate-fade-in">
      <div className="text-center mb-5">
        <div className="d-inline-flex align-items-center justify-content-center p-2 mb-3 rounded-pill bg-primary bg-opacity-10 text-primary fw-bold small px-3">
          <Sparkles size={16} className="me-2" />
          Step 2: Course Content
        </div>
        <h2 className="display-6 fw-bold mb-2">
          <span className="text-primary-gradient">Explore</span> Subjects
        </h2>
        <p className="text-muted">
          Personalizing experience for <span className="fw-bold text-dark border-bottom border-primary border-2">Class {selectedClassName}</span>
        </p>
      </div>

      <div className="row g-4 justify-content-center">
        {subjects.length === 0 ? (
          // Skeleton Loading State
          [1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="col-6 col-md-4 col-lg-3">
              <div className="skeleton-subject-card">
                <div className="skeleton-icon-orb" />
                <div className="skeleton-line short" />
                <div className="skeleton-line tiny" />
              </div>
            </div>
          ))
        ) : (
          subjects.map((subject, index) => {
            const theme = getSubjectTheme(subject.name);
            const isActive = watchedSubjectId === subject.id;

            return (
              <div 
                key={subject.id} 
                className="col-6 col-md-4 col-lg-3 animate-slide-up"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                <div
                  className={`subject-card ${isActive ? 'active' : ''}`}
                  onClick={() => setValue("subjectId", subject.id)}
                  style={{ 
                      '--subject-color': theme.color,
                      '--subject-bg': theme.bg 
                  } as React.CSSProperties}
                >
                  <div className="card-accent"></div>
                  
                  <div className="icon-container">
                    {React.cloneElement(theme.icon as React.ReactElement, {
                      size: 32,
                      strokeWidth: 1.5,
                      className: 'subject-icon'
                    })}
                  </div>

                  <div className="text-center mt-3">
                    <h6 className="fw-bold mb-1 text-dark">{subject.name}</h6>
                    <div className="status-label">
                      {isActive ? (
                        <span className="active-text"><Check size={14} /> Selected</span>
                      ) : (
                        <span className="hover-text">Choose</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {errors.subjectId && (
        <div className="error-container-premium mt-5">
          <AlertCircle size={20} className="me-2" />
          <span>{errors.subjectId.message}</span>
        </div>
      )}

      <style jsx>{`
        .text-primary-gradient {
          background: linear-gradient(135deg, #0d6efd 0%, #6610f2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subject-card {
          position: relative;
          background: white;
          border-radius: 28px;
          padding: 2rem 1rem;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          border: 1px solid #f1f5f9;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          overflow: hidden;
        }

        .icon-container {
          width: 75px;
          height: 75px;
          border-radius: 22px;
          background: var(--subject-bg);
          color: var(--subject-color);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.4s ease;
        }

        .subject-card:hover {
          transform: translateY(-10px);
          border-color: var(--subject-color);
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.1);
        }

        .subject-card.active {
          border-color: var(--subject-color);
          background: #ffffff;
          box-shadow: 0 20px 40px -10px rgba(var(--subject-color), 0.2);
        }

        .subject-card.active .icon-container {
          background: var(--subject-color);
          color: white;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-5px) rotate(-2deg); }
        }

        .status-label {
          font-size: 0.75rem;
          font-weight: 700;
          height: 20px;
          color: #94a3b8;
        }

        .active-text { color: var(--subject-color); display: flex; align-items: center; gap: 4px; }

        /* Skeletons */
        .skeleton-subject-card {
          background: white;
          border-radius: 28px;
          padding: 2rem 1rem;
          border: 1px solid #f1f5f9;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .skeleton-icon-orb {
          width: 75px;
          height: 75px;
          border-radius: 22px;
          background: #f1f5f9;
          position: relative;
          overflow: hidden;
        }

        .skeleton-line {
          height: 12px;
          background: #f1f5f9;
          border-radius: 4px;
          margin-top: 15px;
          position: relative;
          overflow: hidden;
        }
        .skeleton-line.short { width: 60%; }
        .skeleton-line.tiny { width: 30%; height: 8px; margin-top: 8px; }

        .skeleton-icon-orb::after, .skeleton-line::after {
          content: "";
          position: absolute;
          top: 0; right: 0; bottom: 0; left: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer { 100% { transform: translateX(100%); } }

        /* Animations */
        .animate-slide-up {
          animation: slideUp 0.6s ease-out forwards;
          opacity: 0;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(25px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .error-container-premium {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
          padding: 14px 30px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          width: fit-content;
          margin: 0 auto;
          animation: slideUp 0.4s ease-out;
        }

        @media (max-width: 576px) {
          .subject-card { padding: 1.5rem 0.5rem; }
          .icon-container { width: 60px; height: 60px; }
        }
      `}</style>
    </div>
  );
};