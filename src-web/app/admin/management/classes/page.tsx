'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { FiEdit, FiTrash2, FiPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { isUserAdmin } from "@/lib/auth-utils";
import { useRouter } from "next/navigation";
interface Class {
  id: string;
  name: number;
  description?: string;
}

export default function ClassManagement() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true); // for table load
  const [saving, setSaving] = useState(false); // for form save
  const [showForm, setShowForm] = useState(false);
  const [currentClass, setCurrentClass] = useState<Class | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
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
  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setClasses(data as Class[]);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || isNaN(Number(formData.name))) {
      toast.error('Please enter a valid class number');
      return;
    }

    setSaving(true);
    try {
      if (currentClass) {
        const { error } = await supabase
          .from('classes')
          .update({
            name: Number(formData.name),
            description: formData.description?.trim() || null
          })
          .eq('id', currentClass.id);

        if (error) throw error;
        toast.success('Class updated successfully');
      } else {
        const { error } = await supabase
          .from('classes')
          .insert([{
            name: Number(formData.name),
            description: formData.description?.trim() || null
          }]);

        if (error) throw error;
        toast.success('Class created successfully');
      }

      setShowForm(false);
      setCurrentClass(null);
      fetchClasses();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save class');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this class?')) return;

    try {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
      toast.success('Class deleted successfully');
      fetchClasses();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete class');
    }
  };

  return (
    <AdminLayout activeTab="management">
      <div className="container py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>Class Management</h2>
          <button
            className="btn btn-primary"
            onClick={() => {
              setCurrentClass(null);
              setFormData({ name: '', description: '' });
              setShowForm(true);
            }}
          >
            <FiPlus className="me-1" /> Add Class
          </button>
        </div>

        {showForm && (
          <div className="card mb-4">
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Class Name (Number) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({
                        ...formData,
                        name: e.target.value
                      })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Description</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        description: e.target.value
                      })}
                    />
                  </div>
                  <div className="col-md-12 d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowForm(false);
                        setCurrentClass(null);
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Class'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name (Number)</th>
                      <th>Description</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.length > 0 ? (
                      classes.map((cls,i) => (
                        <tr key={cls.id}>
                          <td>{i+1}</td>
                          <td>{cls.name}</td>
                          <td>{cls.description || '-'}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-outline-primary me-2"
                              onClick={() => {
                                setCurrentClass(cls);
                                setFormData({
                                  name: cls.name.toString(),
                                  description: cls.description || ''
                                });
                                setShowForm(true);
                              }}
                            >
                              <FiEdit />
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(cls.id)}
                            >
                              <FiTrash2 />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-center py-4">
                          <div className="alert alert-info">
                            No classes found
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
