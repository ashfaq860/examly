// src/app/dashboard/generate-paper/components/sections/PaperEditorSection.tsx
'use client';
import React, { useState } from 'react';
import { Question } from '@/types/types';

interface PaperEditorSectionProps {
  watch: any;
  setValue: (field: string, value: any) => void;
  paperTitle: string;
  setPaperTitle: (title: string) => void;
  paperDate: string;
  setPaperDate: (date: string) => void;
  previewQuestions: Record<string, Question[]>;
  setPreviewQuestions: (questions: any) => void;
  loadPreviewQuestions: () => Promise<void>;
}

export const PaperEditorSection: React.FC<PaperEditorSectionProps> = ({
  watch,
  setValue,
  paperTitle,
  setPaperTitle,
  paperDate,
  setPaperDate,
  previewQuestions,
  setPreviewQuestions,
  loadPreviewQuestions
}) => {
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // Handle question text editing
  const startEditingQuestion = (questionId: string, currentText: string) => {
    setEditingQuestionId(questionId);
    setEditingText(currentText);
  };

  const saveQuestionEdit = () => {
    if (!editingQuestionId) return;

    // Find and update the question
    const updatedQuestions = { ...previewQuestions };
    let questionUpdated = false;

    Object.keys(updatedQuestions).forEach(type => {
      updatedQuestions[type] = updatedQuestions[type].map(q => {
        if (q.id === editingQuestionId) {
          questionUpdated = true;
          return { ...q, question_text: editingText };
        }
        return q;
      });
    });

    if (questionUpdated) {
      setPreviewQuestions(updatedQuestions);
      alert('Question updated successfully!');
    }

    setEditingQuestionId(null);
    setEditingText('');
  };

  // Handle paper header editing
  const updatePaperHeader = (field: string, value: string) => {
    setValue(field, value);
    
    if (field === 'title') {
      setPaperTitle(value);
    } else if (field === 'dateOfPaper') {
      setPaperDate(value);
    }
  };

  // Handle question marks editing
  const updateQuestionMarks = (questionId: string, marks: number) => {
    const updatedQuestions = { ...previewQuestions };
    let questionUpdated = false;

    Object.keys(updatedQuestions).forEach(type => {
      updatedQuestions[type] = updatedQuestions[type].map(q => {
        if (q.id === questionId) {
          questionUpdated = true;
          return { ...q, customMarks: marks };
        }
        return q;
      });
    });

    if (questionUpdated) {
      setPreviewQuestions(updatedQuestions);
    }
  };

  // Reset all changes
  const resetChanges = () => {
    if (window.confirm('Reset all edits? This will revert to original questions.')) {
      loadPreviewQuestions();
    }
  };

  return (
    <div className="card border-warning">
      <div className="card-header bg-warning text-dark">
        <h5 className="mb-0">
          <i className="bi bi-pencil me-2"></i>
          Paper Editor
        </h5>
      </div>
      <div className="card-body">
        <div className="alert alert-warning">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Edit Mode Active: Click on any text to edit it directly.
        </div>
        
        <div className="row">
          <div className="col-md-6">
            <div className="mb-3">
              <label className="form-label">Paper Title</label>
              <input
                type="text"
                className="form-control"
                value={paperTitle}
                onChange={(e) => updatePaperHeader('title', e.target.value)}
                placeholder="Enter paper title"
              />
            </div>
            
            <div className="mb-3">
              <label className="form-label">Date of Paper</label>
              <input
                type="date"
                className="form-control"
                value={paperDate}
                onChange={(e) => updatePaperHeader('dateOfPaper', e.target.value)}
              />
            </div>
            
            <div className="mb-3">
              <label className="form-label">Total Time (minutes)</label>
              <input
                type="number"
                className="form-control"
                value={watch('timeMinutes') || 60}
                onChange={(e) => updatePaperHeader('timeMinutes', e.target.value)}
                min="1"
              />
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="mb-3">
              <label className="form-label">Language</label>
              <select
                className="form-select"
                value={watch('language') || 'english'}
                onChange={(e) => updatePaperHeader('language', e.target.value)}
              >
                <option value="english">English</option>
                <option value="urdu">Urdu</option>
                <option value="bilingual">Bilingual</option>
              </select>
            </div>
            
            <div className="mb-3">
              <label className="form-label">Shuffle Questions</label>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={watch('shuffleQuestions')}
                  onChange={(e) => updatePaperHeader('shuffleQuestions', e.target.checked.toString())}
                />
                <label className="form-check-label">
                  Randomize question order
                </label>
              </div>
            </div>
            
            <div className="d-grid gap-2">
              <button
                className="btn btn-outline-danger"
                onClick={resetChanges}
              >
                <i className="bi bi-arrow-clockwise me-2"></i>
                Reset All Changes
              </button>
            </div>
          </div>
        </div>
        
        {/* Question Editing */}
        <div className="mt-4">
          <h6>Edit Questions:</h6>
          <div className="list-group" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {Object.keys(previewQuestions).map(type => (
              previewQuestions[type].map((question, index) => (
                <div key={question.id} className="list-group-item">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <small className="text-muted">{type.toUpperCase()} - Q{index + 1}</small>
                      {editingQuestionId === question.id ? (
                        <div className="mt-2">
                          <textarea
                            className="form-control"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            rows={3}
                          />
                          <div className="mt-2">
                            <button
                              className="btn btn-sm btn-success me-2"
                              onClick={saveQuestionEdit}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => setEditingQuestionId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="mt-1 cursor-pointer"
                          onClick={() => startEditingQuestion(question.id, question.question_text || '')}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="text-truncate">
                            {question.question_text || 'No question text'}
                          </div>
                          <small className="text-primary">Click to edit</small>
                        </div>
                      )}
                    </div>
                    <div className="ms-3">
                      <div className="input-group input-group-sm" style={{ width: '120px' }}>
                        <span className="input-group-text">Marks</span>
                        <input
                          type="number"
                          className="form-control"
                          value={question.customMarks || 1}
                          onChange={(e) => updateQuestionMarks(question.id, parseInt(e.target.value) || 1)}
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};