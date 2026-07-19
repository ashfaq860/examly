// /dashboard/checker/[paperId] — submissions manager for one paper: add
// scanned submissions (camera-first, batch-friendly), watch them get
// graded, review/retry, and export the gradebook.
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, RefreshCw, ScanLine, User } from 'lucide-react';
import { useCheckerAuthGuard } from '../hooks/useCheckerAuthGuard';
import { BilingualLabel } from '../components/BilingualLabel';
import { AddSubmissionForm, RosterStudent } from './components/AddSubmissionForm';
import { SubmissionsTable, SubmissionListItem } from './components/SubmissionsTable';
import { useEntitlements } from '@/hooks/useEntitlements';
import Loading from '@/app/dashboard/generate-paper/loading';

interface PaperInfo {
  id: string;
  title: string;
  class_name: string | null;
  subject_name: string | null;
}

export default function SubmissionsManagerPage() {
  const { isAuthenticated, authChecked, authError } = useCheckerAuthGuard();
  const { scansRemaining } = useEntitlements();
  const params = useParams();
  const paperId = params.paperId as string;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paper, setPaper] = useState<PaperInfo | null>(null);
  const [hasLayoutMap, setHasLayoutMap] = useState(false);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [createdByName, setCreatedByName] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    const res = await fetch(`/api/checker/submissions?paperId=${paperId}`);
    if (res.ok) {
      const data = await res.json();
      setSubmissions(data.submissions || []);
    }
  }, [paperId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/checker/papers?paperId=${paperId}`);
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setPaper(data.paper);
    setHasLayoutMap(Boolean(data.hasLayoutMap));
    setRoster(data.roster || []);
    setCreatedByName(data.createdByName || null);
    await fetchSubmissions();
    setLoading(false);
  }, [paperId, fetchSubmissions]);

  useEffect(() => { if (isAuthenticated) fetchAll(); }, [isAuthenticated, fetchAll]);

  if (!authChecked || (isAuthenticated && loading)) {
    return <div className="text-center py-5"><Loading /></div>;
  }
  if (authError) return <div className="chk-root"><div className="chk-empty">{authError}</div></div>;
  if (notFound || !paper) return <div className="chk-root"><div className="chk-empty">Paper not found.</div></div>;

  return (
    <div className="chk-root chk-manager">
      <Link href="/dashboard/checker" className="chk-back"><ArrowLeft size={14} /> All papers</Link>

      <div className="chk-hd">
        <div>
          <h1 className="chk-h1">{paper.title}</h1>
          <p className="chk-sub">
            {paper.class_name || '—'} · {paper.subject_name || '—'}
            {createdByName && (
              <span className="chk-card-creator"><User size={11} /> {createdByName}</span>
            )}
          </p>
        </div>
        <div className="chk-hd-actions">
          {scansRemaining !== null && (
            <span className="chk-scans-pill">
              <ScanLine size={13} />
              <BilingualLabel en={`Scans left: ${scansRemaining}`} ur={`باقی اسکین: ${scansRemaining}`} />
            </span>
          )}
          {hasLayoutMap && (
            <a className="chk-btn chk-btn-ghost" href={`/api/checker/export?paperId=${paperId}`}>
              <Download size={15} /> Export results
            </a>
          )}
        </div>
      </div>

      {!hasLayoutMap ? (
        <div className="chk-empty">
          <RefreshCw size={20} />
          <p className="chk-empty-title">No layout map for this paper</p>
          <p className="chk-empty-sub">Open this paper in the builder and save it again to generate the MCQ bubble-sheet layout map before checking submissions.</p>
        </div>
      ) : (
        <>
          <section className="chk-panel">
            <h2 className="chk-h2"><BilingualLabel en="Add submission" ur="جمع کرائی گئی کاپی شامل کریں" /></h2>
            <AddSubmissionForm paperId={paperId} roster={roster} onSubmissionGraded={fetchSubmissions} />
          </section>

          <section className="chk-panel">
            <h2 className="chk-h2"><BilingualLabel en="Submissions" ur="جمع کرائی گئی کاپیاں" /></h2>
            <SubmissionsTable paperId={paperId} submissions={submissions} onRetried={fetchSubmissions} />
          </section>
        </>
      )}

      <style jsx>{`
        .chk-manager { padding-bottom: 2rem; display: flex; flex-direction: column; gap: 1.25rem; }
        .chk-back {
          display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--chk-muted);
          text-decoration: none; width: fit-content;
        }
        .chk-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .chk-hd-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .chk-scans-pill {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--chk-accent-soft); color: var(--chk-accent);
          font-size: 0.78rem; font-weight: 700; padding: 5px 12px; border-radius: 999px; white-space: nowrap;
        }
        .chk-h1 { margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--chk-navy); }
        .chk-sub { margin: 2px 0 0; font-size: 0.85rem; color: var(--chk-muted); }
        .chk-card-creator {
          display: inline-flex; align-items: center; gap: 3px; margin-left: 8px;
          background: var(--chk-accent-soft); color: var(--chk-accent);
          font-size: 0.72rem; font-weight: 700; padding: 1px 8px; border-radius: 999px;
        }
        .chk-h2 { margin: 0 0 0.85rem; font-size: 0.95rem; font-weight: 700; color: var(--chk-navy); }

        .chk-panel {
          background: var(--chk-surface); border: 1px solid var(--chk-border); border-radius: var(--chk-radius-lg);
          padding: 1.1rem; box-shadow: var(--chk-shadow-sm);
        }

        .chk-empty {
          background: var(--chk-surface); border: 1px solid var(--chk-border); border-radius: var(--chk-radius-lg);
          padding: 2.5rem 1rem; text-align: center; color: var(--chk-muted); display: flex; flex-direction: column;
          align-items: center; gap: 6px;
        }
        .chk-empty-title { font-weight: 700; color: var(--chk-navy); margin: 4px 0 0; }
        .chk-empty-sub { font-size: 0.85rem; margin: 0; max-width: 32rem; }

        .chk-btn {
          display: inline-flex; align-items: center; gap: 6px; padding: 0.55rem 1rem; border-radius: var(--chk-radius-md);
          font-weight: 700; font-size: 0.82rem; text-decoration: none; border: none; cursor: pointer; white-space: nowrap;
        }
        .chk-btn-ghost { background: var(--chk-bg); color: var(--chk-navy); }
      `}</style>
    </div>
  );
}
