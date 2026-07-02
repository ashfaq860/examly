'use client';
import React from 'react';
import { ArrowLeft, Rocket, ShieldAlert } from 'lucide-react';

// step components
import { ClassSelectionStep } from './components/steps/ClassSelectionStep';
import { SubjectSelectionStep } from './components/steps/SubjectSelectionStep';
import { ChapterSelectionStep } from './components/steps/ChapterSelectionStep';
import { PaperBuilderApp } from './components/PaperBuilderApp';
import Loading from '@/app/dashboard/generate-paper/loading';
// custom hook containing business logic
import { useGeneratePaper } from './hooks/useGeneratePaper';

const GeneratePaperPage = () => {
  const {
    step,
    classes,
    subjects,
    chapters,
    watchedClassId,
    watchedSubjectId,
    watchedChapterOption,
    setSelectedQuestions,
    setPreviewQuestions,
    isLoading,
    isSubjectsLoading,
    isLoadingPreview,
    isDownloadingKey,
    previewQuestions,
    loadPreviewQuestions,
    trialStatus,         // Used below to guard the loader
    subjectRules,
    ruleValidation,
    setRuleValidation,
    validateFormAgainstRules,
    getChapterIdsToUse,
    canGeneratePaper,
    prevStep,
    handleChapterSelection,
    watch,
    setValue,
    register,
    errors,
    getValues,
    trigger,
    getQuestionTypes,
    isAuthenticated,
    authChecked,
    authError,
    trialLoading,
    setStep,
  } = useGeneratePaper();

  // 1. DEFENSIVE LOADING STATE 
  // Only intercept with a full loader if we don't have auth data yet, 
  // OR if trial data is loading and we don't already have an existing trialStatus cache.
  const isInitialLoading = !authChecked || (trialLoading && !trialStatus);

  if (isInitialLoading) {
    return (
      <div className="container-fluid">
        <Loading />
      </div>
    );
  }

  // 2. Auth Error State
  if (!isAuthenticated && authError) {
    return (
      <div className="container py-5">
        <div className="card border-0 shadow-sm mx-auto" style={{ maxWidth: '500px' }}>
          <div className="card-body text-center p-5">
            <ShieldAlert className="text-danger mb-3" size={64} />
            <h4 className="fw-bold">Access Denied</h4>
            <p className="text-muted mb-4">{authError}</p>
            <button
              className="btn btn-primary w-100 py-2 fw-bold"
              onClick={() => (window.location.href = '/auth/login')}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* PREMIUM RESPONSIVE BACK BUTTON */}
      {step > 1 && (
        <>
          <style jsx>{`
            .fixed-back-btn {
              position: fixed;
              top: 8rem;
              left: 5%;
              z-index: 1200;
              transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }

            @media (min-width: 992px) {
              .fixed-back-btn {
                left: calc(280px + 2%);
                top: 5rem;
              }
            }
          `}</style>
          
          <div className="fixed-back-btn">
            <button
              onClick={prevStep}
              className="btn border-0 d-flex align-items-center justify-content-center shadow-lg bg-white text-primary"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: '1px solid #eef2f7',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <ArrowLeft size={24} strokeWidth={2.5} />
            </button>
          </div>
        </>
      )}

      <div className="container-fluid px-0 px-lg-4">

        {/* ── Step Progress Indicator ── */}
        <style jsx>{`
          .step-bar {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0px 0 0px;
          }
          .step-node {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            border-radius: 999px;
            font-size: 0.82rem;
            font-weight: 600;
            border: 2px solid #e9ecef;
            background: #f8f9fa;
            color: #9ca3af;
            transition: all 0.3s ease;
            white-space: nowrap;
          }
          .step-node.step-done {
            background: #ecfdf5;
            border-color: #86efac;
            color: #16a34a;
          }
          .step-node.step-active {
            background: #0d6efd;
            border-color: #0d6efd;
            color: #fff;
            box-shadow: 0 4px 14px rgba(13, 110, 253, 0.3);
          }
          .step-bubble {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            background: #e9ecef;
          }
          .step-node.step-done .step-bubble {
            background: rgba(22, 163, 74, 0.12);
          }
          .step-node.step-active .step-bubble {
            background: rgba(255, 255, 255, 0.2);
          }
          .step-line {
            width: 32px;
            height: 2px;
            background: #e9ecef;
            border-radius: 2px;
            margin: 0 2px;
            flex-shrink: 0;
            transition: background 0.3s ease;
          }
          .step-line.step-done { background: #86efac; }
          .step-lbl { display: none; }
          @media (min-width: 480px) { .step-lbl { display: inline; } }
        `}</style>
        {step < 4 && <div className="step-bar">
          {[
            { n: 1, label: 'Class', emoji: '🎓' },
            { n: 2, label: 'Subject', emoji: '📚' },
            { n: 3, label: 'Chapters', emoji: '📋' },
            { n: 4, label: 'Build Paper', emoji: '📄' },
          ].map((s, i) => {
            const done = step > s.n;
            const active = step === s.n;
            return (
              <React.Fragment key={s.n}>
                <div className={`step-node${done ? ' step-done' : active ? ' step-active' : ''}`}>
                  <div className="step-bubble">{done ? '✓' : s.emoji}</div>
                  <span className="step-lbl">{s.label}</span>
                </div>
                {i < 3 && <div className={`step-line${done ? ' step-done' : ''}`} />}
              </React.Fragment>
            );
          })}
        </div>}

        <div
          className="position-relative"
          style={{
            opacity: canGeneratePaper() && isAuthenticated ? 1 : 0.6,
            pointerEvents: canGeneratePaper() && isAuthenticated ? 'auto' : 'none',
            paddingTop: step > 1 ? '0px' : '0' 
          }}
        >
          {/* Rule validation warnings */}
          {ruleValidation.warnings.length > 0 && step >= 4 && (
            <div className="alert alert-warning border-0 shadow-sm alert-dismissible fade show mb-4" role="alert">
              <div className="d-flex">
                <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
                <div className="small">
                  <strong className="d-block mb-1">Chapter Rule Warnings:</strong>
                  <ul className="mb-0 ps-3">
                    {ruleValidation.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setRuleValidation({ isValid: true, missing: {}, warnings: [] })}
              />
            </div>
          )}

          {/* Render Step Components with responsive container */}
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 mx-auto" style={{ maxWidth: '1200px' }}>
            {step === 1 && (
              <ClassSelectionStep
                classes={classes}
                watchedClassId={watchedClassId}
                setValue={setValue}
                errors={errors}
              />
            )}

            {step === 2 && (
              <SubjectSelectionStep
                subjects={subjects}
                watchedSubjectId={watchedSubjectId}
                watchedClassId={watchedClassId}
                classes={classes}
                setValue={setValue}
                errors={errors}
                isLoading={isSubjectsLoading}
              />
            )}

            {step === 3 && (
              <ChapterSelectionStep
                chapters={chapters}
                watchedSubjectId={watchedSubjectId}
                watchedChapterOption={watchedChapterOption}
                selectedChapters={watch('selectedChapters') || []}
                subjects={subjects}
                classes={classes}
                watchedClassId={watchedClassId}
                setValue={setValue}
                setStep={setStep}
                watch={watch}
                handleChapterSelection={handleChapterSelection}
              />
            )}

            {step === 4 && (
              <PaperBuilderApp
                watch={watch}
                setValue={setValue}
                register={register}
                errors={errors}
                getValues={getValues}
                trigger={trigger}
                getQuestionTypes={getQuestionTypes}
                subjects={subjects}
                classes={classes}
                chapters={chapters}
                watchedClassId={watchedClassId}
                watchedSubjectId={watchedSubjectId}
                watchedChapterOption={watchedChapterOption}
                selectedChapters={watch('selectedChapters') || []}
                setStep={setStep}
                setSelectedQuestions={setSelectedQuestions}
                setPreviewQuestions={setPreviewQuestions}
                isLoading={isLoading}
                isLoadingPreview={isLoadingPreview}
                isDownloadingKey={isDownloadingKey}
                previewQuestions={previewQuestions}
                loadPreviewQuestions={loadPreviewQuestions}
                trialStatus={trialStatus}
                subjectRules={subjectRules}
                validateFormAgainstRules={validateFormAgainstRules}
                getChapterIdsToUse={getChapterIdsToUse}
              />
            )}
          </div>
        </div>

        {/* Upgrade Call to Action - Responsive Card */}
        {!canGeneratePaper() && trialStatus && isAuthenticated && (
          <div className="card mt-5 border-0 shadow-lg overflow-hidden mx-auto" style={{ borderRadius: '24px', maxWidth: '800px' }}>
            <div className="card-body text-center py-5 px-4" style={{ background: 'linear-gradient(to bottom, #ffffff, #f8f9ff)' }}>
              <div className="bg-primary bg-opacity-10 d-inline-flex p-4 rounded-circle mb-4">
                <Rocket className="text-primary" size={32} />
              </div>
              <h2 className="fw-bold h4 h2-md">Experience the Full Version</h2>
              <p className="text-muted mb-4 mx-auto small fs-md-5">
                {trialStatus.isTrial ? 'Trial expired.' : 'Subscription inactive.'} Unlock unlimited, high-quality exam papers instantly.
              </p>
              <button
                className="btn btn-primary btn-lg px-5 py-3 fw-bold rounded-pill w-100 w-md-auto transition-all"
                onClick={() => (window.location.href = '/dashboard/packages')}
              >
                View Packages
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default GeneratePaperPage;