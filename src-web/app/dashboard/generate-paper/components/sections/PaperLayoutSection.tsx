// src/app/dashboard/generate-paper/components/sections/PaperLayoutSection.tsx
'use client';
import React from 'react';

interface PaperLayoutSectionProps {
  watch: any;
  setValue: (field: string, value: any) => void;
}

export const PaperLayoutSection: React.FC<PaperLayoutSectionProps> = ({
  watch,
  setValue
}) => {
  const layoutOptions = [
    {
      value: 'separate',
      label: 'Separate Pages',
      description: 'MCQ and subjective on different pages',
      icon: '📄',
      limits: { mcq: 15, subjective: 30 }
    },
    {
      value: 'same_page',
      label: 'Same Page',
      description: 'All questions on same page',
      icon: '📝',
      limits: { mcq: 5, subjective: 15 }
    },
    {
      value: 'two_papers',
      label: 'Two Papers',
      description: 'Two papers per page',
      icon: '📋',
      limits: { mcq: 5, subjective: 10 }
    },
    {
      value: 'three_papers',
      label: 'Three Papers',
      description: 'Three papers per page',
      icon: '📚',
      limits: { mcq: 5, subjective: 15 }
    }
  ];

  const currentLayout = watch('mcqPlacement') || 'separate';
  const currentLayoutInfo = layoutOptions.find(l => l.value === currentLayout);

  return (
    <div className="card border-info">
      <div className="card-header bg-info text-white">
        <h5 className="mb-0">
          <i className="bi bi-layout-split me-2"></i>
          Paper Layout
        </h5>
      </div>
      <div className="card-body">
        <div className="mb-3">
          <label className="form-label">Select Layout:</label>
          <select
            className="form-select"
            value={currentLayout}
            onChange={(e) => setValue('mcqPlacement', e.target.value)}
          >
            {layoutOptions.map(layout => (
              <option key={layout.value} value={layout.value}>
                {layout.icon} {layout.label} - {layout.description}
              </option>
            ))}
          </select>
        </div>
        
        {currentLayoutInfo && (
          <div className="alert alert-info">
            <h6>Current Layout: {currentLayoutInfo.label}</h6>
            <ul className="mb-0">
              <li><strong>Description:</strong> {currentLayoutInfo.description}</li>
              <li><strong>MCQ Limit:</strong> Max {currentLayoutInfo.limits.mcq} questions</li>
              <li><strong>Subjective Limit:</strong> Max {currentLayoutInfo.limits.subjective} questions</li>
            </ul>
          </div>
        )}
        
        {/* Time Settings for Separate Layout */}
        {currentLayout === 'separate' && (
          <div className="mt-4 p-3 border rounded bg-light">
            <h6>Time Allocation:</h6>
            <div className="row">
              <div className="col-md-6">
                <label className="form-label">MCQ Time (minutes)</label>
                <input
                  type="number"
                  className="form-control"
                  value={watch('mcqTimeMinutes') || 15}
                  onChange={(e) => setValue('mcqTimeMinutes', parseInt(e.target.value) || 15)}
                  min="1"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Subjective Time (minutes)</label>
                <input
                  type="number"
                  className="form-control"
                  value={watch('subjectiveTimeMinutes') || 30}
                  onChange={(e) => setValue('subjectiveTimeMinutes', parseInt(e.target.value) || 30)}
                  min="1"
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Layout Preview */}
        <div className="mt-4">
          <h6>Layout Preview:</h6>
          <div className="layout-preview border rounded p-3 text-center">
            {currentLayout === 'separate' && (
              <div className="d-flex justify-content-center gap-3">
                <div className="border p-4" style={{ width: '45%', height: '150px' }}>
                  <h6>MCQ Section</h6>
                  <small>Separate Page</small>
                </div>
                <div className="border p-4" style={{ width: '45%', height: '150px' }}>
                  <h6>Subjective Section</h6>
                  <small>Separate Page</small>
                </div>
              </div>
            )}
            
            {currentLayout === 'same_page' && (
              <div className="border p-4" style={{ height: '150px' }}>
                <div className="d-flex justify-content-between h-100">
                  <div className="w-50 border-end p-2">
                    <h6>MCQ Section</h6>
                  </div>
                  <div className="w-50 p-2">
                    <h6>Subjective Section</h6>
                  </div>
                </div>
                <small>Single Page Layout</small>
              </div>
            )}
            
            {currentLayout === 'two_papers' && (
              <div className="d-flex flex-wrap justify-content-center gap-2">
                {[1, 2].map(i => (
                  <div key={i} className="border p-3" style={{ width: '48%', height: '120px' }}>
                    <h6>Paper {i}</h6>
                    <small>MCQ + Subjective</small>
                  </div>
                ))}
                <div className="w-100 mt-2">
                  <small>Two Papers Side by Side</small>
                </div>
              </div>
            )}
            
            {currentLayout === 'three_papers' && (
              <div className="d-flex flex-wrap justify-content-center gap-1">
                {[1, 2, 3].map(i => (
                  <div key={i} className="border p-2" style={{ width: '32%', height: '100px' }}>
                    <h6>Paper {i}</h6>
                    <small>Compact Layout</small>
                  </div>
                ))}
                <div className="w-100 mt-2">
                  <small>Three Papers Per Page</small>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};