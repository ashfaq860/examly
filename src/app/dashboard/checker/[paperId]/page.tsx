// /dashboard/checker/[paperId] — submissions manager for one paper: add
// scanned submissions (camera-first, batch-friendly), watch them get
// graded, review/retry, and export the gradebook.
//
// Grading now runs as a background job (see /api/checker/grade) instead of
// blocking the upload request, so this page subscribes to Supabase
// Realtime on the submissions table for this paper and merges live
// updates into the list — a submission's status/score updates in place as
// soon as the background grade finishes, no manual refresh needed. A
// manual refetch (fetchSubmissions) is still used right after a
// submission is added/retried and as a startup/fallback path.
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Download, RefreshCw, ScanLine, User, Users } from 'lucide-react';
import { useCheckerAuthGuard } from '../hooks/useCheckerAuthGuard';
import { BilingualLabel } from '../components/BilingualLabel';
import { AddSubmissionForm, RosterStudent } from './components/AddSubmissionForm';
import { SubmissionsTable, SubmissionListItem } from './components/SubmissionsTable';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useBreadcrumbLabel } from '@/components/BreadcrumbLabels';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import Loading from '@/app/dashboard/generate-paper/loading';

type ExcessAttemptPolicy = 'first_n' | 'grade_all_best_n';

interface PaperInfo {
  id: string;
  title: string;
  class_name: string | null;
  subject_name: string | null;
  settings?: { excessAttemptPolicy?: ExcessAttemptPolicy } | null;
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
  const [expectedPageCount, setExpectedPageCount] = useState<number | null>(null);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    const res = await fetch(`/api/checker/submissions?paperId=${paperId}`);
    if (res.ok) {
      const data = await res.json();
      setSubmissions(data.submissions || []);
    }
  }, [paperId]);

  // Roster-only refresh (no full-page loading state) — the roster already
  // excludes already-checked and wrong-class students server-side, but that
  // exclusion is only as fresh as the last fetch. Re-running it after every
  // queued submission is what makes the "Add submission" picker drop a
  // just-checked student immediately instead of only after a page reload.
  const fetchRoster = useCallback(async () => {
    const res = await fetch(`/api/checker/papers?paperId=${paperId}`);
    if (res.ok) {
      const data = await res.json();
      setRoster(data.roster || []);
    }
  }, [paperId]);

  const refreshAfterSubmission = useCallback(async () => {
    await Promise.all([fetchSubmissions(), fetchRoster()]);
  }, [fetchSubmissions, fetchRoster]);

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
    setExpectedPageCount(data.expectedPageCount ?? null);
    setRoster(data.roster || []);
    setCreatedByName(data.createdByName || null);
    setSchoolName(data.schoolName || null);
    await fetchSubmissions();
    setLoading(false);
  }, [paperId, fetchSubmissions]);

  useEffect(() => { if (isAuthenticated) fetchAll(); }, [isAuthenticated, fetchAll]);

  // Live-update submission rows in place as background grading finishes —
  // merges by id instead of refetching the whole list on every event.
  useEffect(() => {
    if (!isAuthenticated) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`checker-submissions-${paperId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions', filter: `paper_id=eq.${paperId}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            setSubmissions(prev => prev.filter(s => s.id !== (payload.old as any).id));
            return;
          }
          const row = payload.new as any;
          setSubmissions(prev => {
            const idx = prev.findIndex(s => s.id === row.id);
            if (idx === -1) return prev; // a brand-new row is picked up by the next fetchSubmissions() instead
            const merged = { ...prev[idx], ...row };
            const next = [...prev];
            next[idx] = merged;
            return next;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, paperId]);

  // Polling fallback for the same live-update job the Realtime subscription
  // above is meant to cover. Realtime's postgres_changes delivery is gated
  // by the SAME RLS policy client-side reads of this table hit — see
  // /api/checker/papers/route.ts's own doc comment: reads on submissions
  // were found to silently fail RLS in this project for reasons that never
  // reproduced through any standard cause, which is why every OTHER read of
  // this table already goes through a service-role API route instead of a
  // direct client-side query. postgres_changes evaluates that same SELECT
  // policy per row before delivering an event, so if it denies the read,
  // the channel just never fires — no error, nothing to catch, the UI
  // simply never hears about the status flipping to graded/failed until
  // something else (a manual refresh, adding the next submission) happens
  // to call fetchSubmissions(). Polling here doesn't depend on RLS at all
  // (same service-role route as the initial load), so it's the reliable
  // path regardless of whether Realtime happens to be working; it only
  // runs while at least one row is actually in flight, so it costs nothing
  // once a paper's queue is idle.
  const hasPendingSubmissions = submissions.some(s => s.status === 'uploaded' || s.status === 'processing');
  useEffect(() => {
    if (!isAuthenticated || !hasPendingSubmissions) return;
    const interval = setInterval(fetchSubmissions, 4000);
    return () => clearInterval(interval);
  }, [isAuthenticated, hasPendingSubmissions, fetchSubmissions]);

  useBreadcrumbLabel(paperId, paper?.title);

  const handlePolicyChange = async (policy: ExcessAttemptPolicy) => {
    setSavingPolicy(true);
    try {
      const res = await fetch(`/api/checker/papers/${paperId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excess_attempt_policy: policy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save setting');
      setPaper(data.paper);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingPolicy(false);
    }
  };

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
          <Link href="/dashboard/students" className="chk-btn chk-btn-ghost">
            <Users size={15} /> Students
          </Link>
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

      <div className="chk-policy">
        <label htmlFor="chk-policy-select" className="chk-policy-label">
          <BilingualLabel en="Excess-attempt policy" ur="زائد کوشش کی پالیسی" />
        </label>
        <select
          id="chk-policy-select"
          value={paper.settings?.excessAttemptPolicy || 'first_n'}
          onChange={e => handlePolicyChange(e.target.value as ExcessAttemptPolicy)}
          disabled={savingPolicy}
        >
          <option value="first_n">First N attempted (fewer AI calls)</option>
          <option value="grade_all_best_n">Grade all, keep best N (costs more)</option>
        </select>
        <p className="chk-policy-hint">
          <BilingualLabel
            en="In a choice section (“attempt any N of M”), which N answers count."
            ur="انتخابی سیکشن میں (“کوئی سے N جواب حل کریں”) کون سے N جواب شمار ہوں گے۔"
          />
        </p>
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
            <AddSubmissionForm paperId={paperId} roster={roster} expectedPageCount={expectedPageCount} onSubmissionGraded={refreshAfterSubmission} />
          </section>

          <section className="chk-panel">
            <h2 className="chk-h2"><BilingualLabel en="Submissions" ur="جمع کرائی گئی کاپیاں" /></h2>
            <SubmissionsTable
              paperId={paperId}
              paperTitle={paper.title}
              schoolName={schoolName}
              className={paper.class_name}
              subjectName={paper.subject_name}
              submissions={submissions}
              onRetried={fetchSubmissions}
            />
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

        .chk-policy {
          background: var(--chk-surface); border: 1px solid var(--chk-border); border-radius: var(--chk-radius-lg);
          padding: 0.75rem 1rem; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .chk-policy-label { font-size: 0.82rem; font-weight: 700; color: var(--chk-navy); white-space: nowrap; }
        .chk-policy select {
          padding: 0.4rem 0.6rem; border-radius: var(--chk-radius-sm); border: 1px solid var(--chk-border);
          font-size: 0.82rem; font-family: inherit; background: var(--chk-bg);
        }
        .chk-policy-hint { margin: 0; font-size: 0.76rem; color: var(--chk-muted); flex-basis: 100%; }

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
