'use client';

import React from 'react';
import { Subject, Class } from '@/types/types';
import { 
  Library, 
  Wand2, 
  Clock, 
  Target, 
  Globe2, 
  ChevronRight, 
  Info,
  Check
} from 'lucide-react';

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
  currentSubject,
  getQuestionTypes,
  getModelPaperDetails,
  setDefaultQuestionTypeValues,
  setPaperTypeStep,
  setStep
}) => {
  const paperType = watch("paperType");
  const modelDetails = getModelPaperDetails();

  const onSelectBoard = () => {
    setSelectedQuestions({});
    setPreviewQuestions({});
    setQuestionsCache({});
    setLastPreviewLoad(null);
    setValue("paperType", "model");

    const subjectName = currentSubject?.name?.toLowerCase() || '';
    setValue("language", 
      ["urdu", "islamiat", "tarjuma tul quran"].includes(subjectName) ? "urdu" : 
      subjectName === "english" ? "english" : "bilingual"
    );

    setValue("mcqPlacement", "separate");
    setValue("subjectiveTimeMinutes", 130);
    setValue("easyPercent", 20);
    setValue("mediumPercent", 50);
    setValue("hardPercent", 30);
    setValue("shuffleQuestions", true);
    setValue("source_type", "all");
    setValue("selectionMethod", "auto");

    const questionTypes = getQuestionTypes();
    questionTypes.forEach(type => {
      const data = type.value === "mcq" ? modelDetails.mcq : 
                   type.value === "short" ? modelDetails.short : 
                   type.value === "long" ? modelDetails.long : 
                   modelDetails.additionalTypes.find((t: any) => t.name === type.value) || { count: 0, attempt: 0, marks: 1 };

      setValue(`${type.fieldPrefix}Count`, data.count);
      setValue(`${type.fieldPrefix}ToAttempt`, data.attempt);
      setValue(`${type.fieldPrefix}Marks`, data.marks);
    });

    setTimeout(() => setStep(5), 400);
  };

  const onSelectCustom = () => {
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
    setPaperTypeStep(1);
  };

  return (
    <div className="w-100 py-2 animate-in">
      <div className="text-center mb-5">
        <h2 className="fw-black text-dark mb-2 tracking-tight">Generation <span className="text-primary-gradient">Mode</span></h2>
        <p className="text-muted fs-6">Choose a streamlined preset or build from scratch.</p>
      </div>

      <div className="row g-4 justify-content-center">
        {/* Preset Board Pattern */}
        <div className="col-md-6 col-lg-5">
          <div 
            className={`premium-choice-card ${paperType === 'model' ? 'selected' : ''}`}
            onClick={onSelectBoard}
          >
            <div className="selection-indicator">
               <Check size={16} strokeWidth={3} />
            </div>
            
            <div className="card-top">
              <div className="icon-wrapper board">
                <Library size={32} />
              </div>
              <div className="title-area">
                <h4 className="fw-bold m-0">Board Pattern</h4>
                <span className="subtitle">Official Standards</span>
              </div>
            </div>

            <p className="description">
              Optimized for final exam preparation using verified board mark distributions.
            </p>

            <div className="spec-row">
              <div className="spec-pill"><Target size={14} /> {modelDetails.totalMarks} Marks</div>
              <div className="spec-pill"><Clock size={14} /> {modelDetails.timeMinutes}m</div>
              <div className="spec-pill"><Globe2 size={14} /> Bilingual</div>
            </div>

            <div className="card-action">
              <span>Generate Instantly</span>
              <ChevronRight size={18} />
            </div>
          </div>
        </div>

        {/* Custom Creator */}
        <div className="col-md-6 col-lg-5">
          <div 
            className={`premium-choice-card ${paperType === 'custom' ? 'selected' : ''}`}
            onClick={onSelectCustom}
          >
            <div className="selection-indicator">
               <Check size={16} strokeWidth={3} />
            </div>

            <div className="card-top">
              <div className="icon-wrapper custom">
                <Wand2 size={32} />
              </div>
              <div className="title-area">
                <h4 className="fw-bold m-0">Custom Builder</h4>
                <span className="subtitle">Unlimited Freedom</span>
              </div>
            </div>

            <p className="description">
              Create monthly tests or quizzes with custom marks, chapters, and layout.
            </p>

            <div className="spec-row">
              <div className="spec-pill custom">Flexible Logic</div>
              <div className="spec-pill custom">Smart Shuffling</div>
            </div>

            <div className="card-action">
              <span>Configure Layout</span>
              <ChevronRight size={18} />
            </div>
          </div>
        </div>
      </div>

      <div className="glass-info-bar mt-5">
        <Info size={18} className="text-primary" />
        <p className="m-0 ms-2">
          <strong>Pro-tip:</strong> Use Board Pattern for full-length mock exams to get the most accurate results.
        </p>
      </div>

      <style jsx>{`
        .text-primary-gradient {
          background: linear-gradient(135deg, #0d6efd 0%, #6610f2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .premium-choice-card {
          background: #ffffff;
          border-radius: 24px;
          padding: 2rem;
          cursor: pointer;
          border: 2px solid #f1f5f9;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          position: relative;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .premium-choice-card:hover {
          transform: translateY(-8px);
          border-color: #cbd5e1;
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.08);
        }

        .premium-choice-card.selected {
          border-color: #0d6efd;
          background: #f8faff;
          box-shadow: 0 20px 40px -15px rgba(13, 110, 253, 0.2);
        }

        .selection-indicator {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 28px;
          height: 28px;
          background: #0d6efd;
          border-radius: 50%;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: scale(0.5);
          transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .premium-choice-card.selected .selection-indicator {
          opacity: 1;
          transform: scale(1);
        }

        .card-top {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 1.5rem;
        }

        .icon-wrapper {
          width: 60px;
          height: 60px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: 0.3s;
        }

        .icon-wrapper.board { background: #eef2ff; color: #4f46e5; }
        .icon-wrapper.custom { background: #fdf2f8; color: #db2777; }

        .selected .icon-wrapper.board { background: #4f46e5; color: white; }
        .selected .icon-wrapper.custom { background: #db2777; color: white; }

        .subtitle {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 700;
          color: #94a3b8;
        }

        .description {
          color: #64748b;
          font-size: 0.95rem;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        .spec-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 2rem;
        }

        .spec-pill {
          background: #f1f5f9;
          padding: 6px 14px;
          border-radius: 100px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #475569;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .spec-pill.custom { background: #fef2f2; color: #991b1b; }

        .card-action {
          margin-top: auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-weight: 700;
          color: #0d6efd;
          font-size: 0.9rem;
          opacity: 0.6;
          transition: 0.3s;
        }

        .premium-choice-card:hover .card-action {
          opacity: 1;
          transform: translateX(4px);
        }

        .glass-info-bar {
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(13, 110, 253, 0.1);
          padding: 1rem 1.5rem;
          border-radius: 16px;
          display: flex;
          align-items: center;
          font-size: 0.9rem;
          color: #475569;
          max-width: fit-content;
          margin-left: auto;
          margin-right: auto;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-in {
          animation: fadeIn 0.5s ease-out;
        }

        @media (max-width: 768px) {
          .premium-choice-card { padding: 1.5rem; }
        }
      `}</style>
    </div>
  );
};