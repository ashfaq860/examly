'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { FiEdit, FiTrash2, FiPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useRouter } from "next/navigation";
import { isUserAdmin } from "@/lib/auth-utils";

interface Class {
  id: string;
  name: number;
  description?: string;
}

interface Subject {
  id: string;
  name: string;
  description?: string;
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
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<ClassSubject | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', classId: '' });


const router= useRouter();
    // ✅ Check admin
    useEffect(() => {
      async function init() {
        setLoading(true);
        const admin = await isUserAdmin();
        if (!admin) {
          router.replace("/unauthorized");
          return;
        }
        setLoading(false);
      }
      init();
    }, [router]);


  // Fetch classes
  useEffect(() => { fetchClasses(); }, []);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setClasses(data as Class[]);
      if (data && data.length > 0) setSelectedClass(data[0].id);
    } catch (err) {
      console.log(err);
      toast.error('Failed to fetch classes');
    } finally {
      setLoading(false);
    }
  };

  // Fetch subjects whenever selected class changes
  useEffect(() => {
  fetchSubjects(selectedClass || undefined);
}, [selectedClass]);
  const fetchSubjects = async (classId?: string) => {
  setLoading(true);
  try {
    let query = supabase
      .from('class_subjects')
      .select(`
        id,
        class_id,
        subject_id,
        subject:subjects(*),
        class:classes(*)
      `)
      .order('name', { foreignTable: 'subject', ascending: true });

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query;
    if (error) throw error;

    setSubjects(data as ClassSubject[]);
  } catch (err) {
    console.log(err);
    toast.error('Failed to fetch subjects');
  } finally {
    setLoading(false);
  }
};

  // Add or edit subject
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.classId) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      let subjectId = '';

      // If editing
      if (currentSubject) {
        const { error: updateError } = await supabase
          .from('subjects')
          .update({ name: formData.name, description: formData.description })
          .eq('id', currentSubject.subject_id);
        if (updateError) throw updateError;

        // Update class association if changed
        if (currentSubject.class_id !== formData.classId) {
          const { error: linkError } = await supabase
            .from('class_subjects')
            .update({ class_id: formData.classId })
            .eq('id', currentSubject.id);
          if (linkError) throw linkError;
        }

        toast.success('Subject updated successfully');
      } else {
        // Check if subject exists
        const { data: existingSubjects } = await supabase
          .from('subjects')
          .select('*')
          .eq('name', formData.name)
          .limit(1);

        if (existingSubjects && existingSubjects.length > 0) {
          subjectId = existingSubjects[0].id;
          // Update description if needed
          await supabase
            .from('subjects')
            .update({ description: formData.description })
            .eq('id', subjectId);
        } else {
          const { data: newSubject, error: insertError } = await supabase
            .from('subjects')
            .insert([{ name: formData.name, description: formData.description }])
            .select()
            .single();
          if (insertError) throw insertError;
          subjectId = newSubject.id;
        }

        // Link subject to class
        const { data: existingLink } = await supabase
          .from('class_subjects')
          .select('*')
          .eq('class_id', formData.classId)
          .eq('subject_id', subjectId)
          .limit(1);

        if (!existingLink || existingLink.length === 0) {
          const { error: linkError } = await supabase
            .from('class_subjects')
            .insert([{ class_id: formData.classId, subject_id: subjectId }]);
          if (linkError) throw linkError;
        }

        toast.success('Subject added successfully');
      }

      setShowForm(false);
      setCurrentSubject(null);
      fetchSubjects(formData.classId);
    } catch (err) {
      console.log(err);
      toast.error('Failed to save subject');
    } finally {
      setLoading(false);
    }
  };

  // Delete subject from class
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this subject from this class?')) return;
    try {
      const { error } = await supabase
        .from('class_subjects')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Subject removed from class');
      if (selectedClass) fetchSubjects(selectedClass);
    } catch (err) {
      console.log(err);
      toast.error('Failed to remove subject');
    }
  };

  return (
    <AdminLayout activeTab="management">
      <div className="container py-4">
<h2>Subject Management</h2>
        {/* Class selector */}
        <div className="mb-3">
          <label className="form-label">Select Class</label>
          <select
            className="form-select"
            value={selectedClass || ''}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}-{c.description}</option>)}
          </select>
        </div>

        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>
  Subjects for {classes.find(c => c.id === selectedClass)
    ? `${classes.find(c => c.id === selectedClass)?.name} - ${classes.find(c => c.id === selectedClass)?.description || ''}`
    : 'All Classes'}
</h2>
          <button className="btn btn-primary" onClick={() => {
            setCurrentSubject(null);
            setFormData({ name: '', description: '', classId: selectedClass || '' });
            setShowForm(true);
          }}>
            <FiPlus className="me-1" /> Add Subject
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="card mb-4">
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Class</label>
                    <select className="form-select" required
                      value={formData.classId}
                      onChange={(e) => setFormData({ ...formData, classId: e.target.value })}>
                      <option value="">Select Class</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}-{c.description}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Subject Name</label>
                    <input type="text" className="form-control" required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="col-md-12">
                    <label className="form-label">Subject Description</label>
                    <textarea className="form-control" rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                  </div>

                  <div className="col-md-12 d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-secondary"
                      onClick={() => { setShowForm(false); setCurrentSubject(null); }} disabled={loading}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Subjects table */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body table-responsive text-center">
              <table className="table table-hover text-center">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Subject Name</th>
                    <th>Subject Description</th>
                    <th>Class</th>
                    <th>Class Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.length > 0 ? subjects.map((cs,i) => (
                    <tr key={cs.id}>
                      <td>{i+1}</td>
                      <td>{cs.subject.name}</td>
                      <td>{cs.subject.description || '-'}</td>
                      <td>{cs.class.name}</td>
                      <td>{cs.class.description || '-'}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-primary me-2"
                          onClick={() => {
                            setCurrentSubject(cs);
                            setFormData({ 
                              name: cs.subject.name, 
                              description: cs.subject.description || '', 
                              classId: cs.class_id 
                            });
                            setShowForm(true);
                          }}>
                          <FiEdit />
                        </button>
                        <button className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(cs.id)}>
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="py-4">
                        <div className="alert alert-info">No subjects found for this class</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
