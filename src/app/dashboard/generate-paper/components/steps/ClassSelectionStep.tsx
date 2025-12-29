'use client';
import React from 'react';
import { Class } from '@/types/types';

interface ClassSelectionStepProps {
  classes: Class[];
  watchedClassId: string;
  setValue: (field: string, value: any) => void;
  errors: any;
}

export const ClassSelectionStep: React.FC<ClassSelectionStepProps> = ({
  classes,
  watchedClassId,
  setValue,
  errors
}) => {
  return (
    <div className="step-card step-transition">
      <div className="text-center mb-3">
        <h5 className="fw-bold mb-3">🎓 Select Your Class</h5>
        <p className="text-muted d-none d-sm-inline">Choose the class for which you want to generate the paper</p>
      </div>
      
      {classes.length === 0 ? (
        <div className="loading-state text-center py-5">
          <div className="spinner-border text-primary mb-3" role="status" style={{width: '3rem', height: '3rem'}}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="fs-5 text-muted">Loading classes...</p>
        </div>
      ) : (
        <div className="row row-cols-2 row-cols-md-4 g-4">
          {classes.map((cls) => (
            <div key={cls.id} className="col">
              <div
                className={`option-card card h-20 text-center p-2 cursor-pointer ${
                  watchedClassId === cls.id ? "active border-primary" : "border-light"
                }`}
                onClick={() => setValue("classId", cls.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="card-body d-flex flex-column justify-content-center p-2 p-sm-1">
                  <span className="display-6 mb-3">🎓</span>
                  <h6 className="fw-semibold mb-2">Class {cls.name}</h6>
                  <small className="text-muted d-none d-sm-inline">Select to continue</small>
                  
                  {watchedClassId === cls.id && (
                    <div className="mt-3">
                      <span className="badge bg-primary rounded-pill">
                        <i className="bi bi-check-circle me-1"></i>
                        Selected
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {errors.classId && (
        <div className="alert alert-danger mt-3" role="alert">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {errors.classId.message}
        </div>
      )}
    </div>
  );
};