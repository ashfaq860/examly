// "Add submission" flow for a student's ENTIRE paper, optimized for a
// phone camera. Three input paths, mutually exclusive per submission:
// - Camera loop: each shot appends a thumbnail; "Add page" keeps the
//   camera open for rapid one-tap-per-page batch capture. Each thumbnail
//   supports reorder (up/down) and per-page retake/delete.
// - Choose files: multi-select images, same thumbnail strip, order =
//   selection order.
// - Upload PDF: single file, rasterized server-side into one JPEG per page
//   (see api/checker/submissions/[id]/complete/route.ts) — no client-side
//   thumbnails (would need a PDF-rendering dependency this project doesn't
//   carry), just a filename confirmation chip.
//
// Upload goes straight from this browser to Supabase Storage via signed
// upload URLs (init/route.ts hands them out, [id]/complete/route.ts
// finalizes the row once they land) — no more proxying file bytes through
// a Next.js API route body. Grading is fire-and-forget too: POST
// /api/checker/grade now returns as soon as the scan-quota slot is
// reserved, the actual Claude/CV work runs server-side afterward, and the
// submissions table below picks up the real result via Supabase Realtime.
//
// None of this blocks the form: tapping "Save & add next" snapshots the
// current pages (or PDF) and student info, clears the form immediately,
// and hands the snapshot to a queue that uploads/kicks off grading one job
// at a time while the teacher is already photographing the next student.
// Only the (fast, local) downscale step still gates the button, since it
// operates on the pages about to be queued.
'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { Camera, FolderOpen, FileText, X, Loader2, CheckCircle2, AlertTriangle, RotateCw, UserPlus, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { downscaleImage } from '@/lib/checker/downscaleImage';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { CameraCapture } from './CameraCapture';
import { UpgradeModal, UpgradeReason } from '@/components/UpgradeModal';

export interface RosterStudent {
  id: string;
  full_name: string;
  roll_no: string | null;
}

interface PageEntry {
  file: File;
  url: string; // object URL for the thumbnail preview — revoked when the page is removed/replaced/submitted
}

type JobSnapshot =
  | { kind: 'images'; files: File[]; studentId: string; studentName: string; rollNo: string }
  | { kind: 'pdf'; file: File; studentId: string; studentName: string; rollNo: string };

interface QueueJob {
  id: string;
  label: string;
  pageCount: number;
  status: 'uploading' | 'grading' | 'done' | 'failed';
  message?: string;
  retryable: boolean; // true only if upload itself never succeeded (no table row to retry from there)
}

interface SignedUpload { path: string; token: string; signedUrl: string }

