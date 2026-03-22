'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { FiEdit, FiTrash2, FiPlus, FiX, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { isUserAdmin } from "@/lib/auth-utils";
import { useRouter } from "next/navigation";

// Interface matches your current DB but allows flexible name handling
interface ClassEntity {
  id: string;
  name: string | number; // Handles both legacy integer and new text types
  description: string | null;
}

export default function ClassManagement() {
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentClass, setCurrentClass] = useState<ClassEntity | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const router = useRouter();

  // ✅ Authentication Guard
  useEffect(() => {
    async function checkAuth() {
      const admin = await isUserAdmin();
      if (!admin) router.replace("/unauthorized");
    }
    checkAuth();
  }, [router]);

  // ✅ Fetch Classes with error handling
const fetchClasses = useCallback(async () => {
  setLoading(true);
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*');

    if (error) throw error;

    // Natural Sort Logic: handles 1, 2, 10, O-Level correctly
    const sortedData = (data || []).sort((a, b) => 
      a.name.toString().localeCompare(b.name.toString(), undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    );

    setClasses(sortedData);
  } catch (error: any) {
    toast.error(error.message || 'Failed to load classes');
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const resetForm = () => {
    setFormData({ name: '', description: '' });
    setCurrentClass(null);
    setShowForm(false);
  };

  // ✅ Fixed Submit Handler with String Casting
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // CRITICAL FIX: Cast to string before trimming to prevent "trim is not a function"
    const cleanedName = String(formData.name || '').trim();

    if (!cleanedName) {
      toast.error('Class name is required');
      return;
    }

    setSaving(true);
    
    // If your DB column is still 'integer', use Number(cleanedName)
    // If you updated it to 'text' as we discussed, keep it as cleanedName
    const payload = {
      name: cleanedName, 
      description: formData.description?.trim() || null
    };

    try {
      if (currentClass) {
        const { error } = await supabase
          .from('classes')
          .update(payload)
          .eq('id', currentClass.id);

        if (error) throw error;
        toast.success('Class updated successfully');
      } else {
        const { error } = await supabase
          .from('classes')
          .insert([payload]);

        if (error) throw error;
        toast.success('Class created successfully');
      }

      resetForm();
      fetchClasses();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('A class with this name already exists');
      } else {
        toast.error('Database error: ' + error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Warning: Deleting a class will affect linked subjects and chapters. Continue?')) return;

    try {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
      toast.success('Class deleted');
      fetchClasses();
    } catch (error: any) {
      toast.error('Cannot delete: Class is in use by other records.');
    }
  };

  return (
    <AdminLayout activeTab="management">
      <div className="container py-4">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4 p-3 bg-white rounded shadow-sm border-start border-primary border-4">
          <div>
            <h2 className="mb-0 fw-bold">Academic Classes</h2>
            <small className="text-muted">Manage grade levels for your question bank</small>
          </div>
          {!showForm && (
            <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowForm(true)}>
              <FiPlus /> New Class
            </button>
          )}
        </div>

        {/* Dynamic Form */}
        {showForm && (
          <div className="card border-0 shadow-sm mb-4 animate__animated animate__fadeInDown">
            <div className="card-header bg-dark text-white fw-bold">
              {currentClass ? 'Edit Class Configuration' : 'Register New Class'}
            </div>
            <div className="card-body bg-light">
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label small fw-bold text-uppercase text-muted">Class Identifier</label>
                    <input
                      type="text"
                      className="form-control form-control-lg border-2"
                      placeholder="e.g. 9 or Matric"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label small fw-bold text-uppercase text-muted">Internal Notes</label>
                    <input
                      type="text"
                      className="form-control form-control-lg border-2"
                      placeholder="Description of this academic group..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="col-12 d-flex justify-content-end gap-2 mt-3">
                    <button type="button" className="btn btn-outline-secondary" onClick={resetForm} disabled={saving}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary px-4 shadow-sm" disabled={saving}>
                      {saving ? (
                        <span className="spinner-border spinner-border-sm me-2" />
                      ) : (
                        <FiCheck className="me-1" />
                      )}
                      {currentClass ? 'Update Class' : 'Create Class'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Table Section */}
        <div className="card shadow-sm border-0">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status" />
                <p className="mt-2 text-muted fw-light">Fetching academic records...</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="bg-light text-muted small text-uppercase">
                    <tr>
                      <th className="ps-4">Sequence</th>
                      <th>Level/Grade</th>
                      <th>Notes</th>
                      <th className="text-end pe-4">Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.length > 0 ? (
                      classes.map((cls, i) => (
                        <tr key={cls.id}>
                          <td className="ps-4 text-muted font-monospace">{i + 1}</td>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" style={{width: '32px', height: '32px', fontSize: '12px'}}>
                                {String(cls.name).charAt(0)}
                              </div>
                              <span className="fw-bold">{cls.name}</span>
                            </div>
                          </td>
                          <td className="text-muted small">{cls.description || '-'}</td>
                          <td className="text-end pe-4">
                            <div className="btn-group shadow-sm">
                              <button
                                className="btn btn-sm btn-white border"
                                title="Edit"
                                onClick={() => {
                                  setCurrentClass(cls);
                                  // Fix: Force toString() when loading into form
                                  setFormData({ 
                                    name: cls.name ? cls.name.toString() : '', 
                                    description: cls.description || '' 
                                  });
                                  setShowForm(true);
                                }}
                              >
                                <FiEdit className="text-primary" />
                              </button>
                              <button
                                className="btn btn-sm btn-white border"
                                title="Delete"
                                onClick={() => handleDelete(cls.id)}
                              >
                                <FiTrash2 className="text-danger" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="text-center py-5">
                          <p className="text-muted mb-0">No academic levels registered yet.</p>
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
    </AdminLayout>
  );
}