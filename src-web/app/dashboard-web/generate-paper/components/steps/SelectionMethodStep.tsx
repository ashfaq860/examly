'use client';

import React from 'react';
import { 
  Cpu, 
  MousePointer2, 
  Sparkles, 
  Zap, 
  Settings, 
  ChevronRight, 
  CheckCircle2 
} from 'lucide-react';

interface SelectionMethodStepProps {
  watchedSelectionMethod: string;
  setValue: (field: string, value: any) => void;
  setStep: (step: number) => void;
}

export const SelectionMethodStep: React.FC<SelectionMethodStepProps> = ({
  watchedSelectionMethod,
  setValue,
  setStep
}) => {

  const handleSelection = (method: 'auto' | 'manual', targetStep: number) => {
    setValue('selectionMethod', method);
    // Slight delay for the "selected" animation to be felt by the user
    setTimeout(() => setStep(targetStep), 500);
  };

  return (
    <div className="w-100 py-2 animate-fade-in">
      {/* Header Section */}
      <div className="text-center mb-5">
        <div className="d-inline-flex align-items-center justify-content-center p-2 mb-3 rounded-pill bg-primary bg-opacity-10 text-primary fw-bold small px-3">
          <Sparkles size={16} className="me-2" />
          Step 6: Selection Logic
        </div>
        <h2 className="display-6 fw-bold text-dark mb-2">
          Pick Your <span className="text-primary-gradient">Method</span>
        </h2>
        <p className="text-muted mx-auto fs-6" style={{ maxWidth: '500px' }}>
          Decide how questions are pulled from the bank. Speed or Precision?
        </p>
      </div>

      <div className="row g-4 justify-content-center">
        {/* Auto Selection Card */}
        <div className="col-md-6 col-lg-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div 
            className={`selection-card ${watchedSelectionMethod === 'auto' ? 'active' : ''}`}
            onClick={() => handleSelection('auto', 7)}
          >
            <div className="active-indicator">
              <CheckCircle2 size={20} />
            </div>

            <div className="card-inner">
              <div className="icon-box auto">
                <Cpu size={32} strokeWidth={1.5} />
              </div>
              
              <div className="content-area mt-4">
                <h4 className="fw-bold text-dark mb-2">Auto Selection</h4>
                <p className="text-muted small">
                  AI-driven randomization based on your difficulty criteria and chapter weightage.
                </p>
                
                <div className="feature-list mt-3">
                  <div className="feature-item">
                    <Zap size={14} className="text-warning" />
                    <span>Instant generation</span>
                  </div>
                  <div className="feature-item">
                    <Settings size={14} className="text-primary" />
                    <span>Balanced difficulty</span>
                  </div>
                </div>
              </div>

              <div className="card-footer-action mt-4">
                <span>Fastest Way</span>
                <ChevronRight size={18} />
              </div>
            </div>
          </div>
        </div>

        {/* Manual Selection Card */}
        <div className="col-md-6 col-lg-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div 
            className={`selection-card ${watchedSelectionMethod === 'manual' ? 'active' : ''}`}
            onClick={() => handleSelection('manual', 6)}
          >
            <div className="active-indicator">
              <CheckCircle2 size={20} />
            </div>

            <div className="card-inner">
              <div className="icon-box manual">
                <MousePointer2 size={32} strokeWidth={1.5} />
              </div>
              
              <div className="content-area mt-4">
                <h4 className="fw-bold text-dark mb-2">Manual Selection</h4>
                <p className="text-muted small">
                  Hand-pick every single question from the pool for total pedagogical control.
                </p>
                
                <div className="feature-list mt-3">
                  <div className="feature-item">
                    <CheckCircle2 size={14} className="text-success" />
                    <span>Custom question flow</span>
                  </div>
                  <div className="feature-item">
                    <Sparkles size={14} className="text-primary" />
                    <span>Exact question choice</span>
                  </div>
                </div>
              </div>

              <div className="card-footer-action mt-4">
                <span>Precision Mode</span>
                <ChevronRight size={18} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .text-primary-gradient {
          background: linear-gradient(135deg, #0d6efd 0%, #6610f2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .selection-card {
          background: white;
          border-radius: 32px;
          padding: 2.5rem;
          border: 1px solid #f1f5f9;
          cursor: pointer;
          position: relative;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          height: 100%;
          box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);
        }

        .selection-card:hover {
          transform: translateY(-10px);
          border-color: #cbd5e1;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.08);
        }

        .selection-card.active {
          border-color: #0d6efd;
          background: #f8faff;
          box-shadow: 0 20px 40px -15px rgba(13, 110, 253, 0.2);
        }

        .active-indicator {
          position: absolute;
          top: 25px;
          right: 25px;
          color: #0d6efd;
          opacity: 0;
          transform: scale(0.5);
          transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .selection-card.active .active-indicator {
          opacity: 1;
          transform: scale(1);
        }

        .icon-box {
          width: 70px;
          height: 70px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: 0.3s;
        }

        .icon-box.auto { background: #eef2ff; color: #4f46e5; }
        .icon-box.manual { background: #fdf2f8; color: #db2777; }

        .active .icon-box.auto { background: #4f46e5; color: white; }
        .active .icon-box.manual { background: #db2777; color: white; }

        .feature-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.85rem;
          font-weight: 600;
          color: #475569;
        }

        .card-footer-action {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-weight: 800;
          font-size: 0.85rem;
          color: #0d6efd;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.4;
          transition: 0.3s;
        }

        .selection-card:hover .card-footer-action {
          opacity: 1;
          transform: translateX(5px);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fadeIn 0.5s ease-out;
        }

        .animate-slide-up {
          animation: slideUp 0.6s ease-out forwards;
          opacity: 0;
        }

        @media (max-width: 576px) {
          .selection-card { padding: 1.5rem; }
        }
      `}</style>
    </div>
  );
};