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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  /* ================= FETCH PAPERS ================= */
  const fetchPapers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      console.log('User authenticated:', user.id);

      const { data: role, error: roleError } = await supabase.rpc('get_user_role', {
        user_id: user.id
      });

      if (roleError) {
        console.error('RPC get_user_role error:', roleError);
        throw new Error(`Failed to get user role: ${roleError.message}`);
      }

      console.log('User role:', role);

      if (role !== 'teacher') {
        router.push('/');
        return;
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      console.log('Fetching papers for user:', user.id, 'range:', from, 'to:', to);

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
          pdf_path,
          classes ( name ),
          subjects ( name )
        `, { count: 'exact' })
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Papers query error:', error);
        throw error;
      }

      console.log('Papers fetched successfully:', data?.length || 0, 'total:', count);

      setPapers(data || []);
      setTotal(count || 0);

    } catch (err) {
      console.error('Error loading papers:', err);
      console.error('Error details:', {
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
        code: (err as any)?.code,
        details: (err as any)?.details
      });
      // Show user-friendly error message
      alert('Failed to load papers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, [page]);

  /* ================= DOWNLOAD PDF ================= */
  const handleDownload = async (paper: any) => {
    if (!paper.pdf_path) {
      alert('PDF not found.');
      return;
    }

    try {
      setDownloadingId(paper.id);

      // Since pdf_path is now a full URL, use fetch to download
      const response = await fetch(paper.pdf_path);
      if (!response.ok) throw new Error('Failed to download PDF');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${paper.title}.pdf`;
      document.body.appendChild(a);
      a.click();

      URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      console.error(err);
      alert('Failed to download PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  /* ================= DELETE PAPER ================= */
  const handleDelete = async (paper: any) => {
    if (!confirm('Are you sure you want to delete this paper?')) return;

    try {
      // delete PDF from storage
      if (paper.pdf_path) {
        // Extract path from URL: remove the base URL part
        const urlParts = paper.pdf_path.split('/storage/v1/object/public/generated-papers/');
        const pdfPath = urlParts[1];
        if (pdfPath) {
          await supabase.storage
            .from('generated-papers')
            .remove([pdfPath]);
        }
      }

      // delete DB record
      const { error } = await supabase
        .from('papers')
        .delete()
        .eq('id', paper.id);

      if (error) throw error;

      fetchPapers();
    } catch (err) {
      console.error(err);
      alert('Failed to delete paper');
    }
  };

  /* ================= LOADING ================= */
  if (loading) {
    return (
      <AcademyLayout>
        <div className="container-fluid text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      </AcademyLayout>
    );
  }

  /* ================= UI ================= */
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
                  <th>Type</th>
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
                        title="Download PDF"
                        disabled={downloadingId === paper.id}
                        onClick={() => handleDownload(paper)}
                      >
                        {downloadingId === paper.id
                          ? <span className="spinner-border spinner-border-sm" />
                          : <i className="bi bi-download" />}
                      </button>

                      {/* Delete */}
                      <button
                        className="btn btn-sm btn-outline-danger"
                        title="Delete Paper"
                        onClick={() => handleDelete(paper)}
                      >
                        <i className="bi bi-trash" />
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
