// components/steps/CustomPaperSettingsStep.tsx
import React, { useState } from 'react';
import { Subject } from '@/types/types';

interface CustomPaperSettingsStepProps {
  watch: any;
  setValue: (field: string, value: any) => void;
  register: any;
  errors: any;
  setStep: (step: number) => void;
  subjects: Subject[];
  getQuestionTypes: () => any[];
  getSubjectiveMaxForLayout: (layoutValue: string) => number;
  setPaperTypeStep: (step: number) => void;
}

export const CustomPaperSettingsStep: React.FC<CustomPaperSettingsStepProps> = ({
  watch,
  setValue,
  register,
  errors,
  setStep,
  subjects,
  getQuestionTypes,
  getSubjectiveMaxForLayout,
  setPaperTypeStep
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return 'Select Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleTotalChange = (fieldPrefix: string, value: number) => {
    const field = `${fieldPrefix}Count`;
    const attemptField = `${fieldPrefix}ToAttempt`;
    const currentAttempt = watch(attemptField) || 0;
    
    if (currentAttempt > value) {
      setValue(attemptField, value);
    }
    
    const placement = watch("mcqPlacement");
    const questionTypes = getQuestionTypes();
    const currentType = questionTypes.find(t => t.fieldPrefix === fieldPrefix);
    
    if (!currentType) return;
    
    if (currentType.value === "mcq") {
      let maxMcq = 0;
      if (placement === "separate") maxMcq = 15;
      else if (placement === "same_page") maxMcq = 5;
      else if (placement === "two_papers") maxMcq = 5;
      else if (placement === "three_papers") maxMcq = 5;
      
      if (value > maxMcq) {
        setValue(field, maxMcq);
        setValue(attemptField, Math.min(currentAttempt, maxMcq));
        const layoutName = placement === "separate" ? "Separate Pages" : 
                          placement === "same_page" ? "Single Page" : 
                          placement === "two_papers" ? "Two Papers" : 
                          "Three Papers";
        alert(`MCQs: Maximum ${maxMcq} questions allowed for ${layoutName} layout.`);
      }
    } else {
      const subjectiveTypes = getQuestionTypes().filter(t => t.value !== 'mcq');
      const subjectiveTotal = subjectiveTypes.reduce((sum, t) => {
        const count = t.fieldPrefix === fieldPrefix ? value : (watch(`${t.fieldPrefix}Count`) || 0);
        return sum + count;
      }, 0);
      
      const maxSubjective = getSubjectiveMaxForLayout(placement);
      
      if (subjectiveTotal > maxSubjective) {
        const maxForThis = maxSubjective - (subjectiveTotal - value);
        setValue(field, maxForThis);
        setValue(attemptField, Math.min(watch(attemptField) || 0, maxForThis));
        const layoutName = placement === "separate" ? "Separate Pages" : 
                          placement === "same_page" ? "Single Page" : 
                          placement === "two_papers" ? "Two Papers" : 
                          "Three Papers";
        alert(`Subjective questions: Maximum ${maxSubjective} total questions allowed for ${layoutName} layout.`);
      }
    }
  };

  const handleAttemptChange = (fieldPrefix: string, value: number) => {
    const attemptField = `${fieldPrefix}ToAttempt`;
    const total = watch(`${fieldPrefix}Count`) || 0;
    
    if (value > total) {
      setValue(attemptField, total);
    }
  };

  const validateAndProceed = () => {
    const questionTypes = getQuestionTypes();
    let hasError = false;
    
    questionTypes.forEach(type => {
      const total = watch(`${type.fieldPrefix}Count`) || 0;
      const attempt = watch(`${type.fieldPrefix}ToAttempt`) || 0;
      
      if (attempt > total) {
        alert(`Please fix the 'To Attempt' value for ${type.label}. It cannot exceed 'Total Qs'.`);
        hasError = true;
      }
    });
    
    if (hasError) return;
    
    const placement = watch("mcqPlacement");
    const questionTypesList = getQuestionTypes();
    const mcqType = questionTypesList.find(t => t.value === 'mcq');
    const subjectiveTypes = questionTypesList.filter(t => t.value !== 'mcq');
    
    const mcqCount = mcqType ? (watch(`${mcqType.fieldPrefix}Count`) || 0) : 0;
    const subjectiveTotal = subjectiveTypes.reduce((sum, t) => {
      return sum + (watch(`${t.fieldPrefix}Count`) || 0);
    }, 0);
    
    const maxSubjective = getSubjectiveMaxForLayout(placement);
    
    if (placement === "separate" && mcqCount > 15) {
      alert(`Separate Pages Layout: Maximum 15 MCQs allowed. You have ${mcqCount}.`);
      return;
    }
    if (placement === "same_page" && mcqCount > 5) {
      alert(`Single Page Layout: Maximum 5 MCQs allowed. You have ${mcqCount}.`);
      return;
    }
    if (placement === "two_papers" && mcqCount > 5) {
      alert(`Two Papers Layout: Maximum 5 MCQs allowed. You have ${mcqCount}.`);
      return;
    }
    if (placement === "three_papers" && mcqCount > 5) {
      alert(`Three Papers Layout: Maximum 5 MCQs allowed. You have ${mcqCount}.`);
      return;
    }
    
    if (subjectiveTotal > maxSubjective) {
      const layoutName = placement === "separate" ? "Separate Pages" : 
                      placement === "same_page" ? "Single Page" : 
                      placement === "two_papers" ? "Two Papers" : 
                      "Three Papers";
      alert(`${layoutName} Layout: Maximum ${maxSubjective} subjective questions allowed. You have ${subjectiveTotal}.`);
      return;
    }
    
    setStep(5);
  };

  return (
    <div className="step-card step-transition p-1 p-md-3 py-3">
      <div className="text-center mb-4">
        <h5 className="fw-bold mb-3">⚙️ Custom Paper Settings</h5>
        <p className="text-muted d-none d-sm-inline">Configure your custom paper settings</p>
      </div>

      {/* Layout Display */}
      <div className="mb-4 p-3 border rounded bg-light">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h6 className="fw-bold mb-1"><span className='d-none d-md-inline'>Selected Layout: </span>{
              watch("mcqPlacement") === "separate" ? "Separate Pages" :
              watch("mcqPlacement") === "same_page" ? "Single Page" :
              watch("mcqPlacement") === "two_papers" ? "Two Papers Layout" :
              "Three Papers Layout"
            }</h6>
            <p className="small text-muted mb-0 d-none d-md-inline">
              MCQs: {
                watch("mcqPlacement") === "separate" ? "Max 15" :
                watch("mcqPlacement") === "same_page" ? "Max 5" :
                watch("mcqPlacement") === "two_papers" ? "Max 5" :
                "Max 5"
              } • Subjective: Max {getSubjectiveMaxForLayout(watch("mcqPlacement"))}
            </p>
          </div>
          <button 
            className="btn btn-sm btn-outline-primary"
            onClick={() => setPaperTypeStep(1)}
          >
            Change <span className='d-none d-md-inline'>Layout</span>
          </button>
        </div>
      </div>

      {/* Paper Title, Date, and Time */}
      <div className="row mb-3 g-3">
        <div className="col-12 col-lg-4">
          <label className="form-label">Paper Title</label>
          <input
            type="text"
            {...register("title")}
            className={`form-control ${errors.title ? "is-invalid" : ""}`}
            placeholder="Enter paper title"
          />
          {errors.title && <div className="invalid-feedback">{errors.title.message}</div>}
        </div>

        <div className="col-12 col-lg-4">
          <label className="form-label">Date of Paper</label>
          <div className="position-relative">
            <button
              type="button"
              className="form-control text-start bg-white d-flex justify-content-between align-items-center"
              onClick={() => setShowDatePicker(!showDatePicker)}
              style={{ cursor: 'pointer' }}
            >
              <span>{formatDateForDisplay(watch('dateOfPaper') || '')}</span>
              <i className="bi bi-calendar"></i>
            </button>
            
            {showDatePicker && (
              <div className="card position-absolute top-100 start-0 mt-1 shadow-lg z-3 w-100">
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0">Select Date</h6>
                    <button 
                      type="button" 
                      className="btn-close"
                      onClick={() => setShowDatePicker(false)}
                    ></button>
                  </div>
                  <input
                    type="date"
                    className="form-control"
                    value={watch('dateOfPaper') || ''}
                    onChange={(e) => {
                      setValue('dateOfPaper', e.target.value);
                      setShowDatePicker(false);
                    }}
                  />
                  <div className="mt-2 d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm flex-fill"
                      onClick={() => {
                        setValue('dateOfPaper', new Date().toISOString().split('T')[0]);
                        setShowDatePicker(false);
                      }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm flex-fill"
                      onClick={() => {
                        setValue('dateOfPaper', '');
                        setShowDatePicker(false);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {watch("mcqPlacement") === "separate" ? (
          <>
            <div className="col-6 col-lg-2">
              <label className="form-label">Objective Time</label>
              <div className="input-group">
                <input
                  type="number"
                  {...register("mcqTimeMinutes", { valueAsNumber: true })}
                  className="form-control no-spinner"
                  placeholder="Min"
                  style={{ textAlign: 'center' }}
                />
                <span className="input-group-text" style={{ padding: '0.375rem 0.5rem' }}>min</span>
              </div>
              {errors.mcqTimeMinutes && <div className="invalid-feedback d-block">{errors.mcqTimeMinutes.message}</div>}
            </div>
            
            <div className="col-6 col-lg-2">
              <label className="form-label">Subjective Time</label>
              <div className="input-group">
                <input
                  type="number"
                  {...register("subjectiveTimeMinutes", { valueAsNumber: true })}
                  className="form-control no-spinner"
                  placeholder="Min"
                  style={{ textAlign: 'center' }}
                />
                <span className="input-group-text" style={{ padding: '0.375rem 0.5rem' }}>min</span>
              </div>
              {errors.subjectiveTimeMinutes && <div className="invalid-feedback d-block">{errors.subjectiveTimeMinutes.message}</div>}
            </div>
          </>
        ) : (
          <div className="col-12 col-lg-4">
            <label className="form-label">Total Time</label>
            <div className="input-group">
              <input
                type="number"
                {...register("timeMinutes", { valueAsNumber: true })}
                className="form-control no-spinner"
                placeholder="Minutes"
                style={{ textAlign: 'center' }}
              />
              <span className="input-group-text" style={{ padding: '0.375rem 0.5rem' }}>min</span>
            </div>
            {errors.timeMinutes && <div className="invalid-feedback d-block">{errors.timeMinutes.message}</div>}
          </div>
        )}
      </div>

      {/* Language + Source */}
      <div className="row mb-3 g-3">
        <div className="col-md-6">
          <label className="form-label d-block">Language</label>
          <div className="d-flex flex-wrap gap-3">
            {["english", "urdu", "bilingual"].map((lang) => {
              let disabled = false;
              const subject = subjects.find(s => s.id === watch('subjectId'));
              if (subject) {
                const subjectName = subject.name.toLowerCase();
                if (subjectName === 'english' && lang !== 'english') {
                  disabled = true;
                } else if (subjectName === 'urdu' && lang !== 'urdu') {
                  disabled = true;
                }
              }
              
              return (
                <div className="form-check" key={lang}>
                  <input
                    className="form-check-input"
                    type="radio"
                    value={lang}
                    {...register("language")}
                    id={`lang-${lang}`}
                    disabled={disabled}
                  />
                  <label className="form-check-label" htmlFor={`lang-${lang}`} style={disabled ? { opacity: 0.5 } : {}}>
                    {lang === "english" ? "🇬🇧 English" : 
                     lang === "urdu" ? "🇵🇰 Urdu" : 
                     "🌐 Both"}
                    {disabled && " (Disabled)"}
                  </label>
                </div>
              );
            })}
          </div>
          {errors.language && <div className="invalid-feedback d-block">{errors.language.message}</div>}
        </div>
        <div className="col-md-6">
          <label className="form-label">Source Type</label>
          <select {...register("source_type")} className="form-select">
            <option value="all">📚 All Sources</option>
            <option value="book">📖 Book Only</option>
            <option value="model_paper">📋 Model Papers</option>
            <option value="past_paper">📜 Past Papers</option>
          </select>
          {errors.source_type && <div className="invalid-feedback d-block">{errors.source_type.message}</div>}
        </div>
      </div>

      {/* Shuffle Option */}
      <div className="form-check form-switch mb-4 d-none d-sm-block">
        <input
          className="form-check-input"
          type="checkbox"
          id="shuffleQuestions"
          {...register("shuffleQuestions")}
        />
        <label className="form-check-label" htmlFor="shuffleQuestions">
          🔀 Shuffle Questions
        </label>
        <div className="form-text">
          Randomize the order of questions in each section
        </div>
        {errors.shuffleQuestions && <div className="invalid-feedback d-block">{errors.shuffleQuestions.message}</div>}
      </div>

      {/* Question Distribution */}
      <div className="distribution-card mt-3 p-0 p-md-3 bg-white rounded shadow-sm">
        <h6 className="fw-semibold mb-3">📊 Question Distribution</h6>

        {/* Layout-specific Validation Alerts */}
        {(() => {
          const placement = watch("mcqPlacement");
          const questionTypes = getQuestionTypes();
          const mcqType = questionTypes.find(t => t.value === 'mcq');
          const subjectiveTypes = questionTypes.filter(t => t.value !== 'mcq');
          
          const mcqCount = mcqType ? (watch(`${mcqType.fieldPrefix}Count`) || 0) : 0;
          const subjectiveCount = subjectiveTypes.reduce((sum, t) => sum + (watch(`${t.fieldPrefix}Count`) || 0), 0);
          const maxSubjective = getSubjectiveMaxForLayout(placement);
          
          if (placement === "separate") {
            return (
              <div className="alert alert-info mb-3 d-none d-md-block">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Separate Pages Layout Limits:</strong>
                <div className="mt-1 small">
                  • MCQs: Maximum 15 questions
                  <br/>
                  • Subjective questions: Maximum {maxSubjective} questions total
                  {subjectiveCount > maxSubjective && (
                    <div className="text-danger">
                      Current subjective: {subjectiveCount} questions
                    </div>
                  )}
                  {mcqCount > 15 && (
                    <div className="text-danger">
                      Current MCQs: {mcqCount} questions
                    </div>
                  )}
                </div>
              </div>
            );
          }
          
          if (placement === "same_page") {
            return (
              <div className="alert alert-info mb-3 d-none d-md-block">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Single Page Layout Limits:</strong>
                <div className="mt-1 small">
                  • MCQs: Maximum 5 questions
                  <br/>
                  • Subjective questions: Maximum {maxSubjective} questions total
                  {subjectiveCount > maxSubjective && (
                    <div className="text-danger">
                      Current subjective: {subjectiveCount} questions
                    </div>
                  )}
                  {mcqCount > 5 && (
                    <div className="text-danger">
                      Current MCQs: {mcqCount} questions
                    </div>
                  )}
                </div>
              </div>
            );
          }
          
          if (placement === "two_papers") {
            return (
              <div className="alert alert-info mb-3 d-none d-md-block">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Two Papers Layout Limits:</strong>
                <div className="mt-1 small">
                  • MCQs: Maximum 5 questions
                  <br/>
                  • Subjective questions: Maximum {maxSubjective} questions total
                  {subjectiveCount > maxSubjective && (
                    <div className="text-danger">
                      Current subjective: {subjectiveCount} questions
                    </div>
                  )}
                  {mcqCount > 5 && (
                    <div className="text-danger">
                      Current MCQs: {mcqCount} questions
                    </div>
                  )}
                </div>
              </div>
            );
          }
          
          if (placement === "three_papers") {
            return (
              <div className="alert alert-info mb-3 d-none d-md-block">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Three Papers Layout Limits:</strong>
                <div className="mt-1 small">
                  • MCQs: Maximum 5 questions
                  <br/>
                  • Subjective questions: Maximum 15 questions total
                  {subjectiveCount > 15 && (
                    <div className="text-danger">
                      Current subjective: {subjectiveCount} questions
                    </div>
                  )}
                  {mcqCount > 5 && (
                    <div className="text-danger">
                      Current MCQs: {mcqCount} questions
                    </div>
                  )}
                </div>
              </div>
            );
          }
          
          return null;
        })()}

        <div className="table-responsive">
          <table className="table text-center align-middle" style={{ minWidth: '600px' }}>
            <thead className="table-light">
              <tr>
                <th style={{ width: "20%", minWidth: "80px" }}>Type</th>
                <th style={{ width: "15%", minWidth: "70px" }}>Total Qs</th>
                <th style={{ width: "15%", minWidth: "70px" }}>To Attempt</th>
                <th style={{ width: "15%", minWidth: "70px" }}>Marks Each</th>
                <th style={{ width: "20%", minWidth: "80px" }}>Difficulty</th>
                <th style={{ width: "15%", minWidth: "70px" }}>Section Marks</th>
              </tr>
            </thead>
            <tbody>
              {getQuestionTypes().map((type) => {
                const totalField = `${type.fieldPrefix}Count`;
                const attemptField = `${type.fieldPrefix}ToAttempt`;
                const marksField = `${type.fieldPrefix}Marks`;
                const difficultyField = `${type.fieldPrefix}Difficulty`;
                
                const totalValue = watch(totalField) || 0;
                const attemptValue = watch(attemptField) || 0;
                const marksValue = watch(marksField) || 0;
                const sectionMarks = attemptValue * marksValue;
                
                return (
                  <tr key={type.value}>
                    <td className="fw-bold text-capitalize">
                      {type.label}
                    </td>
                    <td className="text-center">
                      <div className="position-relative" style={{ maxWidth: '100px', margin: '0 auto' }}>
                        <input
                          type="number"
                          {...register(totalField, { 
                            valueAsNumber: true,
                            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                              handleTotalChange(type.fieldPrefix, parseInt(e.target.value) || 0);
                            }
                          })}
                          className={`form-control text-center no-spinner ${attemptValue > totalValue ? "is-invalid" : ""}`}
                          placeholder="0"
                          min="0"
                          max={100}
                          style={{ 
                            padding: '0.375rem 0.25rem',
                            fontSize: '0.875rem',
                            width: '100%'
                          }}
                        />
                      </div>
                      {type.value === "mcq" && (
                        <small className="text-muted d-block mt-1">
                          Max: {
                            watch("mcqPlacement") === "separate" ? "15" :
                            watch("mcqPlacement") === "same_page" ? "5" :
                            watch("mcqPlacement") === "two_papers" ? "5" :
                            watch("mcqPlacement") === "three_papers" ? "5" : ""
                          }
                        </small>
                      )}
                      {type.value !== "mcq" && (
                        <small className="text-muted d-block mt-1">
                          Max total subjective: {getSubjectiveMaxForLayout(watch("mcqPlacement"))}
                        </small>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="position-relative" style={{ maxWidth: '100px', margin: '0 auto' }}>
                        <input
                          type="number"
                          {...register(attemptField, { 
                            valueAsNumber: true,
                            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                              handleAttemptChange(type.fieldPrefix, parseInt(e.target.value) || 0);
                            }
                          })}
                          className={`form-control text-center no-spinner ${attemptValue > totalValue ? "is-invalid" : ""}`}
                          placeholder="0"
                          min="0"
                          max={totalValue}
                          style={{ 
                            padding: '0.375rem 0.25rem',
                            fontSize: '0.875rem',
                            width: '100%'
                          }}
                        />
                      </div>
                      {attemptValue > totalValue && (
                        <div className="invalid-feedback d-block small">
                          Exceeds total
                        </div>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="position-relative" style={{ maxWidth: '100px', margin: '0 auto' }}>
                        <input
                          type="number"
                          {...register(marksField, { valueAsNumber: true })}
                          className="form-control text-center no-spinner"
                          placeholder="1"
                          min="1"
                          style={{ 
                            padding: '0.375rem 0.25rem',
                            fontSize: '0.875rem',
                            width: '100%'
                          }}
                        />
                      </div>
                    </td>
                    <td className="text-center">
                      <select
                        {...register(difficultyField)}
                        className="form-select text-center"
                        style={{ 
                          padding: '0.375rem 0.25rem',
                          fontSize: '0.875rem',
                          minWidth: '80px'
                        }}
                      >
                        <option value="any">🎲 Any</option>
                        <option value="easy">😊 Easy</option>
                        <option value="medium">😐 Medium</option>
                        <option value="hard">😰 Hard</option>
                      </select>
                    </td>
                    <td className="text-center fw-bold text-success">
                      {sectionMarks} marks
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="row mt-3 text-center g-2">
          <div className="col-4">
            <div className="fw-bold text-primary small">📋 MCQs</div>
            <div className="fs-6 fw-bold">
              {(() => {
                const mcqType = getQuestionTypes().find(t => t.value === 'mcq');
                return mcqType ? `${watch(`${mcqType.fieldPrefix}ToAttempt`) || 0}/${watch(`${mcqType.fieldPrefix}Count`) || 0}` : '0/0';
              })()}
            </div>
            <div className="fw-bold text-success">
              {(() => {
                const mcqType = getQuestionTypes().find(t => t.value === 'mcq');
                if (!mcqType) return '0 marks';
                return `${(watch(`${mcqType.fieldPrefix}ToAttempt`) || 0) * (watch(`${mcqType.fieldPrefix}Marks`) || 0)} marks`;
              })()}
            </div>
          </div>
          <div className="col-4">
            <div className="fw-bold text-success small">🎯 Subj<span className="d-none d-sm-inline">ective</span></div>
            <div className="fs-6 fw-bold">
              {(() => {
                const subjectiveTypes = getQuestionTypes().filter(t => t.value !== 'mcq');
                const totalAttempt = subjectiveTypes.reduce((sum, t) => sum + (watch(`${t.fieldPrefix}ToAttempt`) || 0), 0);
                const totalCount = subjectiveTypes.reduce((sum, t) => sum + (watch(`${t.fieldPrefix}Count`) || 0), 0);
                return `${totalAttempt}/${totalCount}`;
              })()}
            </div>
            <div className="fw-bold text-success">
              {(() => {
                const subjectiveTypes = getQuestionTypes().filter(t => t.value !== 'mcq');
                const totalMarks = subjectiveTypes.reduce((sum, t) => {
                  const toAttempt = watch(`${t.fieldPrefix}ToAttempt`) || 0;
                  const marks = watch(`${t.fieldPrefix}Marks`) || 1;
                  return sum + (toAttempt * marks);
                }, 0);
                return `${totalMarks} marks`;
              })()}
            </div>
          </div>
          <div className="col-4">
            <div className="fw-bold text-danger small">⭐ Total Marks</div>
            <div className="fs-6 fw-bold">
              {(() => {
                const questionTypes = getQuestionTypes();
                const totalMarks = questionTypes.reduce((sum, t) => {
                  const toAttempt = watch(`${t.fieldPrefix}ToAttempt`) || 0;
                  const marks = watch(`${t.fieldPrefix}Marks`) || 1;
                  return sum + (toAttempt * marks);
                }, 0);
                return totalMarks;
              })()}
            </div>
            <span className="d-none d-sm-inline"><small className="text-muted">Based on To Attempt</small></span>
          </div>
        </div>
      </div>

      <div className="text-center mt-4 pt-3 border-top">
        <button 
          className="btn btn-outline-secondary me-2"
          onClick={() => setPaperTypeStep(1)}
        >
          <i className="bi bi-arrow-left me-2"></i> Back <span className='d-none d-md-inline'>to Layout</span>
        </button>
        
        <button 
          className="btn btn-primary  px-4 px-sm-5" 
          onClick={validateAndProceed}
        >
          Continue<span className="d-none d-sm-inline"> to Selection Method</span> <i className="bi bi-arrow-right ms-2"></i>
        </button>
        
        <div className="mt-2">
          <small className="text-muted">
            <i className="bi bi-info-circle me-1"></i>
            You can always come back and adjust these settings
          </small>
        </div>
      </div>
    </div>
  );
};