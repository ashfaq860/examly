// src/app/dashboard/generate-paper/components/PaperLayoutModal.tsx
'use client';
import React from 'react';

interface PaperLayoutModalProps {
  watch: any;
  setValue: (field: string, value: any) => void;
  onClose: () => void;
  getQuestionTypes: () => any[];
}

export const PaperLayoutModal: React.FC<PaperLayoutModalProps> = ({
  watch,
  setValue,
  onClose,
  getQuestionTypes
}) => {
  const layouts = [
    {
      value: "separate",
      title: "Separate Pages",
      description: "Objective and subjective on different pages",
      icon: "📄📄"
    },
    {
      value: "same_page",
      title: "Single Page",
      description: "All questions combined on a single page",
      icon: "📄"
    },
    {
      value: "two_papers",
      title: "Two Papers Layout",
      description: "Optimized for printing two papers per page",
      icon: "📄📄"
    },
    {
      value: "three_papers",
      title: "Three Papers Layout",
      description: "Optimized for printing three papers per page",
      icon: "📄📄📄"
    }
  ];

  const handleLayoutSelect = (layoutValue: string) => {
    setValue("mcqPlacement", layoutValue);
    
    // Set default values for the selected layout
    if (layoutValue === "separate") {
      setValue("mcqTimeMinutes", 15);
      setValue("subjectiveTimeMinutes", 30);
    } else {
      setValue("timeMinutes", 60);
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Paper Layout</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="row g-4">
              {layouts.map((layout) => (
                <div className="col-6" key={layout.value}>
                  <div 
                    className={`card h-100 cursor-pointer ${
                      watch("mcqPlacement") === layout.value ? 'border-primary bg-primary bg-opacity-10' : ''
                    }`}
                    onClick={() => handleLayoutSelect(layout.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="card-body text-center">
                      <div className="display-4 mb-3">{layout.icon}</div>
                      <h5 className="card-title">{layout.title}</h5>
                      <p className="card-text text-muted small">{layout.description}</p>
                      {watch("mcqPlacement") === layout.value && (
                        <div className="badge bg-success">Selected</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Time Settings based on layout */}
            <div className="mt-4">
              <h6>Time Settings</h6>
              {watch("mcqPlacement") === "separate" ? (
                <div className="row">
                  <div className="col-md-6">
                    <label className="form-label">Objective Time (minutes)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={watch("mcqTimeMinutes") || 15}
                      onChange={(e) => setValue("mcqTimeMinutes", parseInt(e.target.value) || 15)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Subjective Time (minutes)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={watch("subjectiveTimeMinutes") || 30}
                      onChange={(e) => setValue("subjectiveTimeMinutes", parseInt(e.target.value) || 30)}
                    />
                  </div>
                </div>
              ) : (
                <div className="row">
                  <div className="col-md-6">
                    <label className="form-label">Total Time (minutes)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={watch("timeMinutes") || 60}
                      onChange={(e) => setValue("timeMinutes", parseInt(e.target.value) || 60)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Apply Layout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};