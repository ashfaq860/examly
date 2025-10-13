// components/TemplateManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { PaperTemplate, PaperTemplateConfig } from '@/types/types';
import { supabase } from "@/lib/supabaseClient";

interface TemplateManagerProps {
  currentConfig: PaperTemplateConfig;
  onTemplateSelect: (template: PaperTemplate) => void;
  onClose: () => void;
}

export default function TemplateManager({ 
  currentConfig, 
  onTemplateSelect, 
  onClose 
}: TemplateManagerProps) {
  const [templates, setTemplates] = useState<PaperTemplate[]>([]);
  const [userTemplates, setUserTemplates] = useState<PaperTemplate[]>([]);
  const [publicTemplates, setPublicTemplates] = useState<PaperTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [activeTab, setActiveTab] = useState<'user' | 'public'>('user');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;
      
      // Get user's templates
      const { data: userData, error: userError } = await supabase
        .from('paper_templates')
        .select('*')
        .eq('created_by', session.user.id)
        .order('updated_at', { ascending: false });

      if (userError) throw userError;
      
      // Get public templates
      const { data: publicData, error: publicError } = await supabase
        .from('paper_templates')
        .select('*')
        .eq('is_public', true)
        .neq('created_by', session.user.id)
        .order('updated_at', { ascending: false });

      if (publicError) throw publicError;

      setUserTemplates(userData?.map(convertDbTemplate) || []);
      setPublicTemplates(publicData?.map(convertDbTemplate) || []);
      setTemplates([...userData?.map(convertDbTemplate) || [], ...publicData?.map(convertDbTemplate) || []]);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const convertDbTemplate = (dbTemplate: any): PaperTemplate => ({
    id: dbTemplate.id,
    name: dbTemplate.name,
    description: dbTemplate.description,
    config: dbTemplate.config,
    createdBy: dbTemplate.created_by,
    academyId: dbTemplate.academy_id,
    isPublic: dbTemplate.is_public,
    paperType: dbTemplate.paper_type,
    subjectId: dbTemplate.subject_id,
    classId: dbTemplate.class_id,
    createdAt: new Date(dbTemplate.created_at),
    updatedAt: new Date(dbTemplate.updated_at),
  });

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('You must be logged in to save templates');
        return;
      }

      const templateData = {
        name: templateName,
        description: templateDescription,
        config: currentConfig,
        created_by: session.user.id,
        is_public: isPublic,
        paper_type: currentConfig.paperType,
        subject_id: currentConfig.subjectId,
        class_id: currentConfig.classId,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('paper_templates')
        .insert([templateData])
        .select();

      if (error) throw error;

      setShowSaveDialog(false);
      setTemplateName('');
      setTemplateDescription('');
      setIsPublic(false);
      
      loadTemplates();
      alert('Template saved successfully!');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('paper_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      loadTemplates();
      alert('Template deleted successfully!');
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  if (isLoading) {
    return (
      <div className="modal show d-block" tabIndex={-1}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-body text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2">Loading templates...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal show d-block" tabIndex={-1}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Paper Templates</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <ul className="nav nav-tabs">
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'user' ? 'active' : ''}`}
                    onClick={() => setActiveTab('user')}
                  >
                    My Templates
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'public' ? 'active' : ''}`}
                    onClick={() => setActiveTab('public')}
                  >
                    Public Templates
                  </button>
                </li>
              </ul>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setShowSaveDialog(true)}
              >
                Save Current as Template
              </button>
            </div>

            <div className="template-list">
              {(activeTab === 'user' ? userTemplates : publicTemplates).length === 0 ? (
                <div className="alert alert-info">
                  {activeTab === 'user' 
                    ? "You haven't saved any templates yet." 
                    : "No public templates available."
                  }
                </div>
              ) : (
                <div className="row row-cols-1 g-3">
                  {(activeTab === 'user' ? userTemplates : publicTemplates).map(template => (
                    <div key={template.id} className="col">
                      <div className="card">
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="flex-grow-1">
                              <h6 className="card-title">{template.name}</h6>
                              <p className="card-text text-muted small">{template.description}</p>
                              <div className="d-flex gap-2 flex-wrap">
                                <span className="badge bg-primary">{template.config.paperType}</span>
                                <span className="badge bg-secondary">{template.config.language}</span>
                                <span className="badge bg-info">{template.config.mcqCount} MCQs</span>
                                <span className="badge bg-info">{template.config.shortCount} Short</span>
                                <span className="badge bg-info">{template.config.longCount} Long</span>
                                {template.isPublic && <span className="badge bg-success">Public</span>}
                              </div>
                            </div>
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-outline-primary"
                                onClick={() => onTemplateSelect(template)}
                              >
                                Use
                              </button>
                              {activeTab === 'user' && (
                                <button
                                  className="btn btn-outline-danger"
                                  onClick={() => handleDeleteTemplate(template.id)}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Template Dialog */}
      {showSaveDialog && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Save as Template</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowSaveDialog(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Template Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Enter template name"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Enter template description"
                    rows={3}
                  />
                </div>
                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    id="isPublicCheck"
                  />
                  <label className="form-check-label" htmlFor="isPublicCheck">
                    Make this template public
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowSaveDialog(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveTemplate}
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}