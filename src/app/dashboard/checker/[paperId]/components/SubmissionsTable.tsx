// Submissions list for one paper — a real <table> on wider screens, a
// stacked card list under ~860px (mirrors the Question Bank admin page's
// .qb-table/.qb-cards breakpoint convention, since no shared Table
// component exists anywhere in this codebase to import instead).
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw, AlertTriangle } from 'lucide-react';
import { SubmissionStatusBadge, StatusBadge } from '../../components/StatusBadge';

export interface SubmissionListItem {
  id: string;
  student_name_raw: string | null;
  roll_no_raw: string | null;
  status: string;
  mcq_score: number | null;
  max_score: number | null;
  needs_review_count: number;
  created_at: string;
  processing_error: string | null;
}

export function SubmissionsTable({
  paperId,
  submissions,
  onRetried,
}: {
  paperId: string;
  submissions: SubmissionListItem[];
  onRetried: () => void;
}) {
  const router = useRouter();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const retry = async (e: React.MouseEvent, submissionId: string) => {
    e.stopPropagation();
    setRetryingId(submissionId);
    try {
      await fetch('/api/checker/grade-mcq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId }),
      });
    } finally {
      setRetryingId(null);
      onRetried();
    }
  };

  const openReview = (submissionId: string) => router.push(`/dashboard/checker/${paperId}/review/${submissionId}`);

  const scoreLabel = (s: SubmissionListItem) =>
    s.mcq_score != null && s.max_score != null ? `${s.mcq_score}/${s.max_score}` : '—';

  const dateLabel = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  if (submissions.length === 0) {
    return <p className="chk-subs-empty">No submissions yet — add the first scan above.</p>;
  }

  return (
    <div className="chk-subs">
      {/* Desktop table */}
      <table className="chk-subs-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Status</th>
            <th>Score</th>
            <th>Review</th>
            <th>Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map(s => (
            <tr key={s.id} onClick={() => openReview(s.id)}>
              <td>
                <div className="chk-subs-name">{s.student_name_raw || 'Unnamed'}</div>
                {s.roll_no_raw && <div className="chk-subs-roll">Roll {s.roll_no_raw}</div>}
              </td>
              <td>
                <SubmissionStatusBadge status={s.status} />
                {s.status === 'failed' && s.processing_error && (
                  <div className="chk-subs-error"><AlertTriangle size={12} /> {s.processing_error}</div>
                )}
              </td>
              <td className="chk-mono">{scoreLabel(s)}</td>
              <td>{s.needs_review_count > 0 ? <StatusBadge label={String(s.needs_review_count)} tone="amber" /> : '—'}</td>
              <td className="chk-subs-date">{dateLabel(s.created_at)}</td>
              <td onClick={e => e.stopPropagation()}>
                {s.status === 'failed' && (
                  <button className="chk-btn chk-btn-ghost chk-subs-retry" onClick={e => retry(e, s.id)} disabled={retryingId === s.id}>
                    <RotateCw size={13} className={retryingId === s.id ? 'chk-spin' : ''} /> Retry
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="chk-subs-cards">
        {submissions.map(s => (
          <div key={s.id} className="chk-subs-card" onClick={() => openReview(s.id)}>
            <div className="chk-subs-card-top">
              <div>
                <div className="chk-subs-name">{s.student_name_raw || 'Unnamed'}</div>
                {s.roll_no_raw && <div className="chk-subs-roll">Roll {s.roll_no_raw}</div>}
              </div>
              <SubmissionStatusBadge status={s.status} />
            </div>
            <div className="chk-subs-card-bottom">
              <span className="chk-mono">{scoreLabel(s)}</span>
              {s.needs_review_count > 0 && <StatusBadge label={`${s.needs_review_count} to review`} tone="amber" />}
              <span className="chk-subs-date">{dateLabel(s.created_at)}</span>
            </div>
            {s.status === 'failed' && (
              <>
                {s.processing_error && <div className="chk-subs-error"><AlertTriangle size={12} /> {s.processing_error}</div>}
                <button
                  className="chk-btn chk-btn-ghost chk-subs-retry"
                  onClick={e => retry(e, s.id)}
                  disabled={retryingId === s.id}
                >
                  <RotateCw size={13} className={retryingId === s.id ? 'chk-spin' : ''} /> Retry
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .chk-subs-empty { color: var(--chk-muted); font-size: 0.85rem; text-align: center; padding: 1.5rem 0; }
        .chk-subs-table { width: 100%; border-collapse: collapse; display: table; }
        .chk-subs-table thead th {
          text-align: left; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em;
          color: var(--chk-muted); background: var(--chk-bg); padding: 8px 12px; border-bottom: 1px solid var(--chk-border);
        }
        .chk-subs-table tbody td { padding: 10px 12px; border-bottom: 1px solid var(--chk-border); font-size: 0.85rem; vertical-align: top; }
        .chk-subs-table tbody tr { cursor: pointer; }
        .chk-subs-table tbody tr:hover { background: var(--chk-bg); }
        .chk-subs-name { font-weight: 600; color: var(--chk-navy); }
        .chk-subs-roll { font-size: 0.78rem; color: var(--chk-muted); }
        .chk-subs-date { font-size: 0.78rem; color: var(--chk-muted); white-space: nowrap; }
        .chk-subs-error { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--chk-danger); margin-top: 4px; }
        .chk-subs-retry {
          display: inline-flex; align-items: center; gap: 6px; padding: 0.35rem 0.7rem; font-size: 0.78rem;
        }
        .chk-subs-cards { display: none; }
        .chk-spin { animation: chk-spin 0.9s linear infinite; }
        @keyframes chk-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 860px) {
          .chk-subs-table { display: none; }
          .chk-subs-cards { display: flex; flex-direction: column; gap: 10px; }
          .chk-subs-card {
            background: var(--chk-surface); border: 1px solid var(--chk-border); border-radius: var(--chk-radius-md);
            padding: 0.85rem 1rem; cursor: pointer;
          }
          .chk-subs-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
          .chk-subs-card-bottom { display: flex; align-items: center; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
