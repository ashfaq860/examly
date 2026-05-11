//  PaperTypeStep.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { Subject, Class } from '@/types/types';

interface PaperTypeStepProps {
  watch: any;
  setValue: (field: string, value: any) => void;
  register: any;
  errors: any;
  setStep: (step: number) => void;
  setSelectedQuestions: (questions: Record<string, string[]>) => void;
  setQuestionsCache: (cache: any) => void;
  setLastPreviewLoad: (load: any) => void;
  setPreviewQuestions: (questions: any) => void;
  subjects: Subject[];
  classes: Class[];
  getQuestionTypes: () => any[];
}

export const PaperTypeStep: React.FC<PaperTypeStepProps> = ({
  watch,
  setValue,
  register,
  errors,
  setStep,
  setSelectedQuestions,
  setQuestionsCache,
  setLastPreviewLoad,
  setPreviewQuestions,
  subjects,
  classes,
  getQuestionTypes
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentClass, setCurrentClass] = useState<Class | null>(null);
  const [currentSubject, setCurrentSubject] = useState<Subject | null>(null);

  // Helper function to get subject-specific subjective limits
  const getSubjectiveMaxForLayout = (layoutValue: string): number => {
    const specialSubjects = ['urdu', 'english', 'islamiyat', 'tarjuma tul quran', 'pakistan study', 'islamiat'];
    const currentSubjectName = currentSubject?.name?.toLowerCase() || '';
    const isSpecialSubject = specialSubjects.includes(currentSubjectName);
    
    let baseMax = 0;
    
    // Get base maximum for the layout
    switch (layoutValue) {
      case "separate":
        baseMax = 30;
        break;
      case "same_page":
        baseMax = 15;
        break;
      case "two_papers":
        baseMax = 10;
        break;
      case "three_papers":
        baseMax = 15; // Changed from 15 to 15 (same as same_page)
        break;
      default:
        baseMax = 15;
    }
    
    // Increase by 5 for special subjects (except for three_papers where we want all subjects to have max 15)
    if (layoutValue === "three_papers") {
      return 15; // Fixed 15 for all subjects in three_papers layout
    }
    
    return isSpecialSubject ? baseMax + 5 : baseMax;
  };

  // Update current class and subject when they change
  useEffect(() => {
    const classId = watch("classId");
    const subjectId = watch("subjectId");
    
    if (classId && classes.length > 0) {
      const foundClass = classes.find(c => c.id === classId);
      setCurrentClass(foundClass || null);
    }
    
    if (subjectId && subjects.length > 0) {
      const foundSubject = subjects.find(s => s.id === subjectId);
      setCurrentSubject(foundSubject || null);
    }
  }, [watch("classId"), watch("subjectId"), classes, subjects]);

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return 'Select Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleLayoutChange = (placement: string) => {
    setValue("mcqPlacement", placement);
    
    // Get all question types
    const questionTypes = getQuestionTypes();
    
    // Enforce limits based on layout
    let maxMcq = 0;
    const maxSubjective = getSubjectiveMaxForLayout(placement);
    
    if (placement === "separate") {
      maxMcq = 15;
    } else if (placement === "same_page") {
      maxMcq = 5;
    } else if (placement === "two_papers") {
      maxMcq = 5;
    } else if (placement === "three_papers") {
      maxMcq = 5; // Changed from 0 to 5
    }
    
    // Adjust MCQ count
    const mcqType = questionTypes.find(t => t.value === 'mcq');
    if (mcqType) {
      const currentMcq = watch(`${mcqType.fieldPrefix}Count`) || 0;
      if (currentMcq > maxMcq) {
        setValue(`${mcqType.fieldPrefix}Count`, maxMcq);
        setValue(`${mcqType.fieldPrefix}ToAttempt`, Math.min(watch(`${mcqType.fieldPrefix}ToAttempt`) || 0, maxMcq));
      }
    }
    
    // For three papers layout, adjust MCQ count to max 5 (previously forced to 0)
    if (placement === "three_papers") {
      if (mcqType) {
        const currentMcq = watch(`${mcqType.fieldPrefix}Count`) || 0;
        if (currentMcq > 5) {
          setValue(`${mcqType.fieldPrefix}Count`, 5);
          setValue(`${mcqType.fieldPrefix}ToAttempt`, Math.min(watch(`${mcqType.fieldPrefix}ToAttempt`) || 0, 5));
        }
      }
    }
    
    // Adjust subjective counts
    const subjectiveTypes = questionTypes.filter(t => t.value !== 'mcq');
    const subjectiveTotal = subjectiveTypes.reduce((sum, t) => {
      return sum + (watch(`${t.fieldPrefix}Count`) || 0);
    }, 0);
    
    if (subjectiveTotal > maxSubjective) {
      // Distribute the reduction proportionally
      subjectiveTypes.forEach(t => {
        const currentCount = watch(`${t.fieldPrefix}Count`) || 0;
        if (currentCount > 0) {
          const newCount = Math.round((currentCount / subjectiveTotal) * maxSubjective);
          setValue(`${t.fieldPrefix}Count`, newCount);
          setValue(`${t.fieldPrefix}ToAttempt`, Math.min(watch(`${t.fieldPrefix}ToAttempt`) || 0, newCount));
        }
      });
    }
  };

  const handleTotalChange = (fieldPrefix: string, value: number) => {
    const field = `${fieldPrefix}Count`;
    const attemptField = `${fieldPrefix}ToAttempt`;
    const currentAttempt = watch(attemptField) || 0;
    
    // Ensure toAttempt doesn't exceed total
    if (currentAttempt > value) {
      setValue(attemptField, value);
    }
    
    // Enforce layout-specific limits
    const placement = watch("mcqPlacement");
    const questionTypes = getQuestionTypes();
    const currentType = questionTypes.find(t => t.fieldPrefix === fieldPrefix);
    
    if (!currentType) return;
    
    // Handle MCQ limits
    if (currentType.value === "mcq") {
      let maxMcq = 0;
      if (placement === "separate") maxMcq = 15;
      else if (placement === "same_page") maxMcq = 5;
      else if (placement === "two_papers") maxMcq = 5;
      else if (placement === "three_papers") maxMcq = 5; // Changed from 0 to 5
      
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
      // Handle subjective limits
      const subjectiveTypes = questionTypes.filter(t => t.value !== 'mcq');
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

  // Helper function to set default values for all question types
  const setDefaultQuestionTypeValues = () => {
    const questionTypes = getQuestionTypes();
    
    questionTypes.forEach(type => {
      if (type.value === 'mcq') {
        setValue(`${type.fieldPrefix}Count`, 5);
        setValue(`${type.fieldPrefix}ToAttempt`, 5);
        setValue(`${type.fieldPrefix}Marks`, 1);
      } else if (type.value === 'short') {
        setValue(`${type.fieldPrefix}Count`, 5);
        setValue(`${type.fieldPrefix}ToAttempt`, 5);
        setValue(`${type.fieldPrefix}Marks`, 2);
      } else if (type.value === 'long') {
        setValue(`${type.fieldPrefix}Count`, 2);
        setValue(`${type.fieldPrefix}ToAttempt`, 2);
        setValue(`${type.fieldPrefix}Marks`, 5);
      } else {
        // Default values for other question types
        setValue(`${type.fieldPrefix}Count`, 0);
        setValue(`${type.fieldPrefix}ToAttempt`, 0);
        setValue(`${type.fieldPrefix}Marks`, 1);
      }
    });
  };

  // Function to scroll to custom settings
  const scrollToCustomSettings = () => {
    setTimeout(() => {
      const customSettings = document.getElementById('custom-settings');
      if (customSettings) {
        customSettings.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Updated getModelPaperDetails function
  const getModelPaperDetails = () => {
    const subjectName = currentSubject?.name?.toLowerCase() || '';
    const className = currentClass?.name || '';
    
    // Base structure for all subjects
    const baseDetails = {
      mcq: {
        count: subjectName === 'english' ? 16 : subjectName==='urdu'? 15 : subjectName==='computer'? 10 : 12, 
        attempt: subjectName === 'english' ? 16 : subjectName==='urdu'? 15 : subjectName==='computer'? 10 : 12, 
        marks: 1, 
        total: subjectName === 'english' ? 16 : subjectName==='urdu'? 15 : subjectName==='computer'? 10 : 12 
      },
      short: { count: 0, attempt: 0, marks: 2, total: 0 }, // Will be set conditionally
      long: { count: 3, attempt: 2, marks: subjectName === 'urdu' ? 10 : 8, total: subjectName === 'urdu' ? 20 : 16 },
      totalMarks: 0, // Will be calculated
      timeMinutes: 145,
      additionalTypes: [] as Array<{name: string, label: string, count: number, attempt: number, marks: number, total: number}>
    };

    // Set short questions based on subject
    if (subjectName === 'urdu' || subjectName === 'english') {
      baseDetails.short = { count: 8, attempt: 5, marks: 2, total: 10 };
    } else if (subjectName === "computer") {
      baseDetails.short = { count: 18, attempt: 12, marks: 2, total: 24 };
    } else {
      baseDetails.short = { count: 24, attempt: 16, marks: 2, total: 32 };
    }

    // Calculate base total marks
    baseDetails.totalMarks = baseDetails.mcq.total + baseDetails.short.total + baseDetails.long.total;

    // Add subject-specific question types
    if (subjectName === 'urdu') {
      baseDetails.additionalTypes.push(
        { 
          name: 'poetry_explanation', 
          label: 'Poetry Explanation',
          count: 8, 
          attempt: 5, 
          marks: 2, 
          total: 10 
        },
        { 
          name: 'prose_explanation', 
          label: 'Prose Explanation',
          count:2,
          attempt: 2,  
          marks: 5, 
          total: 10 
        }
      );

      if (className === 10) {
        baseDetails.additionalTypes.push(
          { 
            name: 'passage', 
            label: 'Passage',
            count: 1, 
            attempt: 1, 
            marks: 10, 
            total: 10 
          }
        );
      } else if (className === 9) {
        baseDetails.additionalTypes.push(
          { 
            name: 'sentence_correction', 
            label: 'Sentence Correction',
            count: 5, 
            attempt: 5, 
            marks: 1, 
            total: 5 
          },
          { 
            name: 'sentence_completion', 
            label: 'Sentence Completion',
            count: 5, 
            attempt: 5, 
            marks: 1, 
            total: 5 
          }
        );
      }
    } else if (subjectName === 'english' || subjectName === 'English') {
      if (className !== 10) {
        baseDetails.additionalTypes.push(
          { 
            name: 'translate_urdu', 
            label: 'Translate to Urdu',
            count: 3, 
            attempt: 2, 
            marks: 4, 
            total: 8 
          }
        );
      } else {
        baseDetails.additionalTypes.push(
          { 
            name: 'translate_urdu', 
            label: 'Translate to Urdu',
            count: 1, 
            attempt: 1, 
            marks: 8, 
            total: 8 
          }
        );
      }

      baseDetails.additionalTypes.push(
        { 
          name: 'translate_english', 
          label: 'Translate to English',
          count: 1, 
          attempt: 1, 
          marks: 5, 
          total: 5 
        },
        { 
          name: 'idiom_phrases', 
          label: 'Idiom & Phrases',
          count: 8, 
          attempt: 5, 
          marks: 1, 
          total: 5 
        }
      );

      if (className !== 10) {
        baseDetails.additionalTypes.push(
          { 
            name: 'passage', 
            label: 'Passage',
            count: 1, 
            attempt: 1, 
            marks: 10, 
            total: 10 
          },
          { 
            name: 'activePassive', 
            label: 'Active/Passive',
            count: 6, 
            attempt: 5, 
            marks: 1, 
            total: 5 
          }
        );
      } else if (className === 10) {
        baseDetails.additionalTypes.push(
          { 
            name: 'directInDirect', 
            label: 'Direct/Indirect',
            count: 6, 
            attempt: 5, 
            marks: 1, 
            total: 5 
          }
        );
      }
    }

    // Calculate total marks including additional types
    const additionalMarks = baseDetails.additionalTypes.reduce((sum, type) => sum + type.total, 0);
    baseDetails.totalMarks += additionalMarks;

    return baseDetails;
  };

  return (
    <div className="step-card step-transition p-0 p-md-3 py-3">
      <div className="text-center mb-3">
        <h5 className="fw-bold mb-3">📝 Select Paper Type</h5>
        <p className="text-muted d-none d-sm-inline">Choose between predefined board pattern or customize your own paper</p>
      </div>
<div className="row g-4">
  {/* Board Paper Card */}
  <div className="col-md-6">
    <div
      className={`option-card card h-100 p-2 cursor-pointer text-center border rounded-3  ${
        watch("paperType") === "model" ? "active border-primary" : "border-secondary"
      }`}
      onClick={() => {
        setSelectedQuestions({});
        setPreviewQuestions({});
        setQuestionsCache({});
        setLastPreviewLoad(null);

        setValue("paperType", "model");

        const subjectName = currentSubject?.name?.toLowerCase() || '';
        setValue(
          "language",
          ["urdu", "islamiat", "tarjuma tul quran"].includes(subjectName)
            ? "urdu"
            : subjectName === "english"
            ? "english"
            : "bilingual"
        );

        setValue("mcqPlacement", "separate");
        setValue("subjectiveTimeMinutes", 130);
        setValue("easyPercent", 20);
        setValue("mediumPercent", 50);
        setValue("hardPercent", 30);
        setValue("shuffleQuestions", true);
        setValue("dateOfPaper", undefined);
        setValue("source_type", "all");
        setValue("selectionMethod", "auto");

        const modelDetails = getModelPaperDetails();
        const questionTypes = getQuestionTypes();

        questionTypes.forEach(type => {
          const data =
            type.value === "mcq"
              ? modelDetails.mcq
              : type.value === "short"
              ? modelDetails.short
              : type.value === "long"
              ? modelDetails.long
              : modelDetails.additionalTypes.find(t => t.name === type.value) || { count: 0, attempt: 0, marks: 1 };

          setValue(`${type.fieldPrefix}Count`, data.count);
          setValue(`${type.fieldPrefix}ToAttempt`, data.attempt);
          setValue(`${type.fieldPrefix}Marks`, data.marks);
        });

        setTimeout(() => setStep(5), 100);
      }}
    >
      <div className="card-body p-0">
        <span className="display-4">🏛️</span>
        <h5 className="fw-bold mt-0">Board Pattern</h5>
        <div className="d-none d-sm-inline">
        <p className="text-muted mb-3 small">Predefined style with fixed marks & time</p>


        <div className="fw-bold text-primary">{getModelPaperDetails().totalMarks} Total Marks <small className="text-muted d-inline mb-2">({getModelPaperDetails().timeMinutes} )</small></div>
        
        <div>
          <span className="badge bg-secondary me-1"><i className="bi bi-shuffle me-1"></i>Shuffled</span>
          {currentSubject?.name?.toLowerCase() === 'urdu' && <span className="badge bg-danger">🇵🇰 Urdu</span>}
          {currentSubject?.name?.toLowerCase() === 'english' && <span className="badge bg-primary">🇬🇧 English</span>}
          {!['urdu', 'english'].includes(currentSubject?.name?.toLowerCase()) && <span className="badge bg-info">🌐 Bilingual</span>}
        </div>

     
      </div>
      </div>
    </div>
  </div>

  {/* Custom Paper Card */}
  <div className="col-md-6">
    <div
      className={`option-card card h-100 p-2 cursor-pointer text-center  border rounded-3  ${
        watch("paperType") === "custom" ? "active border-success" : "border-secondary"
      }`}
      onClick={() => {
        setValue("paperType", "custom");
        setDefaultQuestionTypeValues();
        setValue("mcqPlacement", "same_page");
        setValue("timeMinutes", 60);
        setValue("shuffleQuestions", true);
        setValue("dateOfPaper", new Date().toISOString().split('T')[0]);
        setValue("source_type", "all");

        setSelectedQuestions({});
        setQuestionsCache({});
        setLastPreviewLoad(null);
        setPreviewQuestions({});

        scrollToCustomSettings();
      }}
    >
      <div className="card-body p-0 ">
        <span className="display-4">⚙️</span>
        <h5 className="fw-bold mt-0">Custom Paper</h5>
        <div className='d-none d-sm-flex flex-column align-items-center text-center'>
        <p className="text-muted mb-1 small">Full control over sections, marks & difficulty</p>

        <div className="row row-cols-3 g-2 mb-1 text-center">
          {[
            { icon: '🎯', text: 'Flexible marks' },
            { icon: '⏱️', text: 'Custom timing' },
            { icon: '🌐', text: 'Multiple languages' },
            { icon: '📊', text: 'Difficulty levels' },
            { icon: '🔀', text: 'Shuffling' },
            { icon: '📝', text: 'Custom title' }
          ].map((feature, idx) => (
            <div key={idx} className="col text-start d-flex align-items-center">
              <span className="me-2">{feature.icon}</span>
              <small>{feature.text}</small>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  </div>
</div>


      {watch("paperType") === "custom" && (
        <div className="custom-settings mt-2 p-1 p-md-4 border rounded bg-light step-transition" id="custom-settings">
          
          {/* Layout Selection */}
          <div className="row mb-4">
            <div className="col-12">
              <label className="form-label mb-3">📄 Question Paper Layout</label>
              <div className="row g-3">
                {[
                  {
                    value: "separate",
                    title: "Separate Pages",
                    description: "Objective and subjective on different pages",
                    mcqMax: 15,
                    colors: { mcq: "info", subjective: "success" }
                  },
                  {
                    value: "same_page",
                    title: "Single Page",
                    description: "All questions combined on a single page",
                    mcqMax: 5,
                    colors: { mcq: "primary", subjective: "success" }
                  },
                  {
                    value: "two_papers",
                    title: "Two Papers Layout",
                    description: "Optimized for printing two papers per page",
                    mcqMax: 5,
                    colors: { mcq: "purple", subjective: "pink" }
                  },
                  {
                    value: "three_papers",
                    title: "Three Papers Layout",
                    description: "Optimized for printing three papers per page (MCQs: 5, Subjective: 15)",
                    mcqMax: 5, // Changed from 0 to 5
                    colors: { mcq: "secondary", subjective: "warning" }
                  }
                ].map((layout) => {
                  const maxSubjective = getSubjectiveMaxForLayout(layout.value);
                  const hasMCQs = layout.mcqMax > 0;
                  
                  return (
                    <div className="col-12 col-sm-6 col-lg-3" key={layout.value}>
                      <div 
                        className={`card h-100 cursor-pointer p-1 ${watch("mcqPlacement") === layout.value ? "border-primary bg-primary bg-opacity-10 shadow" : "border"}`}
                        onClick={() => handleLayoutChange(layout.value)}
                        style={{ 
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          minHeight: '180px'
                        }}
                      >
                        <div className="card-body text-center p-0">
                          <div className="mb-2">
                            <div className="position-relative" style={{ height: '60px' }}>
                              {hasMCQs ? (
                                <>
                                  <div className="position-absolute start-0 top-0 border rounded p-2" style={{ 
                                    width: '45%', 
                                    height: '100%',
                                    background: layout.value === 'two_papers' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
                                              layout.value === 'three_papers' ? 'linear-gradient(135deg, #6c757d 0%, #495057 100%)' : 
                                              `var(--bs-${layout.colors.mcq})`,
                                    color: 'white'
                                  }}>
                                    <div className="small">MCQs</div>
                                    <div className="fw-bold"><span className="d-none d-sm-inline">Max </span>{layout.mcqMax}</div>
                                  </div>
                                  <div className="position-absolute end-0 top-0 border rounded p-2" style={{ 
                                    width: '45%', 
                                    height: '100%',
                                    background: layout.value === 'two_papers' ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : 
                                              layout.value === 'three_papers' ? 'linear-gradient(135deg, #ffb347 0%, #ffcc33 100%)' : 
                                              `var(--bs-${layout.colors.subjective})`,
                                    color: 'white'
                                  }}>
                                    <div className="small d-none d-sm-block">Subjective</div>
                                    <div className="small d-sm-none">Subj</div>
                                    <div className="fw-bold"><span className="d-none d-sm-inline">Max</span> {maxSubjective}</div>
                                  </div>
                                </>
                              ) : (
                                <div className="border rounded p-2" style={{ 
                                  width: '100%', 
                                  height: '100%',
                                  background: 'linear-gradient(135deg, #ffb347 0%, #ffcc33 100%)',
                                  color: 'white'
                                }}>
                                  <div className="small">Subjective Only</div>
                                  <div className="fw-bold">Max {maxSubjective} Qs</div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <h6 className="fw-bold mb-1">{layout.title}</h6>
                          <p className="small text-muted mb-0" style={{ 
                            wordBreak: 'break-word',
                            hyphens: 'auto'
                          }}>{layout.description}</p>
                          
                          <div className="mt-2">
                            {hasMCQs && (
                              <span className="badge me-1 mb-1" style={{ 
                                backgroundColor: layout.value === 'two_papers' ? '#667eea' : 
                                               layout.value === 'three_papers' ? '#6c757d' : layout.value === 'separate' ? '#0dcaf0' : '#0d6efd'
                              }}>
                                <span className="d-none d-sm-inline">MCQs: </span>Max {layout.mcqMax}
                              </span>
                            )}
                            <span className="badge mb-1" style={{ 
                              backgroundColor: layout.value === 'two_papers' ? '#f093fb' : 
                                             layout.value === 'three_papers' ? '#ffb347' : layout.value === 'separate' ? '#0dcaf0' : '#0d6efd'
                            }}>
                              <span className="d-none d-sm-inline">Subjective: </span>Max {maxSubjective}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-2">
                <small className="text-muted">
                  <i className="bi bi-info-circle me-1"></i>
                  {watch("mcqPlacement") === "separate" && 
                    "MCQs on separate page (max 15), subjective questions (max " + getSubjectiveMaxForLayout("separate") + ") on following pages"}
                  {watch("mcqPlacement") === "same_page" && 
                    "Single page layout: MCQs (max 5), subjective questions (max " + getSubjectiveMaxForLayout("same_page") + ")"}
                  {watch("mcqPlacement") === "two_papers" && 
                    "Two papers per page: MCQs (max 5), subjective questions (max " + getSubjectiveMaxForLayout("two_papers") + ")"}
                  {watch("mcqPlacement") === "three_papers" && 
                    "Three papers per page: MCQs (max 5), subjective questions (max " + getSubjectiveMaxForLayout("three_papers") + ")"}
                </small>
              </div>
            </div>
          </div>

          {/* Paper Title, Date, and Time */}
          <div className="row mb-3 g-3">
            <div className="col-12 col-lg-3">
              <label className="form-label">Paper Title</label>
              <input
                type="text"
                {...register("title")}
                className={`form-control ${errors.title ? "is-invalid" : ""}`}
                placeholder="Enter paper title"
              />
              {errors.title && <div className="invalid-feedback">{errors.title.message}</div>}
            </div>

            <div className="col-12 col-lg-3">
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
                <div className="col-6 col-lg-3">
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
                
                <div className="col-6 col-lg-3">
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
              <div className="col-12 col-lg-3">
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
                         "🌐 Bilingual"}
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
          <div className="form-check form-switch mb-4">
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
                  <div className="alert alert-info mb-3">
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
                  <div className="alert alert-info mb-3">
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
                  <div className="alert alert-info mb-3">
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
                  <div className="alert alert-info mb-3">
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
              className="btn btn-primary btn-lg px-4 px-sm-5" 
              onClick={() => {
                // Check if any toAttempt exceeds total
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
                
                // Check layout-specific limits
                const placement = watch("mcqPlacement");
                const questionTypesList = getQuestionTypes();
                const mcqType = questionTypesList.find(t => t.value === 'mcq');
                const subjectiveTypes = questionTypesList.filter(t => t.value !== 'mcq');
                
                const mcqCount = mcqType ? (watch(`${mcqType.fieldPrefix}Count`) || 0) : 0;
                const subjectiveTotal = subjectiveTypes.reduce((sum, t) => {
                  return sum + (watch(`${t.fieldPrefix}Count`) || 0);
                }, 0);
                
                const maxSubjective = getSubjectiveMaxForLayout(placement);
                
                // Check MCQ limits
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
                
                // Check subjective limits
                if (subjectiveTotal > maxSubjective) {
                  const layoutName = placement === "separate" ? "Separate Pages" : 
                                  placement === "same_page" ? "Single Page" : 
                                  placement === "two_papers" ? "Two Papers" : 
                                  "Three Papers";
                  alert(`${layoutName} Layout: Maximum ${maxSubjective} subjective questions allowed. You have ${subjectiveTotal}.`);
                  return;
                }
                
                setStep(5);
              }}
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
      )}
    </div>
  );
};