'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { FiEdit, FiTrash2, FiPlus, FiFilter, FiX, FiBook, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useRouter } from "next/navigation";
import { isUserAdmin } from "@/lib/auth-utils";

// ------------------- Interfaces -------------------
interface Class {
  id: string;
  name: string | number;
  description?: string;
}

interface Subject {
  id: string;
  name: string;
}

interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  subject: Subject;
  class: Class;
}

interface Chapter {
  id: string;
  name: string;
  chapterNo: number;
  class_subject_id: string;
  class_subject: ClassSubject;
}

export default function ChapterManagement() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<ClassSubject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    class_id: '',
    subject_id: '',
    chapterNo: ''
  });

  const router = useRouter();

  // ✅ 1. Admin Guard
  useEffect(() => {
    async function init() {
      const admin = await isUserAdmin();
      if (!admin) router.replace("/unauthorized");
    }
    init();
  }, [router]);

  // ✅ 2. Fetch Initial Metadata (Classes & Subject Mappings)
  const fetchMetadata = useCallback(async () => {
    try {
      const { data: clsData } = await supabase.from('classes').select('*');
      const { data: mappingData } = await supabase
        .from('class_subjects')
        .select(`id, class_id, subject_id, subject:subjects(name, id), class:classes(*)`);

      // Natural Sort Classes (1, 2, 10 instead of 1, 10, 2)
      const sortedClasses = (clsData || []).sort((a, b) => 
        String(a.name).localeCompare(String(b.name), undefined, { numeric: true })
      );

      setClasses(sortedClasses);
      setClassSubjects((mappingData as any) || []);
    } catch (err) {
      toast.error('Failed to load metadata');
    }
  }, []);

  useEffect(() => { fetchMetadata(); }, [fetchMetadata]);

  // ✅ 3. Fetch Chapters based on Filters
  const fetchChapters = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('chapters')
        .select(`
          *,
          class_subject:class_subjects!inner(
            id, class_id, subject_id,
            subject:subjects(name),
            class:classes(name)
          )
        `)
        .order('chapterNo', { ascending: true });

      if (selectedClass) query = query.eq('class_subject.class_id', selectedClass);
      if (selectedSubject) query = query.eq('class_subject.subject_id', selectedSubject);

      const { data, error } = await query;
      if (error) throw error;
      setChapters((data as any) || []);
    } catch (err) {
      toast.error('Error fetching chapters');
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedSubject]);

  useEffect(() => { fetchChapters(); }, [fetchChapters]);

  // ✅ 4. Dynamic Filtering Logic
  useEffect(() => {
    if (selectedClass) {
      const available = classSubjects.filter(cs => cs.class_id === selectedClass);
      setFilteredSubjects(available);
    } else {
      setFilteredSubjects([]);
    }
  }, [selectedClass, classSubjects]);

  // ✅ 5. Submit Logic (Handles relational link)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.class_id || !formData.subject_id || !formData.name) {
      toast.error('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      // Find the specific Class-Subject mapping ID
      const mapping = classSubjects.find(
        cs => cs.class_id === formData.class_id && cs.subject_id === formData.subject_id
      );

      if (!mapping) throw new Error("This subject isn't assigned to the selected class.");

      const payload = {
        name: formData.name.trim(),
        chapterNo: parseInt(formData.chapterNo) || 0,
        class_subject_id: mapping.id
      };

      if (currentChapter) {
        const { error } = await supabase.from('chapters').update(payload).eq('id', currentChapter.id);
        if (error) throw error;
        toast.success('Chapter updated');
      } else {
        const { error } = await supabase.from('chapters').insert([payload]);
        if (error) throw error;
        toast.success('Chapter created');
      }

      setShowForm(false);
      setFormData({ name: '', class_id: '', subject_id: '', chapterNo: '' });
      fetchChapters();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will delete all questions linked to this chapter.')) return;
    try {
      const { error } = await supabase.from('chapters').delete().eq('id', id);
      if (error) throw error;
      toast.success('Chapter deleted');
      fetchChapters();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  return (
    <AdminLayout activeTab="management">
      <div className="container py-4">
        
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4 bg-white p-3 rounded shadow-sm border-start border-4 border-warning">
          <div>
            <h2 className="fw-bold mb-0 text-dark">Chapter Management</h2>
            <p className="text-muted mb-0 small">Organize subjects into specific chapters</p>
          </div>
          <button 
            className="btn btn-warning d-flex align-items-center gap-2 fw-bold"
            onClick={() => {
              setCurrentChapter(null);
              setFormData({ 
                name: '', 
                class_id: selectedClass, 
                subject_id: selectedSubject, 
                chapterNo: String(chapters.length + 1) 
              });
              setShowForm(true);
            }}
          >
            <FiPlus /> New Chapter
          </button>
        </div>

        {/* Filters Panel */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body bg-light rounded">
            <div className="row g-3 align-items-end">
              <div className="col-md-5">
                <label className="form-label small fw-bold text-muted">Step 1: Select Class</label>
                <select className="form-select border-2" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>Class {c.name}</option>)}
                </select>
              </div>
              <div className="col-md-5">
                <label className="form-label small fw-bold text-muted">Step 2: Select Subject</label>
                <select 
                  className="form-select border-2" 
                  value={selectedSubject} 
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  disabled={!selectedClass}
                >
                  <option value="">All Subjects</option>
                  {filteredSubjects.map(fs => <option key={fs.subject_id} value={fs.subject_id}>{fs.subject.name}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <button className="btn btn-outline-secondary w-100" onClick={() => {setSelectedClass(''); setSelectedSubject('');}}>
                  <FiX className="me-1" /> Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Form Modal-style */}
        {showForm && (
          <div className="card border-0 shadow-lg mb-4 animate__animated animate__fadeIn">
            <div className="card-header bg-dark text-white fw-bold">
              {currentChapter ? 'Update Chapter Details' : 'Register New Chapter'}
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label fw-bold">Class Assignment</label>
                    <select className="form-select" value={formData.class_id} onChange={(e) => setFormData({ ...formData, class_id: e.target.value })} required>
                      <option value="">Select Class...</option>
                      {classes.map(c => <option key={c.id} value={c.id}>Class {c.name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-bold">Subject Assignment</label>
                    <select 
                      className="form-select" 
                      value={formData.subject_id} 
                      onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })} 
                      required
                      disabled={!formData.class_id}
                    >
                      <option value="">Select Subject...</option>
                      {classSubjects.filter(cs => cs.class_id === formData.class_id).map(cs => (
                        <option key={cs.subject_id} value={cs.subject_id}>{cs.subject.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label fw-bold">Chapter No.</label>
                    <input type="number" className="form-control" value={formData.chapterNo} onChange={(e) => setFormData({ ...formData, chapterNo: e.target.value })} required />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold">Chapter Title</label>
                    <input type="text" className="form-control" placeholder="e.g. Introduction to Algebra" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
                  <div className="col-12 text-end">
                    <hr />
                    <button type="button" className="btn btn-light me-2" onClick={() => setShowForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-warning px-4 fw-bold" disabled={saving}>
                      {saving ? <span className="spinner-border spinner-border-sm me-2" /> : <FiCheck className="me-1" />}
                      {currentChapter ? 'Update Chapter' : 'Save Chapter'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Data List */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5"><div className="spinner-border text-warning" /></div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="bg-light text-muted small text-uppercase">
                    <tr>
                      <th className="ps-4">No.</th>
                      <th>Chapter Title</th>
                      <th>Class & Subject</th>
                      <th className="text-end pe-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chapters.length > 0 ? (
                      chapters.map((ch) => (
                        <tr key={ch.id}>
                          <td className="ps-4">
                            <span className="badge bg-soft-warning text-dark border border-warning">Ch {ch.chapterNo}</span>
                          </td>
                          <td>
                            <div className="fw-bold text-dark">{ch.name}</div>
                          </td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <span className="badge bg-dark">Class {ch.class_subject?.class?.name}</span>
                              <span className="text-muted">/</span>
                              <span className="fw-semibold text-primary">{ch.class_subject?.subject?.name}</span>
                            </div>
                          </td>
                          <td className="text-end pe-4">
                            <button
                              className="btn btn-sm btn-white border shadow-sm me-2"
                              onClick={() => {
                                setCurrentChapter(ch);
                                setFormData({
                                  name: ch.name,
                                  class_id: ch.class_subject.class_id,
                                  subject_id: ch.class_subject.subject_id,
                                  chapterNo: ch.chapterNo.toString()
                                });
                                setShowForm(true);
                              }}
                            >
                              <FiEdit className="text-primary" />
                            </button>
                            <button className="btn btn-sm btn-white border shadow-sm" onClick={() => handleDelete(ch.id)}>
                              <FiTrash2 className="text-danger" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="text-center py-5 text-muted">No chapters found for this criteria.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .bg-soft-warning { background-color: rgba(255, 193, 7, 0.15); }
        .btn-white { background: #fff; }
      `}</style>
    </AdminLayout>
  );
}