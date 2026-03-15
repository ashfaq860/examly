// components/steps/CombinedLayoutAndSettingsStep.tsx
import React, { useState, useMemo } from 'react';
import { Subject } from '@/types/types';

interface CombinedLayoutAndSettingsStepProps {
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

export const CombinedLayoutAndSettingsStep: React.FC<CombinedLayoutAndSettingsStepProps> = ({
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
  const [selectedTypePrefix, setSelectedTypePrefix] = useState('');

  // Local state to track which question types are "active" in the list
  const activeTypes = watch("activeQuestionTypes") || [];
  const currentPlacement = watch("mcqPlacement");

  const layoutOptions = [
    { value: "separate", label: "📄 Separate Pages", desc: "Objective & Subjective on different pages", mcq: 15 },
    { value: "same_page", label: "📝 Single Page", desc: "All questions on one page", mcq: 5 },
    { value: "two_papers", label: "📚 Two Papers", desc: "Two papers per A4 page", mcq: 5 },
    { value: "three_papers", label: "📊 Three Papers", desc: "Three papers per A4 page", mcq: 5 }
  ];

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return 'Select Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const addQuestionType = () => {
    if (!selectedTypePrefix) return;
    if (activeTypes.includes(selectedTypePrefix)) {
      alert("This question type is already added.");
      return;
    }
    setValue("activeQuestionTypes", [...activeTypes, selectedTypePrefix]);
    setSelectedTypePrefix('');
  };

  const removeQuestionType = (prefix: string) => {
    setValue("activeQuestionTypes", activeTypes.filter((p: string) => p !== prefix));
    setValue(`${prefix}Count`, 0);
    setValue(`${prefix}ToAttempt`, 0);
  };

  // Calculations for Summary
  const stats = useMemo(() => {
    const types = getQuestionTypes();
    let mcqCount = 0;
    let subjCount = 0;
    let totalMarks = 0;

    activeTypes.forEach((prefix: string) => {
      const type = types.find(t => t.fieldPrefix === prefix);
      const count = watch(`${prefix}Count`) || 0;
      const attempt = watch(`${prefix}ToAttempt`) || 0;
      const marks = watch(`${prefix}Marks`) || 0;

      if (type?.value === 'mcq') mcqCount += count;
      else subjCount += count;
      
      totalMarks += (attempt * marks);
    });

    return { mcqCount, subjCount, totalMarks };
  }, [watch, activeTypes, getQuestionTypes]);

  const validateAndProceed = () => {
    const maxSubj = getSubjectiveMaxForLayout(currentPlacement);
    const layout = layoutOptions.find(l => l.value === currentPlacement);
    
    if (stats.mcqCount > (layout?.mcq || 0)) {
        alert(`Layout limit exceeded: Max ${layout?.mcq} MCQs allowed.`);
        return;
    }
    if (stats.subjCount > maxSubj) {
        alert(`Layout limit exceeded: Max ${maxSubj} subjective questions allowed.`);
        return;
    }
    if (activeTypes.length === 0) {
        alert("Please add at least one question type.");
        return;
    }
    setStep(5);
  };

  return (
    <div className="container-fluid p-0">
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="card-header bg-white border-bottom-0 pt-4 pb-0 text-center">
          <h4 className="fw-bold text-dark mb-1">Paper Configuration</h4>
          <p className="text-muted small">Define layout, metadata, and question distribution</p>
        </div>

        <div className="card-body p-3 p-md-4">
          {/* Section 1: Layout & Core Info */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-md-6">
              <div className="p-3 border rounded-3 bg-light h-100">
                <label className="form-label fw-semibold small text-uppercase">1. Choose Layout</label>
                <select {...register("mcqPlacement")} className="form-select form-select-lg mb-2 shadow-sm border-0">
                  <option value="">Select Layout...</option>
                  {layoutOptions.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                {currentPlacement && (
                  <div className="mt-2 p-2 bg-white rounded-2 border-start border-4 border-primary">
                    <p className="small mb-0 text-dark"><strong>Limits:</strong> MCQs: {layoutOptions.find(l=>l.value === currentPlacement)?.mcq} | Subj: {getSubjectiveMaxForLayout(currentPlacement)}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="p-3 border rounded-3 bg-light h-100">
                <label className="form-label fw-semibold small text-uppercase">2. Paper Metadata</label>
                <div className="row g-2">
                  <div className="col-12">
                    <input {...register("title")} className="form-control shadow-sm border-0" placeholder="Exam Title (e.g. Mid Term 2026)" />
                  </div>
                  <div className="col-6">
                    <button type="button" className="btn btn-white w-100 shadow-sm border-0 text-start small py-2" onClick={() => setShowDatePicker(!showDatePicker)}>
                       📅 {formatDateForDisplay(watch('dateOfPaper'))}
                    </button>
                    {showDatePicker && (
                        <input type="date" className="form-control mt-1 shadow-sm border-0" onChange={(e) => { setValue('dateOfPaper', e.target.value); setShowDatePicker(false); }} />
                    )}
                  </div>
                  <div className="col-6">
                     <div className="input-group shadow-sm rounded">
                        <input type="number" {...register("timeMinutes")} className="form-control border-0" placeholder="Mins" />
                        <span className="input-group-text bg-white border-0 small">min</span>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {currentPlacement && (
            <>
              {/* Section 2: Summary Dashboard */}
              <div className="row g-3 mb-4">
                <div className="col-4">
                  <div className="text-center p-2 rounded-3 bg-primary bg-opacity-10 border border-primary border-opacity-25">
                    <div className="text-primary small fw-bold">MCQs</div>
                    <div className="h5 mb-0 fw-bold">{stats.mcqCount}</div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="text-center p-2 rounded-3 bg-success bg-opacity-10 border border-success border-opacity-25">
                    <div className="text-success small fw-bold">Subjective</div>
                    <div className="h5 mb-0 fw-bold">{stats.subjCount}</div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="text-center p-2 rounded-3 bg-dark bg-opacity-10 border border-dark border-opacity-25">
                    <div className="text-dark small fw-bold">Total Marks</div>
                    <div className="h5 mb-0 fw-bold">{stats.totalMarks}</div>
                  </div>
                </div>
              </div>

              {/* Section 3: Dynamic Question Adder */}
              <div className="bg-light p-3 rounded-4 border">
                <h6 className="fw-bold mb-3 d-flex align-items-center">
                  <span className="bg-primary text-white rounded-circle me-2 d-inline-flex align-items-center justify-content-center" style={{width:'24px', height:'24px', fontSize:'12px'}}>3</span>
                  Question Distribution
                </h6>
                
                {/* Single Line Entry Form */}
                <div className="row g-2 align-items-end mb-4 bg-white p-3 rounded-3 shadow-sm mx-0">
                  <div className="col-12 col-md-3">
                    <label className="small fw-bold text-muted">Question Type</label>
                    <select className="form-select border-0 bg-light" value={selectedTypePrefix} onChange={(e) => setSelectedTypePrefix(e.target.value)}>
                      <option value="">Select Type...</option>
                      {getQuestionTypes().map(t => (
                        <option key={t.fieldPrefix} value={t.fieldPrefix} disabled={activeTypes.includes(t.fieldPrefix)}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="small fw-bold text-muted">Total Qs</label>
                    <input type="number" className="form-control border-0 bg-light" placeholder="0" id="tempCount" />
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="small fw-bold text-muted">To Attempt</label>
                    <input type="number" className="form-control border-0 bg-light" placeholder="0" id="tempAttempt" />
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="small fw-bold text-muted">Marks/Q</label>
                    <input type="number" className="form-control border-0 bg-light" placeholder="1" id="tempMarks" />
                  </div>
                  <div className="col-12 col-md-3">
                    <button type="button" className="btn btn-primary w-100 fw-bold shadow-sm" onClick={() => {
                        const count = parseInt((document.getElementById('tempCount') as HTMLInputElement).value) || 0;
                        const attempt = parseInt((document.getElementById('tempAttempt') as HTMLInputElement).value) || 0;
                        const marks = parseInt((document.getElementById('tempMarks') as HTMLInputElement).value) || 1;
                        
                        if(!selectedTypePrefix || count <= 0) return;
                        
                        setValue(`${selectedTypePrefix}Count`, count);
                        setValue(`${selectedTypePrefix}ToAttempt`, attempt);
                        setValue(`${selectedTypePrefix}Marks`, marks);
                        addQuestionType();
                    }}>
                      <i className="bi bi-plus-lg me-1"></i> Add Section
                    </button>
                  </div>
                </div>

                {/* Active Sections List */}
                <div className="table-responsive">
                  <table className="table table-hover align-middle bg-white rounded-3 overflow-hidden shadow-sm">
                    <thead className="table-light">
                      <tr className="small text-uppercase">
                        <th className="ps-3">Type</th>
                        <th className="text-center">Count</th>
                        <th className="text-center">Attempt</th>
                        <th className="text-center">Marks</th>
                        <th className="text-center">Total</th>
                        <th className="text-end pe-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTypes.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-4 text-muted small">No questions added yet. Use the form above to start.</td></tr>
                      ) : (
                        activeTypes.map((prefix: string) => {
                          const type = getQuestionTypes().find(t => t.fieldPrefix === prefix);
                          const count = watch(`${prefix}Count`);
                          const attempt = watch(`${prefix}ToAttempt`);
                          const marks = watch(`${prefix}Marks`);
                          return (
                            <tr key={prefix}>
                              <td className="ps-3 fw-bold">{type?.label}</td>
                              <td className="text-center">
                                <input type="number" {...register(`${prefix}Count`)} className="form-control form-control-sm border-0 bg-light mx-auto text-center" style={{width:'60px'}} />
                              </td>
                              <td className="text-center">
                                <input type="number" {...register(`${prefix}ToAttempt`)} className="form-control form-control-sm border-0 bg-light mx-auto text-center" style={{width:'60px'}} />
                              </td>
                              <td className="text-center">
                                <input type="number" {...register(`${prefix}Marks`)} className="form-control form-control-sm border-0 bg-light mx-auto text-center" style={{width:'60px'}} />
                              </td>
                              <td className="text-center fw-bold text-success">{attempt * marks}</td>
                              <td className="text-end pe-3">
                                <button type="button" className="btn btn-outline-danger btn-sm border-0" onClick={() => removeQuestionType(prefix)}>
                                  <i className="bi bi-trash"></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="d-flex justify-content-between align-items-center mt-5 pt-3 border-top">
            <button className="btn btn-link text-decoration-none text-secondary fw-bold" onClick={() => setPaperTypeStep(0)}>
              <i className="bi bi-arrow-left me-2"></i> Back
            </button>
            <button className="btn btn-primary px-5 py-2 rounded-pill fw-bold shadow" onClick={validateAndProceed} disabled={!currentPlacement}>
              Continue to Selection <i className="bi bi-arrow-right ms-2"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};