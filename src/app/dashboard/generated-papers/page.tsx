'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import AcademyLayout from '@/components/AcademyLayout';
import { useUser } from '@/app/context/userContext';
import { FileText, Download, Trash2 } from 'lucide-react';

export default function GeneratedPapersPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { trialStatus, isLoading: userLoading } = useUser();

  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<any[]>([]);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [downloadingKeyId, setDownloadingKeyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ================= FETCH PAPERS ================= */
  const fetchPapers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { data, error } = await supabase
        .from('papers')
        .select(`id, title, created_at, "paperPdf", "paperKey", class_name, subject_name`)
        .eq('created_by', user.id)
        .not('paperPdf', 'is', null)
        .not('paperKey', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setPapers((data || []).map(paper => ({
        ...paper,
        class_name: paper.class_name || '—',
        subject_name: paper.subject_name || '—'
      })));

    } catch (err) {
      console.error('Error fetching papers:', err);
      alert('Failed to load papers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const isTrialActive = trialStatus?.isTrial && new Date(trialStatus.trialEndsAt || 0) > new Date();
    if (trialStatus && (trialStatus.hasActiveSubscription || isTrialActive)) {
      fetchPapers();
    } else if (trialStatus) {
      setLoading(false);
    }
  }, [trialStatus]);

  /* ================= DOWNLOAD PDF ================= */
  const handleDownloadPDF = async (paper: any) => {
    if (!paper.paperPdf) return alert('PDF not found.');
    try {
      setDownloadingPdfId(paper.id);
      const response = await fetch(paper.paperPdf);
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
      setDownloadingPdfId(null);
    }
  };

  /* ================= DOWNLOAD KEY ================= */
  const handleDownloadKey = async (paper: any) => {
    if (!paper.paperKey) return alert('Key not found.');
    try {
      setDownloadingKeyId(paper.id);
      const response = await fetch(paper.paperKey);
      if (!response.ok) throw new Error('Failed to download key');

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
      console.error(err);
      alert('Failed to download key');
    } finally {
      setDownloadingKeyId(null);
    }
  };

  /* ================= DELETE PAPER ================= */
  const handleDeletePaper = async (paper: any) => {
    if (!confirm('Are you sure you want to delete this paper and its files?')) return;

    try {
      setDeletingId(paper.id);
      const res = await fetch('/api/papers/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId: paper.id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete paper');

      alert('Paper deleted successfully');
      fetchPapers();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error deleting paper');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || userLoading) {
    return (
      <AcademyLayout>
        <div className="container-fluid text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      </AcademyLayout>
    );
  }

  const isTrialActive = trialStatus?.isTrial && new Date(trialStatus.trialEndsAt || 0) > new Date();
  if (trialStatus && isTrialActive) {
    return (
      <AcademyLayout>
        <div className="container-fluid text-center py-5">
          <div className="alert alert-warning" role="alert">
            <h4 className="alert-heading">Access Restricted</h4>
            <p>This facility is only for paid users.</p>
          </div>
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
          <h4 className="mb-0 fs-6 fs-md-5">Generated Papers</h4>
          <button
            className="btn btn-primary btn-sm btn-md"
            onClick={() => router.push('/dashboard/generate-paper')}
          >
            + Generate
          </button>
        </div>

        {/* Table */}
        <div className="card mb-3">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Title</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Download Paper</th>
                    <th>Paper Key</th>
                    <th>Created</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {papers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        No papers found
                      </td>
                    </tr>
                  )}

                  {papers.map(paper => (
                    <tr key={paper.id}>
                      {/* Title */}
                      <td className="fs-6 fs-md-5">{paper.title}</td>
                      <td>{paper.class_name}</td>
                      <td>{paper.subject_name}</td>

                      {/* PDF Download */}
                      <td>
                        {paper.paperPdf && (
                          <button
                            className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
                            disabled={downloadingPdfId === paper.id}
                            onClick={() => handleDownloadPDF(paper)}
                          >
                            <FileText className="d-md-none" size={16} />
                            <Download className="d-md-none" size={16} />
                            <span className="d-none d-md-inline">
                              {downloadingPdfId === paper.id ? 'Downloading...' : 'Download Paper'}
                            </span>
                          </button>
                        )}
                      </td>

                      {/* Paper Key */}
                      <td>
                        {paper.paperKey && (
                          <button
                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                            disabled={downloadingKeyId === paper.id}
                            onClick={() => handleDownloadKey(paper)}
                          >
                            <FileText className="d-md-none" size={16} />
                            <Download className="d-md-none" size={16} />
                            <span className="d-none d-md-inline">
                              {downloadingKeyId === paper.id ? 'Downloading...' : 'Download Key'}
                            </span>
                          </button>
                        )}
                      </td>

                      <td>{new Date(paper.created_at).toLocaleDateString()}</td>

                      {/* Delete */}
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1 justify-content-end"
                          disabled={deletingId === paper.id}
                          onClick={() => handleDeletePaper(paper)}
                        >
                          <Trash2 className="d-md-none" size={16} />
                          <span className="d-none d-md-inline">
                            {deletingId === paper.id ? 'Deleting...' : 'Delete'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}

                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </AcademyLayout>
  );
}
