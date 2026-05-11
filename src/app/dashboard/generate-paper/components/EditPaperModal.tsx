// src/app/dashboard/generate-paper/components/EditPaperModal.tsx
'use client';
import React, { useState } from 'react';
import { Question } from '@/types/types';

interface EditPaperModalProps {
  watch: any;
  setValue: (field: string, value: any) => void;
  register: any;
  errors: any;
  onClose: () => void;
  previewQuestions: Record<string, Question[]>;
  setPreviewQuestions: (questions: any) => void;
  getQuestionTypes: () => any[];
  subjects: any[];
  classes: any[];
}

export const EditPaperModal: React.FC<EditPaperModalProps> = ({
  watch,
  setValue,
  register,
  errors,
  onClose,
  previewQuestions,
  setPreviewQuestions,
  getQuestionTypes,
  subjects,
  classes
}) => {
  const [editMode, setEditMode] = useState(false);

  const handleSave = () => {
    // Save all changes
    onClose();
  };

  const updateQuestionText = (type: string, questionId: string, newText: string) => {
    setPreviewQuestions(prev => ({
      ...prev,
      [type]: prev[type].map(q => 
        q.id === questionId 
          ? { ...q, question_text: newText }
          : q
      )
    }));
  };

  const updateQuestionMarks = (type: string, questionId: string, marks: number) => {
    setPreviewQuestions(prev => ({
      ...prev,
      [type]: prev[type].map(q => 
        q.id === questionId 
          ? { ...q, customMarks: marks }
          : q
      )
    }));
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Edit Paper</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {/* Paper Header Editing */}
            <div className="mb-4">
              <h6>Paper Header</h6>
              <div className="row">
                <div className="col-md-6">
                  <label className="form-label">Paper Title</label>
                  <input
                    type="text"
                    className="form-control"
                    value={watch('title') || ''}
                    onChange={(e) => setValue('title', e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={watch('dateOfPaper') || ''}
                    onChange={(e) => setValue('dateOfPaper', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Enable Edit Mode */}
            <div className="mb-4">
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={editMode}
                  onChange={(e) => setEditMode(e.target.checked)}
                  id="editModeToggle"
                />
                <label className="form-check-label" htmlFor="editModeToggle">
                  Enable Edit Mode
                </label>
              </div>
              {editMode && (
                <div className="alert alert-info mt-2">
                  <i className="bi bi-info-circle me-2"></i>
                  You can now edit question text, marks, and reorder questions.
                </div>
              )}
            </div>

            {/* Question Editing */}
            {editMode && (
              <div>
                <h6>Edit Questions</h6>
                {getQuestionTypes().map(type => {
                  const questions = previewQuestions[type.value] || [];
                  if (questions.length === 0) return null;

                  return (
                    <div key={type.value} className="mb-3">
                      <h6 className="text-primary">{type.label} Questions</h6>
                      {questions.map((question, index) => (
                        <div key={question.id} className="card mb-2">
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-start">
                              <div className="flex-grow-1">
                                <div className="mb-2">
                                  <label className="form-label small">Question {index + 1}</label>
                                  <textarea
                                    className="form-control"
                                    value={question.question_text || ''}
                                    onChange={(e) => updateQuestionText(type.value, question.id, e.target.value)}
                                    rows={3}
                                  />
                                </div>
                                
                                {/* MCQ Options Editing */}
                                {type.value === 'mcq' && (
                                  <div className="row">
                                    {['option_a', 'option_b', 'option_c', 'option_d'].map(opt => (
                                      <div key={opt} className="col-6 mb-1">
                                        <label className="form-label small">
                                          Option {opt.split('_')[1].toUpperCase()}
                                        </label>
                                        <input
                                          type="text"
                                          className="form-control form-control-sm"
                                          value={question[opt as keyof Question] as string || ''}
                                          onChange={(e) => {
                                            const newQuestions = { ...previewQuestions };
                                            const qIndex = newQuestions[type.value].findIndex(q => q.id === question.id);
                                            if (qIndex !== -1) {
                                              newQuestions[type.value][qIndex][opt as keyof Question] = e.target.value;
                                              setPreviewQuestions(newQuestions);
                                            }
                                          }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              <div className="ms-3">
                                <div className="mb-2">
                                  <label className="form-label small">Marks</label>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={question.customMarks || 1}
                                    onChange={(e) => updateQuestionMarks(type.value, question.id, parseInt(e.target.value) || 1)}
                                    style={{ width: '80px' }}
                                    min="1"
                                  />
                                </div>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => {
                                    const newQuestions = { ...previewQuestions };
                                    newQuestions[type.value] = newQuestions[type.value].filter(q => q.id !== question.id);
                                    setPreviewQuestions(newQuestions);
                                  }}
                                >
                                  <i className="bi bi-trash"></i> Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};