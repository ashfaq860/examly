'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AdminLayout from '@/components/AdminLayout';
import { toast } from 'react-hot-toast';
import { useRouter } from "next/navigation";
import { isUserAdmin } from "@/lib/auth-utils";
import { FiPlus, FiX, FiEdit, FiTrash2, FiCheck } from 'react-icons/fi';

// ─── Helper: flatten a raw topic row from Supabase ────────────────────────────
// Extracted so both fetchTopics and handleSave use identical logic
function flattenTopic(t) {
  const cs = Array.isArray(t.chapters?.class_subjects)
    ? t.chapters.class_subjects[0]
    : t.chapters?.class_subjects;

  return {
    id: t.id,
    name: t.name,
    chapter_id: t.chapter_id,
    chapter_name: t.chapters?.name,
    chapter_no: t.chapters?.chapterNo,
    class_id: cs?.classes?.id,
    class_name: cs?.classes?.name,
    subject_id: cs?.subjects?.id,
    subject_name: cs?.subjects?.name,
  };
}

// ─── The join query string (reused in both fetch and insert) ──────────────────
const TOPIC_SELECT = `
  id, name, chapter_id,
  chapters!topics_chapter_id_fkey (
    id, name, chapterNo,
    class_subjects!chapters_class_subject_id_fkey (
      id,
      classes!class_subjects_class_id_fkey ( id, name ),
      subjects!class_subjects_subject_id_fkey ( id, name )
    )
  )
`;

