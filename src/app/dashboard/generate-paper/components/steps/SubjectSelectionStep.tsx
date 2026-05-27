'use client';
import React from 'react';
import { UseFormSetValue } from 'react-hook-form';
import Loading from '@/app/dashboard/generate-paper/loading';

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

const getSubjectIcon = (subjectName: string): string => {
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

const SkeletonCard: React.FC = () => (
  <div className="col-6 col-md-4 col-lg-3">
    <div className="skeleton-card shadow-sm border-0">
      <div className="skeleton-icon mb-3" />
      <div className="skeleton-text" />
    </div>
  </div>
);

export const SubjectSelectionStep: React.FC<SubjectSelectionStepProps> = ({
  subjects,
  watchedSubjectId,
  watchedClassId,
  classes,
  setValue,
  errors,
  isLoading = false,
}) => {
   // ✅ Local "just mounted" guard — subjects haven't arrived yet
  const [hasWaited, setHasWaited] = React.useState(false);
  const [hasStartedLoading, setHasStartedLoading] = React.useState(false);

  React.useEffect(() => {
    // Give the fetch a moment before allowing empty state to show
    const timer = setTimeout(() => setHasWaited(true), 800);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (isLoading) {
      setHasStartedLoading(true);
    }
  }, [isLoading]);

  const showEmpty = hasStartedLoading && !isLoading && subjects.length === 0;
  const showLoading = isLoading || !hasWaited;

  const selectedClassName = classes.find((c) => c.id === watchedClassId)?.name;

  return (
    <div className="container py-4">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="text-center mb-5 animate-premium-fade">
        <h2 className="fw-black text-dark mb-1 tracking-tight">Select Subject</h2>
        <div
          className="mx-auto bg-primary rounded-pill mb-3"
          style={{ width: 40, height: 4 }}
        />
        <p className="text-secondary opacity-75">
          {showLoading
            ? 'Fetching curriculum…'
            : `Available subjects for Class ${selectedClassName ?? 'Selected'}`}
        </p>
      </div>

      {/* ─── Card Grid ───────────────────────────────────── */}
      <div className="row g-4 justify-content-center perspective-stage">
        {showLoading ? (
          <div className="col-12 d-flex justify-content-center py-5">
            <div style={{ maxWidth: 320, width: '100%' }}>
              <Loading message="Loading subjects..." />
            </div>
          </div>
        ) : showEmpty ? (
          <div className="col-12 text-center text-secondary py-5">
            <span className="fs-4">📭</span>
            <p className="mt-2">No subjects found for this class.</p>
          </div>
        ) : (
          subjects.map((subject, index) => {
            const isActive = watchedSubjectId === subject.id;

            return (
              <div
                key={subject.id}
                className="col-6 col-md-4 col-lg-3 flip-container"
                style={{ '--delay': `${index * 0.08}s` } as React.CSSProperties}
                onClick={() => setValue('subjectId', subject.id, { shouldValidate: true })}
                role="button"
                aria-pressed={isActive}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setValue('subjectId', subject.id, { shouldValidate: true });
                  }
                }}
              >
                <div className={`flip-card-inner${isActive ? ' is-active' : ''}`}>
                  {/* Front */}
                  <div className="flip-card-front card shadow-sm border-0">
                    <div className="card-body d-flex flex-column align-items-center justify-content-center p-4 front-content-wrapper">
                      <div className="icon-wrapper mb-3">
                        <span className="fs-1">{getSubjectIcon(subject.name)}</span>
                      </div>
                      <h6 className="fw-bold text-dark mb-1 text-center">{subject.name}</h6>
                      {subject.name_ur && (
                        <span className="urdu-text text-primary text-center">
                          {subject.name_ur}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Back */}
                  <div className="flip-card-back card shadow-lg text-white border-0">
                    <div className="card-body d-flex flex-column align-items-center justify-content-center">
                      <div className="check-ring mb-2">
                        <i className="bi bi-check-lg" />
                      </div>
                      <h6 className="fw-bold mb-0">Selected</h6>
                      <small className="opacity-75">Subject Confirmed</small>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ─── Validation Error ────────────────────────────── */}
      {errors.subjectId && (
        <div className="mt-5 text-center animate-shake">
          <div className="d-inline-flex align-items-center gap-2 bg-danger-subtle text-danger px-4 py-2 rounded-pill border border-danger-subtle">
            <i className="bi bi-exclamation-circle-fill" />
            <span className="fw-semibold small">{errors.subjectId.message}</span>
          </div>
        </div>
      )}

      {/* ─── Scoped Styles ───────────────────────────────── */}
      <style jsx>{`
        /* NOTE: @font-face for JameelNoori MUST live in globals.css — not here.
           Add the following to app/globals.css (or styles/globals.css):

           @font-face {
             font-family: 'JameelNoori';
             src: url('/fonts/JameelNooriNastaleeqKasheeda.woff2') format('woff2'),
                  url('/fonts/JameelNooriNastaleeqKasheeda.ttf')   format('truetype');
             font-weight: normal;
             font-style: normal;
             font-display: swap;
           }

           And add this to app/layout.tsx <head>:
           <link
             rel="preload"
             href="/fonts/JameelNooriNastaleeqKasheeda.woff2"
             as="font"
             type="font/woff2"
             crossOrigin="anonymous"
           />
        */

        .urdu-text {
          font-family: 'JameelNoori', serif;
          font-size: 1.4rem;
          line-height: 1.4;
          display: block;
          margin-top: 4px;
        }

        /* ── Layout ── */
        .perspective-stage {
          perspective: 2000px;
        }

        .flip-container {
          height: 200px;
          opacity: 0;
          animation: slideUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          animation-delay: var(--delay);
          cursor: pointer;
        }

        /* ── Flip mechanics ── */
        .flip-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
          pointer-events: none;
        }

        .flip-container:hover .flip-card-inner,
        .flip-card-inner.is-active {
          transform: rotateY(180deg) scale(1.05);
        }

        .flip-card-front,
        .flip-card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          border-radius: 28px;
          pointer-events: auto;
        }

        /* ── Front ── */
        .flip-card-front {
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.04);
          z-index: 2;
        }

        .front-content-wrapper {
          width: 100%;
          height: 100%;
          transition: opacity 0.4s ease-in-out;
          opacity: 1;
        }

        .flip-container:hover .front-content-wrapper,
        .flip-card-inner.is-active .front-content-wrapper {
          opacity: 0.1;
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

        /* ── Back ── */
        .flip-card-back {
          transform: rotateY(180deg);
          background: linear-gradient(135deg, #0d6efd 0%, #0046af 100%);
        }

        .check-ring {
          width: 50px;
          height: 50px;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(4px);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        /* ── Skeleton ── */
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
          content: '';
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.6),
            transparent
          );
          animation: shimmer 1.8s infinite;
        }

        /* ── Keyframes ── */
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-shake {
          animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }

        @keyframes shake {
          10%,
          90% {
            transform: translate3d(-1px, 0, 0);
          }
          20%,
          80% {
            transform: translate3d(2px, 0, 0);
          }
          30%,
          50%,
          70% {
            transform: translate3d(-4px, 0, 0);
          }
          40%,
          60% {
            transform: translate3d(4px, 0, 0);
          }
        }
      `}</style>
    </div>
  );
};