// /dashboard/checker — landing page: lists the teacher's papers that have
// an MCQ layout map (generated automatically when the paper was last
// saved — see PaperLayoutRenderer's captureMcqLayoutMap) and lets them
// jump into that paper's submissions manager. Papers without a map are
// shown greyed out, since /api/checker/grade-mcq has nothing to grade
// against until one exists.
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ClipboardCheck, RefreshCw, ScanLine, User, Users } from 'lucide-react';
import { useCheckerAuthGuard } from './hooks/useCheckerAuthGuard';
import { BilingualLabel } from './components/BilingualLabel';
import { StatusBadge } from './components/StatusBadge';
import { useEntitlements } from '@/hooks/useEntitlements';
import Loading from '@/app/dashboard/generate-paper/loading';

interface PaperCounts {
  uploaded: number;
  graded: number;
  needsReview: number;
  failed: number;
  total: number;
}

interface PaperRow {
  id: string;
  title: string;
  class_name: string | null;
  subject_name: string | null;
  hasLayoutMap: boolean;
  counts: PaperCounts;
  /** Set only when this paper belongs to an academy member other than the
   *  caller — academy owners see every member's papers here, so this is
   *  what tells them whose paper they're looking at. Null for the
   *  caller's own papers and for plain (non-owner) teachers. */
  createdByName: string | null;
}