export default function TopicsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Data States
  const [topics, setTopics] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);

  // Filter & Form States
  const [filters, setFilters] = useState({ classId: '', subjectId: '', chapterId: '' });
  const [formData, setFormData] = useState({ id: '', name: '', classId: '', subjectId: '', chapterId: '' });

  const router = useRouter();

  // ─── fetchTopics is now stable via useCallback ────────────────────────────
  // BUG FIX: plain async functions inside component body capture stale closures
  // when called from other useCallback hooks. Wrapping in useCallback fixes this.
  const fetchTopics = useCallback(async () => {
    const { data, error } = await supabase
      .from('topics')
      .select(TOPIC_SELECT)
      .order('name');

    if (error) {
      toast.error(error.message);
      return;
    }

    setTopics((data || []).map(flattenTopic));
  }, []);

  // ─── Fetch all metadata + topics on mount ────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resCls, resSub, resCS, resChaps] = await Promise.all([
        supabase.from('classes').select('*'),
        supabase.from('subjects').select('*').order('name'),
        supabase.from('class_subjects').select('*'),
        supabase.from('chapters').select('*').order('chapterNo'),
      ]);

      const sortedClasses = (resCls.data || []).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );

      setClasses(sortedClasses);
      setSubjects(resSub.data || []);
      setClassSubjects(resCS.data || []);
      setChapters(resChaps.data || []);

      await fetchTopics();
    } catch (err) {
      console.error('fetchData error:', err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [fetchTopics]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Derived Selects ──────────────────────────────────────────────────────
  const getSubjectsForClass = (classId) => {
    if (!classId) return [];
    const linkedIds = classSubjects
      .filter(cs => cs.class_id === classId)
      .map(cs => cs.subject_id);
    return subjects.filter(s => linkedIds.includes(s.id));
  };

  const getChaptersForContext = (classId, subjectId) => {
    if (!classId || !subjectId) return [];
    const targetCS = classSubjects.find(
      cs => cs.class_id === classId && cs.subject_id === subjectId
    );
    if (!targetCS) return [];
    return chapters.filter(ch => ch.class_subject_id === targetCS.id);
  };

  // ─── Filtered View ────────────────────────────────────────────────────────
  const filteredTopics = topics.filter(t =>
    (!filters.classId   || t.class_id   === filters.classId) &&
    (!filters.subjectId || t.subject_id === filters.subjectId) &&
    (!filters.chapterId || t.chapter_id === filters.chapterId)
  );

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.chapterId) {
      return toast.error("Topic name and chapter are required");
    }

    setSaving(true);
    const payload = { name: formData.name.trim(), chapter_id: formData.chapterId };

    if (formData.id) {
      // ── UPDATE ──────────────────────────────────────────────────────────
      const { error } = await supabase
        .from('topics')
        .update(payload)
        .eq('id', formData.id);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Topic updated");
        handleCloseForm();
        await fetchTopics();
      }

    } else {
      // ── INSERT ──────────────────────────────────────────────────────────
      // BUG FIX: Do NOT chain .select() on .insert() — in supabase-js v2 this
      // generates a ?columns= URL param request that strips auth headers and
      // fails with "No API key found". Instead: insert first, then fetch by
      // the returned id separately.
      const { data: inserted, error: insertError } = await supabase
        .from('topics')
        .insert([payload])
        .select('id')  // only ask for the id — safe, no join, no ?columns= issue
        .single();

      if (insertError) {
        toast.error(insertError.message);
      } else {
        // Now fetch the full row with joins using the returned id
        const { data: newRow, error: fetchError } = await supabase
          .from('topics')
          .select(TOPIC_SELECT)
          .eq('id', inserted.id)
          .single();

        if (fetchError) {
          // Insert succeeded but join-fetch failed — just do a full refetch
          console.warn('Post-insert fetch failed, falling back to full refetch:', fetchError);
          await fetchTopics();
        } else {
          // Optimistically append the new topic and keep list sorted
          const newTopic = flattenTopic(newRow);
          setTopics(prev =>
            [...prev, newTopic].sort((a, b) => a.name.localeCompare(b.name))
          );
        }

        toast.success("Topic added");
        // Keep class/subject/chapter selected for rapid multi-entry
        setFormData(prev => ({ ...prev, name: '' }));
      }
    }

    setSaving(false);
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm("Delete this topic? Questions linked to it may be affected.")) return;
    const { error } = await supabase.from('topics').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Topic deleted");
      // Remove from local state immediately — no refetch needed
      setTopics(prev => prev.filter(t => t.id !== id));
    }
  };

  // ─── Edit Prefill ─────────────────────────────────────────────────────────
  const handleEdit = (t) => {
    setFormData({
      id: t.id,
      name: t.name,
      classId: t.class_id,
      subjectId: t.subject_id,
      chapterId: t.chapter_id,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setFormData({ id: '', name: '', classId: '', subjectId: '', chapterId: '' });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <AdminLayout activeTab="management">
      <div className="container py-4">

        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4 p-3 bg-white rounded shadow-sm border-start border-4 border-primary">
          <div>
            <h3 className="fw-bold mb-0">Topic Repository</h3>
            <p className="text-muted small mb-0">Manage granular topics for question categorisation</p>
          </div>
          <button
            className="btn btn-primary d-flex align-items-center gap-2"
            onClick={() => (showForm ? handleCloseForm() : setShowForm(true))}
          >
            {showForm ? <FiX /> : <FiPlus />}
            {showForm ? 'Close' : 'Add Topic'}
          </button>
        </div>

        {/* Filters */}
        <div className="card border-0 shadow-sm mb-4 bg-light">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="small fw-bold text-uppercase text-muted d-block mb-1">Class</label>
                <select
                  className="form-select border-0 shadow-sm"
                  value={filters.classId}
                  onChange={(e) => setFilters({ classId: e.target.value, subjectId: '', chapterId: '' })}
                >
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="small fw-bold text-uppercase text-muted d-block mb-1">Subject</label>
                <select
                  className="form-select border-0 shadow-sm"
                  value={filters.subjectId}
                  disabled={!filters.classId}
                  onChange={(e) => setFilters({ ...filters, subjectId: e.target.value, chapterId: '' })}
                >
                  <option value="">All Subjects</option>
                  {getSubjectsForClass(filters.classId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="small fw-bold text-uppercase text-muted d-block mb-1">Chapter</label>
                <select
                  className="form-select border-0 shadow-sm"
                  value={filters.chapterId}
                  disabled={!filters.subjectId}
                  onChange={(e) => setFilters({ ...filters, chapterId: e.target.value })}
                >
                  <option value="">All Chapters</option>
                  {getChaptersForContext(filters.classId, filters.subjectId).map(ch => (
                    <option key={ch.id} value={ch.id}>Ch {ch.chapterNo}: {ch.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <button
                  className="btn btn-outline-secondary w-100 border-0 shadow-sm bg-white"
                  onClick={() => setFilters({ classId: '', subjectId: '', chapterId: '' })}
                >
                  <FiX className="me-1" /> Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Add / Edit Form */}
        {showForm && (
          <div className="card border-0 shadow-lg mb-4">
            <div className="card-header bg-dark text-white fw-bold">
              {formData.id ? '✏️ Edit Topic' : '➕ Register New Topic'}
            </div>
            <div className="card-body">
              <form onSubmit={handleSave} className="row g-3">
                {/* Step 1 — Class + Subject */}
                <div className="col-md-4">
                  <label className="form-label small fw-bold">1. Class &amp; Subject</label>
                  <div className="input-group">
                    <select
                      className="form-select"
                      value={formData.classId}
                      required
                      onChange={(e) =>
                        setFormData({ ...formData, classId: e.target.value, subjectId: '', chapterId: '' })
                      }
                    >
                      <option value="">Class…</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select
                      className="form-select"
                      value={formData.subjectId}
                      required
                      disabled={!formData.classId}
                      onChange={(e) =>
                        setFormData({ ...formData, subjectId: e.target.value, chapterId: '' })
                      }
                    >
                      <option value="">Subject…</option>
                      {getSubjectsForClass(formData.classId).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Step 2 — Chapter */}
                <div className="col-md-4">
                  <label className="form-label small fw-bold">2. Chapter</label>
                  <select
                    className="form-select"
                    value={formData.chapterId}
                    required
                    disabled={!formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, chapterId: e.target.value })}
                  >
                    <option value="">Select chapter…</option>
                    {getChaptersForContext(formData.classId, formData.subjectId).map(ch => (
                      <option key={ch.id} value={ch.id}>Ch {ch.chapterNo}: {ch.name}</option>
                    ))}
                  </select>
                </div>

                {/* Step 3 — Topic Name */}
                <div className="col-md-4">
                  <label className="form-label small fw-bold">3. Topic Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Newton's First Law"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="col-12 d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary" onClick={handleCloseForm}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success px-4" disabled={saving}>
                    {saving
                      ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</>
                      : <><FiCheck className="me-1" /> Save Topic</>
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center py-3">
            <span className="fw-semibold text-muted small text-uppercase">
              {filteredTopics.length} topic{filteredTopics.length !== 1 ? 's' : ''} found
            </span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-3" style={{ width: 50 }}>#</th>
                  <th>Topic Name</th>
                  <th>Chapter</th>
                  <th>Class / Subject</th>
                  <th className="text-end pe-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-5">
                      <div className="spinner-border text-primary" />
                    </td>
                  </tr>
                ) : filteredTopics.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-5 text-muted">
                      {topics.length === 0
                        ? 'No topics yet. Click "Add Topic" to create the first one.'
                        : 'No topics match the selected filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredTopics.map((t, i) => (
                    <tr key={t.id}>
                      <td className="ps-3 text-muted small">{i + 1}</td>
                      <td className="fw-semibold">{t.name}</td>
                      <td>
                        <span className="badge bg-info-subtle text-info border border-info-subtle">
                          Ch {t.chapter_no}: {t.chapter_name}
                        </span>
                      </td>
                      <td className="small text-muted">
                        {t.class_name}
                        <span className="mx-1 text-muted">·</span>
                        {t.subject_name}
                      </td>
                      <td className="text-end pe-3">
                        <button
                          className="btn btn-sm btn-outline-primary me-2"
                          title="Edit"
                          onClick={() => handleEdit(t)}
                        >
                          <FiEdit />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          title="Delete"
                          onClick={() => handleDelete(t.id)}
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}