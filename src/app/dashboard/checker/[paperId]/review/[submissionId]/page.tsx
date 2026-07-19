// /dashboard/checker/[paperId]/review/[submissionId] — review screen.
// Two-pane (stacked on mobile): scanned image + overlay on one side,
// per-question answer grid with teacher-override on the other. Overlay
// geometry and signed image URLs both come from the single GET
// /api/checker/submissions?submissionId= call — no CV ever runs here.
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Lock, MessageCircle } from 'lucide-react';
import { useCheckerAuthGuard } from '../../../hooks/useCheckerAuthGuard';
import { SubmissionStatusBadge } from '../../../components/StatusBadge';
import { ScanViewer } from './components/ScanViewer';
import { AnswerGrid } from './components/AnswerGrid';
import { SubmissionAnswerRow } from '@/types/checker';
import { buildWhatsappLink } from '@/lib/checker/whatsapp';
import Loading from '@/app/dashboard/generate-paper/loading';

export default function ReviewPage() {
  const { isAuthenticated, authChecked, authError } = useCheckerAuthGuard();
  const params = useParams();
  const paperId = params.paperId as string;
  const submissionId = params.submissionId as string;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [answers, setAnswers] = useState<SubmissionAnswerRow[]>([]);
  const [signedScanUrls, setSignedScanUrls] = useState<(string | null)[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [overridingId, setOverridingId] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [paperTitle, setPaperTitle] = useState<string | null>(null);
  const [studentWhatsapp, setStudentWhatsapp] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/checker/submissions?submissionId=${submissionId}`);
    const data = await res.json();
    if (!res.ok) {
      setLoadError(data.error || 'Failed to load submission');
      return;
    }
    setSubmission(data.submission);
    setAnswers(data.answers || []);
    setSignedScanUrls(data.signedScanUrls || []);
    setPageIndex(typeof data.submission.graded_scan_index === 'number' ? data.submission.graded_scan_index : 0);
    setPaperTitle(data.paperTitle ?? null);
    setStudentWhatsapp(data.studentWhatsapp ?? null);
  }, [submissionId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => { setLoading(true); await fetchDetail(); setLoading(false); })();
  }, [isAuthenticated, fetchDetail]);

  const handleOverride = async (answerId: string, option: string) => {
    const prevAnswers = answers;
    setOverridingId(answerId);
    setAnswers(prev => prev.map(a => a.id === answerId ? {
      ...a,
      override_option: option as any,
      needs_review: false,
      final_marks: option === a.correct_option ? a.max_marks : 0,
    } : a));

    try {
      const res = await fetch(`/api/checker/answers/${answerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ override_option: option }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update answer');
      setAnswers(prev => prev.map(a => a.id === answerId ? data.answer : a));
      setSubmission(data.submission);
    } catch (err: any) {
      setAnswers(prevAnswers);
      toast.error(err.message);
    } finally {
      setOverridingId(null);
    }
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      const res = await fetch(`/api/checker/submissions/${submissionId}/finalize`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to finalize');
      setSubmission(data.submission);
      toast.success('Submission finalized');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setFinalizing(false);
    }
  };

  if (!authChecked || (isAuthenticated && loading)) {
    return <div className="text-center py-5"><Loading /></div>;
  }
  if (authError) return <div className="chk-root"><div className="chk-review-empty">{authError}</div></div>;
  if (loadError || !submission) return <div className="chk-root"><div className="chk-review-empty">{loadError || 'Not found'}</div></div>;

  const finalized = submission.status === 'finalized';
  const anyNeedsReview = answers.some(a => a.needs_review);
  const gradedIndex = typeof submission.graded_scan_index === 'number' ? submission.graded_scan_index : 0;
  const currentUrl = signedScanUrls[pageIndex];

  const resultMessage = [
    `Result for ${submission.student_name_raw || 'your child'}`,
    submission.roll_no_raw ? ` (Roll ${submission.roll_no_raw})` : '',
    paperTitle ? ` — ${paperTitle}` : '',
    `: ${submission.mcq_score ?? 0}/${submission.max_score ?? 0}.`,
  ].join('');
  const whatsappHref = studentWhatsapp ? buildWhatsappLink(studentWhatsapp, resultMessage) : null;

  return (
    <div className="chk-root chk-review">
      <Link href={`/dashboard/checker/${paperId}`} className="chk-back"><ArrowLeft size={14} /> Submissions</Link>

      <div className="chk-review-hd">
        <div>
          <h1 className="chk-h1">{submission.student_name_raw || 'Unnamed submission'}</h1>
          <p className="chk-sub">
            {submission.roll_no_raw ? `Roll ${submission.roll_no_raw} · ` : ''}
            <span className="chk-mono">{submission.mcq_score ?? 0}/{submission.max_score ?? 0}</span>
          </p>
        </div>
        <SubmissionStatusBadge status={submission.status} />
      </div>

      {signedScanUrls.length > 1 && (
        <div className="chk-review-pages">
          {signedScanUrls.map((_, i) => (
            <button
              key={i}
              className={`chk-review-page-btn ${i === pageIndex ? 'chk-review-page-active' : ''}`}
              onClick={() => setPageIndex(i)}
            >
              Page {i + 1}{i === gradedIndex ? ' (graded)' : ''}
            </button>
          ))}
        </div>
      )}

      <div className="chk-review-panes">
        <div className="chk-review-pane">
          {currentUrl ? (
            <ScanViewer imageUrl={currentUrl} answers={pageIndex === gradedIndex ? answers : []} />
          ) : (
            <div className="chk-review-empty">Could not load this scan image.</div>
          )}
        </div>
        <div className="chk-review-pane chk-review-answers">
          <AnswerGrid answers={answers} finalized={finalized} overridingId={overridingId} onOverride={handleOverride} />
        </div>
      </div>

      <div className="chk-review-footer">
        {submission.student_id && (
          whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="chk-btn chk-btn-ghost">
              <MessageCircle size={15} /> Send result on WhatsApp
            </a>
          ) : (
            <span className="chk-review-wa-hint" title="Add a WhatsApp number for this student from Manage students">
              <MessageCircle size={13} /> No WhatsApp number on file
            </span>
          )
        )}
        {finalized ? (
          <span className="chk-review-locked"><Lock size={14} /> Finalized — no further changes</span>
        ) : (
          <button
            type="button"
            className="chk-btn chk-btn-primary chk-review-finalize-btn"
            onClick={handleFinalize}
            disabled={anyNeedsReview || finalizing}
            title={anyNeedsReview ? 'Resolve all needs-review answers first' : undefined}
          >
            {finalizing ? 'Finalizing…' : 'Finalize submission'}
          </button>
        )}
      </div>

      <style jsx>{`
        .chk-review { padding-bottom: 2rem; display: flex; flex-direction: column; gap: 1rem; }
        .chk-back {
          display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--chk-muted);
          text-decoration: none; width: fit-content;
        }
        .chk-review-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
        .chk-h1 { margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--chk-navy); }
        .chk-sub { margin: 2px 0 0; font-size: 0.85rem; color: var(--chk-muted); }

        .chk-review-pages { display: flex; gap: 6px; flex-wrap: wrap; }
        .chk-review-page-btn {
          padding: 0.35rem 0.75rem; border-radius: var(--chk-radius-sm); border: 1px solid var(--chk-border);
          background: var(--chk-surface); font-size: 0.78rem; cursor: pointer;
        }
        .chk-review-page-active { background: var(--chk-accent); border-color: var(--chk-accent); color: #fff; }

        /* CSS Grid, not flexbox — grid tracks are strictly non-overlapping by
           definition (a cell's content can never bleed into a sibling
           track), where flex-basis percentages can still let a wide,
           unshrinkable child fight the layout and visually spill into the
           next item under a min-width/overflow edge case. That's what was
           happening here: the answer list was rendering across the scan
           image instead of in its own column. */
        .chk-review-panes { display: grid; grid-template-columns: 1fr; gap: 1rem; }
        .chk-review-pane { min-width: 0; overflow: hidden; }
        .chk-review-answers {
          background: var(--chk-surface); border: 1px solid var(--chk-border); border-radius: var(--chk-radius-lg);
          padding: 0.9rem; max-height: 60vh; overflow-y: auto; overflow-x: hidden;
        }

        .chk-review-empty {
          background: var(--chk-surface); border: 1px solid var(--chk-border); border-radius: var(--chk-radius-lg);
          padding: 2.5rem 1rem; text-align: center; color: var(--chk-muted);
        }

        .chk-review-footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .chk-review-locked { display: inline-flex; align-items: center; gap: 6px; color: var(--chk-muted); font-size: 0.85rem; font-weight: 600; margin-left: auto; }
        .chk-review-finalize-btn { margin-left: auto; }
        .chk-review-wa-hint { display: inline-flex; align-items: center; gap: 6px; color: var(--chk-muted); font-size: 0.78rem; }

        .chk-btn {
          display: inline-flex; align-items: center; gap: 6px; padding: 0.65rem 1.3rem; border-radius: var(--chk-radius-md);
          font-weight: 700; font-size: 0.85rem; border: none; cursor: pointer;
        }
        .chk-btn-primary { background: linear-gradient(135deg, var(--chk-navy) 0%, var(--chk-accent) 100%); color: #fff; }
        .chk-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        @media (min-width: 768px) {
          .chk-review-panes { grid-template-columns: minmax(0, 55fr) minmax(0, 45fr); align-items: start; }
        }
      `}</style>
    </div>
  );
}
