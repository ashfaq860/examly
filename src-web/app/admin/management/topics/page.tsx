'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AdminLayout from '@/components/AdminLayout';
import { toast } from 'react-hot-toast';
import { useRouter } from "next/navigation";
import { isUserAdmin } from "@/lib/auth-utils";

export default function TopicsPage() {
  const [topics, setTopics] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);

  const [filters, setFilters] = useState({ classId: '', subjectId: '', chapterId: '' });

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    classId: '',
    subjectId: '',
    chapterId: '',
  });

  const [loading, setLoading] = useState(false);

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
  const fetchClasses = async () => {
    const { data, error } = await supabase.from('classes').select('*').order('name');
    if (error) toast.error(error.message);
    else setClasses(data);
  };

  // Fetch all subjects
  const fetchSubjects = async () => {
    const { data, error } = await supabase.from('subjects').select('*').order('name');
    if (error) toast.error(error.message);
    else setSubjects(data);
  };

  // Fetch class-subject relationships
  const fetchClassSubjects = async () => {
    const { data, error } = await supabase
      .from('class_subjects')
      .select('class_id, subject_id')
      .order('class_id');
    
    if (error) {
      toast.error(error.message);
      return;
    }
    
    setClassSubjects(data);
  };

  // Fetch chapters with their class and subject relationships
  const fetchChapters = async () => {
    const { data, error } = await supabase
      .from('chapters')
      .select(`
        *,
        classes (*),
        subjects (*)
      `).order('chapterNo');
    
    if (error) {
      toast.error(error.message);
      return;
    }
    
    setChapters(data);
  };

  // Fetch topics with their relationships
  const fetchTopics = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('topics')
      .select(`
        id,
        name,
        chapters (
          id,
          name,
          classes (id, name, description),
          subjects (id, name)
        )
      `)
      .order('name');
    
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    
    // Flatten the data structure for easier filtering
    const flattenedTopics = data.map(topic => ({
      id: topic.id,
      name: topic.name,
      chapter_id: topic.chapters?.id || null,
      chapter_name: topic.chapters?.name || '-',
      subject_id: topic.chapters?.subjects?.id || null,
      subject_name: topic.chapters?.subjects?.name || '-',
      class_id: topic.chapters?.classes?.id || null,
      class_name: topic.chapters?.classes?.name || '-',
      class_description: topic.chapters?.classes?.description || '-'
    }));
    
    setTopics(flattenedTopics);
    setLoading(false);
  };

  useEffect(() => {
    fetchClasses();
    fetchSubjects();
    fetchClassSubjects();
    fetchChapters();
    fetchTopics();
  }, []);

  // Get subjects for a specific class
  const getSubjectsForClass = (classId) => {
    if (!classId) return subjects;
    
    const subjectIds = classSubjects
      .filter(cs => cs.class_id === classId)
      .map(cs => cs.subject_id);
    
    return subjects.filter(subject => subjectIds.includes(subject.id));
  };

  // Filtered topics for table display
  const filteredTopics = topics.filter((topic) => {
    const matchClass = !filters.classId || topic.class_id === filters.classId;
    const matchSubject = !filters.subjectId || topic.subject_id === filters.subjectId;
    const matchChapter = !filters.chapterId || topic.chapter_id === filters.chapterId;
    return matchClass && matchSubject && matchChapter;
  });

  // Filter chapters based on selected subject and class for FILTER section
  const filteredChapters = chapters.filter(chapter => {
    const matchClass = !filters.classId || chapter.class_id === filters.classId;
    const matchSubject = !filters.subjectId || chapter.subject_id === filters.subjectId;
    return matchClass && matchSubject;
  });

  // Get chapters for the FORM based on selected subject AND class
  const formChapters = chapters.filter(chapter => {
    const matchSubject = !formData.subjectId || chapter.subject_id === formData.subjectId;
    const matchClass = !formData.classId || chapter.class_id === formData.classId;
    return matchSubject && matchClass;
  });

  // Get subjects for filter dropdown based on selected class
  const filterSubjects = getSubjectsForClass(filters.classId);

  // Get subjects for form dropdown based on selected class
  const formFilterSubjects = getSubjectsForClass(formData.classId);

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      classId: '',
      subjectId: '',
      chapterId: '',
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.chapterId) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);

    try {
      if (formData.id) {
        // Update existing topic
        const { error } = await supabase
          .from('topics')
          .update({
            name: formData.name,
            chapter_id: formData.chapterId,
          })
          .eq('id', formData.id);

        if (error) {
          toast.error(error.message);
          return;
        }
        
        toast.success('Topic updated successfully');
        fetchTopics();
        resetForm();
      } else {
        // Insert new topic
        const { error } = await supabase
          .from('topics')
          .insert([
            {
              name: formData.name,
              chapter_id: formData.chapterId,
            },
          ]);

        if (error) {
          toast.error(error.message);
          return;
        }
        
        toast.success('Topic added successfully');
        fetchTopics();
        resetForm();
      }
    } catch (error) {
      toast.error('An error occurred');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (topic) => {
    setFormData({
      id: topic.id,
      name: topic.name,
      classId: topic.class_id || '',
      subjectId: topic.subject_id || '',
      chapterId: topic.chapter_id || '',
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this topic?')) return;
    
    const { error } = await supabase.from('topics').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Topic deleted successfully');
      fetchTopics();
    }
  };

  return (
    <AdminLayout activeTab="management">
      <div className="container py-4">
        <h2 className="mb-4">Manage Topics</h2>

        {/* Filters */}
        <div className="row mb-3">
          <div className="col-md-3">
            <label className="form-label">Class</label>
            <select
              className="form-control"
              value={filters.classId}
              onChange={(e) => setFilters({ 
                ...filters, 
                classId: e.target.value, 
                subjectId: '', 
                chapterId: '' 
              })}
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.description}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Subject</label>
            <select
              className="form-control"
              value={filters.subjectId}
              onChange={(e) => setFilters({ 
                ...filters, 
                subjectId: e.target.value, 
                chapterId: '' 
              })}
              disabled={!filters.classId}
            >
              <option value="">All Subjects</option>
              {filterSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {!filters.classId && (
              <small className="text-muted">Select a class to see subjects</small>
            )}
          </div>
          <div className="col-md-3">
            <label className="form-label">Chapter</label>
            <select
              className="form-control"
              value={filters.chapterId}
              onChange={(e) => setFilters({ ...filters, chapterId: e.target.value })}
              disabled={!filters.subjectId && !filters.classId}
            >
              <option value="">All Chapters</option>
              {filteredChapters.map((ch,i) => (
                <option key={ch.id} value={ch.id}>
                 {i+1}-{ch.name}
                </option>
              ))}
            </select>
            {!filters.subjectId && !filters.classId && (
              <small className="text-muted">Select a class or subject to filter chapters</small>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="card mb-4">
          <div className="card-body">
            <h5>{formData.id ? 'Edit Topic' : 'Add New Topic'}</h5>
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Class</label>
                <select
                  className="form-control"
                  value={formData.classId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      classId: e.target.value,
                      subjectId: '',
                      chapterId: '',
                    })
                  }
                >
                  <option value="">Select Class (Optional)</option>
                  {classes.map((c,i) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Subject</label>
                <select
                  className="form-control"
                  value={formData.subjectId}
                  onChange={(e) =>
                    setFormData({ 
                      ...formData, 
                      subjectId: e.target.value, 
                      chapterId: '' 
                    })
                  }
                >
                  <option value="">Select Subject</option>
                  {formFilterSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {formData.classId && formFilterSubjects.length === 0 && (
                  <small className="text-muted">No subjects found for this class</small>
                )}
              </div>
              <div className="col-md-3">
                <label className="form-label">Chapter *</label>
                <select
                  className="form-control"
                  value={formData.chapterId}
                  onChange={(e) =>
                    setFormData({ ...formData, chapterId: e.target.value })
                  }
                  required
                >
                  <option value="">Select Chapter</option>
                  {formChapters.map((ch,index) => (
                    <option key={ch.id} value={ch.id}>
                      {index+1}-{ch.name}
                    </option>
                  ))}
                </select>
                <small className="text-muted">
                  Chapters are filtered by both class and subject
                </small>
              </div>
              <div className="col-md-3">
                <label className="form-label">Topic Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter topic name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button 
                className="btn btn-primary me-2" 
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? 'Saving...' : formData.id ? 'Update' : 'Add'}
              </button>
              {formData.id && (
                <button 
                  className="btn btn-secondary" 
                  onClick={resetForm}
                  disabled={loading}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Topics Table */}
        <div className="table-responsive">
          <table className="table table-bordered">
            <thead className="table-dark">
              <tr>
                <th>#</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Chapter</th>
                <th>Topic</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTopics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4">
                    No topics found. {filters.classId || filters.subjectId || filters.chapterId 
                      ? 'Try changing your filters.' 
                      : 'Add a topic to get started.'}
                  </td>
                </tr>
              ) : (
                filteredTopics.map((topic, index) => (
                  <tr key={topic.id}>
                    <td>{index + 1}</td>
                    <td>{topic.class_name} {topic.class_description && `- ${topic.class_description}`}</td>
                    <td>{topic.subject_name}</td>
                    <td>{topic.chapter_name}</td>
                    <td>{topic.name}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-info me-2"
                        onClick={() => handleEdit(topic)}
                        disabled={loading}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(topic.id)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}