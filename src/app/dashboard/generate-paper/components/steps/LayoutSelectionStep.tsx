// components/steps/LayoutSelectionStep.tsx
import React from 'react';

interface LayoutSelectionStepProps {
  watch: any;
  setValue: (field: string, value: any) => void;
  getSubjectiveMaxForLayout: (layoutValue: string) => number;
  setPaperTypeStep: (step: number) => void;
}

export const LayoutSelectionStep: React.FC<LayoutSelectionStepProps> = ({
  watch,
  setValue,
  getSubjectiveMaxForLayout,
  setPaperTypeStep
}) => {
  const handleLayoutSelect = (layoutValue: string) => {
    setValue("mcqPlacement", layoutValue);
    
    // Move to custom settings step
    setPaperTypeStep(2);
  };

  const layouts = [
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
      mcqMax: 5,
      colors: { mcq: "secondary", subjective: "warning" }
    }
  ];

  return (
    <div className="step-card step-transition p-0 p-md-3 py-3">
      <div className="text-center mb-4">
        <h5 className="fw-bold mb-3">📄 Select Paper Layout</h5>
        <p className="text-muted d-none d-sm-inline">Choose a layout for your custom paper</p>
      </div>

      <div className="row g-4">
        {layouts.map((layout) => {
          const maxSubjective = getSubjectiveMaxForLayout(layout.value);
          const hasMCQs = layout.mcqMax > 0;
          
          return (
            <div className="col-12 col-sm-6 col-lg-3 mt-2" key={layout.value}>
              <div 
                className={`card h-100 cursor-pointer p-2 m-2 ${
                  watch("mcqPlacement") === layout.value 
                    ? "border-primary bg-primary bg-opacity-10 shadow" 
                    : "border border-secondary"
                }`}
                onClick={() => handleLayoutSelect(layout.value)}
                style={{ 
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                
                }}
              >
                <div className="card-body text-center p-2 pb-0">
                  <div className="mb-2">
                    <div className="position-relative" style={{ height: '60px' }}>
                      {hasMCQs ? (
                        <>
                          <div className="position-absolute start-0 top-0 border rounded p-2" style={{ 
                            width: '49%', 
                            height: '100%',
                            background: layout.value === 'two_papers' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
                                      layout.value === 'three_papers' ? 'linear-gradient(135deg, #6c757d 0%, #495057 100%)' : 
                                      layout.value === 'separate' ? '#0dcaf0' : '#0d6efd',
                            color: 'white'
                          }}>
                            <div className="small">MCQs</div>
                            <div className="fw-bold"><span className=" d-sm-inline">Max </span>{layout.mcqMax}</div>
                          </div>
                          <div className="position-absolute end-0 top-0 border rounded p-2" style={{ 
                            width: '45%', 
                            height: '100%',
                            background: layout.value === 'two_papers' ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : 
                                      layout.value === 'three_papers' ? 'linear-gradient(135deg, #ffb347 0%, #ffcc33 100%)' : 
                                      layout.value === 'separate' ? '#198754' : '#198754',
                            color: 'white'
                          }}>
                            <div className="small d-sm-block">Subjective</div>
                           
                            <div className="fw-bold"><span className=" d-sm-inline">Max</span> {maxSubjective}</div>
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
                  
                  <h6 className="fw-bold mb-1 mt-2">{layout.title}</h6>
                  <p className="small text-muted mb-0" style={{ 
                    wordBreak: 'break-word',
                    hyphens: 'auto',
                
                  }}>
                    {layout.description}
                  </p>
                  
                        
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 border rounded bg-light d-none d-sm-block">
        <div className="d-flex align-items-center mb-2">
          <i className="bi bi-info-circle text-primary me-2"></i>
          <h6 className="mb-0">Layout Information</h6>
        </div>
        <ul className="small mb-0 ">
          <li><strong>Separate Pages:</strong> MCQs on separate page, subjective on following pages</li>
          <li><strong>Single Page:</strong> All questions combined on one page</li>
          <li><strong>Two Papers:</strong> Optimized for printing two papers side by side</li>
          <li><strong>Three Papers:</strong> Optimized for printing three papers per page</li>
        </ul>
      </div>

      <div className="text-center mt-4">
        <button 
          className="btn btn-outline-secondary me-2"
          onClick={() => setPaperTypeStep(0)}
        >
          <i className="bi bi-arrow-left me-2"></i> Back
        </button>
      </div>
    </div>
  );
};