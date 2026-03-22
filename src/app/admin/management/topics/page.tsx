'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AdminLayout from '@/components/AdminLayout';
import { toast } from 'react-hot-toast';
import { useRouter } from "next/navigation";
import { isUserAdmin } from "@/lib/auth-utils";
import { FiPlus, FiFilter, FiX, FiEdit, FiTrash2, FiCheck, FiBookOpen } from 'react-icons/fi';

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

  // 1. Fetch all necessary metadata
// 1. Fetch and Sort Metadata
const fetchData = useCallback(async () => {
  setLoading(true);
  try {
    const [resCls, resSub, resCS, resChaps] = await Promise.all([
      // Fetch classes
      supabase.from('classes').select('*'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('class_subjects').select('*'),
      supabase.from('chapters').select('*').order('chapterNo')
    ]);

    // Professional Natural Sort (handles Class 1, Class 2, Class 10 correctly)
    const sortedClasses = (resCls.data || []).sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    setClasses(sortedClasses);
    setSubjects(resSub.data || []);
    setClassSubjects(resCS.data || []);
    setChapters(resChaps.data || []);
    
    await fetchTopics();
  } catch (error) {
    toast.error("Failed to load data");
  } finally {
    setLoading(false);
  }
}, []);

  // 2. Fetch Topics with full relational context
  const fetchTopics = async () => {
    const { data, error } = await supabase
      .from('topics')
      .select(`
        id, name, chapter_id,
        chapters (
          id, name, chapterNo,
          class_subjects (
            class:classes(id, name),
            subject:subjects(id, name)
          )
        )
      `)
      .order('name');

    if (error) {
      toast.error(error.message);
      return;
    }

    const flattened = data.map(t => ({
      id: t.id,
      name: t.name,
      chapter_id: t.chapter_id,
      chapter_name: t.chapters?.name,
      chapter_no: t.chapters?.chapterNo,
      class_id: t.chapters?.class_subjects?.class?.id,
      class_name: t.chapters?.class_subjects?.class?.name,
      subject_id: t.chapters?.class_subjects?.subject?.id,
      subject_name: t.chapters?.class_subjects?.subject?.name
    }));
    setTopics(flattened);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 3. Filtering Logic based on Schema
  // Get only subjects linked to the selected class via class_subjects table
  const getSubjectsForClass = (classId) => {
    if (!classId) return [];
    const linkedSubjectIds = classSubjects
      .filter(cs => cs.class_id === classId)
      .map(cs => cs.subject_id);
    return subjects.filter(s => linkedSubjectIds.includes(s.id));
  };

  // Get only chapters linked to the specific class_subject_id pair
  const getChaptersForContext = (classId, subjectId) => {
    if (!classId || !subjectId) return [];
    const targetCS = classSubjects.find(cs => cs.class_id === classId && cs.subject_id === subjectId);
    if (!targetCS) return [];
    return chapters.filter(ch => ch.class_subject_id === targetCS.id);
  };

  const filteredTopics = topics.filter(t => 
    (!filters.classId || t.class_id === filters.classId) &&
    (!filters.subjectId || t.subject_id === filters.subjectId) &&
    (!filters.chapterId || t.chapter_id === filters.chapterId)
  );

  // 4. Save/Delete Handlers
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.chapterId) return toast.error("Missing required fields");

    setSaving(true);
    const payload = { name: formData.name, chapter_id: formData.chapterId };
    
    const { error } = formData.id 
      ? await supabase.from('topics').update(payload).eq('id', formData.id)
      : await supabase.from('topics').insert([payload]);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Topic ${formData.id ? 'updated' : 'added'}`);
      setShowForm(false);
      setFormData({ id: '', name: '', classId: '', subjectId: '', chapterId: '' });
      fetchTopics();
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this topic? This might affect linked questions.")) return;
    const { error } = await supabase.from('topics').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); fetchTopics(); }
  };

  return (
    <AdminLayout activeTab="management">
      <div className="container py-4">
        
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4 p-3 bg-white rounded shadow-sm border-start border-4 border-primary">
          <div>
            <h3 className="fw-bold mb-0">Topic Repository</h3>
            <p className="text-muted small mb-0">Manage granular topics for question categorization</p>
          </div>
          <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowForm(!showForm)}>
            {showForm ? <FiX /> : <FiPlus />} {showForm ? 'Close' : 'Add Topic'}
          </button>
        </div>

        {/* Filters Section */}
        <div className="card border-0 shadow-sm mb-4 bg-light">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="small fw-bold text-uppercase text-muted d-block mb-1">Class</label>
                <select className="form-select border-0 shadow-sm" value={filters.classId} 
                  onChange={(e) => setFilters({ classId: e.target.value, subjectId: '', chapterId: '' })}>
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="small fw-bold text-uppercase text-muted d-block mb-1">Subject</label>
                <select className="form-select border-0 shadow-sm" value={filters.subjectId} disabled={!filters.classId}
                  onChange={(e) => setFilters({ ...filters, subjectId: e.target.value, chapterId: '' })}>
                  <option value="">All Subjects</option>
                  {getSubjectsForClass(filters.classId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="small fw-bold text-uppercase text-muted d-block mb-1">Chapter</label>
                <select className="form-select border-0 shadow-sm" value={filters.chapterId} disabled={!filters.subjectId}
                  onChange={(e) => setFilters({ ...filters, chapterId: e.target.value })}>
                  <option value="">All Chapters</option>
                  {getChaptersForContext(filters.classId, filters.subjectId).map(ch => (
                    <option key={ch.id} value={ch.id}>Ch {ch.chapterNo}: {ch.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <button className="btn btn-outline-secondary w-100 border-0 shadow-sm bg-white" 
                  onClick={() => setFilters({ classId: '', subjectId: '', chapterId: '' })}>
                  <FiX className="me-1"/> Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Form Section */}
        {showForm && (
          <div className="card border-0 shadow-lg mb-4 animate__animated animate__fadeInDown">
            <div className="card-header bg-dark text-white fw-bold">
              {formData.id ? 'Modify Topic' : 'Register New Topic'}
            </div>
            <div className="card-body">
              <form onSubmit={handleSave} className="row g-3">
                <div className="col-md-4">
                  <label className="form-label small fw-bold">1. Select Class & Subject</label>
                  <div className="input-group">
                    <select className="form-select" value={formData.classId} required
                      onChange={(e) => setFormData({...formData, classId: e.target.value, subjectId: '', chapterId: ''})}>
                      <option value="">Class...</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select className="form-select" value={formData.subjectId} required disabled={!formData.classId}
                      onChange={(e) => setFormData({...formData, subjectId: e.target.value, chapterId: ''})}>
                      <option value="">Subject...</option>
                      {getSubjectsForClass(formData.classId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold">2. Assign to Chapter</label>
                  <select className="form-select" value={formData.chapterId} required disabled={!formData.subjectId}
                    onChange={(e) => setFormData({...formData, chapterId: e.target.value})}>
                    <option value="">Select Chapter...</option>
                    {getChaptersForContext(formData.classId, formData.subjectId).map(ch => (
                      <option key={ch.id} value={ch.id}>Ch {ch.chapterNo}: {ch.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold">3. Topic Name</label>
                  <input type="text" className="form-control" placeholder="e.g. Newton's First Law" 
                    value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="col-12 text-end">
                  <button type="submit" className="btn btn-success px-4" disabled={saving}>
                    {saving ? 'Processing...' : <><FiCheck className="me-1"/> Save Topic</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-3">No.</th>
                  <th>Topic Name</th>
                  <th>Chapter Context</th>
                  <th>Academic Level</th>
                  <th className="text-end pe-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-5"><div className="spinner-border text-primary"/></td></tr>
                ) : filteredTopics.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-5 text-muted">No topics found. Select a class/subject to browse.</td></tr>
                ) : (
                  filteredTopics.map((t, i) => (
                    <tr key={t.id}>
                      <td className="ps-3 text-muted small">{i + 1}</td>
                      <td className="fw-bold">{t.name}</td>
                      <td>
                        <span className="badge bg-info-subtle text-info border border-info-subtle">
                          Ch {t.chapter_no}: {t.chapter_name}
                        </span>
                      </td>
                      <td className="small">
                        {t.class_name} <span className="text-mutedmx-1">|</span> {t.subject_name}
                      </td>
                      <td className="text-end pe-3">
                        <button className="btn btn-sm btn-outline-primary me-2" onClick={() => {
                          setFormData({ id: t.id, name: t.name, classId: t.class_id, subjectId: t.subject_id, chapterId: t.chapter_id });
                          setShowForm(true);
                        }}>
                          <FiEdit />
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(t.id)}>
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