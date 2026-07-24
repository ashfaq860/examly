// Submissions list for one paper — a real <table> on wider screens, a
// stacked card list under ~860px (mirrors the Question Bank admin page's
// .qb-table/.qb-cards breakpoint convention, since no shared Table
// component exists anywhere in this codebase to import instead).
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { RotateCw, AlertTriangle, MessageCircle, Loader2 } from 'lucide-react';
import { SubmissionStatusBadge, StatusBadge } from '../../components/StatusBadge';
import { UpgradeModal, UpgradeReason } from '@/components/UpgradeModal';
import { BulkWhatsappModal, BulkSendItem } from './BulkWhatsappModal';
import { SectionStatus } from '@/types/checker';

export interface SubmissionListItem {
  id: string;
  student_id: string | null;
  student_name_raw: string | null;
  roll_no_raw: string | null;
  status: string;
  mcq_score: number | null;
  subjective_score: number | null;
  total_score: number | null;
  max_score: number | null;
  mcq_status: SectionStatus;
  subjective_status: SectionStatus;
  mcq_max: number | null;
  subjective_max: number | null;
  needs_review_count: number;
  created_at: string;
  processing_error: string | null;
  student_whatsapp: string | null;
  /** Live grading progress (see lib/checker/gradingProgress.ts) — only
   *  meaningful while status === 'processing'; a submission that finished
   *  before that migration/column existed just has these as null/0. */
  grading_label: string | null;
  grading_done: number | null;
  grading_total: number | null;
}

/** Status cell for a mid-grade row: a spinner plus the real live stage
 *  label ("Grading MCQ…" -> "MCQ graded (10/10)" -> "Grading subjective
 *  answers…" -> …) instead of the generic "Grading…" pill alone — so a
 *  teacher watching the list can tell MCQ finished and subjective is still
 *  running, not assume the row is done just because it's no longer
 *  "Uploaded". Falls back to the plain badge when there's no label yet
 *  (row just flipped to processing, or graded before this column existed). */
function ProcessingStatusCell({ s }: { s: SubmissionListItem }) {
  if (!s.grading_label) return <SubmissionStatusBadge status={s.status} />;
  return (
    <span className="chk-subs-grading">
      <Loader2 size={13} className="chk-spin" />
      <span>{s.grading_label}</span>
    </span>
  );
}

// Only submissions that have actually been scored are eligible for a
// results message — sending "0/60" for something still processing (or that
// failed) would be a false result, not just an early one.
const GRADED_STATUSES = new Set(['graded', 'in_review', 'finalized']);

function isBulkSendable(s: SubmissionListItem): s is SubmissionListItem & { student_whatsapp: string } {
  return Boolean(s.student_whatsapp) && GRADED_STATUSES.has(s.status);
}

function sectionChip(label: string, status: SectionStatus) {
  if (status !== 'needs_review') return null;
  return <StatusBadge key={label} label={`${label}: review`} tone="amber" />;
}

