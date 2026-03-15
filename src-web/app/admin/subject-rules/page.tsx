'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Class, Subject, Chapter, ChapterRangeRule } from '@/types/types';
import toast from 'react-hot-toast';
import {
  BookOpen,
  Save,
  Trash2,
  RefreshCw,
  Info,
  Plus,
  Check,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  Hash,
  Type,
  Eye,
  Copy,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  XCircle,
  BarChart3,
  Layers,
  Target,
  Grid,
   FileText,
  List
} from 'lucide-react';
import './subject-rules.css';

const supabase = createClientComponentClient();

interface QuestionTypeConfig {
  id: string;
  label: string;
  key: string;
  defaultMin?: number;
  defaultMax?: number;
}

interface ChapterRangeForm {
  id?: string;
  chapter_start: string;
  chapter_end: string;
  question_type: string;
  rule_mode: 'total' | 'per_chapter';
  min_questions: string;
  max_questions: string;
  class_id?: string; 
}

export default function SubjectRulesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [rules, setRules] = useState<ChapterRangeRule[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  // State for new rule form
  const [showNewRuleForm, setShowNewRuleForm] = useState(false);
  const [newRule, setNewRule] = useState<ChapterRangeForm>({
    chapter_start: '',
    chapter_end: '',
    question_type: 'mcq',
    rule_mode: 'total',
    min_questions: '',
    max_questions: '',
    class_id: selectedClass || '' 
  });
  
  // State for editing existing rule
  const [editingRule, setEditingRule] = useState<ChapterRangeRule | null>(null);
  const [editForm, setEditForm] = useState<ChapterRangeForm>({
    chapter_start: '',
    chapter_end: '',
    question_type: 'mcq',
    rule_mode: 'total',
    min_questions: '',
    max_questions: '',
    class_id: selectedClass || ''
  });

  // Fetch classes
  useEffect(() => {
    fetchClasses();
  }, []);

  // Fetch subjects when class changes
  useEffect(() => {
    if (selectedClass) {
      fetchSubjects(selectedClass);
    } else {
      setSubjects([]);
      setChapters([]);
      setRules([]);
      setSelectedSubject('');
    }
  }, [selectedClass]);

  // Fetch chapters and rules when subject changes
  useEffect(() => {
    if (selectedSubject) {
      fetchChapters(selectedClass, selectedSubject);
      fetchRules(selectedSubject);
    } else {
      setChapters([]);
      setRules([]);
      setApiError(null);
    }
  }, [selectedSubject, selectedClass]);

  const fetchClasses = async () => {
    try {
      const response = await fetch('/api/classes');
      if (!response.ok) throw new Error('Failed to fetch classes');
      const data = await response.json();
      setClasses(data);
    } catch (error: any) {
      console.error('Error fetching classes:', error);
      toast.error(`Failed to load classes: ${error.message}`);
    }
  };

  const fetchSubjects = async (classId: string) => {
    try {
      const response = await fetch(`/api/subjects?classId=${classId}`);
      if (!response.ok) throw new Error('Failed to fetch subjects');
      const data = await response.json();
      setSubjects(data);
    } catch (error: any) {
      console.error('Error fetching subjects:', error);
      toast.error(`Failed to load subjects: ${error.message}`);
    }
  };

  const fetchChapters = async (classId: string, subjectId: string) => {
    try {
       const response = await fetch(`/api/chapters?subjectId=${subjectId}&classId=${classId}`);
  if (!response.ok) throw new Error('Failed to fetch chapters');
      const data = await response.json();
      setChapters(data.sort((a: any, b: any) => a.chapterNo - b.chapterNo));
    } catch (error: any) {
      console.error('Error fetching chapters:', error);
      toast.error(`Failed to load chapters: ${error.message}`);
    }
  };

  const fetchRules = async (subjectId: string) => {
    setLoading(true);
    setApiError(null);
    setDebugInfo(null);
    
    try {
      console.log('Fetching rules for subject:', subjectId);
      
    //  const response = await fetch(`/api/chapter-range-rules?subjectId=${subjectId}`);
      const url = `/api/chapter-range-rules?subjectId=${subjectId}${selectedClass ? `&classId=${selectedClass}` : ''}`;
    const response = await fetch(url); 
    console.log('Response status:', response.status);
      
      if (!response.ok) {
        let errorMessage = `Failed to fetch rules: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          setDebugInfo({
            status: response.status,
            error: errorData,
            url: `/api/chapter-range-rules?subjectId=${subjectId}`
          });
        } catch (jsonError) {
          const textError = await response.text();
          errorMessage = textError || errorMessage;
          setDebugInfo({
            status: response.status,
            textError: textError,
            url: `/api/chapter-range-rules?subjectId=${subjectId}`
          });
        }
        
        setApiError(errorMessage);
        toast.error(errorMessage);
        setRules([]);
        return;
      }
      
      const data = await response.json();
      console.log('Fetched rules data:', data);
      setRules(data);
      
      setDebugInfo({
        status: response.status,
        count: data.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('Network error fetching rules:', error);
      const errorMsg = error.message || 'Network error. Please check your connection.';
      setApiError(errorMsg);
      setDebugInfo({
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      toast.error(errorMsg);
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  const getQuestionTypes = (): QuestionTypeConfig[] => {
    const subject = subjects.find(s => s.id === selectedSubject);
    if (!subject) return [];
    
    const subjectName = subject.name.toLowerCase();
    
    const baseTypes: QuestionTypeConfig[] = [
      { id: 'mcq', label: 'MCQ', key: 'mcq', defaultMin: 3, defaultMax: 5 },
      { id: 'short', label: 'Short Answer', key: 'short', defaultMin: 2, defaultMax: 4 },
      { id: 'long', label: 'Long Answer', key: 'long', defaultMin: 1, defaultMax: 2 },
    ];

    if (subjectName === 'english') {
      return [
        ...baseTypes,
        { id: 'translate_urdu', label: 'Translate Urdu', key: 'translate_urdu' },
        { id: 'translate_english', label: 'Translate English', key: 'translate_english' },
        { id: 'idiom_phrases', label: 'Idiom/Phrases', key: 'idiom_phrases' },
        { id: 'passage', label: 'Passage', key: 'passage' },
        { id: 'directindirect', label: 'Direct/Indirect', key: 'directindirect' },
        { id: 'activepassive', label: 'Active/Passive', key: 'activepassive' }
      ];
    } else if (subjectName === 'urdu') {
      return [
        ...baseTypes,
        { id: 'poetry_explanation', label: 'Poetry Explanation', key: 'poetry_explanation' },
        { id: 'prose_explanation', label: 'Prose Explanation', key: 'prose_explanation' },
        { id: 'sentence_correction', label: 'Sentence Correction', key: 'sentence_correction' },
        { id: 'sentence_completion', label: 'Sentence Completion', key: 'sentence_completion' },
        { id: 'darkhwast_khat', label: 'Darkhwast Khat', key: 'darkhwast_khat' },
        { id: 'kahani_makalma', label: 'Kahani Makalma', key: 'kahani_makalma' },
        { id: 'nasarkhulasa_markzikhyal', label: 'Nasri Khulasa', key: 'nasarkhulasa_markzikhyal' }
      ];
    }
    
    return baseTypes;
  };

  const handleCreateRule = async () => {
    if (!selectedSubject) {
      toast.error('Please select a subject first');
      return;
    }

    // Validate form
    if (!newRule.chapter_start || !newRule.chapter_end) {
      toast.error('Please specify chapter range');
      return;
    }

    if (!newRule.min_questions) {
      toast.error('Please specify minimum questions');
      return;
    }

    const start = parseInt(newRule.chapter_start);
    const end = parseInt(newRule.chapter_end);
    const min = parseInt(newRule.min_questions);
    const max = newRule.max_questions ? parseInt(newRule.max_questions) : null;

    if (start > end) {
      toast.error('Start chapter must be less than or equal to end chapter');
      return;
    }

    if (max !== null && max < min) {
      toast.error('Maximum questions must be greater than or equal to minimum');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/chapter-range-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_id: selectedSubject,
           class_id: selectedClass,
          chapter_start: start,
          chapter_end: end,
          question_type: newRule.question_type,
          rule_mode: newRule.rule_mode,
          min_questions: min,
          max_questions: max,
         
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Rule created successfully!');
        setShowNewRuleForm(false);
        setNewRule({
          chapter_start: '',
          chapter_end: '',
          question_type: 'mcq',
          rule_mode: 'total',
          min_questions: '',
          max_questions: '',
          class_id: selectedClass
        });
        await fetchRules(selectedSubject);
      } else {
        throw new Error(result.error || 'Failed to create rule');
      }
    } catch (error: any) {
      console.error('Error creating rule:', error);
      toast.error(error.message || 'Failed to create rule');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;

    // Validate form
    if (!editForm.chapter_start || !editForm.chapter_end) {
      toast.error('Please specify chapter range');
      return;
    }

    if (!editForm.min_questions) {
      toast.error('Please specify minimum questions');
      return;
    }

    const start = parseInt(editForm.chapter_start);
    const end = parseInt(editForm.chapter_end);
    const min = parseInt(editForm.min_questions);
    const max = editForm.max_questions ? parseInt(editForm.max_questions) : null;

    if (start > end) {
      toast.error('Start chapter must be less than or equal to end chapter');
      return;
    }

    if (max !== null && max < min) {
      toast.error('Maximum questions must be greater than or equal to minimum');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/chapter-range-rules?id=${editingRule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_id: selectedSubject,
           class_id: selectedClass,
          chapter_start: start,
          chapter_end: end,
          question_type: editForm.question_type,
          rule_mode: editForm.rule_mode,
          min_questions: min,
          max_questions: max
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Rule updated successfully!');
        setEditingRule(null);
        setEditForm({
          chapter_start: '',
          chapter_end: '',
          question_type: 'mcq',
          rule_mode: 'total',
          min_questions: '',
          max_questions: '',
          class_id: selectedClass
        });
        await fetchRules(selectedSubject);
      } else {
        throw new Error(result.error || 'Failed to update rule');
      }
    } catch (error: any) {
      console.error('Error updating rule:', error);
      toast.error(error.message || 'Failed to update rule');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/chapter-range-rules?id=${ruleId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Rule deleted successfully!');
        await fetchRules(selectedSubject);
      } else {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete rule');
      }
    } catch (error: any) {
      console.error('Error deleting rule:', error);
      toast.error(error.message || 'Failed to delete rule');
    } finally {
      setLoading(false);
    }
  };

  const startEditRule = (rule: ChapterRangeRule) => {
    setEditingRule(rule);
    setEditForm({
      chapter_start: rule.chapter_start.toString(),
      chapter_end: rule.chapter_end.toString(),
      question_type: rule.question_type,
      rule_mode: rule.rule_mode,
      min_questions: rule.min_questions.toString(),
      max_questions: rule.max_questions?.toString() || '',
       class_id: rule.class_id || selectedClass
    });
  };

  const getFilteredRules = () => {
    let filtered = [...rules];
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(rule => {
        const questionType = getQuestionTypes().find(t => t.key === rule.question_type);
        return (
          `chapters ${rule.chapter_start}-${rule.chapter_end}`.toLowerCase().includes(query) ||
          (questionType?.label.toLowerCase().includes(query)) ||
          rule.question_type.toLowerCase().includes(query)
        );
      });
    }
    
    // Sort by chapter range
    filtered.sort((a, b) => {
      if (a.chapter_start !== b.chapter_start) {
        return a.chapter_start - b.chapter_start;
      }
      if (a.chapter_end !== b.chapter_end) {
        return a.chapter_end - b.chapter_end;
      }
      return a.question_type.localeCompare(b.question_type);
    });
    
    return filtered;
  };

  const getRulesByChapterRange = () => {
    const ranges: { [key: string]: ChapterRangeRule[] } = {};
    
    rules.forEach(rule => {
      const key = `${rule.chapter_start}-${rule.chapter_end}`;
      if (!ranges[key]) {
        ranges[key] = [];
      }
      ranges[key].push(rule);
    });
    
    return ranges;
  };

  const getTotalChapters = () => {
    if (chapters.length === 0) return 0;
    return Math.max(...chapters.map(c => c.chapterNo));
  };

  const getChapterRulesSummary = () => {
    const summary: any[] = [];
    const ranges = getRulesByChapterRange();
    
    Object.keys(ranges).forEach(rangeKey => {
      const [start, end] = rangeKey.split('-').map(Number);
      const rulesInRange = ranges[rangeKey];
      
      const questionTypes = rulesInRange.map(rule => {
        const typeConfig = getQuestionTypes().find(t => t.key === rule.question_type);
        return {
          type: typeConfig?.label || rule.question_type,
          min: rule.min_questions,
          max: rule.max_questions,
          mode: rule.rule_mode
        };
      });
      
      summary.push({
        range: `${start}-${end}`,
        start,
        end,
        questionTypes,
        ruleCount: rulesInRange.length
      });
    });
    
    return summary.sort((a, b) => a.start - b.start);
  };

  return (
    <AdminLayout>
      <div className="container-fluid py-4">
        {/* Header Section */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card shadow-sm border-0">
              <div className="card-body p-4">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
                  <div className="mb-3 mb-md-0">
                    <h1 className="h3 mb-2 text-primary d-flex align-items-center">
                      <BookOpen className="me-3" size={28} />
                      Chapter Range Rules Management
                    </h1>
                    <p className="text-muted mb-0 d-flex align-items-center">
                      <Info size={16} className="me-2" />
                      Set question distribution rules for chapter ranges (e.g., Chapters 1-4)
                    </p>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary-subtle text-primary fs-6 px-3 py-2">
                      <CheckCircle size={16} className="me-2" />
                      {rules.length} Rules Defined
                    </span>
                  </div>
                </div>

                {/* Error Display */}
                {apiError && (
                  <div className="alert alert-danger alert-dismissible fade show mb-4">
                    <div className="d-flex align-items-center">
                      <AlertCircle size={20} className="me-2" />
                      <strong>API Error:</strong> {apiError}
                    </div>
                    {debugInfo && (
                      <div className="mt-2">
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => {
                            console.log('Debug Info:', debugInfo);
                            navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
                            toast.success('Debug info copied to clipboard');
                          }}
                        >
                          Copy Debug Info
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setApiError(null)}
                    ></button>
                  </div>
                )}

                {/* Selection Controls */}
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <label className="form-label fw-medium">
                      <BookOpen size={16} className="me-2" />
                      Class
                    </label>
                    <select
                      className="form-select form-select-lg"
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      disabled={loading}
                    >
                      <option value="">Select Class</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label fw-medium">
                      <FileText size={16} className="me-2" />
                      Subject
                    </label>
                    <select
                      className="form-select form-select-lg"
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      disabled={!selectedClass || loading}
                    >
                      <option value="">Select Subject</option>
                      {subjects.map(sub => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label fw-medium">
                      <Search size={16} className="me-2" />
                      Search Rules
                    </label>
                    <div className="input-group input-group-lg">
                      <span className="input-group-text bg-transparent border-end-0">
                        <Search size={18} />
                      </span>
                      <input
                        type="text"
                        className="form-control border-start-0"
                        placeholder="Search by chapter range or question type..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="d-flex flex-wrap justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-3">
                    <button
                      className="btn btn-primary d-flex align-items-center"
                      onClick={() => fetchRules(selectedSubject)}
                      disabled={!selectedSubject || loading}
                    >
                      <RefreshCw className={`me-2 ${loading ? 'spin' : ''}`} size={18} />
                      {loading ? 'Loading...' : 'Refresh Rules'}
                    </button>
                    
                    {selectedSubject && (
                      <div className="text-muted d-flex align-items-center gap-3">
                        <span>
                          <Hash size={14} className="me-1" />
                          <strong>{getTotalChapters()}</strong> Total Chapters
                        </span>
                        <span className="vr"></span>
                        <span>
                          <Layers size={14} className="me-1" />
                          <strong>{Object.keys(getRulesByChapterRange()).length}</strong> Ranges
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {selectedSubject && (
                    <div className="mt-2 mt-md-0">
                      <button
                        className="btn btn-success d-flex align-items-center"
                        onClick={() => setShowNewRuleForm(true)}
                        disabled={loading}
                      >
                        <Plus size={18} className="me-2" />
                        Add New Rule
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* New Rule Form Modal */}
        {showNewRuleForm && (
          <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <Plus size={20} className="me-2" />
                    Add New Chapter Range Rule
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowNewRuleForm(false)}
                    disabled={loading}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Start Chapter</label>
                      <input
                        type="number"
                        className="form-control"
                        min="1"
                        max={getTotalChapters()}
                        value={newRule.chapter_start}
                        onChange={(e) => setNewRule({...newRule, chapter_start: e.target.value})}
                        disabled={loading}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">End Chapter</label>
                      <input
                        type="number"
                        className="form-control"
                        min={newRule.chapter_start || 1}
                        max={getTotalChapters()}
                        value={newRule.chapter_end}
                        onChange={(e) => setNewRule({...newRule, chapter_end: e.target.value})}
                        disabled={loading}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Question Type</label>
                      <select
                        className="form-select"
                        value={newRule.question_type}
                        onChange={(e) => setNewRule({...newRule, question_type: e.target.value})}
                        disabled={loading}
                      >
                        {getQuestionTypes().map(type => (
                          <option key={type.id} value={type.key}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Rule Mode</label>
                      <select
                        className="form-select"
                        value={newRule.rule_mode}
                        onChange={(e) => setNewRule({...newRule, rule_mode: e.target.value as 'total' | 'per_chapter'})}
                        disabled={loading}
                      >
                        <option value="total">Total Questions for Range</option>
                        <option value="per_chapter">Questions Per Chapter</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Minimum Questions</label>
                      <input
                        type="number"
                        className="form-control"
                        min="0"
                        value={newRule.min_questions}
                        onChange={(e) => setNewRule({...newRule, min_questions: e.target.value})}
                        disabled={loading}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Maximum Questions (optional)</label>
                      <input
                        type="number"
                        className="form-control"
                        min={newRule.min_questions || 0}
                        value={newRule.max_questions}
                        onChange={(e) => setNewRule({...newRule, max_questions: e.target.value})}
                        disabled={loading}
                        placeholder="Leave empty for no limit"
                      />
                    </div>
                    <div className="col-12">
                      <div className="alert alert-info">
                        <Info size={16} className="me-2" />
                        {newRule.rule_mode === 'total' ? 
                          'Total Questions for Range: Select X questions from any chapters in the range' :
                          'Questions Per Chapter: Select X questions from EACH chapter in the range'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowNewRuleForm(false)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCreateRule}
                    disabled={loading}
                  >
                    {loading ? 'Creating...' : 'Create Rule'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Rule Form Modal */}
        {editingRule && (
          <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <Copy size={20} className="me-2" />
                    Edit Chapter Range Rule
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setEditingRule(null)}
                    disabled={loading}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Start Chapter</label>
                      <input
                        type="number"
                        className="form-control"
                        min="1"
                        max={getTotalChapters()}
                        value={editForm.chapter_start}
                        onChange={(e) => setEditForm({...editForm, chapter_start: e.target.value})}
                        disabled={loading}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">End Chapter</label>
                      <input
                        type="number"
                        className="form-control"
                        min={editForm.chapter_start || 1}
                        max={getTotalChapters()}
                        value={editForm.chapter_end}
                        onChange={(e) => setEditForm({...editForm, chapter_end: e.target.value})}
                        disabled={loading}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Question Type</label>
                      <select
                        className="form-select"
                        value={editForm.question_type}
                        onChange={(e) => setEditForm({...editForm, question_type: e.target.value})}
                        disabled={loading}
                      >
                        {getQuestionTypes().map(type => (
                          <option key={type.id} value={type.key}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Rule Mode</label>
                      <select
                        className="form-select"
                        value={editForm.rule_mode}
                        onChange={(e) => setEditForm({...editForm, rule_mode: e.target.value as 'total' | 'per_chapter'})}
                        disabled={loading}
                      >
                        <option value="total">Total Questions for Range</option>
                        <option value="per_chapter">Questions Per Chapter</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Minimum Questions</label>
                      <input
                        type="number"
                        className="form-control"
                        min="0"
                        value={editForm.min_questions}
                        onChange={(e) => setEditForm({...editForm, min_questions: e.target.value})}
                        disabled={loading}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Maximum Questions (optional)</label>
                      <input
                        type="number"
                        className="form-control"
                        min={editForm.min_questions || 0}
                        value={editForm.max_questions}
                        onChange={(e) => setEditForm({...editForm, max_questions: e.target.value})}
                        disabled={loading}
                        placeholder="Leave empty for no limit"
                      />
                    </div>
                    <div className="col-12">
                      <div className="alert alert-info">
                        <Info size={16} className="me-2" />
                        {editForm.rule_mode === 'total' ? 
                          'Total Questions for Range: Select X questions from any chapters in the range' :
                          'Questions Per Chapter: Select X questions from EACH chapter in the range'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditingRule(null)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleUpdateRule}
                    disabled={loading}
                  >
                    {loading ? 'Updating...' : 'Update Rule'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-0 bg-light">
                <div className="card-body text-center py-5">
                  <div className="spinner-border text-primary mb-3" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="text-muted mb-0">Loading rules data...</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedSubject ? (
          chapters.length > 0 ? (
            <>
              {/* Question Types Legend */}
              <div className="row mb-4">
                <div className="col-12">
                  <div className="card shadow-sm border-0">
                    <div className="card-body p-4">
                      <h5 className="card-title d-flex align-items-center mb-4">
                        <BarChart3 size={20} className="me-2" />
                        Available Question Types
                      </h5>
                      <div className="d-flex flex-wrap gap-3">
                        {getQuestionTypes().map((type) => (
                          <div key={type.id} className="d-flex align-items-center gap-2 px-3 py-2 bg-light rounded">
                            <span className="fw-medium">{type.label}</span>
                            {type.defaultMin !== undefined && (
                              <span className="badge bg-primary-subtle text-primary">
                                Default: {type.defaultMin}-{type.defaultMax || '∞'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rules Table */}
              <div className="row">
                <div className="col-12">
                  <div className="card shadow-sm border-0">
                    <div className="card-body p-0">
                      <div className="table-responsive">
                        <table className="table table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th className="ps-4" style={{ width: '150px' }}>
                                <div className="d-flex align-items-center">
                                  <Layers size={16} className="me-2" />
                                  Chapter Range
                                </div>
                              </th>
                              <th className="text-center" style={{ width: '150px' }}>
                                <div className="d-flex align-items-center justify-content-center">
                                  <Target size={16} className="me-2" />
                                  Question Type
                                </div>
                              </th>
                              <th className="text-center" style={{ width: '120px' }}>
                                Rule Mode
                              </th>
                              <th className="text-center" style={{ width: '150px' }}>
                                Questions
                              </th>
                              <th className="text-center" style={{ width: '200px' }}>
                                Description
                              </th>
                              <th className="text-center pe-4" style={{ width: '150px' }}>
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {getFilteredRules().map(rule => {
                              const typeConfig = getQuestionTypes().find(t => t.key === rule.question_type);
                              const isTotalMode = rule.rule_mode === 'total';
                              const chapterCount = rule.chapter_end - rule.chapter_start + 1;
                              
                              return (
                                <tr key={rule.id}>
                                  <td className="ps-4 align-middle">
                                    <div className="d-flex align-items-center">
                                      <span className="badge bg-primary rounded-pill px-3 py-2">
                                        Chapters {rule.chapter_start} - {rule.chapter_end}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="text-center align-middle">
                                    <div className="fw-medium">{typeConfig?.label || rule.question_type}</div>
                                  </td>
                                  <td className="text-center align-middle">
                                    <span className={`badge ${isTotalMode ? 'bg-info' : 'bg-warning'}`}>
                                      {isTotalMode ? 'Total for Range' : 'Per Chapter'}
                                    </span>
                                  </td>
                                  <td className="text-center align-middle">
                                    <div className="fw-bold">
                                      {rule.min_questions}
                                      {rule.max_questions ? ` - ${rule.max_questions}` : ' +'}
                                    </div>
                                  </td>
                                  <td className="text-center align-middle">
                                    <div className="text-muted small">
                                      {isTotalMode ? 
                                        `Select ${rule.min_questions}${rule.max_questions ? `-${rule.max_questions}` : ''} questions from ${chapterCount} chapters` :
                                        `Select ${rule.min_questions}${rule.max_questions ? `-${rule.max_questions}` : ''} questions from EACH of ${chapterCount} chapters`
                                      }
                                    </div>
                                  </td>
                                  <td className="pe-4 align-middle">
                                    <div className="d-flex justify-content-center gap-2">
                                      <button
                                        className="btn btn-sm btn-primary d-flex align-items-center"
                                        onClick={() => startEditRule(rule)}
                                        disabled={loading}
                                        title="Edit rule"
                                      >
                                        <Copy size={16} className="me-1" />
                                        Edit
                                      </button>
                                      <button
                                        className="btn btn-sm btn-outline-danger d-flex align-items-center"
                                        onClick={() => handleDeleteRule(rule.id)}
                                        disabled={loading}
                                        title="Delete rule"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        
                        {getFilteredRules().length === 0 && (
                          <div className="text-center py-5">
                            <Search size={48} className="text-muted mb-3" />
                            <h5 className="text-muted">No rules found</h5>
                            <p className="text-muted mb-3">
                              {rules.length === 0 ? 
                                'No rules have been created for this subject yet.' :
                                'Try adjusting your search criteria.'
                              }
                            </p>
                            {rules.length === 0 && (
                              <button
                                className="btn btn-success"
                                onClick={() => setShowNewRuleForm(true)}
                              >
                                <Plus size={18} className="me-2" />
                                Create Your First Rule
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary View */}
              {rules.length > 0 && (
                <div className="row mt-4">
                  <div className="col-12">
                    <div className="card shadow-sm border-0">
                      <div className="card-body p-4">
                        <h5 className="card-title d-flex align-items-center mb-4">
                          <Grid size={20} className="me-2" />
                          Chapter Range Summary
                        </h5>
                        <div className="row">
                          {getChapterRulesSummary().map(summary => (
                            <div key={summary.range} className="col-md-6 col-lg-4 mb-4">
                              <div className="card h-100 border">
                                <div className="card-header bg-light">
                                  <div className="d-flex justify-content-between align-items-center">
                                    <h6 className="mb-0">
                                      Chapters {summary.range}
                                    </h6>
                                    <span className="badge bg-primary">
                                      {summary.ruleCount} rules
                                    </span>
                                  </div>
                                </div>
                                <div className="card-body">
                                  <div className="list-group list-group-flush">
                                    {summary.questionTypes.map((type, index) => (
                                      <div key={index} className="list-group-item px-0 py-2">
                                        <div className="d-flex justify-content-between align-items-center">
                                          <span className="fw-medium">{type.type}</span>
                                          <div className="text-end">
                                            <div className="fw-bold">
                                              {type.min}
                                              {type.max ? `-${type.max}` : '+'}
                                            </div>
                                            <div className="text-muted small">
                                              {type.mode === 'total' ? 'total' : 'per chapter'}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats and Tips */}
              <div className="row mt-4">
                <div className="col-md-4 mb-4">
                  <div className="card bg-primary text-white shadow-sm border-0 h-100">
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="card-title mb-0">Coverage</h5>
                        <CheckCircle size={24} />
                      </div>
                      <div className="mb-3">
                        <h2 className="display-6 fw-bold">{Object.keys(getRulesByChapterRange()).length}</h2>
                        <p className="opacity-75 mb-0">Chapter Ranges Covered</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="col-md-4 mb-4">
                  <div className="card shadow-sm border-0 h-100">
                    <div className="card-body p-4">
                      <h5 className="card-title d-flex align-items-center mb-4">
                        <BarChart3 size={20} className="me-2" />
                        Quick Stats
                      </h5>
                      <div className="list-group list-group-flush">
                        <div className="list-group-item border-0 px-0 py-2 d-flex justify-content-between align-items-center">
                          <span className="fw-medium">Total Rules</span>
                          <div className="fw-bold">{rules.length}</div>
                        </div>
                        <div className="list-group-item border-0 px-0 py-2 d-flex justify-content-between align-items-center">
                          <span className="fw-medium">Total Mode</span>
                          <div className="fw-bold">
                            {rules.filter(r => r.rule_mode === 'total').length}
                          </div>
                        </div>
                        <div className="list-group-item border-0 px-0 py-2 d-flex justify-content-between align-items-center">
                          <span className="fw-medium">Per Chapter Mode</span>
                          <div className="fw-bold">
                            {rules.filter(r => r.rule_mode === 'per_chapter').length}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="col-md-4 mb-4">
                  <div className="card shadow-sm border-0 h-100">
                    <div className="card-body p-4">
                      <h5 className="card-title d-flex align-items-center mb-4">
                        <HelpCircle size={20} className="me-2" />
                        Usage Tips
                      </h5>
                      <ul className="list-unstyled mb-0">
                        <li className="mb-3 d-flex">
                          <Check size={16} className="text-success me-2 mt-1 flex-shrink-0" />
                          <span><strong>Total Mode:</strong> Select questions from any chapters in the range</span>
                        </li>
                        <li className="mb-3 d-flex">
                          <Check size={16} className="text-success me-2 mt-1 flex-shrink-0" />
                          <span><strong>Per Chapter Mode:</strong> Select questions from EACH chapter in the range</span>
                        </li>
                        <li className="d-flex">
                          <Check size={16} className="text-success me-2 mt-1 flex-shrink-0" />
                          <span>Leave max empty for unlimited questions</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="row">
              <div className="col-12">
                <div className="card shadow-sm border-0">
                  <div className="card-body text-center py-5">
                    <BookOpen size={64} className="text-muted mb-4" />
                    <h4 className="text-muted mb-3">No Chapters Found</h4>
                    <p className="text-muted">
                      No chapters available for the selected subject. Please check if chapters are properly configured.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="row">
            <div className="col-12">
              <div className="card shadow-sm border-0">
                <div className="card-body text-center py-5">
                  <BookOpen size={64} className="text-muted mb-4" />
                  <h4 className="text-muted mb-3">Select Class & Subject</h4>
                  <p className="text-muted mb-4">
                    Please select a class and subject to start managing chapter range rules.
                  </p>
                  <div className="alert alert-info d-inline-flex align-items-center">
                    <Info size={20} className="me-2" />
                    Define rules like "Select 2-4 MCQ questions from Chapters 1-4"
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}