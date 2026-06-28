//admin/subject-rules/page.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
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
  List,
  Link2,
  ArrowUpDown
} from 'lucide-react';
import './subject-rules.css';

const supabase = createSupabaseBrowserClient();

interface QuestionTypeConfig {
  id: string;
  label: string;
  key: string;
  defaultMin?: number;
  defaultMax?: number;
}

interface QuestionCategory {
  id: string;
  question_type: string;
  category_value: string;
  label_en: string;
  label_ur?: string | null;
  subject_hint?: string | null;
  class_hint?: string | null;
  default_marks?: number | null;
  sort_order: number;
  is_active: boolean;
}

interface ChapterRangeForm {
  id?: string;
  chapter_start: string;
  chapter_end: string;
  question_type: string;
  question_category_id: string;
  rule_mode: 'total' | 'per_chapter';
  min_questions: string;
  max_questions: string;
  class_id?: string;
  // ── Ordering / grouping fields ──
  sort_order: string;       // exact paper position; empty -> defaults to 0 server-side
  q_label: string;      
  q_label_ur: string;    // sub-part display label, e.g. 'A' / 'B' / 'C'
  attempt_count: string;    // how many of min_questions must be attempted; empty -> attempt all
  group_key: string;        // ties multiple rules into ONE Q.No when shared
  is_paired: boolean;       // pair this rule's own fetched questions into a/b sub-parts
  is_alternative: boolean;  // OR-choice within a group_key (only first by sort_order is used)
}

const EMPTY_FORM: ChapterRangeForm = {
  chapter_start: '',
  chapter_end: '',
  question_type: 'mcq',
  question_category_id: '',
  rule_mode: 'total',
  min_questions: '',
  max_questions: '',
  class_id: '',
  sort_order: '',
  q_label: '',
  q_label_ur: '',
  attempt_count: '',
  group_key: '',
  is_paired: false,
  is_alternative: false,
};

// Full type list, matching questions.question_type / chapter_question_rules.question_type's
// DB CHECK constraint exactly (same casing) — kept here as a single shared
// source so this page never drifts out of sync with the database again.
// Subject-specific filtering still happens in getQuestionTypes() below;
// this is just the universe of possible values.
const ALL_QUESTION_TYPES: QuestionTypeConfig[] = [
  { id: 'mcq', label: 'MCQ', key: 'mcq', defaultMin: 3, defaultMax: 5 },
  { id: 'short', label: 'Short Answer', key: 'short', defaultMin: 2, defaultMax: 4 },
  { id: 'long', label: 'Long Answer', key: 'long', defaultMin: 1, defaultMax: 2 },
  { id: 'translate_urdu', label: 'Translate Urdu', key: 'translate_urdu' },
  { id: 'translate_english', label: 'Translate English', key: 'translate_english' },
  { id: 'idiom_phrases', label: 'Idiom/Phrases', key: 'idiom_phrases' },
  { id: 'passage', label: 'Passage', key: 'passage' },
  { id: 'poetry_explanation', label: 'Poetry Explanation', key: 'poetry_explanation' },
  { id: 'stanza_explanation', label: 'Stanza Explanation', key: 'stanza_explanation' },
  { id: 'prose_explanation', label: 'Prose Explanation', key: 'prose_explanation' },
  { id: 'sentence_correction', label: 'Sentence Correction', key: 'sentence_correction' },
  { id: 'sentence_completion', label: 'Sentence Completion', key: 'sentence_completion' },
  { id: 'punctuation', label: 'Punctuation', key: 'punctuation' },
  // NOTE casing matches the DB constraint exactly — fixed from the old
  // lowercase 'directindirect'/'activepassive', which the database no
  // longer accepts (constraint now requires 'directInDirect'/'activePassive').
  { id: 'directInDirect', label: 'Direct/Indirect', key: 'directInDirect' },
  { id: 'activePassive', label: 'Active/Passive', key: 'activePassive' },
  { id: 'darkhwast_khat', label: 'Darkhwast Khat', key: 'darkhwast_khat' },
  { id: 'kahani_makalma', label: 'Kahani Makalma', key: 'kahani_makalma' },
  { id: 'mokalma', label: 'Mokalma', key: 'mokalma' },
  { id: 'Nasarkhulasa', label: 'Nasar Khulasa', key: 'Nasarkhulasa' },
  { id: 'markziKhyal', label: 'Markzi Khyal', key: 'markziKhyal' },
  { id: 'gazal', label: 'Ghazal', key: 'gazal' },
  { id: 'summary', label: 'Summary', key: 'summary' },
  { id: 'application', label: 'Application', key: 'application' },
  { id: 'letter', label: 'Letter', key: 'letter' },
  { id: 'pair_of_words', label: 'Pair of Words', key: 'pair_of_words' },
  { id: 'essay', label: 'Essay', key: 'essay' },
  { id: 'story', label: 'Story Writing', key: 'story' },
];

