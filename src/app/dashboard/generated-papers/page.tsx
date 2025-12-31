'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import AcademyLayout from '@/components/AcademyLayout';

export default function GeneratedPapersPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<any[]>([]);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [downloadingKeyId, setDownloadingKeyId] = useState<string | null>(null);
  const [isTrial, setIsTrial] = useState(false);

  /* ================= FETCH PAPERS ================= */
  const fetchPapers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Check subscription status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        alert('Failed to check subscription status.');
        return;
      }

      console.log('Subscription status:', profile.subscription_status);

      if (profile.subscription_status !== 'paid') {
        setPapers([]);
        setIsTrial(true);
        setLoading(false);
        return;
      }

      setIsTrial(false);

      const { data, error } = await supabase
        .from('papers')
        .select(`id, title, created_at, "paperPdf", "paperKey", class_name, subject_name`)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      setPapers(data || []);

    } catch (err) {
      console.error('Error loading papers:', err);
      alert('Failed to load papers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  /* ================= DOWNLOAD PDF ================= */
const handleDownloadPDF = async (paper: any) => {
  if (!paper.paperPdf) {
    alert('PDF not found.');
    return;
  }

  try {
    setDownloadingPdfId(paper.id);

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
    setDownloadingKeyId(null);
  }
};


  /* ================= DOWNLOAD KEY ================= */
  const handleDownloadKey = async (paper: any) => {
    if (!paper.paperKey) {
      alert('Key not found.');
      return;
    }

    try {
      setDownloadingKeyId(paper.id);

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

  /* ================= TRIAL MESSAGE ================= */
  if (isTrial) {
    return (
      <AcademyLayout>
        <div className="container-fluid text-center py-5">
          <div className="alert alert-warning" role="alert">
            <h4 className="alert-heading">Trial Period</h4>
            <p>This feature is only for paid users.</p>
            <hr />
            <p className="mb-0">Please upgrade your subscription to access generated papers.</p>
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
                    <td><strong>{paper.title}</strong></td>
                    <td>{paper.class_name || '—'}</td>
                    <td>{paper.subject_name || '—'}</td>

                    {/* PDF Download */}
                    <td>
                      {paper.paperPdf ? (
                        <button
                          className="btn btn-sm btn-outline-success"
                          disabled={downloadingPdfId === paper.id}
                          onClick={() => handleDownloadPDF(paper)}
                        >
                          {downloadingPdfId === paper.id
                            ? <span className="spinner-border spinner-border-sm" />
                            : 'Download Paper PDF'}
                        </button>
                      ) : '—'}
                    </td>

                    {/* Paper Key */}
                    <td>
                      {paper.paperKey ? (
                        <button
                          className="btn btn-sm btn-outline-primary"
                          disabled={downloadingKeyId === paper.id}
                          onClick={() => handleDownloadKey(paper)}
                        >
                          {downloadingKeyId === paper.id
                            ? <span className="spinner-border spinner-border-sm" />
                            : 'Download Key PDF'}
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
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination removed - showing only last 5 papers */}

      </div>
    </AcademyLayout>
  );
}
