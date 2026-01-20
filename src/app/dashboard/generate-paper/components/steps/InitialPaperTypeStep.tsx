// components/steps/InitialPaperTypeStep.tsx
import React from 'react';
import { Subject, Class } from '@/types/types';

interface InitialPaperTypeStepProps {
  watch: any;
  setValue: (field: string, value: any) => void;
  setSelectedQuestions: (questions: Record<string, string[]>) => void;
  setQuestionsCache: (cache: any) => void;
  setLastPreviewLoad: (load: any) => void;
  setPreviewQuestions: (questions: any) => void;
  subjects: Subject[];
  classes: Class[];
  getQuestionTypes: () => any[];
  currentSubject: Subject | null;
  currentClass: Class | null;
  getModelPaperDetails: () => any;
  setDefaultQuestionTypeValues: () => void;
  setPaperTypeStep: (step: number) => void;
  setStep: (step: number) => void;
}

export const InitialPaperTypeStep: React.FC<InitialPaperTypeStepProps> = ({
  watch,
  setValue,
  setSelectedQuestions,
  setQuestionsCache,
  setLastPreviewLoad,
  setPreviewQuestions,
  subjects,
  classes,
  getQuestionTypes,
  currentSubject,
  currentClass,
  getModelPaperDetails,
  setDefaultQuestionTypeValues,
  setPaperTypeStep,
  setStep
}) => {
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
            className={`option-card card h-100 p-2 cursor-pointer text-center border rounded-3 ${
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
                <div className="fw-bold text-primary">{getModelPaperDetails().totalMarks} Total Marks <small className="text-muted d-inline mb-2">({getModelPaperDetails().timeMinutes} min)</small></div>
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
            className={`option-card card h-100 p-2 cursor-pointer text-center border rounded-3 ${
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

              // Move to next step (layout selection)
              setPaperTypeStep(1);
            }}
          >
            <div className="card-body p-0">
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

      <div className="text-center mt-4">
        <p className="text-muted small">
          <i className="bi bi-info-circle me-1"></i>
          Board Pattern uses predefined question distribution. Custom Paper gives you full control.
        </p>
      </div>
    </div>
  );
};