export function SubmissionsTable({
  paperId,
  paperTitle,
  schoolName,
  className,
  subjectName,
  submissions,
  onRetried,
}: {
  paperId: string;
  paperTitle: string;
  schoolName: string | null;
  className: string | null;
  subjectName: string | null;
  submissions: SubmissionListItem[];
  onRetried: () => void;
}) {
  const router = useRouter();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);

  const sendable = useMemo(() => submissions.filter(isBulkSendable), [submissions]);
  const allSendableSelected = sendable.length > 0 && sendable.every(s => selectedIds.has(s.id));

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllSendable = () => {
    setSelectedIds(allSendableSelected ? new Set() : new Set(sendable.map(s => s.id)));
  };

  const bulkItems: BulkSendItem[] = useMemo(
    () =>
      sendable
        .filter(s => selectedIds.has(s.id))
        .map(s => ({
          id: s.id,
          studentName: s.student_name_raw,
          rollNo: s.roll_no_raw,
          whatsappNumber: s.student_whatsapp,
          mcq: s.mcq_max ? { awarded: s.mcq_score, max: s.mcq_max, status: s.mcq_status } : null,
          subjective: s.subjective_max ? { awarded: s.subjective_score, max: s.subjective_max, status: s.subjective_status } : null,
          totalAwarded: s.total_score,
          totalMax: s.max_score ?? 0,
        })),
    [sendable, selectedIds]
  );

  const retry = async (e: React.MouseEvent, submissionId: string) => {
    e.stopPropagation();
    setRetryingId(submissionId);
    try {
      const res = await fetch(`/api/checker/submissions/${submissionId}/regrade`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === 'scan_quota_exhausted') setUpgradeReason('scan_quota_exhausted');
        else if (data.error === 'subscription_required') setUpgradeReason('subscription_required');
        else toast.error(data.error || 'Retry failed');
      }
    } finally {
      setRetryingId(null);
      onRetried();
    }
  };

  const openReview = (submissionId: string) => router.push(`/dashboard/checker/${paperId}/review/${submissionId}`);

  // total_score/max_score, not mcq_score — this used to render the MCQ
  // score against the FULL paper max (a stray "6/25" that was really the
  // objective-only score), independent of whatever the combined total
  // actually was.
  const scoreLabel = (s: SubmissionListItem) =>
    s.total_score != null && s.max_score != null ? `${s.total_score}/${s.max_score}` : '—';

  const dateLabel = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  if (submissions.length === 0) {
    return <p className="chk-subs-empty">No submissions yet — add the first scan above.</p>;
  }

  return (
    <div className="chk-subs">
      <UpgradeModal open={upgradeReason !== null} onClose={() => setUpgradeReason(null)} reason={upgradeReason ?? 'subscription_required'} />
      {showBulkModal && (
        <BulkWhatsappModal
          items={bulkItems}
          schoolName={schoolName}
          className={className}
          subjectName={subjectName}
          paperTitle={paperTitle}
          onClose={() => setShowBulkModal(false)}
        />
      )}

      {sendable.length > 0 && (
        <div className="chk-subs-bulk-bar">
          <label className="chk-subs-bulk-select-all">
            <input type="checkbox" checked={allSendableSelected} onChange={toggleAllSendable} />
            Select all with results ({sendable.length})
          </label>
          <button
            type="button"
            className="chk-btn chk-btn-ghost chk-subs-bulk-btn"
            disabled={selectedIds.size === 0}
            onClick={() => setShowBulkModal(true)}
          >
            <MessageCircle size={14} /> Send results ({selectedIds.size})
          </button>
        </div>
      )}

      {/* Desktop table */}
      <table className="chk-subs-table">
        <thead>
          <tr>
            <th className="chk-subs-check-col" />
            <th>Student</th>
            <th>Status</th>
            <th>Score</th>
            <th>Review</th>
            <th>Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map(s => {
            const sendableRow = isBulkSendable(s);
            return (
              <tr key={s.id} onClick={() => openReview(s.id)}>
                <td className="chk-subs-check-col" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    disabled={!sendableRow}
                    onChange={() => toggleOne(s.id)}
                    title={sendableRow ? 'Select for bulk WhatsApp send' : 'No WhatsApp number on file, or not graded yet'}
                  />
                </td>
                <td>
                  <div className="chk-subs-name">{s.student_name_raw || 'Unnamed'}</div>
                  {s.roll_no_raw && <div className="chk-subs-roll">Roll {s.roll_no_raw}</div>}
                </td>
                <td>
                  {s.status === 'processing' ? <ProcessingStatusCell s={s} /> : <SubmissionStatusBadge status={s.status} />}
                  {s.status === 'failed' && s.processing_error && (
                    <div className="chk-subs-error"><AlertTriangle size={12} /> {s.processing_error}</div>
                  )}
                </td>
                <td className="chk-mono">
                  {scoreLabel(s)}
                  <div className="chk-subs-chips">
                    {sectionChip('MCQ', s.mcq_status)}
                    {sectionChip('Subj', s.subjective_status)}
                  </div>
                </td>
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
            );
          })}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="chk-subs-cards">
        {submissions.map(s => {
          const sendableRow = isBulkSendable(s);
          return (
            <div key={s.id} className="chk-subs-card" onClick={() => openReview(s.id)}>
              <div className="chk-subs-card-top">
                <div className="chk-subs-card-title">
                  {sendableRow && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleOne(s.id)}
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                  <div>
                    <div className="chk-subs-name">{s.student_name_raw || 'Unnamed'}</div>
                    {s.roll_no_raw && <div className="chk-subs-roll">Roll {s.roll_no_raw}</div>}
                  </div>
                </div>
                {s.status === 'processing' ? <ProcessingStatusCell s={s} /> : <SubmissionStatusBadge status={s.status} />}
              </div>
              <div className="chk-subs-card-bottom">
                <span className="chk-mono">{scoreLabel(s)}</span>
                {sectionChip('MCQ', s.mcq_status)}
                {sectionChip('Subj', s.subjective_status)}
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
          );
        })}
      </div>

      <style jsx>{`
        .chk-subs-empty { color: var(--chk-muted); font-size: 0.85rem; text-align: center; padding: 1.5rem 0; }
        .chk-subs-bulk-bar {
          display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
          margin-bottom: 0.75rem; padding: 0.55rem 0.75rem; background: var(--chk-bg); border-radius: var(--chk-radius-md);
        }
        .chk-subs-bulk-select-all { display: inline-flex; align-items: center; gap: 8px; font-size: 0.82rem; color: var(--chk-navy); font-weight: 600; }
        .chk-subs-bulk-btn { padding: 0.4rem 0.9rem; font-size: 0.8rem; }
        .chk-subs-check-col { width: 2.2rem; padding-right: 0 !important; }
        .chk-subs-card-title { display: flex; align-items: center; gap: 8px; }
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
        .chk-subs-grading {
          display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; font-weight: 700; color: var(--chk-accent);
        }
        .chk-subs-chips { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
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
