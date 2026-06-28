'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import toast from 'react-hot-toast';
import {
  Tag, Plus, Pencil, Trash2, RefreshCw, Search,
  ToggleLeft, ToggleRight, AlertCircle, Info, Check,
  ChevronUp, ChevronDown, Filter, BookOpen, X, Layers,
} from 'lucide-react';

// ── Exact question_type values accepted by the DB CHECK constraint ────────────
const QUESTION_TYPES = [
  { value: 'mcq',                 label: 'MCQ' },
  { value: 'short',               label: 'Short Answer' },
  { value: 'long',                label: 'Long Answer' },
  { value: 'story',                label: 'Story Writing' },
  { value: 'translate_urdu',      label: 'Translate Urdu' },
  { value: 'translate_english',   label: 'Translate English' },
  { value: 'idiom_phrases',       label: 'Idiom / Phrases' },
  { value: 'passage',             label: 'Passage' },
  { value: 'poetry_explanation',  label: 'Poetry Explanation' },
  { value: 'stanza_explanation',  label: 'Stanza Explanation' },
  { value: 'prose_explanation',   label: 'Prose Explanation' },
  { value: 'sentence_correction', label: 'Sentence Correction' },
  { value: 'sentence_completion', label: 'Sentence Completion' },
  { value: 'punctuation',         label: 'Punctuation' },
  { value: 'directInDirect',      label: 'Direct / Indirect' },
  { value: 'activePassive',       label: 'Active / Passive' },
  { value: 'application',         label: 'Application' },
  { value: 'letter',              label: 'Letter' },
  { value: 'mokalma',             label: 'Mokalma' },
  { value: 'Nasarkhulasa',        label: 'Nasar Khulasa' },
  { value: 'markziKhyal',         label: 'Markzi Khyal' },
  { value: 'summary',             label: 'Summary' },
  { value: 'gazal',               label: 'Ghazal' },
  { value: 'pair_of_words',       label: 'Pair of Words' },
  { value: 'essay',               label: 'Essay' },
  { value: 'darkhwast_khat',      label: 'Darkhwast Khat' },
  { value: 'kahani_makalma',      label: 'Kahani Makalma' },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────
interface QuestionCategory {
  id: string;
  question_type: string;
  category_value: string;
  label_en: string;
  label_ur: string | null;
  subject_hint: string | null;
  class_hint: string | null;
  default_marks: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface ClassRow {
  id: string;
  name: string;
}

interface SubjectRow {
  id: string;
  name: string;
  name_ur: string | null;
}

interface ClassSubjectRow {
  id: string;
  class_id: string;
  subject_id: string;
  subject: SubjectRow;
  class: ClassRow;
}

type SortKey = keyof QuestionCategory;

const EMPTY_FORM = {
  question_type:  'mcq' as string,
  category_value: '',
  label_en:       '',
  label_ur:       '',
  subject_hint:   '',
  class_hint:     '',
  default_marks:  null as number | null,
  sort_order:     0,
  is_active:      true,
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function QuestionCategoriesPage() {

  // ── Lookup data ─────────────────────────────────────────────────────────────
  const [classes,       setClasses]       = useState<ClassRow[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRow[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);

  // ── Filter bar state ────────────────────────────────────────────────────────
  const [filterClass,   setFilterClass]   = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterType,    setFilterType]    = useState('');
  const [filterActive,  setFilterActive]  = useState<'all' | 'active' | 'inactive'>('all');
  const [search,        setSearch]        = useState('');

  // ── Table data ──────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [loading,    setLoading]    = useState(false);

  // ── Sort ────────────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('question_type');
  const [sortAsc, setSortAsc] = useState(true);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [showModal,   setShowModal]   = useState(false);
  const [editTarget,  setEditTarget]  = useState<QuestionCategory | null>(null);
  const [form,        setForm]        = useState({ ...EMPTY_FORM });
  const [formError,   setFormError]   = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);

  // Separate class selector inside the modal (drives modal's subject list)
  const [modalClass, setModalClass] = useState('');

  // ── Derived: subjects for the filter bar (based on filterClass) ────────────
  const filterBarSubjects: SubjectRow[] = filterClass
    ? classSubjects
        .filter(cs => cs.class_id === filterClass)
        .map(cs => cs.subject)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  // ── Derived: subjects for the modal (based on modalClass) ─────────────────
  const modalSubjects: SubjectRow[] = modalClass
    ? classSubjects
        .filter(cs => cs.class_id === modalClass)
        .map(cs => cs.subject)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  // ── Helper names for active filter chips ───────────────────────────────────
  const selectedClassName   = classes.find(c => c.id === filterClass)?.name ?? '';
  const selectedSubjectName = filterBarSubjects.find(s => s.id === filterSubject)?.name ?? '';

  // ── Fetch lookups ───────────────────────────────────────────────────────────
  const fetchLookups = useCallback(async () => {
    setLookupsLoading(true);
    try {
      const res = await fetch('/api/admin/lookups');
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load lookups');
      const data = await res.json();
      setClasses(
        (data.classes ?? []).sort((a: ClassRow, b: ClassRow) =>
          a.name.localeCompare(b.name)
        )
      );
      setClassSubjects(data.classSubjects ?? []);
    } catch (err: any) {
      toast.error(`Lookups: ${err.message}`);
    } finally {
      setLookupsLoading(false);
    }
  }, []);

  // ── Fetch categories ────────────────────────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/question-categories');
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load');
      setCategories(await res.json());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLookups(); },    [fetchLookups]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // Reset subject when filter class changes
  useEffect(() => { setFilterSubject(''); }, [filterClass]);

  // ── Filtered + sorted list ──────────────────────────────────────────────────
  const visible = [...categories]
    .filter(c => !filterType || c.question_type === filterType)
    .filter(c => {
      if (!filterClass) return true;
      return !c.class_hint ||
        c.class_hint.toLowerCase() === selectedClassName.toLowerCase();
    })
    .filter(c => {
      if (!filterSubject) return true;
      return !c.subject_hint ||
        c.subject_hint.toLowerCase() === selectedSubjectName.toLowerCase();
    })
    .filter(c =>
      filterActive === 'all' ? true :
      filterActive === 'active' ? c.is_active : !c.is_active
    )
    .filter(c =>
      !search ||
      [c.label_en, c.label_ur, c.category_value, c.question_type,
       c.subject_hint, c.class_hint]
        .some(v => v?.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      const cmp = String(a[sortKey] ?? '').localeCompare(
        String(b[sortKey] ?? ''), undefined, { numeric: true }
      );
      return sortAsc ? cmp : -cmp;
    });

  // ── Sort helpers ────────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey !== col ? null :
    sortAsc
      ? <ChevronUp   size={13} className="ms-1" />
      : <ChevronDown size={13} className="ms-1" />;

  const typeLabel = (val: string) =>
    QUESTION_TYPES.find(t => t.value === val)?.label ?? val;

  // ── Modal open helpers ──────────────────────────────────────────────────────
  const openCreate = () => {
    setEditTarget(null);
    setModalClass('');
    setForm({
      ...EMPTY_FORM,
      // Pre-fill subject_hint from active filter to speed up bulk entry
      subject_hint: selectedSubjectName.toLowerCase() || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (cat: QuestionCategory) => {
    setEditTarget(cat);
    // Restore modalClass from the saved class_hint name
    const matchedClass = classes.find(
      c => c.name.toLowerCase() === cat.class_hint?.toLowerCase()
    );
    setModalClass(matchedClass?.id ?? '');
    setForm({
      question_type:  cat.question_type,
      category_value: cat.category_value,
      label_en:       cat.label_en,
      label_ur:       cat.label_ur     ?? '',
      subject_hint:   cat.subject_hint ?? '',
      class_hint:     cat.class_hint   ?? '',
      default_marks:  cat.default_marks,
      sort_order:     cat.sort_order,
      is_active:      cat.is_active,
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditTarget(null);
    setModalClass('');
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setFormError(null);
    if (!form.question_type || !form.category_value.trim() || !form.label_en.trim()) {
      setFormError('Question type, category value, and English label are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        label_ur:      form.label_ur?.trim()     || null,
        subject_hint:  form.subject_hint?.trim() || null,
        class_hint:    form.class_hint?.trim()   || null,
        default_marks: form.default_marks != null
          ? Number(form.default_marks) : null,
      };

      const url    = editTarget
        ? `/api/admin/question-categories?id=${editTarget.id}`
        : '/api/admin/question-categories';
      const method = editTarget ? 'PUT' : 'POST';

      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Save failed');

      toast.success(editTarget ? 'Category updated!' : 'Category created!');
      closeModal();
      await fetchCategories();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ───────────────────────────────────────────────────────────
  const handleToggleActive = async (cat: QuestionCategory) => {
    try {
      const res = await fetch(`/api/admin/question-categories?id=${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cat, is_active: !cat.is_active }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`Category ${!cat.is_active ? 'activated' : 'deactivated'}`);
      await fetchCategories();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (cat: QuestionCategory) => {
    if (!confirm(`Delete "${cat.label_en}"? This cannot be undone.`)) return;
    try {
      const res    = await fetch(`/api/admin/question-categories?id=${cat.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success('Category deleted.');
      await fetchCategories();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="container-fluid py-4">

        {/* ── Header + Filter card ── */}
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body p-4">

            {/* Title row */}
            <div className="d-flex flex-column flex-md-row justify-content-between
                            align-items-start align-items-md-center mb-4">
              <div className="mb-3 mb-md-0">
                <h1 className="h3 mb-1 text-primary d-flex align-items-center">
                  <Tag className="me-3" size={26} />
                  Question Categories
                </h1>
                <p className="text-muted mb-0 d-flex align-items-center">
                  <Info size={15} className="me-2" />
                  Sub-categories for each question type (e.g. Synonyms within MCQ)
                </p>
              </div>
              <span className="badge bg-primary-subtle text-primary fs-6 px-3 py-2">
                {categories.filter(c => c.is_active).length} active / {categories.length} total
              </span>
            </div>

            {/* ── Filter row ── */}
            <div className="row g-3 align-items-end">

              {/* 1. Class */}
              <div className="col-6 col-md-2">
                <label className="form-label fw-medium d-flex align-items-center">
                  <Layers size={14} className="me-1" /> Class
                </label>
                <select
                  className="form-select"
                  value={filterClass}
                  onChange={e => setFilterClass(e.target.value)}
                  disabled={lookupsLoading}
                >
                  <option value="">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* 2. Subject — only enabled after a class is picked */}
              <div className="col-6 col-md-2">
                <label className="form-label fw-medium d-flex align-items-center">
                  <BookOpen size={14} className="me-1" /> Subject
                </label>
                <select
                  className="form-select"
                  value={filterSubject}
                  onChange={e => setFilterSubject(e.target.value)}
                  disabled={lookupsLoading || !filterClass}
                >
                  <option value="">
                    {!filterClass ? '— Select class first —' : 'All Subjects'}
                  </option>
                  {filterBarSubjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* 3. Question type */}
              <div className="col-md-2">
                <label className="form-label fw-medium d-flex align-items-center">
                  <Filter size={14} className="me-1" /> Question Type
                </label>
                <select
                  className="form-select"
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                >
                  <option value="">All Types</option>
                  {QUESTION_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* 4. Status */}
              <div className="col-md-2">
                <label className="form-label fw-medium">Status</label>
                <select
                  className="form-select"
                  value={filterActive}
                  onChange={e => setFilterActive(e.target.value as any)}
                >
                  <option value="all">All</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
              </div>

              {/* 5. Search */}
              <div className="col-md-3">
                <label className="form-label fw-medium d-flex align-items-center">
                  <Search size={14} className="me-1" /> Search
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-transparent border-end-0">
                    <Search size={15} />
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder="label, value, type…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => setSearch('')}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* 6. Action buttons */}
              <div className="col-md-1 d-flex gap-2">
                <button
                  className="btn btn-outline-secondary d-flex align-items-center
                             justify-content-center"
                  style={{ minWidth: 40 }}
                  onClick={fetchCategories}
                  disabled={loading}
                  title="Refresh"
                >
                  <RefreshCw size={16} className={loading ? 'spin' : ''} />
                </button>
                <button
                  className="btn btn-success d-flex align-items-center
                             justify-content-center"
                  style={{ minWidth: 40 }}
                  onClick={openCreate}
                  title="Add new category"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* ── Active filter chips ── */}
            {(filterClass || filterSubject || filterType ||
              filterActive !== 'all' || search) && (
              <div className="d-flex flex-wrap gap-2 mt-3">
                {filterClass && (
                  <span className="badge bg-primary-subtle text-primary
                                   d-flex align-items-center gap-1">
                    Class: {selectedClassName}
                    <X size={12} role="button" onClick={() => setFilterClass('')} />
                  </span>
                )}
                {filterSubject && (
                  <span className="badge bg-success-subtle text-success
                                   d-flex align-items-center gap-1">
                    Subject: {selectedSubjectName}
                    <X size={12} role="button" onClick={() => setFilterSubject('')} />
                  </span>
                )}
                {filterType && (
                  <span className="badge bg-info-subtle text-info
                                   d-flex align-items-center gap-1">
                    Type: {typeLabel(filterType)}
                    <X size={12} role="button" onClick={() => setFilterType('')} />
                  </span>
                )}
                {filterActive !== 'all' && (
                  <span className="badge bg-warning-subtle text-warning
                                   d-flex align-items-center gap-1">
                    {filterActive}
                    <X size={12} role="button" onClick={() => setFilterActive('all')} />
                  </span>
                )}
                {search && (
                  <span className="badge bg-secondary-subtle text-secondary
                                   d-flex align-items-center gap-1">
                    "{search}"
                    <X size={12} role="button" onClick={() => setSearch('')} />
                  </span>
                )}
                <span className="text-muted small align-self-center">
                  {visible.length} result{visible.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Table card ── */}
        <div className="card shadow-sm border-0">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status" />
                <p className="text-muted mt-3 mb-0">Loading categories…</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="ps-4" style={{ width: 160 }}>
                        <span
                          role="button"
                          className="d-flex align-items-center user-select-none"
                          onClick={() => handleSort('question_type')}
                        >
                          Question Type <SortIcon col="question_type" />
                        </span>
                      </th>
                      <th style={{ width: 160 }}>
                        <span
                          role="button"
                          className="d-flex align-items-center user-select-none"
                          onClick={() => handleSort('category_value')}
                        >
                          Value <SortIcon col="category_value" />
                        </span>
                      </th>
                      <th>
                        <span
                          role="button"
                          className="d-flex align-items-center user-select-none"
                          onClick={() => handleSort('label_en')}
                        >
                          English Label <SortIcon col="label_en" />
                        </span>
                      </th>
                      <th style={{ width: 160 }}>Urdu Label</th>
                      <th style={{ width: 120 }}>Subject Hint</th>
                      <th style={{ width: 120 }}>Class Hint</th>
                      <th className="text-center" style={{ width: 80 }}>
                        <span
                          role="button"
                          className="d-flex align-items-center justify-content-center user-select-none"
                          onClick={() => handleSort('default_marks')}
                        >
                          Marks <SortIcon col="default_marks" />
                        </span>
                      </th>
                      <th className="text-center" style={{ width: 80 }}>
                        <span
                          role="button"
                          className="d-flex align-items-center justify-content-center user-select-none"
                          onClick={() => handleSort('sort_order')}
                        >
                          Order <SortIcon col="sort_order" />
                        </span>
                      </th>
                      <th className="text-center" style={{ width: 90 }}>Active</th>
                      <th className="text-center pe-4" style={{ width: 130 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-5">
                          <Tag size={48} className="text-muted mb-3 d-block mx-auto" />
                          <p className="text-muted mb-0">
                            No categories found. Adjust filters or add a new one.
                          </p>
                        </td>
                      </tr>
                    ) : visible.map(cat => (
                      <tr key={cat.id} className={!cat.is_active ? 'opacity-50' : ''}>
                        <td className="ps-4">
                          <span className="badge bg-primary-subtle text-primary">
                            {typeLabel(cat.question_type)}
                          </span>
                        </td>
                        <td>
                          <code className="text-secondary small">{cat.category_value}</code>
                        </td>
                        <td className="fw-medium">{cat.label_en}</td>
                        <td className="text-muted" dir="rtl">{cat.label_ur || '—'}</td>
                        <td>
                          {cat.subject_hint
                            ? <span className="badge bg-info-subtle text-info">{cat.subject_hint}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td>
                          {cat.class_hint
                            ? <span className="badge bg-warning-subtle text-warning">{cat.class_hint}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td className="text-center">
                          {cat.default_marks ?? <span className="text-muted">—</span>}
                        </td>
                        <td className="text-center">{cat.sort_order}</td>
                        <td className="text-center">
                          <button
                            className="btn btn-sm btn-link p-0"
                            title={cat.is_active ? 'Deactivate' : 'Activate'}
                            onClick={() => handleToggleActive(cat)}
                          >
                            {cat.is_active
                              ? <ToggleRight size={24} className="text-success" />
                              : <ToggleLeft  size={24} className="text-muted"   />}
                          </button>
                        </td>
                        <td className="pe-4">
                          <div className="d-flex justify-content-center gap-2">
                            <button
                              className="btn btn-sm btn-primary d-flex align-items-center"
                              onClick={() => openEdit(cat)}
                            >
                              <Pencil size={14} className="me-1" /> Edit
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(cat)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Add / Edit Modal ── */}
        {showModal && (
          <div
            className="modal fade show d-block"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          >
            <div className="modal-dialog modal-lg">
              <div className="modal-content">

                <div className="modal-header">
                  <h5 className="modal-title d-flex align-items-center">
                    {editTarget
                      ? <Pencil size={18} className="me-2" />
                      : <Plus   size={18} className="me-2" />}
                    {editTarget ? 'Edit Category' : 'Add New Category'}
                  </h5>
                  <button className="btn-close" onClick={closeModal} disabled={saving} />
                </div>

                <div className="modal-body">
                  {formError && (
                    <div className="alert alert-danger d-flex align-items-center mb-4">
                      <AlertCircle size={18} className="me-2 flex-shrink-0" />
                      {formError}
                    </div>
                  )}

                  <div className="row g-3">

                    {/* Question Type */}
                    <div className="col-md-6">
                      <label className="form-label fw-medium">
                        Question Type <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={form.question_type}
                        onChange={e =>
                          setForm(f => ({ ...f, question_type: e.target.value }))
                        }
                        disabled={saving}
                      >
                        {QUESTION_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Category Value */}
                    <div className="col-md-6">
                      <label className="form-label fw-medium">
                        Category Value <span className="text-danger">*</span>
                        <span className="text-muted small ms-1">(slug, e.g. synonyms)</span>
                      </label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        placeholder="synonyms"
                        value={form.category_value}
                        onChange={e =>
                          setForm(f => ({ ...f, category_value: e.target.value }))
                        }
                        disabled={saving}
                      />
                    </div>

                    {/* English Label */}
                    <div className="col-md-6">
                      <label className="form-label fw-medium">
                        English Label <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Synonyms"
                        value={form.label_en}
                        onChange={e =>
                          setForm(f => ({ ...f, label_en: e.target.value }))
                        }
                        disabled={saving}
                      />
                    </div>

                    {/* Urdu Label */}
                    <div className="col-md-6">
                      <label className="form-label fw-medium">
                        Urdu Label
                        <span className="text-muted small ms-1">(optional)</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="مترادفات"
                        value={form.label_ur ?? ''}
                        onChange={e =>
                          setForm(f => ({ ...f, label_ur: e.target.value }))
                        }
                        disabled={saving}
                        dir="rtl"
                      />
                    </div>

                    {/* ── Class Hint (step 1) ── */}
                    <div className="col-md-6">
                      <label className="form-label fw-medium">
                        Class Hint
                        <span className="text-muted small ms-1">(optional)</span>
                      </label>
                      <select
                        className="form-select"
                        value={modalClass}
                        onChange={e => {
                          const classId   = e.target.value;
                          const className = classes.find(c => c.id === classId)?.name ?? '';
                          setModalClass(classId);
                          // Store class name as text; clear subject_hint since
                          // the subject list is about to change
                          setForm(f => ({
                            ...f,
                            class_hint:   className,
                            subject_hint: '',
                          }));
                        }}
                        disabled={saving || lookupsLoading}
                      >
                        <option value="">— Any class —</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <div className="form-text">
                        Restricts this category to a specific class only
                      </div>
                    </div>

                    {/* ── Subject Hint (step 2 — only enabled after class is chosen) ── */}
                    <div className="col-md-6">
                      <label className="form-label fw-medium">
                        Subject Hint
                        <span className="text-muted small ms-1">(optional)</span>
                      </label>
                      <select
                        className="form-select"
                        value={form.subject_hint ?? ''}
                        onChange={e =>
                          setForm(f => ({ ...f, subject_hint: e.target.value }))
                        }
                        disabled={saving || !modalClass}
                      >
                        <option value="">
                          {!modalClass
                            ? '— Select a class first —'
                            : '— Any subject —'}
                        </option>
                        {modalSubjects.map(s => (
                          // Store lowercase name to match isEnglishOrUrdu() exactly
                          <option key={s.id} value={s.name.toLowerCase()}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <div className="form-text">
                        {!modalClass
                          ? 'Select a class above to see its subjects'
                          : 'Restricts this category to a specific subject only'}
                      </div>
                    </div>

                    {/* Default Marks */}
                    <div className="col-md-4">
                      <label className="form-label fw-medium">Default Marks</label>
                      <input
                        type="number"
                        className="form-control"
                        min={0}
                        step={0.5}
                        placeholder="—"
                        value={form.default_marks ?? ''}
                        onChange={e =>
                          setForm(f => ({
                            ...f,
                            default_marks: e.target.value === ''
                              ? null : Number(e.target.value),
                          }))
                        }
                        disabled={saving}
                      />
                    </div>

                    {/* Sort Order */}
                    <div className="col-md-4">
                      <label className="form-label fw-medium">Sort Order</label>
                      <input
                        type="number"
                        className="form-control"
                        min={0}
                        value={form.sort_order}
                        onChange={e =>
                          setForm(f => ({ ...f, sort_order: Number(e.target.value) }))
                        }
                        disabled={saving}
                      />
                    </div>

                    {/* Is Active */}
                    <div className="col-md-4 d-flex align-items-end pb-1">
                      <div className="form-check form-switch mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="isActiveSwitch"
                          checked={form.is_active}
                          onChange={e =>
                            setForm(f => ({ ...f, is_active: e.target.checked }))
                          }
                          disabled={saving}
                        />
                        <label className="form-check-label fw-medium" htmlFor="isActiveSwitch">
                          Active
                        </label>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary d-flex align-items-center"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Check size={16} className="me-2" />
                        {editTarget ? 'Update' : 'Create'}
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}