export default function CheckerLandingPage() {
  const { isAuthenticated, authChecked, authError } = useCheckerAuthGuard();
  const { scansRemaining } = useEntitlements();
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<PaperRow[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/checker/papers');
    if (res.ok) {
      const data = await res.json();
      setPapers(data.papers || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated, fetchData]);

  if (!authChecked || (isAuthenticated && loading)) {
    return <div className="text-center py-5"><Loading /></div>;
  }
  if (authError) {
    return (
      <div className="chk-root">
        <div className="chk-empty">{authError}</div>
      </div>
    );
  }

  return (
    <div className="chk-root chk-landing">
      <div className="chk-hd">
        <div className="chk-hd-icon"><ClipboardCheck size={20} color="#fff" /></div>
        <div>
          <h1 className="chk-h1">
            <BilingualLabel en="Paper Checker" ur="پرچہ چیکر" />
          </h1>
          <p className="chk-sub">
            {papers.length} paper{papers.length === 1 ? '' : 's'} available for MCQ checking
          </p>
        </div>
        <Link href="/dashboard/checker/students" className="chk-btn chk-btn-ghost chk-students-link">
          <Users size={15} /> Students
        </Link>
        {scansRemaining !== null && (
          <span className="chk-scans-pill">
            <ScanLine size={13} />
            <BilingualLabel en={`Scans left: ${scansRemaining}`} ur={`باقی اسکین: ${scansRemaining}`} />
          </span>
        )}
      </div>

      {papers.length === 0 ? (
        <div className="chk-empty">
          <div className="chk-empty-icon"><ClipboardCheck size={22} /></div>
          <p className="chk-empty-title">No papers yet</p>
          <p className="chk-empty-sub">Generate and save a paper first — it'll show up here once it has MCQs.</p>
          <Link href="/dashboard/generate-paper" className="chk-btn chk-btn-primary">Generate a paper</Link>
        </div>
      ) : (
        <div className="chk-list">
          {papers.map(p => (
            <div key={p.id} className={`chk-card ${!p.hasLayoutMap ? 'chk-card-disabled' : ''}`}>
              <div className="chk-card-main">
                <p className="chk-card-title">{p.title}</p>
                <p className="chk-card-meta">
                  {p.class_name || '—'} · {p.subject_name || '—'}
                  {p.createdByName && (
                    <span className="chk-card-creator"><User size={11} /> {p.createdByName}</span>
                  )}
                </p>
                {!p.hasLayoutMap ? (
                  <p className="chk-hint"><RefreshCw size={13} /> Regenerate this paper to enable checking</p>
                ) : (
                  <div className="chk-badges">
                    {p.counts.uploaded > 0 && <StatusBadge label={`${p.counts.uploaded} uploaded`} tone="neutral" />}
                    {p.counts.graded > 0 && <StatusBadge label={`${p.counts.graded} graded`} tone="green" />}
                    {p.counts.needsReview > 0 && <StatusBadge label={`${p.counts.needsReview} need review`} tone="amber" />}
                    {p.counts.failed > 0 && <StatusBadge label={`${p.counts.failed} failed`} tone="red" />}
                    {p.counts.total === 0 && <StatusBadge label="No submissions yet" tone="neutral" />}
                  </div>
                )}
              </div>
              {p.hasLayoutMap ? (
                <Link href={`/dashboard/checker/${p.id}`} className="chk-btn chk-btn-primary">Check papers</Link>
              ) : (
                <button className="chk-btn chk-btn-ghost" disabled>Check papers</button>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .chk-landing { padding-bottom: 2rem; }
        .chk-hd { display: flex; align-items: center; gap: 12px; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .chk-students-link { margin-left: auto; }
        .chk-scans-pill {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--chk-accent-soft); color: var(--chk-accent);
          font-size: 0.78rem; font-weight: 700; padding: 5px 12px; border-radius: 999px;
        }
        .chk-hd-icon {
          width: 44px; height: 44px; border-radius: var(--chk-radius-md); flex-shrink: 0;
          background: linear-gradient(135deg, var(--chk-navy) 0%, var(--chk-accent) 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: var(--chk-shadow-md);
        }
        .chk-h1 { margin: 0; font-size: 1.3rem; font-weight: 800; color: var(--chk-navy); }
        .chk-sub { margin: 2px 0 0; font-size: 0.85rem; color: var(--chk-muted); }

        .chk-empty {
          background: var(--chk-surface); border: 1px solid var(--chk-border); border-radius: var(--chk-radius-lg);
          padding: 3rem 1rem; text-align: center;
        }
        .chk-empty-icon {
          width: 52px; height: 52px; border-radius: 50%; margin: 0 auto 1rem;
          background: var(--chk-accent-soft); color: var(--chk-accent);
          display: flex; align-items: center; justify-content: center;
        }
        .chk-empty-title { font-weight: 700; margin-bottom: 4px; color: var(--chk-navy); }
        .chk-empty-sub { font-size: 0.85rem; color: var(--chk-muted); margin: 0 0 1.25rem; }

        .chk-list { display: flex; flex-direction: column; gap: 10px; }
        .chk-card {
          background: var(--chk-surface); border: 1px solid var(--chk-border); border-radius: var(--chk-radius-lg);
          padding: 1rem 1.1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem;
          box-shadow: var(--chk-shadow-sm); flex-wrap: wrap;
        }
        .chk-card-disabled { opacity: 0.55; }
        .chk-card-main { min-width: 0; flex: 1 1 240px; }
        .chk-card-title { margin: 0; font-weight: 700; color: var(--chk-navy); font-size: 0.98rem; }
        .chk-card-meta { margin: 2px 0 8px; font-size: 0.82rem; color: var(--chk-muted); }
        .chk-card-creator {
          display: inline-flex; align-items: center; gap: 3px; margin-left: 8px;
          background: var(--chk-accent-soft); color: var(--chk-accent);
          font-size: 0.72rem; font-weight: 700; padding: 1px 8px; border-radius: 999px;
        }
        .chk-hint { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--chk-muted); margin: 0; }
        .chk-badges { display: flex; flex-wrap: wrap; gap: 6px; }

        .chk-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 0.55rem 1.1rem; border-radius: var(--chk-radius-md); font-weight: 700; font-size: 0.85rem;
          text-decoration: none; border: none; cursor: pointer; white-space: nowrap; flex-shrink: 0;
        }
        .chk-btn-primary { background: linear-gradient(135deg, var(--chk-navy) 0%, var(--chk-accent) 100%); color: #fff; }
        .chk-btn-ghost { background: var(--chk-bg); color: var(--chk-muted); cursor: not-allowed; }

        @media (max-width: 420px) {
          .chk-card { flex-direction: column; align-items: stretch; }
          .chk-btn { width: 100%; }
        }
      `}</style>
    </div>
  );
}
