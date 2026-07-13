//admin/subject-rules/page.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Class, Subject, Chapter, ChapterRangeRule } from '@/types/types';
import toast from 'react-hot-toast';
import {
  BookOpen,
  Trash2,
  RefreshCw,
  Info,
  Plus,
  Check,
  Search,
  Hash,
  FileText,
  Copy,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Layers,
  Target,
  Link2,
  ArrowUpDown,
  X,
} from 'lucide-react';

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
      const url = `/api/chapter-range-rules?subjectId=${subjectId}${selectedClass ? `&classId=${selectedClass}` : ''}`;
      const response = await fetch(url);

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
            'letter', 'punctuation', 'pair_of_words', 'essay', 'stanza_explanation','story', 'mokalma']
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

    // In "per_chapter" mode, min_questions is PER chapter — the actual pool
    // size across the whole range is min_questions x number of chapters in
    // [start, end] (matches fetchQuestionsForRule's own limit calculation in
    // PaperBuilderApp.tsx). Comparing attemptCount against the raw
    // per-chapter min here rejected valid values like "2 per chapter across
    // 4 chapters (8 total), attempt 6".
    const effectiveMinForAttempt = newRule.rule_mode === 'per_chapter' ? min * ((end - start) + 1) : min;
    if (attemptCount !== null && attemptCount > effectiveMinForAttempt) {
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

    // See handleCreateRule's identical comment: min_questions is PER
    // chapter in "per_chapter" mode, so the attempt-count ceiling must be
    // scaled by the number of chapters in range too.
    const effectiveMinForAttempt = editForm.rule_mode === 'per_chapter' ? min * ((end - start) + 1) : min;
    if (attemptCount !== null && attemptCount > effectiveMinForAttempt) {
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

  // Shared core form fields (chapter range / type / category / mode /
  // questions) used by both the Add and Edit modals — kept as a render
  // function (not a separate component) so it can reuse this component's
  // own closures (getQuestionTypes, getCategoriesForType, ...) without
  // prop-drilling everything through.
  const renderCoreFields = (
    form: ChapterRangeForm,
    setForm: React.Dispatch<React.SetStateAction<ChapterRangeForm>>
  ) => (
    <>
      <div className="sr-field-row">
        <div className="sr-field">
          <label className="sr-label">Start Chapter</label>
          <input
            type="number"
            className="sr-input"
            min="1"
            max={getTotalChapters()}
            value={form.chapter_start}
            onChange={(e) => setForm({ ...form, chapter_start: e.target.value })}
            disabled={loading}
          />
        </div>
        <div className="sr-field">
          <label className="sr-label">End Chapter</label>
          <input
            type="number"
            className="sr-input"
            min={form.chapter_start || 1}
            max={getTotalChapters()}
            value={form.chapter_end}
            onChange={(e) => setForm({ ...form, chapter_end: e.target.value })}
            disabled={loading}
          />
        </div>
      </div>

      <div className="sr-field-row">
        <div className="sr-field">
          <label className="sr-label">Question Type</label>
          <select
            className="sr-select"
            value={form.question_type}
            onChange={(e) => setForm({ ...form, question_type: e.target.value, question_category_id: '' })}
            disabled={loading}
          >
            {getQuestionTypes().map(type => (
              <option key={type.id} value={type.key}>{type.label}</option>
            ))}
          </select>
        </div>
        <div className="sr-field">
          <label className="sr-label">Category <span className="sr-label-hint">(optional)</span></label>
          <select
            className="sr-select"
            value={form.question_category_id}
            onChange={(e) => setForm({ ...form, question_category_id: e.target.value })}
            disabled={loading || getCategoriesForType(form.question_type).length === 0}
          >
            <option value="">
              {getCategoriesForType(form.question_type).length === 0 ? 'No categories for this type' : 'Whole type (no category)'}
            </option>
            {getCategoriesForType(form.question_type).map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label_en}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="sr-field-row">
        <div className="sr-field">
          <label className="sr-label">Rule Mode</label>
          <select
            className="sr-select"
            value={form.rule_mode}
            onChange={(e) => setForm({ ...form, rule_mode: e.target.value as 'total' | 'per_chapter' })}
            disabled={loading}
          >
            <option value="total">Total Questions for Range</option>
            <option value="per_chapter">Questions Per Chapter</option>
          </select>
        </div>
        <div className="sr-field">
          <label className="sr-label">Minimum Questions</label>
          <input
            type="number"
            className="sr-input"
            min="0"
            value={form.min_questions}
            onChange={(e) => setForm({ ...form, min_questions: e.target.value })}
            disabled={loading}
          />
        </div>
      </div>

      <div className="sr-field-row">
        <div className="sr-field">
          <label className="sr-label">Maximum Questions <span className="sr-label-hint">(optional)</span></label>
          <input
            type="number"
            className="sr-input"
            min={form.min_questions || 0}
            value={form.max_questions}
            onChange={(e) => setForm({ ...form, max_questions: e.target.value })}
            disabled={loading}
            placeholder="No limit"
          />
        </div>
        <div className="sr-field" />
      </div>

      <div className="sr-note">
        <Info size={15} />
        <div>
          {form.rule_mode === 'total' ?
            'Total Questions for Range: select X questions from any chapters in the range.' :
            'Questions Per Chapter: select X questions from EACH chapter in the range.'}
          {form.question_category_id && (
            <div className="sr-note-sub">
              This rule targets ONLY the <strong>{getCategoriesForType(form.question_type).find(c => c.id === form.question_category_id)?.label_en}</strong> subpart of {getQuestionTypes().find(t => t.key === form.question_type)?.label} — other categories of this type are unaffected.
            </div>
          )}
        </div>
      </div>
    </>
  );

  // Shared ordering/grouping fields block, unchanged in behaviour from
  // before — just restyled to match the rest of the modal.
  const renderOrderingFields = (
    form: ChapterRangeForm,
    setForm: React.Dispatch<React.SetStateAction<ChapterRangeForm>>
  ) => {
    const existingGroupKeys = getExistingGroupKeys();
    const idSuffix = form === newRule ? 'new' : 'edit';
    return (
      <>
        <div className="sr-divider">
          <ArrowUpDown size={14} />
          <span>Paper Ordering &amp; Grouping</span>
        </div>

        <div className="sr-field-row">
          <div className="sr-field" style={{ flex: '0 0 140px' }}>
            <label className="sr-label">Sort Order <span className="sr-label-hint">(paper position)</span></label>
            <input
              type="number"
              className="sr-input"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              disabled={loading}
              placeholder="0"
            />
          </div>
          <div className="sr-field">
            <label className="sr-label">
              {form.is_paired ? (
                <>Attempt Note <span className="sr-label-hint">(shown once above the paired questions)</span></>
              ) : (
                <>Sub-Part Label <span className="sr-label-hint">(full instruction text shown on the paper)</span></>
              )}
            </label>
            <textarea
              className="sr-textarea"
              rows={2}
              value={form.q_label}
              onChange={(e) => setForm({ ...form, q_label: e.target.value })}
              disabled={loading}
              placeholder={form.is_paired ? 'e.g. Note: Attempt any 2 questions in detail' : 'e.g. Choose the correct Synonym from the options below'}
            />
          </div>
        </div>

        <div className="sr-field-row">
          <div className="sr-field" style={{ flex: '0 0 140px' }} />
          <div className="sr-field">
            <label className="sr-label">Urdu Label <span className="sr-label-hint">(q_label_ur)</span></label>
            <textarea
              className="sr-textarea"
              rows={2}
              value={form.q_label_ur}
              onChange={(e) => setForm({ ...form, q_label_ur: e.target.value })}
              disabled={loading}
              placeholder="Urdu translation of the sub-part / attempt note"
            />
          </div>
        </div>

        <div className="sr-field-row">
          <div className="sr-field">
            <label className="sr-label">Attempt Count <span className="sr-label-hint">(optional)</span></label>
            <input
              type="number"
              className="sr-input"
              min="0"
              max={form.min_questions || undefined}
              value={form.attempt_count}
              onChange={(e) => setForm({ ...form, attempt_count: e.target.value })}
              disabled={loading}
              placeholder="Defaults to Minimum Questions"
            />
          </div>
          <div className="sr-field" style={{ flex: 2 }}>
            <label className="sr-label">
              <Link2 size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
              Group Key <span className="sr-label-hint">(rules sharing this = ONE Q.No)</span>
            </label>
            <input
              type="text"
              className="sr-input"
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
              <div className="sr-field-hint">Existing keys for this subject/class: {existingGroupKeys.join(', ')}</div>
            )}
          </div>
        </div>

        <div className="sr-checkbox-row">
          <label className="sr-checkbox">
            <input
              type="checkbox"
              id={`is_paired-${idSuffix}`}
              checked={form.is_paired}
              onChange={(e) => setForm({ ...form, is_paired: e.target.checked })}
              disabled={loading}
            />
            Pair into a/b sub-parts (long Qs)
          </label>
          <label className="sr-checkbox">
            <input
              type="checkbox"
              id={`is_alternative-${idSuffix}`}
              checked={form.is_alternative}
              onChange={(e) => setForm({ ...form, is_alternative: e.target.checked })}
              disabled={loading}
            />
            OR-choice within group (e.g. Summary OR Stanza)
          </label>
        </div>

        {form.is_paired && (
          <div className="sr-note sr-note-secondary">
            <div>
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
          <div className="sr-note sr-note-secondary">
            <div>
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

  const ranges = getRulesByChapterRange();
  const modeTotalCount = rules.filter(r => r.rule_mode === 'total').length;
  const modePerChapterCount = rules.filter(r => r.rule_mode === 'per_chapter').length;
  const categoryTargetedCount = rules.filter(r => (r as any).question_category_id).length;
  const groupedCount = rules.filter(r => (r as any).group_key).length;

  return (
    <AdminLayout activeTab="subject-rules">
      <style>{`
        :root {
          --sr-bg       : #f5f6fb;
          --sr-surface  : #ffffff;
          --sr-border   : #e6e8f1;
          --sr-navy     : #101935;
          --sr-accent   : #2f4fe0;
          --sr-accent-lt: #eef1ff;
          --sr-text     : #15192b;
          --sr-muted    : #686f8c;
          --sr-shadow   : 0 1px 2px rgba(16,25,53,.04),0 6px 20px rgba(16,25,53,.07);
          --sr-radius   : 16px;
          --sr-rsm      : 9px;
          --sr-font     : 'Lexend','Inter','Segoe UI',system-ui,sans-serif;
          --sr-mono     : 'JetBrains Mono',ui-monospace,monospace;
          --sr-red      : #c8473a;
          --sr-red-bg   : #fdeeec;
          --sr-green    : #1d8a52;
          --sr-green-bg : #e9f9ef;
          --sr-amber    : #a3650a;
          --sr-amber-bg : #fff3bf;
          --sr-purple   : #7e22ce;
          --sr-purple-bg: #f3e8ff;
        }

        .sr { background:var(--sr-bg); min-height:100vh; padding:26px 28px 60px; font-family:var(--sr-font); color:var(--sr-text); }

        /* ── Header ── */
        .sr-hd { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:20px; }
        .sr-hd-eyebrow { display:flex; align-items:center; gap:8px; font-size:.7rem; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--sr-accent); margin-bottom:6px; }
        .sr-hd-eyebrow-dot { width:6px; height:6px; border-radius:50%; background:var(--sr-accent); }
        .sr-hd h1 { font-size:1.5rem; font-weight:700; color:var(--sr-navy); letter-spacing:-.02em; margin:0 0 3px; }
        .sr-hd p  { font-size:.84rem; color:var(--sr-muted); margin:0; }
        .sr-actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }

        .sr-btn { display:inline-flex; align-items:center; gap:6px; font-size:.81rem; font-weight:650; border-radius:var(--sr-rsm); padding:9px 15px; border:none; cursor:pointer; transition:all .14s; white-space:nowrap; font-family:var(--sr-font); }
        .sr-btn[disabled] { opacity:.5; cursor:not-allowed; }
        .sr-btn-primary { background:var(--sr-accent); color:#fff; box-shadow:0 2px 8px rgba(47,79,224,.25); }
        .sr-btn-primary:hover:not(:disabled) { background:#2540bf; box-shadow:0 5px 16px rgba(47,79,224,.38); transform:translateY(-1px); }
        .sr-btn-ghost { background:var(--sr-surface); color:var(--sr-text); border:1.5px solid var(--sr-border); }
        .sr-btn-ghost:hover:not(:disabled) { border-color:var(--sr-accent); color:var(--sr-accent); background:var(--sr-accent-lt); }
        .sr-btn-danger { background:transparent; color:var(--sr-red); border:1.5px solid var(--sr-red-bg); }
        .sr-btn-danger:hover:not(:disabled) { background:var(--sr-red-bg); border-color:var(--sr-red); }

        .sr-count-pill { display:inline-flex; align-items:center; gap:6px; font-size:.78rem; font-weight:700; color:var(--sr-accent); background:var(--sr-accent-lt); border:1.5px solid #dbe3ff; border-radius:999px; padding:8px 14px; white-space:nowrap; }

        /* ── Error banner ── */
        .sr-error { display:flex; align-items:flex-start; gap:10px; background:var(--sr-red-bg); border:1.5px solid #f5c7c1; color:var(--sr-red); border-radius:var(--sr-radius); padding:14px 16px; margin-bottom:16px; font-size:.83rem; }
        .sr-error-body { flex:1; }
        .sr-error-actions { display:flex; gap:8px; margin-top:8px; }
        .sr-error-close { background:none; border:none; color:var(--sr-red); cursor:pointer; flex-shrink:0; opacity:.7; }
        .sr-error-close:hover { opacity:1; }

        /* ── Filters ── */
        .sr-fc { display:flex; flex-wrap:wrap; gap:10px; background:var(--sr-surface); border:1.5px solid var(--sr-border); border-radius:var(--sr-radius); padding:14px 16px; margin-bottom:14px; box-shadow:var(--sr-shadow); }
        .sr-fc-field { flex:1 1 200px; min-width:160px; display:flex; flex-direction:column; gap:5px; }
        .sr-fc-label { display:flex; align-items:center; gap:6px; font-size:.7rem; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--sr-muted); }
        .sr-sel { width:100%; padding:9px 11px; font-size:.83rem; border:1.5px solid var(--sr-border); border-radius:var(--sr-rsm); background:var(--sr-bg); color:var(--sr-text); outline:none; cursor:pointer; font-family:var(--sr-font); transition:border .13s; }
        .sr-sel:focus { border-color:var(--sr-accent); background:#fff; }
        .sr-sel:disabled { opacity:.5; cursor:not-allowed; }
        .sr-si { position:relative; }
        .sr-si svg { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:var(--sr-muted); pointer-events:none; }
        .sr-si input { width:100%; padding:9px 11px 9px 33px; font-size:.83rem; border:1.5px solid var(--sr-border); border-radius:var(--sr-rsm); background:var(--sr-bg); color:var(--sr-text); outline:none; transition:border .13s,background .13s; font-family:var(--sr-font); box-sizing:border-box; }
        .sr-si input:focus { border-color:var(--sr-accent); background:#fff; }

        /* ── Stats bar ── */
        .sr-sb { display:flex; flex-wrap:wrap; align-items:center; gap:14px; font-size:.81rem; color:var(--sr-muted); margin-bottom:16px; padding:0 2px; }
        .sr-sb strong { color:var(--sr-text); font-family:var(--sr-mono); font-weight:600; }
        .sr-sb-item { display:flex; align-items:center; gap:6px; }
        .sr-sb-dot { color:var(--sr-border); }

        /* ── Loader ── */
        .sr-loader { text-align:center; padding:80px; }
        .sr-spin-el { width:36px; height:36px; border:3px solid var(--sr-border); border-top-color:var(--sr-accent); border-radius:50%; animation:sr-spin .65s linear infinite; margin:0 auto; }
        @keyframes sr-spin { to { transform:rotate(360deg); } }
        .spin { animation:sr-spin 1s linear infinite; }

        /* ── Cards / table ── */
        .sr-card { background:var(--sr-surface); border:1.5px solid var(--sr-border); border-radius:var(--sr-radius); box-shadow:var(--sr-shadow); overflow:hidden; margin-bottom:16px; }
        .sr-card-hd { display:flex; align-items:center; gap:8px; padding:16px 18px; border-bottom:1.5px solid var(--sr-border); }
        .sr-card-hd h2 { font-size:.88rem; font-weight:750; color:var(--sr-navy); margin:0; }
        .sr-tw { overflow-x:auto; }
        .sr-table { width:100%; border-collapse:collapse; font-size:.82rem; }
        .sr-table thead tr { background:#f8f9fc; border-bottom:2px solid var(--sr-border); }
        .sr-table th { padding:11px 13px; font-size:.68rem; font-weight:750; text-transform:uppercase; letter-spacing:.06em; color:var(--sr-muted); text-align:left; white-space:nowrap; }
        .sr-table td { padding:12px 13px; vertical-align:middle; border-bottom:1px solid #eff1f8; }
        .sr-table tbody tr:hover { background:#f9fafd; }
        .sr-table tbody tr:last-child td { border-bottom:none; }

        .sr-badge { display:inline-flex; align-items:center; font-size:.69rem; font-weight:750; letter-spacing:.03em; padding:3px 9px; border-radius:999px; white-space:nowrap; }
        .sr-b-range   { background:var(--sr-accent); color:#fff; padding:5px 12px; }
        .sr-b-category{ background:#f0f4ff; color:#4f6ef6; }
        .sr-b-group   { background:#f1f3f9; color:var(--sr-text); }
        .sr-b-paired  { background:var(--sr-purple-bg); color:var(--sr-purple); }
        .sr-b-alt     { background:var(--sr-amber-bg); color:var(--sr-amber); }
        .sr-b-total   { background:#e0f2fe; color:#0369a1; }
        .sr-b-perch   { background:var(--sr-amber-bg); color:var(--sr-amber); }
        .sr-b-order   { background:var(--sr-bg); color:var(--sr-muted); border:1.5px solid var(--sr-border); }
        .sr-muted-txt { color:var(--sr-muted); font-size:.78rem; }

        .sr-ab { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:8px; border:1.5px solid var(--sr-border); background:var(--sr-surface); color:var(--sr-muted); cursor:pointer; transition:all .13s; }
        .sr-ab.edit:hover   { border-color:var(--sr-accent); color:var(--sr-accent); background:var(--sr-accent-lt); }
        .sr-ab.delete:hover { border-color:var(--sr-red); color:var(--sr-red); background:var(--sr-red-bg); }

        .sr-empty { text-align:center; padding:64px 24px; color:var(--sr-muted); }
        .sr-empty-ico { margin-bottom:12px; opacity:.3; display:flex; justify-content:center; }
        .sr-empty h3 { font-size:.95rem; font-weight:700; color:var(--sr-text); margin:0 0 6px; }
        .sr-empty p { font-size:.8rem; margin:0 0 16px; }

        /* ── Bottom row: quick stats + tips ── */
        .sr-bottom-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        @media (max-width:820px) { .sr-bottom-row { grid-template-columns:1fr; } }
        .sr-stat-list { display:flex; flex-direction:column; }
        .sr-stat-row { display:flex; justify-content:space-between; align-items:center; padding:10px 18px; font-size:.82rem; border-bottom:1px solid #f1f3f9; }
        .sr-stat-row:last-child { border-bottom:none; }
        .sr-stat-row b { font-family:var(--sr-mono); font-weight:700; color:var(--sr-navy); }
        .sr-tips-list { list-style:none; margin:0; padding:14px 18px 18px; display:flex; flex-direction:column; gap:10px; }
        .sr-tips-list li { display:flex; gap:9px; font-size:.81rem; color:var(--sr-text); line-height:1.45; }
        .sr-tips-list svg { flex-shrink:0; margin-top:2px; color:var(--sr-green); }

        /* ── Big empty states ── */
        .sr-hero-empty { background:var(--sr-surface); border:1.5px solid var(--sr-border); border-radius:var(--sr-radius); box-shadow:var(--sr-shadow); text-align:center; padding:70px 24px; }
        .sr-hero-empty svg { color:var(--sr-muted); opacity:.35; margin-bottom:18px; }
        .sr-hero-empty h4 { font-size:1.05rem; font-weight:700; color:var(--sr-text); margin:0 0 8px; }
        .sr-hero-empty p { font-size:.85rem; color:var(--sr-muted); margin:0 auto 16px; max-width:420px; }
        .sr-hero-hint { display:inline-flex; align-items:center; gap:8px; background:var(--sr-accent-lt); color:#2540bf; border-radius:var(--sr-rsm); padding:10px 16px; font-size:.82rem; font-weight:600; }

        /* ── Modal ── */
        .sr-mo  { position:fixed; inset:0; background:rgba(13,18,38,.55); z-index:1200; display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(3px); }
        .sr-md  { background:var(--sr-surface); border-radius:18px; box-shadow:0 24px 64px rgba(13,18,38,.3); width:100%; max-width:680px; max-height:92vh; display:flex; flex-direction:column; overflow:hidden; }
        .sr-mhd { display:flex; justify-content:space-between; align-items:center; padding:16px 22px; border-bottom:1.5px solid var(--sr-border); background:#f8f9fc; flex-shrink:0; }
        .sr-mhd h5 { display:flex; align-items:center; gap:8px; font-size:.96rem; font-weight:750; color:var(--sr-navy); margin:0; }
        .sr-mbd { overflow-y:auto; flex:1; padding:20px 22px; display:flex; flex-direction:column; gap:14px; }
        .sr-mft { display:flex; justify-content:flex-end; gap:10px; padding:14px 22px; border-top:1.5px solid var(--sr-border); background:#f8f9fc; flex-shrink:0; }
        .sr-xcl { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:8px; border:1.5px solid var(--sr-border); background:transparent; color:var(--sr-muted); cursor:pointer; transition:all .13s; flex-shrink:0; }
        .sr-xcl:hover { border-color:var(--sr-red); color:var(--sr-red); background:var(--sr-red-bg); }

        /* ── Form fields (inside modal) ── */
        .sr-field-row { display:flex; gap:14px; flex-wrap:wrap; }
        .sr-field { flex:1 1 200px; min-width:150px; display:flex; flex-direction:column; gap:5px; }
        .sr-label { font-size:.76rem; font-weight:650; color:var(--sr-text); }
        .sr-label-hint { font-weight:400; color:var(--sr-muted); font-size:.72rem; }
        .sr-field-hint { font-size:.72rem; color:var(--sr-muted); margin-top:2px; }
        .sr-input, .sr-textarea, .sr-select {
          width:100%; padding:9px 11px; font-size:.83rem; border:1.5px solid var(--sr-border);
          border-radius:var(--sr-rsm); background:var(--sr-bg); color:var(--sr-text); outline:none;
          font-family:var(--sr-font); transition:border .13s, background .13s; box-sizing:border-box;
        }
        .sr-textarea { resize:vertical; min-height:44px; }
        .sr-input:focus, .sr-textarea:focus, .sr-select:focus { border-color:var(--sr-accent); background:#fff; }
        .sr-input:disabled, .sr-textarea:disabled, .sr-select:disabled { opacity:.55; cursor:not-allowed; }
        .sr-select { cursor:pointer; }

        .sr-divider { display:flex; align-items:center; gap:8px; font-size:.72rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--sr-muted); padding-top:4px; border-top:1px dashed var(--sr-border); margin-top:2px; }

        .sr-note { display:flex; gap:10px; align-items:flex-start; background:var(--sr-accent-lt); color:#1f2b6b; border-radius:var(--sr-rsm); padding:11px 13px; font-size:.79rem; line-height:1.5; }
        .sr-note svg { flex-shrink:0; margin-top:1px; color:var(--sr-accent); }
        .sr-note-sub { margin-top:6px; }
        .sr-note-secondary { background:#f5f6fb; color:var(--sr-text); border:1px solid var(--sr-border); }

        .sr-checkbox-row { display:flex; flex-direction:column; gap:8px; }
        .sr-checkbox { display:flex; align-items:center; gap:8px; font-size:.81rem; color:var(--sr-text); cursor:pointer; }
        .sr-checkbox input { width:16px; height:16px; accent-color:var(--sr-accent); cursor:pointer; margin:0; }

        @media (max-width:640px) {
          .sr { padding:18px 14px 50px; }
          .sr-hd h1 { font-size:1.25rem; }
          .sr-actions { width:100%; }
          .sr-actions .sr-btn { flex:1; justify-content:center; }
        }
      `}</style>

      <div className="sr">

        {/* ── Header ── */}
        <div className="sr-hd">
          <div>
            <div className="sr-hd-eyebrow"><span className="sr-hd-eyebrow-dot" />Subject Rules</div>
            <h1>Chapter Range Rules</h1>
            <p>Define how questions are distributed across chapters for board-pattern paper generation</p>
          </div>
          <div className="sr-actions">
            <span className="sr-count-pill"><Check size={14} />{rules.length} rules defined</span>
            <button className="sr-btn sr-btn-ghost" onClick={() => fetchRules(selectedSubject)} disabled={!selectedSubject || loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            {selectedSubject && (
              <button className="sr-btn sr-btn-primary" onClick={() => setShowNewRuleForm(true)} disabled={loading}>
                <Plus size={14} /> Add Rule
              </button>
            )}
          </div>
        </div>

        {/* ── Error banner ── */}
        {apiError && (
          <div className="sr-error">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div className="sr-error-body">
              <strong>API Error:</strong> {apiError}
              {debugInfo && (
                <div className="sr-error-actions">
                  <button
                    className="sr-btn sr-btn-ghost"
                    style={{ padding: '5px 11px', fontSize: '.75rem' }}
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
                      toast.success('Debug info copied to clipboard');
                    }}
                  >
                    Copy Debug Info
                  </button>
                </div>
              )}
            </div>
            <button className="sr-error-close" onClick={() => setApiError(null)}><X size={16} /></button>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="sr-fc">
          <div className="sr-fc-field">
            <span className="sr-fc-label"><BookOpen size={13} />Class</span>
            <select className="sr-sel" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} disabled={loading}>
              <option value="">Select Class</option>
              {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
            </select>
          </div>
          <div className="sr-fc-field">
            <span className="sr-fc-label"><FileText size={13} />Subject</span>
            <select className="sr-sel" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} disabled={!selectedClass || loading}>
              <option value="">Select Subject</option>
              {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
            </select>
          </div>
          <div className="sr-fc-field" style={{ flex: '2 1 260px' }}>
            <span className="sr-fc-label"><Search size={13} />Search Rules</span>
            <div className="sr-si">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search by chapter range, question type, category, or group key…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* ── Stats bar ── */}
        {selectedSubject && (
          <div className="sr-sb">
            <span className="sr-sb-item"><Hash size={14} /><strong>{getTotalChapters()}</strong>&nbsp;total chapters</span>
            <span className="sr-sb-dot">·</span>
            <span className="sr-sb-item"><Layers size={14} /><strong>{Object.keys(ranges).length}</strong>&nbsp;ranges</span>
            <span className="sr-sb-dot">·</span>
            <span className="sr-sb-item"><Target size={14} /><strong>{rules.length}</strong>&nbsp;rules</span>
          </div>
        )}

        {/* ── New Rule Modal ── */}
        {showNewRuleForm && (
          <div className="sr-mo" onClick={() => !loading && setShowNewRuleForm(false)}>
            <div className="sr-md" onClick={e => e.stopPropagation()}>
              <div className="sr-mhd">
                <h5><Plus size={18} />Add New Chapter Range Rule</h5>
                <button className="sr-xcl" onClick={() => setShowNewRuleForm(false)} disabled={loading}><X size={15} /></button>
              </div>
              <div className="sr-mbd">
                {renderCoreFields(newRule, setNewRule)}
                {renderOrderingFields(newRule, setNewRule)}
              </div>
              <div className="sr-mft">
                <button className="sr-btn sr-btn-ghost" onClick={() => setShowNewRuleForm(false)} disabled={loading}>Cancel</button>
                <button className="sr-btn sr-btn-primary" onClick={handleCreateRule} disabled={loading}>
                  {loading ? 'Creating…' : 'Create Rule'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Rule Modal ── */}
        {editingRule && (
          <div className="sr-mo" onClick={() => !loading && setEditingRule(null)}>
            <div className="sr-md" onClick={e => e.stopPropagation()}>
              <div className="sr-mhd">
                <h5><Copy size={18} />Edit Chapter Range Rule</h5>
                <button className="sr-xcl" onClick={() => setEditingRule(null)} disabled={loading}><X size={15} /></button>
              </div>
              <div className="sr-mbd">
                {renderCoreFields(editForm, setEditForm)}
                {renderOrderingFields(editForm, setEditForm)}
              </div>
              <div className="sr-mft">
                <button className="sr-btn sr-btn-ghost" onClick={() => setEditingRule(null)} disabled={loading}>Cancel</button>
                <button className="sr-btn sr-btn-primary" onClick={handleUpdateRule} disabled={loading}>
                  {loading ? 'Updating…' : 'Update Rule'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Main content ── */}
        {loading ? (
          <div className="sr-loader"><div className="sr-spin-el" /></div>
        ) : selectedSubject ? (
          chapters.length > 0 ? (
            <>
              {/* Rules table */}
              <div className="sr-card">
                <div className="sr-tw">
                  <table className="sr-table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Order</th>
                        <th>Chapter Range</th>
                        <th>Question Type</th>
                        <th>Category</th>
                        <th>Group / Label</th>
                        <th>Mode</th>
                        <th>Questions</th>
                        <th style={{ width: 90 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredRules().length > 0 ? getFilteredRules().map(rule => {
                        const typeConfig = getQuestionTypes().find(t => t.key === rule.question_type);
                        const categoryLabel = getCategoryLabel((rule as any).question_category_id);
                        const isTotalMode = rule.rule_mode === 'total';
                        const groupKey = (rule as any).group_key;
                        const qLabel = (rule as any).q_label;
                        const qLabelUr = (rule as any).q_label_ur;
                        const isPaired = (rule as any).is_paired;
                        const isAlternative = (rule as any).is_alternative;
                        const sortOrder = (rule as any).sort_order ?? 0;

                        return (
                          <tr key={rule.id}>
                            <td><span className="sr-badge sr-b-order">{sortOrder}</span></td>
                            <td><span className="sr-badge sr-b-range">Ch {rule.chapter_start}–{rule.chapter_end}</span></td>
                            <td style={{ fontWeight: 600 }}>{typeConfig?.label || rule.question_type}</td>
                            <td>
                              {categoryLabel ? (
                                <span className="sr-badge sr-b-category">{categoryLabel}</span>
                              ) : <span className="sr-muted-txt">—</span>}
                            </td>
                            <td>
                              {groupKey ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <span className="sr-badge sr-b-group">{qLabel ? `(${qLabel}) ` : ''}{groupKey}</span>
                                  {qLabel && qLabelUr && <span className="sr-muted-txt">({qLabelUr})</span>}
                                  {isAlternative && <span className="sr-badge sr-b-alt">OR-choice</span>}
                                </div>
                              ) : isPaired ? (
                                <span className="sr-badge sr-b-paired">Paired a/b</span>
                              ) : <span className="sr-muted-txt">standalone</span>}
                            </td>
                            <td><span className={`sr-badge ${isTotalMode ? 'sr-b-total' : 'sr-b-perch'}`}>{isTotalMode ? 'Total' : 'Per Ch.'}</span></td>
                            <td>
                              <div style={{ fontWeight: 700 }}>
                                {rule.min_questions}{rule.max_questions ? `–${rule.max_questions}` : ''}
                              </div>
                              {(rule as any).attempt_count != null && (
                                <div className="sr-muted-txt">attempt {(rule as any).attempt_count}</div>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="sr-ab edit" title="Edit rule" onClick={() => startEditRule(rule)} disabled={loading}>
                                  <Copy size={13} />
                                </button>
                                <button className="sr-ab delete" title="Delete rule" onClick={() => handleDeleteRule(rule.id)} disabled={loading}>
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={8}>
                            <div className="sr-empty">
                              <div className="sr-empty-ico"><Search size={38} /></div>
                              <h3>No rules found</h3>
                              <p>{rules.length === 0 ? 'No rules have been created for this subject yet.' : 'Try adjusting your search criteria.'}</p>
                              {rules.length === 0 && (
                                <button className="sr-btn sr-btn-primary" onClick={() => setShowNewRuleForm(true)}>
                                  <Plus size={15} /> Create Your First Rule
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick stats + usage tips */}
              {rules.length > 0 && (
                <div className="sr-bottom-row">
                  <div className="sr-card" style={{ marginBottom: 0 }}>
                    <div className="sr-card-hd"><BarChart3 size={16} /><h2>Quick Stats</h2></div>
                    <div className="sr-stat-list">
                      <div className="sr-stat-row"><span>Total Rules</span><b>{rules.length}</b></div>
                      <div className="sr-stat-row"><span>Total Mode</span><b>{modeTotalCount}</b></div>
                      <div className="sr-stat-row"><span>Per Chapter Mode</span><b>{modePerChapterCount}</b></div>
                      <div className="sr-stat-row"><span>Category-Targeted</span><b>{categoryTargetedCount}</b></div>
                      <div className="sr-stat-row"><span>Grouped (shared Q.No)</span><b>{groupedCount}</b></div>
                    </div>
                  </div>

                  <div className="sr-card" style={{ marginBottom: 0 }}>
                    <div className="sr-card-hd"><HelpCircle size={16} /><h2>Usage Tips</h2></div>
                    <ul className="sr-tips-list">
                      <li><Check size={14} /><span><strong>Total Mode:</strong> select questions from any chapters in the range.</span></li>
                      <li><Check size={14} /><span><strong>Per Chapter Mode:</strong> select questions from EACH chapter in the range.</span></li>
                      <li><Check size={14} /><span><strong>Category:</strong> leave as "Whole type" unless you need a sub-part rule, like "10 Synonyms" within MCQs.</span></li>
                      <li><Check size={14} /><span><strong>Group Key:</strong> give 2+ rules the same key to merge them under one Q.No with separate sub-labels — e.g. 3 MCQ rules sharing "q1_mcq".</span></li>
                      <li><Check size={14} /><span>Leave Maximum Questions empty for no upper limit.</span></li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="sr-hero-empty">
              <BookOpen size={56} />
              <h4>No Chapters Found</h4>
              <p>No chapters available for the selected subject. Please check if chapters are properly configured.</p>
            </div>
          )
        ) : (
          <div className="sr-hero-empty">
            <BookOpen size={56} />
            <h4>Select Class &amp; Subject</h4>
            <p>Choose a class and subject above to start managing chapter range rules.</p>
            <span className="sr-hero-hint"><Info size={16} />Define rules like "Select 2-4 MCQ questions from Chapters 1-4"</span>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