export function AddSubmissionForm({
  paperId,
  roster,
  expectedPageCount,
  onSubmissionGraded,
}: {
  paperId: string;
  roster: RosterStudent[];
  /** The paper's expected printed page count (captured at paper-save time,
   *  see PaperLayoutRenderer.tsx) — null for older layout maps that predate
   *  this field, in which case the mismatch warning below just never shows. */
  expectedPageCount: number | null;
  onSubmissionGraded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  // null = the next capture appends a new page; a number = the next
  // capture REPLACES that page index instead (a per-thumbnail "Retake").
  const retakeIndexRef = useRef<number | null>(null);
  const [studentId, setStudentId] = useState('');
  const [downscaling, setDownscaling] = useState(false);
  const [queue, setQueue] = useState<QueueJob[]>([]);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);
  const [supabase] = useState(() => createSupabaseBrowserClient());

  // Job payloads waiting to be processed, plus a processing flag — the
  // actual FIFO worker state. Kept in refs (not React state) since the
  // queue runner reads/mutates them synchronously between awaits and
  // doesn't need re-renders for its own bookkeeping (queue items in state
  // above are the render-facing mirror of this).
  const pendingRef = useRef<Array<{ id: string; snapshot: JobSnapshot }>>([]);
  // Snapshots persist here for the lifetime of their queue item (cleared in
  // removeJob) — pendingRef itself is drained by .shift() as each job starts
  // processing, so it's gone from there long before a failure could need it
  // again for a manual retry.
  const snapshotsRef = useRef(new Map<string, JobSnapshot>());
  const processingRef = useRef(false);
  const stopReasonRef = useRef<string | null>(null); // set once quota/subscription blocks everything

  // Revoke every thumbnail's object URL on unmount only — page-by-page
  // revocation already happens at the specific points a page is removed,
  // replaced, or submitted (see removePage/handleCameraCapture/enqueueCurrent).
  useEffect(() => {
    return () => { pages.forEach(p => URL.revokeObjectURL(p.url)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateJob = (id: string, patch: Partial<QueueJob>) =>
    setQueue(prev => prev.map(j => (j.id === id ? { ...j, ...patch } : j)));

  const removeJob = (id: string) => {
    setQueue(prev => prev.filter(j => j.id !== id));
    snapshotsRef.current.delete(id);
  };

  const runQueue = async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (pendingRef.current.length > 0) {
      const { id, snapshot } = pendingRef.current.shift()!;

      if (stopReasonRef.current) {
        updateJob(id, { status: 'failed', message: stopReasonRef.current, retryable: false });
        continue;
      }

      let uploaded = false; // tracks whether a submission row exists yet — that row is
      // itself retryable from the table below, so only an upload-stage failure
      // (no row at all) needs its own retry affordance on the queue item.
      try {
        const initRes = await fetch('/api/checker/submissions/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paperId,
            student_id: snapshot.studentId,
            student_name: snapshot.studentName,
            roll_no: snapshot.rollNo,
            kind: snapshot.kind,
            ...(snapshot.kind === 'images' ? { count: snapshot.files.length } : {}),
          }),
        });
        const initData = await initRes.json();
        if (!initRes.ok) {
          if (initData.error === 'subscription_required') {
            setUpgradeReason('subscription_required');
            stopReasonRef.current = 'Paper Checker requires an upgraded plan.';
          }
          throw new Error(stopReasonRef.current || initData.error || 'Could not start upload');
        }

        const submissionId: string = initData.submissionId;
        uploaded = true; // row now exists — visible/retryable from the table below regardless of what happens next
        onSubmissionGraded();

        if (snapshot.kind === 'pdf') {
          const upload: SignedUpload = initData.upload;
          const { error: upErr } = await supabase.storage.from(initData.bucket).uploadToSignedUrl(upload.path, upload.token, snapshot.file);
          if (upErr) throw new Error(upErr.message || 'Upload failed');

          const completeRes = await fetch(`/api/checker/submissions/${submissionId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfPath: upload.path }),
          });
          const completeData = await completeRes.json();
          if (!completeRes.ok) throw new Error(completeData.error || 'Upload failed');
        } else {
          const uploads: SignedUpload[] = initData.uploads;
          await Promise.all(uploads.map(async (u, i) => {
            const { error } = await supabase.storage.from(initData.bucket).uploadToSignedUrl(u.path, u.token, snapshot.files[i]);
            if (error) throw new Error(error.message || `Failed to upload page ${i + 1}`);
          }));

          const completeRes = await fetch(`/api/checker/submissions/${submissionId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths: uploads.map(u => u.path) }),
          });
          const completeData = await completeRes.json();
          if (!completeRes.ok) throw new Error(completeData.error || 'Upload failed');
        }

        updateJob(id, { status: 'grading' });

        const gradeRes = await fetch('/api/checker/grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submission_id: submissionId }),
        });
        const gradeData = await gradeRes.json();
        if (!gradeRes.ok) {
          if (gradeData.error === 'scan_quota_exhausted') {
            setUpgradeReason('scan_quota_exhausted');
            stopReasonRef.current = "You've used all your scans on this plan.";
          } else if (gradeData.error === 'subscription_required') {
            setUpgradeReason('subscription_required');
            stopReasonRef.current = 'Paper Checker requires an upgraded plan.';
          }
          throw new Error(gradeData.error || 'Grading failed');
        }

        // Grading itself now runs in the background — this job's part is
        // done as soon as it's been kicked off; the submissions table
        // below picks up the real score live via Realtime once it finishes.
        updateJob(id, { status: 'done', retryable: false, message: 'Uploaded — grading in the background' });
        onSubmissionGraded();
        setTimeout(() => removeJob(id), 3000);
      } catch (err: any) {
        updateJob(id, { status: 'failed', message: err.message || 'Something went wrong', retryable: !uploaded });
        if (uploaded) onSubmissionGraded();
      }
    }

    processingRef.current = false;
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // reset so the same input can be re-opened for the next page
    if (picked.length === 0) return;

    // Images and a PDF are mutually exclusive per submission — picking
    // files clears any previously-selected PDF.
    setPdfFile(null);
    setDownscaling(true);
    try {
      const downscaled = await Promise.all(picked.map(f => downscaleImage(f)));
      setPages(prev => [...prev, ...downscaled.map(file => ({ file, url: URL.createObjectURL(file) }))]);
    } catch {
      // best-effort — leave existing pages intact, just report the failure
      setQueue(prev => [...prev, { id: crypto.randomUUID(), label: 'Selected file(s)', pageCount: 0, status: 'failed', message: 'Could not process one of the selected images — try again.', retryable: false }]);
    } finally {
      setDownscaling(false);
    }
  };

  const handlePdfSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    if (!file) return;
    pages.forEach(p => URL.revokeObjectURL(p.url));
    setPages([]);
    setPdfFile(file);
  };

  const removePdf = () => setPdfFile(null);

  const handleCameraCapture = async (file: File) => {
    try {
      const downscaled = await downscaleImage(file);
      const entry: PageEntry = { file: downscaled, url: URL.createObjectURL(downscaled) };
      if (retakeIndexRef.current != null) {
        const idx = retakeIndexRef.current;
        setPages(prev => {
          if (idx >= prev.length) return prev;
          const copy = [...prev];
          URL.revokeObjectURL(copy[idx].url);
          copy[idx] = entry;
          return copy;
        });
        retakeIndexRef.current = null;
        setCameraOpen(false); // a retake is a single shot, unlike the normal append loop
      } else {
        setPages(prev => [...prev, entry]);
      }
    } catch {
      setQueue(prev => [...prev, { id: crypto.randomUUID(), label: 'Captured photo', pageCount: 0, status: 'failed', message: 'Could not process the captured photo — try again.', retryable: false }]);
    }
  };

  const openCameraForAppend = () => { retakeIndexRef.current = null; setPdfFile(null); setCameraOpen(true); };
  const openCameraForRetake = (idx: number) => { retakeIndexRef.current = idx; setCameraOpen(true); };
  const closeCamera = () => { setCameraOpen(false); retakeIndexRef.current = null; };

  const removePage = (idx: number) => setPages(prev => {
    URL.revokeObjectURL(prev[idx].url);
    return prev.filter((_, i) => i !== idx);
  });

  const movePage = (idx: number, dir: -1 | 1) => setPages(prev => {
    const target = idx + dir;
    if (target < 0 || target >= prev.length) return prev;
    const copy = [...prev];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    return copy;
  });

  const hasPages = pages.length > 0 || pdfFile != null;
  const selectedStudent = roster.find(r => r.id === studentId) || null;
  // A submission belongs to a specific student — only a roster pick counts
  // (see AddSubmissionForm's header comment: no free-text name entry).
  const hasStudent = Boolean(selectedStudent);

  const enqueueCurrent = () => {
    if (!hasPages) return;
    if (!hasStudent) {
      toast.error('Select a student before saving — this paper must belong to a student.');
      return;
    }

    // A fresh, manual "add" is a reasonable signal to give the queue
    // another chance even after an earlier quota/subscription block —
    // otherwise closing the upgrade modal and upgrading in another tab
    // would leave every future submission auto-failing for the rest of
    // this page's lifetime.
    stopReasonRef.current = null;

    const id = crypto.randomUUID();
    const studentName = selectedStudent!.full_name;
    const rollNo = selectedStudent!.roll_no || '';
    const label = `${studentName}${rollNo ? ` · Roll ${rollNo}` : ''}`;
    const snapshot: JobSnapshot = pdfFile
      ? { kind: 'pdf', file: pdfFile, studentId, studentName, rollNo }
      : { kind: 'images', files: pages.map(p => p.file), studentId, studentName, rollNo };

    setQueue(prev => [...prev, { id, label, pageCount: pdfFile ? 0 : pages.length, status: 'uploading', retryable: true }]);
    snapshotsRef.current.set(id, snapshot);
    pendingRef.current.push({ id, snapshot });

    // Clear the staging area right away — this is the whole point: the
    // teacher can start photographing the next student immediately while
    // this job uploads/grades in the background.
    pages.forEach(p => URL.revokeObjectURL(p.url));
    setPages([]);
    setPdfFile(null);
    setStudentId('');

    runQueue();
  };

  const retryJob = (job: QueueJob, snapshot: JobSnapshot | undefined) => {
    if (!snapshot) return;
    updateJob(job.id, { status: 'uploading', message: undefined });
    pendingRef.current.push({ id: job.id, snapshot });
    runQueue();
  };

  const jobIcon = (status: QueueJob['status']) => {
    if (status === 'done') return <CheckCircle2 size={14} />;
    if (status === 'failed') return <AlertTriangle size={14} />;
    return <Loader2 size={14} className="chk-spin" />;
  };

  const pageMismatch = expectedPageCount != null && pages.length > 0 && pages.length !== expectedPageCount;

  return (
    <div className="chk-add">
      <UpgradeModal open={upgradeReason !== null} onClose={() => setUpgradeReason(null)} reason={upgradeReason ?? 'subscription_required'} />

      {cameraOpen && (
        <CameraCapture
          pageCount={pages.length}
          onCapture={handleCameraCapture}
          onClose={closeCamera}
        />
      )}

      <div className="chk-add-capture">
        <button type="button" className="chk-btn chk-btn-primary chk-add-camera-btn" onClick={openCameraForAppend} disabled={downscaling}>
          <Camera size={16} /> Use camera
        </button>
        <button type="button" className="chk-btn chk-btn-ghost chk-add-camera-btn" onClick={() => fileInputRef.current?.click()} disabled={downscaling}>
          <FolderOpen size={16} /> Choose files
        </button>
        <button type="button" className="chk-btn chk-btn-ghost chk-add-camera-btn" onClick={() => pdfInputRef.current?.click()} disabled={downscaling}>
          <FileText size={16} /> Upload PDF
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFilesSelected} className="chk-add-hidden-input" />
        <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={handlePdfSelected} className="chk-add-hidden-input" />
      </div>

      {expectedPageCount != null && hasPages && (
        <p className={`chk-add-progress ${pageMismatch ? 'chk-add-progress-warn' : ''}`}>
          {pdfFile
            ? 'PDF selected — pages will be counted after upload'
            : `${pages.length} of ${expectedPageCount} page${expectedPageCount === 1 ? '' : 's'}`}
          {pageMismatch && <span> <AlertTriangle size={12} /> Expected {expectedPageCount}, this won't block saving</span>}
        </p>
      )}

      {pdfFile ? (
        <div className="chk-add-pdf-chip">
          <FileText size={16} />
          <span className="chk-add-pdf-name">{pdfFile.name}</span>
          <button type="button" onClick={removePdf} aria-label="Remove PDF"><X size={14} /></button>
        </div>
      ) : pages.length > 0 && (
        <ul className="chk-add-thumbs">
          {pages.map((p, i) => (
            <li key={p.url} className="chk-add-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Page ${i + 1}`} className="chk-add-thumb-img" />
              <span className="chk-add-thumb-label">Page {i + 1}</span>
              <div className="chk-add-thumb-actions">
                <button type="button" onClick={() => movePage(i, -1)} disabled={i === 0} aria-label="Move up"><ChevronUp size={13} /></button>
                <button type="button" onClick={() => movePage(i, 1)} disabled={i === pages.length - 1} aria-label="Move down"><ChevronDown size={13} /></button>
                <button type="button" onClick={() => openCameraForRetake(i)} aria-label="Retake this page"><RefreshCw size={13} /></button>
                <button type="button" onClick={() => removePage(i)} aria-label="Remove page"><X size={13} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="chk-add-fields">
        {roster.length > 0 ? (
          <select value={studentId} onChange={e => setStudentId(e.target.value)}>
            <option value="">— Select student —</option>
            {roster.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}{s.roll_no ? ` (${s.roll_no})` : ''}</option>
            ))}
          </select>
        ) : (
          <Link href="/dashboard/students" className="chk-add-roster-hint">
            <UserPlus size={14} /> No students registered yet — add students to pick them here
          </Link>
        )}
      </div>

      <button type="button" className="chk-btn chk-btn-primary chk-add-submit" onClick={enqueueCurrent} disabled={downscaling || !hasPages}>
        {downscaling ? <><Loader2 size={16} className="chk-spin" /> Processing images…</> : 'Save & add next'}
      </button>

      {queue.length > 0 && (
        <ul className="chk-add-queue">
          {queue.map(job => (
            <li key={job.id} className={`chk-add-queue-item chk-add-queue-${job.status}`}>
              {jobIcon(job.status)}
              <div className="chk-add-queue-body">
                <span className="chk-add-queue-label">{job.label}</span>
                <span className="chk-add-queue-status">
                  {job.status === 'uploading' && 'Uploading…'}
                  {job.status === 'grading' && 'Starting grading…'}
                  {job.status === 'done' && (job.message || 'Done')}
                  {job.status === 'failed' && (job.message || 'Failed')}
                </span>
              </div>
              {job.status === 'failed' && job.retryable && (
                <button type="button" className="chk-add-queue-retry" onClick={() => retryJob(job, snapshotsRef.current.get(job.id))} aria-label="Retry upload">
                  <RotateCw size={13} />
                </button>
              )}
              {job.status === 'failed' && (
                <button type="button" className="chk-add-queue-dismiss" onClick={() => removeJob(job.id)} aria-label="Dismiss">
                  <X size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <style jsx>{`
        .chk-add { display: flex; flex-direction: column; gap: 10px; }
        .chk-add-hidden-input { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }
        .chk-add-capture { display: flex; gap: 8px; flex-wrap: wrap; }
        .chk-add-camera-btn { flex: 1 1 30%; min-width: 110px; }

        .chk-add-progress { margin: 0; font-size: 0.78rem; color: var(--chk-muted); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .chk-add-progress-warn { color: var(--chk-amber); }

        .chk-add-pdf-chip {
          display: flex; align-items: center; gap: 8px; background: var(--chk-bg); border-radius: var(--chk-radius-sm);
          padding: 8px 10px; font-size: 0.85rem; color: var(--chk-navy);
        }
        .chk-add-pdf-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .chk-add-pdf-chip button { border: none; background: none; color: var(--chk-danger); cursor: pointer; display: flex; }

        .chk-add-thumbs { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
        .chk-add-thumb {
          position: relative; background: var(--chk-bg); border-radius: var(--chk-radius-sm); overflow: hidden;
          display: flex; flex-direction: column;
        }
        .chk-add-thumb-img { width: 100%; height: 96px; object-fit: cover; display: block; background: #0b0f1e; }
        .chk-add-thumb-label { font-size: 0.7rem; color: var(--chk-muted); text-align: center; padding: 3px 0; }
        .chk-add-thumb-actions {
          display: flex; justify-content: center; gap: 2px; padding: 0 2px 3px;
        }
        .chk-add-thumb-actions button {
          border: none; background: var(--chk-surface); color: var(--chk-muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center; padding: 3px; border-radius: 4px;
        }
        .chk-add-thumb-actions button:disabled { opacity: 0.35; cursor: not-allowed; }

        .chk-add-fields { display: flex; flex-direction: column; gap: 8px; }
        .chk-add-fields select, .chk-add-fields input {
          width: 100%; padding: 0.55rem 0.75rem; border-radius: var(--chk-radius-md);
          border: 1px solid var(--chk-border); font-size: 0.85rem; font-family: inherit; outline: none;
        }
        .chk-add-roster-hint {
          display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--chk-accent);
          text-decoration: none; padding: 0.5rem 0.6rem; background: var(--chk-accent-soft); border-radius: var(--chk-radius-md);
        }
        .chk-add-submit { width: 100%; padding: 0.7rem; font-size: 0.9rem; }
        .chk-spin { animation: chk-spin 0.9s linear infinite; }
        @keyframes chk-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .chk-add-queue { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .chk-add-queue-item {
          display: flex; align-items: center; gap: 8px; padding: 7px 10px;
          border-radius: var(--chk-radius-sm); background: var(--chk-bg); font-size: 0.8rem;
        }
        .chk-add-queue-body { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .chk-add-queue-label { font-weight: 600; color: var(--chk-navy); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .chk-add-queue-status { font-size: 0.75rem; color: var(--chk-muted); }
        .chk-add-queue-uploading, .chk-add-queue-grading { color: var(--chk-accent); }
        .chk-add-queue-done { color: var(--chk-green); }
        .chk-add-queue-failed { color: var(--chk-danger); }
        .chk-add-queue-failed .chk-add-queue-status { color: var(--chk-danger); }
        .chk-add-queue-retry, .chk-add-queue-dismiss {
          border: none; background: none; cursor: pointer; display: flex; padding: 4px; color: var(--chk-muted);
        }
      `}</style>
    </div>
  );
}
