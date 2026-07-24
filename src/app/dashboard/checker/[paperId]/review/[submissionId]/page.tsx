// /dashboard/checker/[paperId]/review/[submissionId] — review screen.
// Two-pane (stacked on mobile): scanned image + overlay on one side,
// per-question answer grid with teacher-override on the other. Overlay
// geometry and signed image URLs both come from the single GET
// /api/checker/submissions?submissionId= call — no CV ever runs here.
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Lock, MessageCircle, FileDown, Loader2 } from 'lucide-react';
import { useCheckerAuthGuard } from '../../../hooks/useCheckerAuthGuard';
import { SubmissionStatusBadge, StatusBadge } from '../../../components/StatusBadge';
import { ScanViewer, MarksSide, SectionSubtotalInfo } from './components/ScanViewer';
import { AnswerGrid, AnswerOverridePayload } from './components/AnswerGrid';
import { CameraCapture } from '../../components/CameraCapture';
import { SubmissionAnswerRow, SectionOutcome } from '@/types/checker';
import { buildWhatsappLink, buildResultMessage } from '@/lib/checker/whatsapp';
import { useBreadcrumbLabel } from '@/components/BreadcrumbLabels';
import Loading from '@/app/dashboard/generate-paper/loading';

interface McqScoreAnchor { xFrac: number; yFrac: number; awarded: number; max: number }
interface SectionSubtotalWithPage extends SectionSubtotalInfo { pageIndex: number }

// A fresh grading run can complete a step in well under a second (e.g. a
// skipped MCQ-less paper going straight to "Finalizing…") — without a
// floor, a poll landing right on a fast transition could show a label for
// one tick and vanish, unreadable. Holds each label on screen at least
// this long before the next one is allowed to replace it; never delays the
// FIRST label a poll ever sees (nothing to hold onto yet).
const MIN_LABEL_DISPLAY_MS = 1200;