export default function SubjectRulesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [rules, setRules] = useState<ChapterRangeRule[]>([]);
  const [questionCategories, setQuestionCategories] = useState<QuestionCategory[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  // State for new rule form
  const [showNewRuleForm, setShowNewRuleForm] = useState(false);
  const [newRule, setNewRule] = useState<ChapterRangeForm>({
    ...EMPTY_FORM,
    class_id: selectedClass || '',
  });
  
  // State for editing existing rule
  const [editingRule, setEditingRule] = useState<ChapterRangeRule | null>(null);
  const [editForm, setEditForm] = useState<ChapterRangeForm>({
    ...EMPTY_FORM,
    class_id: selectedClass || '',
  });

  // Fetch classes
  useEffect(() => {
    fetchClasses();
  }, []);

  // Fetch question categories once on mount — small table, doesn't need
  // to be refetched per subject/class change. Filtered client-side by
  // question_type (and optionally subject_hint/class_hint) wherever used.
  useEffect(() => {
    fetchQuestionCategories();
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

  const fetchQuestionCategories = async () => {
    try {
      const response = await fetch('/api/admin/lookups');
      if (!response.ok) throw new Error('Failed to fetch question categories');
      const data = await response.json();
      setQuestionCategories(data.questionCategories || []);
    } catch (error: any) {
      console.error('Error fetching question categories:', error);
      // Non-fatal — the category dropdown just shows "no categories"
      // for every type if this fails, rest of the page still works.
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

  const isEnglishOrUrdu = useCallback((): 'english' | 'urdu' | null => {
    const subject = subjects.find(s => s.id === selectedSubject);
    if (!subject) return null;
    const n = subject.name.toLowerCase();
    if (n === 'english') return 'english';
    if (n === 'urdu') return 'urdu';
    return null;
  }, [subjects, selectedSubject]);

  const getQuestionTypes = (): QuestionTypeConfig[] => {
    const subject = subjects.find(s => s.id === selectedSubject);
    if (!subject) return [];
    
    const subjectName = subject.name.toLowerCase();
    
    const baseTypes: QuestionTypeConfig[] = [
      ALL_QUESTION_TYPES.find(t => t.key === 'mcq')!,
      ALL_QUESTION_TYPES.find(t => t.key === 'short')!,
      ALL_QUESTION_TYPES.find(t => t.key === 'long')!,
    ];

    if (subjectName === 'english') {
      return [
        ...baseTypes,
        ...['translate_urdu', 'translate_english', 'idiom_phrases', 'passage',
            'directInDirect', 'activePassive', 'summary', 'application',
            'letter', 'punctuation', 'pair_of_words', 'essay', 'stanza_explanation','story']
          .map(key => ALL_QUESTION_TYPES.find(t => t.key === key)!)
          .filter(Boolean),
      ];
    } else if (subjectName === 'urdu') {
      return [
        ...baseTypes,
        ...['poetry_explanation', 'stanza_explanation', 'prose_explanation',
            'sentence_correction', 'sentence_completion', 'punctuation',
            'darkhwast_khat', 'kahani_makalma', 'mokalma', 'Nasarkhulasa',
            'markziKhyal', 'gazal', 'application', 'letter', 'essay', 'passage','story']
          .map(key => ALL_QUESTION_TYPES.find(t => t.key === key)!)
          .filter(Boolean),
      ];
    }
    
    return baseTypes;
  };

  // Categories matching the currently-selected question_type, narrowed by
  // subject (english/urdu) when the category row carries a subject_hint.
  // Mirrors the exact filtering logic QuestionForm.tsx already uses, so
  // rule-creation and question-creation show the same category options
  // for a given type+subject combination.
  const getCategoriesForType = useCallback((questionType: string): QuestionCategory[] => {
    const subjectKey = isEnglishOrUrdu();
    return questionCategories
      .filter(qc => qc.question_type === questionType && qc.is_active)
      .filter(qc => !qc.subject_hint || qc.subject_hint === subjectKey)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [questionCategories, isEnglishOrUrdu]);

  // Distinct group_key values already in use for this subject+class, so
  // the admin can pick an EXISTING key from a dropdown instead of having
  // to retype it character-for-character on every sibling rule (which is
  // exactly the kind of mismatch that silently breaks grouping — a typo
  // like 'q1_mcq ' vs 'q1_mcq' means the rules never merge).
  const getExistingGroupKeys = useCallback((): string[] => {
    const keys = new Set<string>();
    rules.forEach(r => {
      const key = (r as any).group_key;
      if (key) keys.add(key);
    });
    return Array.from(keys).sort();
  }, [rules]);

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
    const attemptCount = newRule.attempt_count ? parseInt(newRule.attempt_count) : null;
    const sortOrder = newRule.sort_order ? parseInt(newRule.sort_order) : 0;

    if (start > end) {
      toast.error('Start chapter must be less than or equal to end chapter');
      return;
    }

    if (max !== null && max < min) {
      toast.error('Maximum questions must be greater than or equal to minimum');
      return;
    }

    if (attemptCount !== null && attemptCount > min) {
      toast.error('Attempt count cannot exceed minimum questions');
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
          question_category_id: newRule.question_category_id || null,
          rule_mode: newRule.rule_mode,
          min_questions: min,
          max_questions: max,
          sort_order: sortOrder,
          q_label: newRule.q_label || null,
          q_label_ur: newRule.q_label_ur || null, 
          attempt_count: attemptCount,
          group_key: newRule.group_key || null,
          is_paired: newRule.is_paired,
          is_alternative: newRule.is_alternative,
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Rule created successfully!');
        setShowNewRuleForm(false);
        setNewRule({ ...EMPTY_FORM, class_id: selectedClass });
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
    const attemptCount = editForm.attempt_count ? parseInt(editForm.attempt_count) : null;
    const sortOrder = editForm.sort_order ? parseInt(editForm.sort_order) : 0;

    if (start > end) {
      toast.error('Start chapter must be less than or equal to end chapter');
      return;
    }

    if (max !== null && max < min) {
      toast.error('Maximum questions must be greater than or equal to minimum');
      return;
    }

    if (attemptCount !== null && attemptCount > min) {
      toast.error('Attempt count cannot exceed minimum questions');
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
          question_category_id: editForm.question_category_id || null,
          rule_mode: editForm.rule_mode,
          min_questions: min,
          max_questions: max,
          sort_order: sortOrder,
          q_label: editForm.q_label || null,
          q_label_ur: editForm.q_label_ur || null,
          attempt_count: attemptCount,
          group_key: editForm.group_key || null,
          is_paired: editForm.is_paired,
          is_alternative: editForm.is_alternative,
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Rule updated successfully!');
        setEditingRule(null);
        setEditForm({ ...EMPTY_FORM, class_id: selectedClass });
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
      question_category_id: (rule as any).question_category_id || '',
      rule_mode: rule.rule_mode,
      min_questions: rule.min_questions.toString(),
      max_questions: rule.max_questions?.toString() || '',
       class_id: rule.class_id || selectedClass,
      sort_order: (rule as any).sort_order != null ? String((rule as any).sort_order) : '',
      q_label: (rule as any).q_label || '',
       q_label_ur: (rule as any).q_label_ur || '', 
      attempt_count: (rule as any).attempt_count != null ? String((rule as any).attempt_count) : '',
      group_key: (rule as any).group_key || '',
      is_paired: Boolean((rule as any).is_paired),
      is_alternative: Boolean((rule as any).is_alternative),
    });
  };

  // Look up a rule's category label for display — rules fetched from
  // /api/chapter-range-rules carry question_category_id (uuid) only, not
  // a joined label, so we resolve it client-side against the
  // questionCategories list already loaded on mount.
  const getCategoryLabel = useCallback((categoryId?: string | null): string | null => {
    if (!categoryId) return null;
    const cat = questionCategories.find(qc => qc.id === categoryId);
    return cat?.label_en || null;
  }, [questionCategories]);

  const getFilteredRules = () => {
    let filtered = [...rules];
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(rule => {
        const questionType = getQuestionTypes().find(t => t.key === rule.question_type);
        const categoryLabel = getCategoryLabel((rule as any).question_category_id) || '';
        const groupKey = (rule as any).group_key || '';
        return (
          `chapters ${rule.chapter_start}-${rule.chapter_end}`.toLowerCase().includes(query) ||
          (questionType?.label.toLowerCase().includes(query)) ||
          rule.question_type.toLowerCase().includes(query) ||
          categoryLabel.toLowerCase().includes(query) ||
          groupKey.toLowerCase().includes(query)
        );
      });
    }
    
    // Sort by sort_order (this is now the actual paper-order field), then
    // chapter range as a tiebreaker for rules that share sort_order=0
    // (i.e. haven't been explicitly ordered yet).
    filtered.sort((a, b) => {
      const aSort = (a as any).sort_order ?? 0;
      const bSort = (b as any).sort_order ?? 0;
      if (aSort !== bSort) return aSort - bSort;
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
        const categoryLabel = getCategoryLabel((rule as any).question_category_id);
        return {
          type: typeConfig?.label || rule.question_type,
          category: categoryLabel,
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

  // Shared form-fields block (chapter range / type / category / mode /
  // questions) used by both modals. Pulled into a render function instead
  // of a separate component so it can keep using the same closures
  // (getQuestionTypes, getCategoriesForType, getExistingGroupKeys, etc.)
  // without prop-drilling everything through.
  const renderOrderingFields = (
    form: ChapterRangeForm,
    setForm: React.Dispatch<React.SetStateAction<ChapterRangeForm>>
  ) => {
    const existingGroupKeys = getExistingGroupKeys();
    return (
      <>
        <div className="col-12">
          <hr className="my-2" />
          <div className="d-flex align-items-center mb-2">
            <ArrowUpDown size={16} className="me-2 text-muted" />
            <span className="fw-medium text-muted small text-uppercase">Paper Ordering & Grouping</span>
          </div>
        </div>

        <div className="col-md-3">
          <label className="form-label">
            Sort Order <span className="text-muted small">(paper position)</span>
          </label>
          <input
            type="number"
            className="form-control"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            disabled={loading}
            placeholder="0"
          />
        </div>

        <div className="col-md-9">
          <label className="form-label">
            {form.is_paired ? (
              <>Attempt Note <span className="text-muted small">(shown once above the paired questions, e.g. "Note: Attempt any 2 questions in detail")</span></>
            ) : (
              <>Sub-Part Label <span className="text-muted small">(full instruction text shown on the paper, e.g. "Choose the correct Synonym from the options below")</span></>
            )}
          </label>
          <textarea
            className="form-control"
            rows={2}
            value={form.q_label}
            onChange={(e) => setForm({ ...form, q_label: e.target.value })}
            disabled={loading}
            placeholder={form.is_paired ? 'e.g. Note: Attempt any 2 questions in detail' : 'e.g. Choose the correct Synonym from the options below'}
          />
        </div>

        <div className="col-md-9 offset-md-3">  {/* aligns with the previous textarea */}
          <label className="form-label">
            Urdu Label <span className="text-muted small">(q_label_ur)</span>
          </label>
          <textarea
            className="form-control"
            rows={2}
            value={form.q_label_ur}
            onChange={(e) => setForm({ ...form, q_label_ur: e.target.value })}
            disabled={loading}
            placeholder="Urdu translation of the sub‑part / attempt note"
          />
        </div>

        <div className="col-md-4">
          <label className="form-label">
            Attempt Count <span className="text-muted small">(optional)</span>
          </label>
          <input
            type="number"
            className="form-control"
            min="0"
            max={form.min_questions || undefined}
            value={form.attempt_count}
            onChange={(e) => setForm({ ...form, attempt_count: e.target.value })}
            disabled={loading}
            placeholder="Defaults to Minimum Questions"
          />
        </div>

        <div className="col-md-8">
          <label className="form-label d-flex align-items-center">
            <Link2 size={14} className="me-1" />
            Group Key <span className="text-muted small ms-1">(rules sharing this = ONE Q.No)</span>
          </label>
          <input
            type="text"
            className="form-control"
            list="existing-group-keys"
            value={form.group_key}
            onChange={(e) => setForm({ ...form, group_key: e.target.value })}
            disabled={loading}
            placeholder="e.g. q1_mcq — pick an existing key or type a new one"
          />
          <datalist id="existing-group-keys">
            {existingGroupKeys.map(key => <option key={key} value={key} />)}
          </datalist>
          {existingGroupKeys.length > 0 && (
            <div className="form-text">
              Existing keys for this subject/class: {existingGroupKeys.join(', ')}
            </div>
          )}
        </div>

        <div className="col-md-4 d-flex flex-column gap-2 justify-content-end">
          <div className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id={`is_paired-${form === newRule ? 'new' : 'edit'}`}
              checked={form.is_paired}
              onChange={(e) => setForm({ ...form, is_paired: e.target.checked })}
              disabled={loading}
            />
            <label className="form-check-label small" htmlFor={`is_paired-${form === newRule ? 'new' : 'edit'}`}>
              Pair into a/b sub-parts (long Qs)
            </label>
          </div>
          <div className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id={`is_alternative-${form === newRule ? 'new' : 'edit'}`}
              checked={form.is_alternative}
              onChange={(e) => setForm({ ...form, is_alternative: e.target.checked })}
              disabled={loading}
            />
            <label className="form-check-label small" htmlFor={`is_alternative-${form === newRule ? 'new' : 'edit'}`}>
              OR-choice within group (e.g. Summary OR Stanza)
            </label>
          </div>
        </div>

        {form.is_paired && (
          <div className="col-12">
            <div className="alert alert-secondary small mb-0">
              <strong>Paired long questions:</strong> Minimum Questions ({form.min_questions || 'N'}) raw questions
              will be fetched and split into pairs of 2, each becoming its OWN sequential Q.No with sub-parts (a)
              and (b) — e.g. 6 questions → Q.5, Q.6, Q.7. Attempt Count ({form.attempt_count || 'all'}) is how many
              of those Q.Nos the student must attempt (both (a) and (b) compulsory within whichever ones they
              choose) — e.g. "attempt any 2 of these 3". {form.q_label && (
                <>The note shown above the first pair will read: "<strong>{form.q_label}</strong>".</>
              )}
            </div>
          </div>
        )}

        {form.group_key && (
          <div className="col-12">
            <div className="alert alert-secondary small mb-0">
              {form.is_alternative ? (
                <>This rule is an <strong>alternative option</strong> within group "<strong>{form.group_key}</strong>" — only the option with the lowest Sort Order in this group will actually appear on the paper.</>
              ) : (
                <>This rule will render as <strong>one sub-part{form.q_label ? ` labeled "${form.q_label}"` : ''}</strong> under a single Q.No, alongside every other rule sharing group key "<strong>{form.group_key}</strong>".</>
              )}
            </div>
          </div>
        )}
      </>
    );
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
                        placeholder="Search by chapter range, question type, category, or group key..."
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
                        onChange={(e) => setNewRule({...newRule, question_type: e.target.value, question_category_id: ''})}
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
                      <label className="form-label">
                        Category <span className="text-muted small">(optional)</span>
                      </label>
                      <select
                        className="form-select"
                        value={newRule.question_category_id}
                        onChange={(e) => setNewRule({...newRule, question_category_id: e.target.value})}
                        disabled={loading || getCategoriesForType(newRule.question_type).length === 0}
                      >
                        <option value="">
                          {getCategoriesForType(newRule.question_type).length === 0 ? 'No categories for this type' : 'Whole type (no category)'}
                        </option>
                        {getCategoriesForType(newRule.question_type).map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.label_en}</option>
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
                        {newRule.question_category_id && (
                          <div className="mt-1">
                            This rule targets ONLY the <strong>{getCategoriesForType(newRule.question_type).find(c => c.id === newRule.question_category_id)?.label_en}</strong> subpart of {getQuestionTypes().find(t => t.key === newRule.question_type)?.label} — other categories of this type are unaffected.
                          </div>
                        )}
                      </div>
                    </div>

                    {renderOrderingFields(newRule, setNewRule)}
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
                        onChange={(e) => setEditForm({...editForm, question_type: e.target.value, question_category_id: ''})}
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
                      <label className="form-label">
                        Category <span className="text-muted small">(optional)</span>
                      </label>
                      <select
                        className="form-select"
                        value={editForm.question_category_id}
                        onChange={(e) => setEditForm({...editForm, question_category_id: e.target.value})}
                        disabled={loading || getCategoriesForType(editForm.question_type).length === 0}
                      >
                        <option value="">
                          {getCategoriesForType(editForm.question_type).length === 0 ? 'No categories for this type' : 'Whole type (no category)'}
                        </option>
                        {getCategoriesForType(editForm.question_type).map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.label_en}</option>
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
                        {editForm.question_category_id && (
                          <div className="mt-1">
                            This rule targets ONLY the <strong>{getCategoriesForType(editForm.question_type).find(c => c.id === editForm.question_category_id)?.label_en}</strong> subpart of {getQuestionTypes().find(t => t.key === editForm.question_type)?.label} — other categories of this type are unaffected.
                          </div>
                        )}
                      </div>
                    </div>

                    {renderOrderingFields(editForm, setEditForm)}
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
                            {getCategoriesForType(type.key).length > 0 && (
                              <span className="badge bg-info-subtle text-info">
                                {getCategoriesForType(type.key).length} categories
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
                              <th className="text-center" style={{ width: '70px' }}>
                                <div className="d-flex align-items-center justify-content-center">
                                  <ArrowUpDown size={14} className="me-1" />
                                  Order
                                </div>
                              </th>
                              <th className="ps-4" style={{ width: '140px' }}>
                                <div className="d-flex align-items-center">
                                  <Layers size={16} className="me-2" />
                                  Chapter Range
                                </div>
                              </th>
                              <th className="text-center" style={{ width: '130px' }}>
                                <div className="d-flex align-items-center justify-content-center">
                                  <Target size={16} className="me-2" />
                                  Question Type
                                </div>
                              </th>
                              <th className="text-center" style={{ width: '150px' }}>
                                Category
                              </th>
                              <th className="text-center" style={{ width: '150px' }}>
                                <div className="d-flex align-items-center justify-content-center">
                                  <Link2 size={14} className="me-1" />
                                  Group / Label
                                </div>
                              </th>
                              <th className="text-center" style={{ width: '110px' }}>
                                Rule Mode
                              </th>
                              <th className="text-center" style={{ width: '130px' }}>
                                Questions
                              </th>
                              <th className="text-center pe-4" style={{ width: '150px' }}>
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {getFilteredRules().map(rule => {
                              const typeConfig = getQuestionTypes().find(t => t.key === rule.question_type);
                              const categoryLabel = getCategoryLabel((rule as any).question_category_id);
                              const isTotalMode = rule.rule_mode === 'total';
                              const groupKey = (rule as any).group_key;
                              const qLabel = (rule as any).q_label;
                              const isPaired = (rule as any).is_paired;
                              const isAlternative = (rule as any).is_alternative;
                              const sortOrder = (rule as any).sort_order ?? 0;
                              
                              return (
                                <tr key={rule.id}>
                                  <td className="text-center align-middle">
                                    <span className="badge bg-light text-dark border">{sortOrder}</span>
                                  </td>
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
                                    {categoryLabel ? (
                                      <span className="badge bg-info-subtle text-info">{categoryLabel}</span>
                                    ) : (
                                      <span className="text-muted small">—</span>
                                    )}
                                  </td>
                                  <td className="text-center align-middle">
                                    {groupKey ? (
                                      <div className="d-flex flex-column align-items-center gap-1">
                                        <span className="badge bg-secondary">
                                          {qLabel ? `(${qLabel}) ` : ''}{groupKey}
                                        </span>
                                         {qLabel && (rule as any).q_label_ur && (
                                          <small className="text-muted">({(rule as any).q_label_ur})</small>
                                        )}
                                        {isAlternative && (
                                          <span className="badge bg-warning-subtle text-warning small">OR-choice</span>
                                        )}
                                      </div>

                                    ) : isPaired ? (
                                      <span className="badge bg-purple-subtle text-purple small" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce' }}>
                                        Paired a/b
                                      </span>
                                    ) : (
                                      <span className="text-muted small">— standalone —</span>
                                    )}
                                  </td>
                                  <td className="text-center align-middle">
                                    <span className={`badge ${isTotalMode ? 'bg-info' : 'bg-warning'}`}>
                                      {isTotalMode ? 'Total' : 'Per Ch.'}
                                    </span>
                                  </td>
                                  <td className="text-center align-middle">
                                    <div className="fw-bold">
                                      {rule.min_questions}
                                      {rule.max_questions ? ` - ${rule.max_questions}` : ''}
                                    </div>
                                    {(rule as any).attempt_count != null && (
                                      <div className="text-muted small">attempt {(rule as any).attempt_count}</div>
                                    )}
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
                                          <span className="fw-medium">
                                            {type.type}
                                            {type.category && (
                                              <span className="badge bg-info-subtle text-info ms-2">{type.category}</span>
                                            )}
                                          </span>
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
                        <div className="list-group-item border-0 px-0 py-2 d-flex justify-content-between align-items-center">
                          <span className="fw-medium">Category-Targeted</span>
                          <div className="fw-bold">
                            {rules.filter(r => (r as any).question_category_id).length}
                          </div>
                        </div>
                        <div className="list-group-item border-0 px-0 py-2 d-flex justify-content-between align-items-center">
                          <span className="fw-medium">Grouped (shared Q.No)</span>
                          <div className="fw-bold">
                            {rules.filter(r => (r as any).group_key).length}
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
                        <li className="mb-3 d-flex">
                          <Check size={16} className="text-success me-2 mt-1 flex-shrink-0" />
                          <span><strong>Category:</strong> Leave as "Whole type" unless you need a sub-part rule, like "10 Synonyms" within MCQs</span>
                        </li>
                        <li className="mb-3 d-flex">
                          <Check size={16} className="text-success me-2 mt-1 flex-shrink-0" />
                          <span><strong>Group Key:</strong> Give 2+ rules the SAME group key to merge them under one Q.No with separate sub-labels (A/B/C) — e.g. 3 MCQ rules sharing "q1_mcq"</span>
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