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

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('papers')
        .select(`id, title, created_at, "paperPdf", "paperKey"`, { count: 'exact' })
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setPapers(data || []);
      setTotal(count || 0);

    } catch (err) {
      console.error('Error loading papers:', err);
      alert('Failed to load papers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, [page]);

  /* ================= DOWNLOAD PDF ================= */
const handleDownloadPDF = async (paper: any) => {
  if (!paper.paperPdf) {
    alert('PDF not found.');
    return;
  }

  try {
    setDownloadingId(paper.id);

    console.log('Downloading PDF from URL:', paper.paperPdf);

    // Use fetch to download directly from the stored URL
    const response = await fetch(paper.paperPdf);
    console.log('Fetch response status:', response.status, response.statusText);
    if (!response.ok) throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);

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
    console.error('Error downloading PDF:', err);
    alert('Failed to download PDF');
  } finally {
    setDownloadingId(null);
  }
};


  /* ================= DOWNLOAD KEY ================= */
  const handleDownloadKey = async (paper: any) => {
    if (!paper.paperKey) {
      alert('Key not found.');
      return;
    }

    try {
      setDownloadingId(paper.id);

      console.log('Downloading key from URL:', paper.paperKey);

      // Use fetch to download directly from the stored URL
      const response = await fetch(paper.paperKey);
      console.log('Fetch response status:', response.status, response.statusText);
      if (!response.ok) throw new Error(`Failed to download key: ${response.status} ${response.statusText}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${paper.title}_key.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      console.error('Error downloading key:', err);
      alert('Failed to download key');
    } finally {
      setDownloadingId(null);
    }
  };

  /* ================= DELETE PAPER ================= */
  const handleDelete = async (paper: any) => {
    if (!confirm('Are you sure you want to delete this paper?')) return;

    try {
      // delete PDF from storage
      if (paper.paperPdf) {
        const urlParts = paper.paperPdf.split('/storage/v1/object/public/generated-papers/');
        const pdfPath = urlParts[1];
        if (pdfPath) {
          await supabase.storage.from('generated-papers').remove([pdfPath]);
        }
      }

      // delete key from storage
      if (paper.paperKey) {
        const urlParts = paper.paperKey.split('/storage/v1/object/public/key/');
        const keyPath = urlParts[1];
        if (keyPath) {
          await supabase.storage.from('key').remove([keyPath]);
        }
      }

      // delete DB record
      const { error } = await supabase.from('papers').delete().eq('id', paper.id);
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
                  <th>Download PDF</th>
                  <th>Paper Key</th>
                  <th>Created</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>

                {papers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      No papers found
                    </td>
                  </tr>
                )}

                {papers.map(paper => (
                  <tr key={paper.id}>
                    <td><strong>{paper.title}</strong></td>

                    {/* PDF Download */}
                    <td>
                      {paper.paperPdf ? (
                        <button
                          className="btn btn-sm btn-outline-success"
                          disabled={downloadingId === paper.id}
                          onClick={() => handleDownloadPDF(paper)}
                        >
                          {downloadingId === paper.id
                            ? <span className="spinner-border spinner-border-sm" />
                            : 'Download PDF'}
                        </button>
                      ) : '—'}
                    </td>

                    {/* Paper Key */}
                    <td>
                      {paper.paperKey ? (
                        <button
                          className="btn btn-sm btn-outline-primary"
                          disabled={downloadingId === paper.id}
                          onClick={() => handleDownloadKey(paper)}
                        >
                          {downloadingId === paper.id
                            ? <span className="spinner-border spinner-border-sm" />
                            : 'Download Key'}
                        </button>
                      ) : '—'}
                    </td>

                    <td>{new Date(paper.created_at).toLocaleDateString()}</td>

                    <td className="text-end">
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
