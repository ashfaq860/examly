'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { FiEdit, FiTrash2, FiPlus, FiFilter, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useRouter } from "next/navigation";
import { isUserAdmin } from "@/lib/auth-utils";

interface Class {
  id: string;
  name: string;
  description: string;
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
}

interface Chapter {
  id: string;
  name: string;
  chapterNo?: number;
  class_subject_id?: string | null;
  class_subject?: ClassSubject;
}

export default function ChapterManagement() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    class_id: '',
    subject_id: '',
    chapterNo: ''
  });

  const router = useRouter();

  // ✅ Admin check
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
    fetchAllSubjects();
    fetchClassSubjects();
  }, []);

  // Fetch all classes
  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) throw error;
      setClasses(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load classes');
    }
  };

  // Fetch all subjects
  const fetchAllSubjects = async () => {
    try {
      const { data, error } = await supabase.from('subjects').select('*').order('name');
      if (error) throw error;
      setAllSubjects(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load subjects');
    }
  };

  // Fetch class-subject relationships
  const fetchClassSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from('class_subjects')
        .select(`id, class_id, subject_id, subject:subjects(name, id)`);
      if (error) throw error;
      setClassSubjects(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load class-subject relationships');
    }
  };

  // Update filtered subjects when class selection changes
  useEffect(() => {
    if (selectedClass) {
      const subjectsForClass = classSubjects
        .filter(cs => cs.class_id === selectedClass)
        .map(cs => cs.subject);
      setFilteredSubjects(subjectsForClass);
      if (selectedSubject && !subjectsForClass.some(s => s.id === selectedSubject)) {
        setSelectedSubject('');
      }
    } else {
      setFilteredSubjects(allSubjects);
    }
  }, [selectedClass, classSubjects, allSubjects, selectedSubject]);

  useEffect(() => {
    fetchChapters();
  }, [selectedClass, selectedSubject]);

  // ✅ Fetch chapters filtered by class_subject_id
  const fetchChapters = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('chapters')
        .select(`
          id, name, chapterNo, class_subject_id,
          class_subject:class_subjects(
            id, class_id, subject_id,
            subject:subjects(name, id)
          )
        `)
        .order('chapterNo', { ascending: true });

      if (selectedClass && selectedSubject) {
        const match = classSubjects.find(
          cs => cs.class_id === selectedClass && cs.subject_id === selectedSubject
        );
        if (match) {
          query = query.eq('class_subject_id', match.id);
        } else {
          setChapters([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setChapters(data || []);
    } catch (err) {
      console.error('Error fetching chapters:', err);
      toast.error('Failed to load chapters');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Create or update chapter (link through class_subjects)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { class_id, subject_id } = formData;
      let classSubject = null;

      if (class_id && subject_id) {
        const { data: found, error } = await supabase
          .from('class_subjects')
          .select('id')
          .eq('class_id', class_id)
          .eq('subject_id', subject_id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        if (found) {
          classSubject = found.id;
        } else {
          const { data: created, error: insertErr } = await supabase
            .from('class_subjects')
            .insert([{ class_id, subject_id }])
            .select('id')
            .single();
          if (insertErr) throw insertErr;
          classSubject = created.id;
        }
      }

      const payload = {
        name: formData.name,
        chapterNo: formData.chapterNo ? Number(formData.chapterNo) : null,
        class_subject_id: classSubject || null,
        class_id: class_id || null,
        subject_id: subject_id || null
      };

      if (currentChapter) {
        const { error } = await supabase.from('chapters').update(payload).eq('id', currentChapter.id);
        if (error) throw error;
        toast.success('Chapter updated successfully');
      } else {
        const { error } = await supabase.from('chapters').insert([payload]);
        if (error) throw error;
        toast.success('Chapter created successfully');
      }

      setShowForm(false);
      setCurrentChapter(null);
      setFormData({ name: '', class_id: '', subject_id: '', chapterNo: '' });
      fetchChapters();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save chapter');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this chapter?')) return;
    try {
      const { error } = await supabase.from('chapters').delete().eq('id', id);
      if (error) throw error;
      toast.success('Chapter deleted successfully');
      fetchChapters();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete chapter');
    }
  };

  const clearFilters = () => {
    setSelectedClass('');
    setSelectedSubject('');
  };

  return (
    <AdminLayout activeTab="management">
      <div className="container py-4">
        <h2>Chapter Management</h2>

        {/* Filters */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5><FiFilter className="me-2" />Filters</h5>
              {(selectedClass || selectedSubject) && (
                <button className="btn btn-sm btn-outline-secondary" onClick={clearFilters}>
                  <FiX className="me-1" /> Clear
                </button>
              )}
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Filter by Class</label>
                <select
                  className="form-select"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="">All Classes</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - {cls.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Filter by Subject</label>
                <select
                  className="form-select"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  disabled={!selectedClass}
                >
                  <option value="">All Subjects</option>
                  {filteredSubjects.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Add Button */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3>Chapters</h3>
          <button
            className="btn btn-primary"
            onClick={() => {
              setCurrentChapter(null);
              setFormData({
                name: '',
                class_id: selectedClass || '',
                subject_id: selectedSubject || '',
                chapterNo: ''
              });
              setShowForm(true);
            }}
            disabled={!selectedClass}
          >
            <FiPlus className="me-1" /> Add Chapter
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="card mb-4">
            <div className="card-body">
              <h5>{currentChapter ? 'Edit Chapter' : 'Add New Chapter'}</h5>
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Class</label>
                    <select
                      className="form-select"
                      value={formData.class_id}
                      onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                    >
                      <option value="">Select Class</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name} - {c.description}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Subject</label>
                    <select
                      className="form-select"
                      value={formData.subject_id}
                      onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                    >
                      <option value="">Select Subject</option>
                      {filteredSubjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Chapter No</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.chapterNo}
                      onChange={(e) => setFormData({ ...formData, chapterNo: e.target.value })}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-12 text-end">
                    <button type="button" className="btn btn-secondary me-2" onClick={() => setShowForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">{currentChapter ? 'Update' : 'Save'}</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary"></div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Chapter No</th>
                    <th>Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {chapters.length > 0 ? (
                    chapters.map((ch, i) => (
                      <tr key={ch.id}>
                        <td>{i + 1}</td>
                        <td>{classes.find(c => c.id === ch.class_subject?.class_id)?.name || '-'}</td>
                        <td>{ch.class_subject?.subject?.name || '-'}</td>
                        <td>{ch.chapterNo || '-'}</td>
                        <td>{ch.name}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => {
                              setCurrentChapter(ch);
                              setFormData({
                                name: ch.name,
                                class_id: ch.class_subject?.class_id || '',
                                subject_id: ch.class_subject?.subject_id || '',
                                chapterNo: ch.chapterNo?.toString() || ''
                              });
                              setShowForm(true);
                            }}
                          >
                            <FiEdit />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(ch.id)}
                          >
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-4">
                        <div className="alert alert-info">No chapters found.</div>
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
