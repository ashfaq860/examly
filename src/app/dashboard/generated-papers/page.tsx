//dashboard/generated-papers/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import AcademyLayout from '@/components/AcademyLayout';

const PAGE_SIZE = 10;

export default function GeneratedPapersPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchPapers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      /* 🔐 Role check */
      const { data: role } = await supabase.rpc('get_user_role', { user_id: user.id });
      if (role !== 'teacher') {
        router.push('/');
        return;
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('papers')
        .select(`
          id,
          title,
          paper_type,
          is_trial,
          created_at,
          total_marks,
          time_minutes,
          classes ( name ),
          subjects ( name )
        `, { count: 'exact' })
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error(error);
        return;
      }

      setPapers(data || []);
      setTotal(count || 0);

    } catch (err) {
      console.error('Error loading papers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, [page]);

  const handleDelete = async (paperId: string) => {
    if (!confirm('Are you sure you want to delete this paper?')) return;

    try {
      const { error } = await supabase
        .from('papers')
        .delete()
        .eq('id', paperId);

      if (error) {
        console.error('Error deleting paper:', error);
        alert('Failed to delete paper.');
        return;
      }

      // Refresh papers after deletion
      fetchPapers();
    } catch (err) {
      console.error(err);
      alert('Something went wrong.');
    }
  };

  // NEW: Updated handleDownload function that uses the API endpoint
  const handleDownload = async (paperId: string) => {
    try {
      // Show loading state on the button
      const button = document.querySelector(`button[data-paper-id="${paperId}"]`);
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Downloading...';
        (button as HTMLButtonElement).disabled = true;

        // Get session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth/login');
          return;
        }

        // Call the download endpoint
        const response = await fetch(`/api/download-paper/${paperId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to download: ${response.status}`);
        }

        // Create blob and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Get filename from response or use default
        const contentDisposition = response.headers.get('content-disposition');
        let filename = 'paper.pdf';
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?(.+)"?/);
          if (match) filename = match[1];
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Reset button
        button.textContent = originalText;
        (button as HTMLButtonElement).disabled = false;
      }
    } catch (error) {
      console.error('Error downloading paper:', error);
      alert('Failed to download paper. Please try again.');
      
      // Reset button on error
      const button = document.querySelector(`button[data-paper-id="${paperId}"]`);
      if (button) {
        button.textContent = 'Download';
        (button as HTMLButtonElement).disabled = false;
      }
    }
  };

  if (loading) {
    return (
      <AcademyLayout>
        <div className="container-fluid text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      </AcademyLayout>
    );
  }

  return (
    <AcademyLayout>
      <div className="container-fluid">

        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0">Generated Papers</h4>
          <button
            className="btn btn-primary"
            onClick={() => router.push('/dashboard/generate-paper')}
          >
            + Generate New Paper
          </button>
        </div>

        {/* Table */}
        <div className="card mb-3">
          <div className="card-body p-0">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Title</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Paper Type</th>
                  <th>Marks</th>
                  <th>Time</th>
                  <th>Created</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {papers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-4 text-muted">
                      No papers found
                    </td>
                  </tr>
                )}

                {papers.map(paper => (
                  <tr key={paper.id}>
                    <td>
                      <strong>{paper.title}</strong>
                      {paper.is_trial && (
                        <span className="badge bg-warning ms-2">Trial</span>
                      )}
                    </td>
                    <td>Grade {paper.classes?.name ?? '—'}</td>
                    <td>{paper.subjects?.name ?? '—'}</td>
                    <td className="text-capitalize">
                      {paper.paper_type?.replace('_', ' ')}
                    </td>
                    <td>{paper.total_marks}</td>
                    <td>{paper.time_minutes} min</td>
                    <td>{new Date(paper.created_at).toLocaleDateString()}</td>
                    <td className="text-end">
                      {/* Download */}
                      <button
                        className="btn btn-sm btn-outline-success me-2"
                        title="Download Paper"
                        onClick={() => handleDownload(paper.id)}
                        data-paper-id={paper.id}
                      >
                        Download
                      </button>

                      {/* Delete */}
                      <button
                        className="btn btn-sm btn-outline-danger"
                        title="Delete Paper"
                        onClick={() => handleDelete(paper.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center">
            <div className="text-muted">
              Page {page} of {totalPages}
            </div>
            <div>
              <button
                className="btn btn-outline-secondary btn-sm me-2"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← Previous
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        )}

      </div>
    </AcademyLayout>
  );
}