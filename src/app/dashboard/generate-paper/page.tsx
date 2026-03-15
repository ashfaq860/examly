//dashboard/generate-paper/page.tsx
'use client';
import React from 'react';
import AcademyLayout from '@/components/AcademyLayout';
import { ArrowLeft, Rocket, ShieldAlert, Loader2 } from 'lucide-react';

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
    isLoadingPreview,
    isDownloadingKey,
    previewQuestions,
    loadPreviewQuestions,
    trialStatus,
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

  // 1. Loading State
  if (!authChecked || trialLoading) {
    return (
      <AcademyLayout>
        <div className="container-fluid">
       {<Loading />}
        </div>
      </AcademyLayout>
    );
  }

  // 2. Auth Error State
  if (!isAuthenticated && authError) {
    return (
      <AcademyLayout>
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
      </AcademyLayout>
    );
  }

  return (
    <AcademyLayout>
      {/* PREMIUM RESPONSIVE BACK BUTTON 
        We use CSS variables and media queries to adjust 'left' position 
        based on the presence of a sidebar on desktop vs mobile.
      */}
      {step > 1 && (
        <>
         <style jsx>{`
              .fixed-back-btn {
                position: fixed;
                top: 8rem; /* ~85px but scalable with font size */
                left: 5%;   /* small offset from left on mobile */
                z-index: 1200;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
              }

              @media (min-width: 992px) {
                .fixed-back-btn {
                  left: calc(280px + 2%); /* sidebar width + small margin */
                  top: 5rem; /* same as mobile */
                }
              }
            `}
          </style>
          
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

      <div className="container-fluid px-2 px-md-4">
        <div
          className="position-relative"
          style={{
            opacity: canGeneratePaper() && isAuthenticated ? 1 : 0.6,
            pointerEvents: canGeneratePaper() && isAuthenticated ? 'auto' : 'none',
            // Provide padding so content doesn't collide with the fixed button on mobile
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
              />
            )}

            {step === 3 && (
              <ChapterSelectionStep
                chapters={chapters}
                watchedSubjectId={watchedSubjectId}
                watchedChapterOption={watchedChapterOption}
                selectedChapters={watch('selectedChapters') || []}
                subjects={subjects}
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
    </AcademyLayout>
  );
};

export default GeneratePaperPage;