function useDebouncedGradingProgress(label: string | null, done: number, total: number) {
  const [display, setDisplay] = useState({ label, done, total });
  const lastShownAt = useRef<number | null>(null);
  const pendingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (label === display.label && done === display.done && total === display.total) return;
    const apply = () => { setDisplay({ label, done, total }); lastShownAt.current = Date.now(); };
    const elapsed = lastShownAt.current == null ? Infinity : Date.now() - lastShownAt.current;
    if (elapsed >= MIN_LABEL_DISPLAY_MS) {
      apply();
    } else {
      if (pendingTimeout.current) clearTimeout(pendingTimeout.current);
      pendingTimeout.current = setTimeout(apply, MIN_LABEL_DISPLAY_MS - elapsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, done, total]);

  useEffect(() => () => { if (pendingTimeout.current) clearTimeout(pendingTimeout.current); }, []);

  return display;
}

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
  const [confirmingRemaining, setConfirmingRemaining] = useState(false);
  const [paperTitle, setPaperTitle] = useState<string | null>(null);
  const [className, setClassName] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [annotatedPdfUrl, setAnnotatedPdfUrl] = useState<string | null>(null);
  const [studentWhatsapp, setStudentWhatsapp] = useState<string | null>(null);
  const [recaptureAnswerId, setRecaptureAnswerId] = useState<string | null>(null);
  const [highlightedAnswerId, setHighlightedAnswerId] = useState<string | null>(null);
  const [mcqScoreAnchor, setMcqScoreAnchor] = useState<McqScoreAnchor | null>(null);
  const [subjectiveMarksSide, setSubjectiveMarksSide] = useState<MarksSide | null>(null);
  const [sectionSubtotals, setSectionSubtotals] = useState<SectionSubtotalWithPage[]>([]);

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
    setClassName(data.className ?? null);
    setSubjectName(data.subjectName ?? null);
    setSchoolName(data.schoolName ?? null);
    setAnnotatedPdfUrl(data.annotatedPdfUrl ?? null);
    setStudentWhatsapp(data.studentWhatsapp ?? null);
    setMcqScoreAnchor(data.mcqScoreAnchor ?? null);
    setSubjectiveMarksSide(data.subjectiveMarksSide ?? null);
    setSectionSubtotals(data.sectionSubtotals ?? []);
  }, [submissionId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => { setLoading(true); await fetchDetail(); setLoading(false); })();
  }, [isAuthenticated, fetchDetail]);

  // Preload every page's scan image as soon as the signed URLs are known —
  // without this, switching the Page 1/2/3 tabs only starts each full-
  // resolution photo downloading at the moment it's clicked (ScanViewer's
  // <img src> only changes then), which is what made tab-switching feel
  // slow. The browser cache does the rest: a page already fetched here
  // loads instantly from cache when its tab is actually clicked. Fire-and-
  // forget Image() objects, not <img> elements — nothing needs to render
  // from this, just warm the cache.
  useEffect(() => {
    for (const url of signedScanUrls) {
      if (!url) continue;
      const img = new Image();
      img.src = url;
    }
  }, [signedScanUrls]);

  // Live grading progress: reads current state on the load above FIRST
  // (so a page opened mid-grade never misses where things are), then polls
  // while status is 'processing' — same pattern already shipped for the
  // submissions list page. Not Supabase Realtime: postgres_changes
  // delivery on this table was already found to be unreliable here (gated
  // by an RLS policy that silently drops the client-side subscription —
  // see the submissions list page's own note on this), so this is the
  // established, reliable "live update" mechanism in this codebase now.
  useEffect(() => {
    if (!isAuthenticated || submission?.status !== 'processing') return;
    const interval = setInterval(fetchDetail, 2000);
    return () => clearInterval(interval);
  }, [isAuthenticated, submission?.status, fetchDetail]);

  const gradingProgress = useDebouncedGradingProgress(
    submission?.grading_label ?? null,
    submission?.grading_done ?? 0,
    submission?.grading_total ?? 0,
  );

  useBreadcrumbLabel(paperId, paperTitle);
  useBreadcrumbLabel(submissionId, submission?.student_name_raw);

  const handleOverride = async (answerId: string, payload: AnswerOverridePayload) => {
    setOverridingId(answerId);

    // Promoting an excess-attempt answer also silently changes a SIBLING
    // row (the group's last-counted answer gets demoted server-side) — no
    // safe way to predict which one client-side, so this path skips the
    // optimistic update and just refetches everything after the PATCH
    // succeeds instead.
    const isPromote = 'promote_excess' in payload;
    const prevAnswers = answers;
    if (!isPromote) {
      setAnswers(prev => prev.map(a => {
        if (a.id !== answerId) return a;
        if ('final_marks' in payload) {
          const clamped = Math.max(0, Math.min(a.max_marks, payload.final_marks));
          return { ...a, final_marks: clamped, needs_review: false };
        }
        return {
          ...a,
          override_option: payload.override_option as any,
          needs_review: false,
          final_marks: payload.override_option === a.correct_option ? a.max_marks : 0,
        };
      }));
    }

    try {
      const res = await fetch(`/api/checker/answers/${answerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update answer');
      if (isPromote) {
        await fetchDetail();
      } else {
        setAnswers(prev => prev.map(a => a.id === answerId ? data.answer : a));
        setSubmission(data.submission);
      }
    } catch (err: any) {
      if (!isPromote) setAnswers(prevAnswers);
      toast.error(err.message);
    } finally {
      setOverridingId(null);
    }
  };

  const handleRecapture = async (file: File) => {
    const answerId = recaptureAnswerId;
    setRecaptureAnswerId(null); // single-shot — close right away, unlike the batch upload camera
    if (!answerId) return;

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/checker/answers/${answerId}/recapture`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Retake failed');
      setAnswers(prev => prev.map(a => a.id === answerId ? data.answer : a));
      setSubmission(data.submission);
      toast.success('Answer regraded');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // A question row in AnswerGrid can be on a DIFFERENT page than the one
  // currently shown (MCQ is always on the graded page; subjective rows
  // carry their own page_index) — selecting one jumps the viewer to that
  // page and highlights the mark, instead of only ever showing MCQ marks
  // on the single "graded" page.
  const handleSelectAnswer = (answerId: string) => {
    const answer = answers.find(a => a.id === answerId);
    if (!answer) return;
    const targetPage = answer.answer_kind === 'mcq'
      ? (typeof submission.graded_scan_index === 'number' ? submission.graded_scan_index : 0)
      : answer.page_index;
    if (typeof targetPage === 'number') setPageIndex(targetPage);
    setHighlightedAnswerId(answerId);
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

  // A teacher who agrees with every still-flagged AI grade can clear them
  // all in one click instead of opening and confirming each row — never
  // changes a mark/option, only accepts the AI's current value as final
  // (same semantics as PATCH /api/checker/answers/[id], minus the actual
  // change). Refetches the whole submission afterward rather than
  // reconciling a bulk update client-side row by row.
  const handleConfirmRemaining = async () => {
    setConfirmingRemaining(true);
    try {
      const res = await fetch(`/api/checker/submissions/${submissionId}/confirm-remaining`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm remaining answers');
      await fetchDetail();
      toast.success('Remaining answers confirmed');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConfirmingRemaining(false);
    }
  };

  if (!authChecked || (isAuthenticated && loading)) {
    return <div className="text-center py-5"><Loading /></div>;
  }
  if (authError) return <div className="chk-root"><div className="chk-review-empty">{authError}</div></div>;
  if (loadError || !submission) return <div className="chk-root"><div className="chk-review-empty">{loadError || 'Not found'}</div></div>;

  const finalized = submission.status === 'finalized';
  const gradedIndex = typeof submission.graded_scan_index === 'number' ? submission.graded_scan_index : 0;
  const currentUrl = signedScanUrls[pageIndex];

  const totalScore = submission.total_score ?? null;
  const mcqOutcome: SectionOutcome = { status: submission.mcq_status || 'graded', awarded: submission.mcq_score ?? null, max: submission.mcq_max ?? 0, error: submission.mcq_error ?? null, errorKind: submission.mcq_error_kind ?? undefined };
  const subjectiveOutcome: SectionOutcome = { status: submission.subjective_status || 'graded', awarded: submission.subjective_score ?? null, max: submission.subjective_max ?? 0, error: submission.subjective_error ?? null, errorKind: submission.subjective_error_kind ?? undefined };

  // Single source of truth for BOTH the Finalize gate and the helper text
  // naming what's blocking it — computed once so the two can never drift
  // apart. Per-row entries are clickable (jump/highlight, reusing
  // handleSelectAnswer); a section that failed outright has no row to
  // click (zero submission_answers exist for it), so it renders as a
  // plain explanatory line instead — nothing a per-row "confirm" could
  // ever resolve; only a successful regrade clears it.
  const blockingItems: { id: string | null; label: string }[] = answers
    .filter(a => a.needs_review)
    .map(a => ({ id: a.id, label: `Q${a.q_number}` }));
  if (mcqOutcome.status === 'needs_review' && mcqOutcome.error) {
    blockingItems.push({ id: null, label: `MCQ section: ${mcqOutcome.error}` });
  }
  if (subjectiveOutcome.status === 'needs_review' && subjectiveOutcome.error) {
    blockingItems.push({ id: null, label: `Subjective section: ${subjectiveOutcome.error}` });
  }

  const resultMessage = buildResultMessage({
    schoolName,
    studentName: submission.student_name_raw,
    rollNo: submission.roll_no_raw,
    className,
    subjectName,
    paperTitle,
    mcq: mcqOutcome,
    subjective: subjectiveOutcome,
    totalAwarded: totalScore,
    totalMax: submission.max_score ?? 0,
    annotatedPdfUrl,
  });
  const whatsappHref = studentWhatsapp ? buildWhatsappLink(studentWhatsapp, resultMessage) : null;

  return (
    <div className="chk-root chk-review">
      <Link href={`/dashboard/checker/${paperId}`} className="chk-back"><ArrowLeft size={14} /> Submissions</Link>

      <div className="chk-review-hd">
        <div>
          <h1 className="chk-h1">{submission.student_name_raw || 'Unnamed submission'}</h1>
          <p className="chk-sub">
            {submission.roll_no_raw ? `Roll ${submission.roll_no_raw} · ` : ''}
            <span className="chk-mono">{totalScore ?? '—'}/{submission.max_score ?? 0}</span>
          </p>
          <div className="chk-review-sections">
            {submission.status !== 'uploaded' && submission.status !== 'processing' && mcqOutcome.status !== 'skipped' && (
              <span className="chk-mono">
                Objective: {mcqOutcome.awarded ?? '—'}/{mcqOutcome.max}
                {mcqOutcome.status === 'needs_review' && <StatusBadge label={mcqOutcome.error ? 'not detected' : 'review'} tone="amber" />}
              </span>
            )}
            {submission.status !== 'uploaded' && submission.status !== 'processing' && subjectiveOutcome.status !== 'skipped' && (
              <span className="chk-mono">
                Subjective: {subjectiveOutcome.awarded ?? '—'}/{subjectiveOutcome.max}
                {subjectiveOutcome.status === 'needs_review' && <StatusBadge label={subjectiveOutcome.error ? 'not graded' : 'review'} tone="amber" />}
              </span>
            )}
          </div>
        </div>
        <SubmissionStatusBadge status={submission.status} />
      </div>

      {submission.status === 'processing' && (
        <div className="chk-review-progress">
          <Loader2 size={16} className="chk-review-progress-spinner" />
          <span className="chk-review-progress-label">{gradingProgress.label || 'Grading…'}</span>
          {gradingProgress.total > 0 && (
            <span className="chk-review-progress-step">
              Step {Math.min(gradingProgress.done + 1, gradingProgress.total)} of {gradingProgress.total}
            </span>
          )}
        </div>
      )}

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
            <ScanViewer
              imageUrl={currentUrl}
              answers={answers.filter(a => (a.answer_kind === 'mcq' ? pageIndex === gradedIndex : a.page_index === pageIndex))}
              highlightedAnswerId={highlightedAnswerId}
              mcqScoreAnchor={pageIndex === gradedIndex ? mcqScoreAnchor : null}
              subjectiveMarksSide={subjectiveMarksSide}
              sectionSubtotals={sectionSubtotals.filter(s => s.pageIndex === pageIndex)}
            />
          ) : (
            <div className="chk-review-empty">Could not load this scan image.</div>
          )}
        </div>
        <div className="chk-review-pane chk-review-answers">
          <AnswerGrid
            answers={answers}
            finalized={finalized}
            overridingId={overridingId}
            onOverride={handleOverride}
            onRetake={setRecaptureAnswerId}
            mcqOutcome={mcqOutcome}
            subjectiveOutcome={subjectiveOutcome}
            selectedAnswerId={highlightedAnswerId}
            onSelect={handleSelectAnswer}
          />
        </div>
      </div>

      {recaptureAnswerId && (
        <CameraCapture pageCount={0} onCapture={handleRecapture} onClose={() => setRecaptureAnswerId(null)} />
      )}

      <div className="chk-review-footer">
        {annotatedPdfUrl && (
          <a href={annotatedPdfUrl} target="_blank" rel="noreferrer" className="chk-btn chk-btn-ghost">
            <FileDown size={15} /> Download annotated PDF
          </a>
        )}
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
          <div className="chk-review-finalize-group">
            <div className="chk-review-finalize-actions">
              {answers.some(a => a.needs_review) && (
                <button
                  type="button"
                  className="chk-btn chk-btn-ghost"
                  onClick={handleConfirmRemaining}
                  disabled={confirmingRemaining || finalizing}
                >
                  {confirmingRemaining ? 'Confirming…' : 'Confirm all remaining as-is'}
                </button>
              )}
              <button
                type="button"
                className="chk-btn chk-btn-primary"
                onClick={handleFinalize}
                disabled={blockingItems.length > 0 || finalizing}
                title={blockingItems.length > 0 ? 'Resolve everything listed below first' : undefined}
              >
                {finalizing ? 'Finalizing…' : 'Finalize submission'}
              </button>
            </div>
            {blockingItems.length > 0 && (
              <p className="chk-review-blocking">
                {blockingItems.length} item{blockingItems.length === 1 ? '' : 's'} still need review:{' '}
                {blockingItems.map((item, i) => (
                  <span key={item.id ?? item.label}>
                    {i > 0 && ', '}
                    {item.id ? (
                      <button type="button" className="chk-review-blocking-link" onClick={() => handleSelectAnswer(item.id!)}>
                        {item.label}
                      </button>
                    ) : (
                      <span className="chk-review-blocking-static">{item.label}</span>
                    )}
                  </span>
                ))}
              </p>
            )}
          </div>
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
        .chk-review-sections { display: flex; gap: 12px; margin-top: 4px; font-size: 0.8rem; color: var(--chk-muted); flex-wrap: wrap; }
        .chk-review-sections span { display: inline-flex; align-items: center; gap: 6px; }

        .chk-review-progress {
          display: flex; align-items: center; gap: 8px; padding: 0.6rem 0.9rem;
          background: var(--chk-accent-soft); color: var(--chk-accent); border-radius: var(--chk-radius-md);
          font-size: 0.85rem; font-weight: 600;
        }
        .chk-review-progress-spinner { animation: chk-spin 1s linear infinite; flex-shrink: 0; }
        .chk-review-progress-label { flex: 1; }
        .chk-review-progress-step { font-size: 0.78rem; opacity: 0.85; white-space: nowrap; }
        @keyframes chk-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

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
        .chk-review-wa-hint { display: inline-flex; align-items: center; gap: 6px; color: var(--chk-muted); font-size: 0.78rem; }

        .chk-review-finalize-group { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; max-width: 100%; }
        .chk-review-finalize-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .chk-review-blocking {
          margin: 0; font-size: 0.78rem; color: var(--chk-muted); text-align: right; max-width: 28rem;
        }
        .chk-review-blocking-link {
          background: none; border: none; padding: 0; margin: 0; font: inherit; font-weight: 700;
          color: var(--chk-accent); text-decoration: underline; cursor: pointer;
        }
        .chk-review-blocking-static { font-style: italic; }

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
