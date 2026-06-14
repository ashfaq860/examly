'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AdminLayout from '@/components/AdminLayout';
import { toast } from 'react-hot-toast';
import { FiPlus, FiX, FiEdit, FiTrash2, FiCheck } from 'react-icons/fi';

interface ClassRecord { id: string; name: string; }
interface SubjectRecord { id: string; name: string; }
interface ClassSubjectRecord { id: string; class_id: string; subject_id: string; }
interface ChapterRecord { id: string; name: string; chapterNo: number; class_subject_id: string; }

interface FlattenedTopic {
  id: string;
  name: string;
  chapter_id: string;
  chapter_name?: string;
  chapter_no?: number;
  class_id?: string;
  class_name?: string;
  subject_id?: string;
  subject_name?: string;
}

export default function TopicsPage() {
  const [loading, setLoading] = useState(true);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Metadata Dropdown States
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRecord[]>([]);
  const [chapters, setChapters] = useState<ChapterRecord[]>([]);

  // Core API State
  const [topics, setTopics] = useState<FlattenedTopic[]>([]);

  // Filter & Form States
  const [filters, setFilters] = useState({ classId: '', subjectId: '', chapterId: '' });
  const [formData, setFormData] = useState({ id: '', name: '', classId: '', subjectId: '', chapterId: '' });

  // 1. Unified API-Driven Topic Fetcher
  const fetchTopicsFromAPI = useCallback(async (clsId: string, subId: string, chId: string) => {
    setTopicsLoading(true);
    try {
      const params = new URLSearchParams();
      if (clsId) params.append('classId', clsId);
      if (subId) params.append('subjectId', subId);
      if (chId) params.append('chapterId', chId);

      const res = await fetch(`/api/admin/topics?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to synchronize topic repository.');
      
      const data = await res.json();
      setTopics(data);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error fetching topics from API");
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  // 2. Load Core Meta-Structures Once on Mount
  useEffect(() => {
    async function loadMetadata() {
      setLoading(true);
      try {
        const [resCls, resSub, resCS, resChaps] = await Promise.all([
          supabase.from('classes').select('*'),
          supabase.from('subjects').select('*').order('name'),
          supabase.from('class_subjects').select('*'),
          supabase.from('chapters').select('*').order('chapterNo')
        ]);

        if (resCls.error) throw resCls.error;
        if (resSub.error) throw resSub.error;
        if (resCS.error) throw resCS.error;
        if (resChaps.error) throw resChaps.error;

        const sortedClasses = (resCls.data || []).sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        setClasses(sortedClasses);
        setSubjects(resSub.data || []);
        setClassSubjects(resCS.data || []);
        setChapters(resChaps.data || []);

        // Initial fetch: Load all topics across all scopes
        await fetchTopicsFromAPI('', '', '');
      } catch (error: any) {
        console.error(error);
        toast.error("Failed loading schema structural variables.");
      } finally {
        setLoading(false);
      }
    }
    loadMetadata();
  }, [fetchTopicsFromAPI]);

  // 3. Watch Filters and Trigger Server-Side Query Instantly
  useEffect(() => {
    // Only fire automatically if initial setup metadata load has finished
    if (!loading) {
      fetchTopicsFromAPI(filters.classId, filters.subjectId, filters.chapterId);
    }
  }, [filters.classId, filters.subjectId, filters.chapterId, loading, fetchTopicsFromAPI]);

  // 4. Cascade Selection Lookups for Dropdowns
  const getSubjectsForClass = (classId: string) => {
    if (!classId) return [];
    const linkedSubjectIds = classSubjects
      .filter(cs => cs.class_id === classId)
      .map(cs => cs.subject_id);
    return subjects.filter(s => linkedSubjectIds.includes(s.id));
  };

  const getChaptersForContext = (classId: string, subjectId: string) => {
    if (!classId || !subjectId) return [];
    const targetCS = classSubjects.find(cs => cs.class_id === classId && cs.subject_id === subjectId);
    if (!targetCS) return [];
    return chapters.filter(ch => ch.class_subject_id === targetCS.id);
  };

  // 5. Save Handler
  const handleSave = async (e: React.FormEvent) => {
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
      toast.success(`Topic ${formData.id ? 'updated' : 'added'} successfully`);
      
      // Keeps selections completely intact while readying form for next topic entry
      setFormData(prev => ({
        ...prev,
        id: '',
        name: ''
      }));
      
      // Re-fetch standard backend context immediately to clear memory gaps
      await fetchTopicsFromAPI(filters.classId, filters.subjectId, filters.chapterId);
    }
    setSaving(false);
  };

  // 6. Delete Handler
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this topic? This might affect linked questions.")) return;
    const { error } = await supabase.from('topics').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else { 
      toast.success("Deleted"); 
      await fetchTopicsFromAPI(filters.classId, filters.subjectId, filters.chapterId); 
    }
  };

  return (
    <AdminLayout activeTab="management">
      <div className="container py-4">
        
        {/* Header Block */}
        <div className="d-flex justify-content-between align-items-center mb-4 p-3 bg-white rounded shadow-sm border-start border-4 border-primary">
          <div>
            <h3 className="fw-bold mb-0">Topic Repository</h3>
            <p className="text-muted small mb-0">Manage granular topics via centralized backend API execution routing</p>
          </div>
          <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowForm(!showForm)}>
            {showForm ? <FiX /> : <FiPlus />} {showForm ? 'Close' : 'Add Topic'}
          </button>
        </div>

        {/* Global Pipeline Filters Selector */}
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

        {/* Create/Update Interactive Module */}
        {showForm && (
          <div className="card border-0 shadow-lg mb-4">
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

        {/* Database Visual Grid Output Component */}
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
                {loading || topicsLoading ? (
                  <tr><td colSpan={5} className="text-center py-5"><div className="spinner-border text-primary"/></td></tr>
                ) : topics.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-5 text-muted">No records found matching target parameters.</td></tr>
                ) : (
                  topics.map((t, i) => (
                    <tr key={t.id}>
                      <td className="ps-3 text-muted small">{i + 1}</td>
                      <td className="fw-bold">{t.name}</td>
                      <td>
                        <span className="badge bg-info-subtle text-info border border-info-subtle">
                          Ch {t.chapter_no}: {t.chapter_name || 'Generic Chapter'}
                        </span>
                      </td>
                      <td className="small">
                        {t.class_name || 'Unknown Class'} <span className="text-muted mx-1">|</span> {t.subject_name || 'Unknown Subject'}
                      </td>
                      <td className="text-end pe-3">
                        <button className="btn btn-sm btn-outline-primary me-2" onClick={() => {
                          setFormData({
                            id: t.id,
                            name: t.name,
                            classId: t.class_id || '',
                            subjectId: t.subject_id || '',
                            chapterId: t.chapter_id || '',
                          });
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