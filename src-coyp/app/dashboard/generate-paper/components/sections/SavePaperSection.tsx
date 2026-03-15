// src/app/dashboard/generate-paper/components/sections/SavePaperSection.tsx
'use client';
import React, { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface SavePaperSectionProps {
  paperTitle: string;
  setPaperTitle: (title: string) => void;
  paperDate: string;
  setPaperDate: (date: string) => void;
  setValue: (field: string, value: any) => void;
  watchedClassId: string;
  watchedSubjectId: string;
  watchedChapterOption: string;
  selectedChapters: string[];
  getChapterIdsToUse: () => string[];
  getValues: any;
  watch: any;
  setPaperSaved: (saved: boolean) => void;
}

export const SavePaperSection: React.FC<SavePaperSectionProps> = ({
  paperTitle,
  setPaperTitle,
  paperDate,
  setPaperDate,
  setValue,
  watchedClassId,
  watchedSubjectId,
  watchedChapterOption,
  selectedChapters,
  getChapterIdsToUse,
  getValues,
  watch,
  setPaperSaved
}) => {
  const supabase = createClientComponentClient();
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [saveError, setSaveError] = useState<string>('');

  const handleSavePaper = async () => {
    try {
      setIsSaving(true);
      setSaveMessage('');
      setSaveError('');

      // Validate
      if (!paperTitle.trim()) {
        setSaveError('Please enter a paper title.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setSaveError('Please log in to save the paper.');
        return;
      }

      // Get form values
      const formValues = getValues();
      const chapterIds = getChapterIdsToUse();
      
      if (chapterIds.length === 0) {
        setSaveError('No chapters selected for the paper.');
        return;
      }

      // Prepare paper data
      const paperData = {
        title: paperTitle,
        date_of_paper: paperDate,
        time_minutes: formValues.timeMinutes || 60,
        layout: formValues.mcqPlacement || 'separate',
        class_id: watchedClassId,
        subject_id: watchedSubjectId,
        chapter_ids: chapterIds,
        chapter_option: watchedChapterOption,
        language: formValues.language || 'english',
        source_type: formValues.source_type || 'all',
        shuffle_questions: formValues.shuffleQuestions || true,
        user_id: session.user.id,
        questions: formValues.selectedQuestions || {},
        question_counts: {},
        marks_distribution: {},
        total_marks: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Save to database
      const { data, error } = await supabase
        .from('saved_papers')
        .insert([paperData])
        .select();

      if (error) {
        throw error;
      }

      // Update local state
      setValue('title', paperTitle);
      setValue('dateOfPaper', paperDate);
      setPaperSaved(true);
      
      setSaveMessage('Paper saved successfully! You can find it in your saved papers.');
      
      // Clear message after 5 seconds
      setTimeout(() => {
        setSaveMessage('');
      }, 5000);

    } catch (error: any) {
      console.error('Error saving paper:', error);
      setSaveError(error.message || 'Failed to save paper. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card border-success">
      <div className="card-header bg-success text-white">
        <h5 className="mb-0">
          <i className="bi bi-save me-2"></i>
          Save Paper
        </h5>
      </div>
      <div className="card-body">
        <div className="alert alert-info mb-3">
          <i className="bi bi-info-circle me-2"></i>
          Save your paper to access it later or make copies.
        </div>
        
        <div className="mb-3">
          <label className="form-label">Paper Title *</label>
          <input
            type="text"
            className="form-control"
            value={paperTitle}
            onChange={(e) => setPaperTitle(e.target.value)}
            placeholder="Enter paper title"
            required
          />
        </div>
        
        <div className="mb-3">
          <label className="form-label">Date of Paper</label>
          <input
            type="date"
            className="form-control"
            value={paperDate}
            onChange={(e) => setPaperDate(e.target.value)}
          />
        </div>
        
        <div className="mb-3">
          <label className="form-label">Description (Optional)</label>
          <textarea
            className="form-control"
            rows={3}
            placeholder="Add a description for this paper..."
          />
        </div>
        
        <div className="d-grid">
          <button
            className="btn btn-success btn-lg"
            onClick={handleSavePaper}
            disabled={isSaving || !paperTitle.trim()}
          >
            {isSaving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Saving...
              </>
            ) : (
              <>
                <i className="bi bi-save me-2"></i>
                Save Paper
              </>
            )}
          </button>
        </div>
        
        {saveMessage && (
          <div className="alert alert-success mt-3">
            <i className="bi bi-check-circle me-2"></i>
            {saveMessage}
          </div>
        )}
        
        {saveError && (
          <div className="alert alert-danger mt-3">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {saveError}
          </div>
        )}
        
        <div className="mt-3">
          <small className="text-muted">
            Saved papers can be accessed from the "My Papers" section in your dashboard.
          </small>
        </div>
      </div>
    </div>
  );
};