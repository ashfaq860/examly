'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { FiEdit, FiTrash2, FiPlus, FiX, FiCheck, FiBookOpen } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { isUserAdmin } from '@/lib/auth-utils';

// ------------------- Types -------------------
interface Class {
  id: string;
  name: string | number;
  description?: string | null;
}

interface Subject {
  id: string;
  name: string;
  name_ur?: string | null;
  description?: string | null;
}

interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  subject: Subject;
  class: Class;
}

export default function SubjectManagement() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<ClassSubject | null>(null);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    name_ur: '', 
    description: '', 
    classId: '' 
  });

  const router = useRouter();

  // ✅ 1. Admin Guard
  useEffect(() => {
    async function checkAuth() {
      const admin = await isUserAdmin();
      if (!admin) router.replace('/unauthorized');
    }
    checkAuth();
  }, [router]);

  // ✅ 2. Fetch Classes with Natural Sort
  const fetchClasses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Client-side natural sort to handle numeric strings properly
      const sorted = (data || []).sort((a, b) => 
        String(a.name).localeCompare(String(b.name), undefined, { numeric: true })
      );
      
      setClasses(sorted);
    } catch (err: any) {
      toast.error('Failed to load classes');
    }
  }, []);

  // ✅ 3. Fetch Subjects (Filtered by Class)
  const fetchSubjects = useCallback(async (classId: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('class_subjects')
        .select(`
          id,
          class_id,
          subject_id,
          subject:subjects!inner(*),
          class:classes!inner(*)
        `);

      if (classId !== 'all') {
        query = query.eq('class_id', classId);
      }

      const { data, error } = await query.order('name', { foreignTable: 'subjects' });

      if (error) throw error;
      setSubjects((data as any) || []);
    } catch (err: any) {
      toast.error('Error loading subjects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchSubjects(selectedClassId);
  }, [selectedClassId, fetchSubjects]);

  // ✅ 4. Add/Edit Logic
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.classId) {
      toast.error('Subject name and Class are required');
      return;
    }

    setSaving(true);
    try {
      if (currentSubject) {
        // Update basic subject info
        const { error: subErr } = await supabase
          .from('subjects')
          .update({
            name: formData.name.trim(),
            name_ur: formData.name_ur.trim() || null,
            description: formData.description.trim() || null,
          })
          .eq('id', currentSubject.subject_id);

        if (subErr) throw subErr;

        // Update link if class changed
        if (currentSubject.class_id !== formData.classId) {
          const { error: linkErr } = await supabase
            .from('class_subjects')
            .update({ class_id: formData.classId })
            .eq('id', currentSubject.id);
          if (linkErr) throw linkErr;
        }
        toast.success('Subject updated');
      } else {
        // Transactional insert: Subject then Link
        const { data: newSub, error: subErr } = await supabase
          .from('subjects')
          .insert([{
            name: formData.name.trim(),
            name_ur: formData.name_ur.trim() || null,
            description: formData.description.trim() || null,
          }])
          .select()
          .single();

        if (subErr) throw subErr;

        const { error: linkErr } = await supabase
          .from('class_subjects')
          .insert([{ class_id: formData.classId, subject_id: newSub.id }]);
        
        if (linkErr) throw linkErr;
        toast.success('New subject registered and linked');
      }

      setShowForm(false);
      setCurrentSubject(null);
      fetchSubjects(selectedClassId);
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this subject from this class? This will not delete the subject itself.')) return;
    try {
      const { error } = await supabase.from('class_subjects').delete().eq('id', id);
      if (error) throw error;
      toast.success('Relationship removed');
      fetchSubjects(selectedClassId);
    } catch (err: any) {
      toast.error('Failed to remove');
    }
  };

  return (
    <AdminLayout activeTab="management">
      <div className="container py-4">
        
        {/* Header Area */}
        <div className="d-flex justify-content-between align-items-center mb-4 bg-white p-3 rounded shadow-sm border-start border-4 border-primary">
          <div>
            <h2 className="fw-bold mb-0">Subject Management</h2>
            <p className="text-muted mb-0 small">Map academic subjects to specific class levels</p>
          </div>
          <button 
            className="btn btn-primary d-flex align-items-center gap-2"
            onClick={() => {
              setCurrentSubject(null);
              setFormData({ name: '', name_ur: '', description: '', classId: selectedClassId === 'all' ? '' : selectedClassId });
              setShowForm(true);
            }}
          >
            <FiPlus /> Add Subject
          </button>
        </div>

        {/* Filters */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body bg-light rounded">
            <div className="row align-items-center">
              <div className="col-md-4">
                <label className="form-label small fw-bold text-muted text-uppercase">Filter by Class</label>
                <select 
                  className="form-select border-2" 
                  value={selectedClassId} 
                  onChange={(e) => setSelectedClassId(e.target.value)}
                >
                  <option value="all">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>Class {c.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Inline Form */}
        {showForm && (
          <div className="card border-0 shadow-lg mb-4 animate__animated animate__fadeIn">
            <div className="card-header bg-dark text-white">
              {currentSubject ? 'Modify Subject Mapping' : 'Register New Subject Mapping'}
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Assigned Class</label>
                    <select
                      className="form-select"
                      required
                      value={formData.classId}
                      onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                    >
                      <option value="">Choose a class...</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>Class {c.name} {c.description ? `(${c.description})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Subject Name (English)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Mathematics"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Subject Name (Urdu)</label>
                    <input
                      type="text"
                      className="form-control text-end"
                      placeholder="مثلاً ریاضی"
                      value={formData.name_ur}
                      onChange={(e) => setFormData({ ...formData, name_ur: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Brief Description</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Optional details..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="col-12 d-flex justify-content-end gap-2 mt-3">
                    <button type="button" className="btn btn-light" onClick={() => setShowForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary px-4" disabled={saving}>
                      {saving ? <span className="spinner-border spinner-border-sm me-2" /> : <FiCheck className="me-1" />}
                      Save Subject
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-grow text-primary" role="status" />
                <p className="mt-2 text-muted">Loading subjects...</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="bg-light text-muted small text-uppercase">
                    <tr>
                      <th className="ps-4">Subject</th>
                      <th>Urdu Name</th>
                      <th>Assigned Class</th>
                      <th className="text-end pe-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.length > 0 ? (
                      subjects.map((cs) => (
                        <tr key={cs.id}>
                          <td className="ps-4">
                            <div className="d-flex align-items-center">
                              <div className="bg-soft-primary text-primary rounded p-2 me-3">
                                <FiBookOpen />
                              </div>
                              <div>
                                <div className="fw-bold">{cs.subject.name}</div>
                                <div className="text-muted extra-small">{cs.subject.description || 'No description'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="urdu-text fs-5">{cs.subject.name_ur || '-'}</td>
                          <td>
                            <span className="badge bg-dark">Class {cs.class.name}</span>
                          </td>
                          <td className="text-end pe-4">
                            <button
                              className="btn btn-sm btn-outline-primary me-2"
                              onClick={() => {
                                setCurrentSubject(cs);
                                setFormData({
                                  name: cs.subject.name,
                                  name_ur: cs.subject.name_ur || '',
                                  description: cs.subject.description || '',
                                  classId: cs.class_id,
                                });
                                setShowForm(true);
                              }}
                            >
                              <FiEdit />
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(cs.id)}>
                              <FiTrash2 />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="text-center py-5">
                          <div className="text-muted">No subjects found for the selection.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .extra-small { font-size: 0.75rem; }
        .bg-soft-primary { background-color: rgba(13, 110, 253, 0.1); }
        .urdu-text { font-family: 'Urdu Typesetting', 'Jameel Noori Nastaleeq', serif; }
      `}</style>
    </AdminLayout>
  );
}