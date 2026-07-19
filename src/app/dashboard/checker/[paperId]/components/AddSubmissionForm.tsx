// "Add submission" flow, optimized for a phone camera. Two capture paths:
// a real in-app live camera (CameraCapture, via getUserMedia) as the
// primary option — needed because <input capture="environment"> is
// unreliable on several browsers (notably desktop Firefox, which ignores
// it and falls back to a plain file picker with no camera at all) — and a
// plain file input as a secondary "choose existing files" path for gallery/
// desktop uploads. Either path accumulates pages in local state (appended,
// never replaced) so multi-page papers and rapid one-tap-per-page batch
// capture both work the same way regardless of which path was used.
//
// Upload + grading run as a background queue (see runQueue below), never
// blocking the form: tapping "Save & add next" snapshots the current pages
// and student info, clears the form immediately, and hands the snapshot to
// a queue that uploads/grades one job at a time while the teacher is
// already photographing the next student. Only the (fast, local) downscale
// step still gates the button, since it operates on the pages about to be
// queued.
'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, FolderOpen, X, Loader2, CheckCircle2, AlertTriangle, RotateCw, UserPlus } from 'lucide-react';
import { downscaleImage } from '@/lib/checker/downscaleImage';
import { CameraCapture } from './CameraCapture';
import { UpgradeModal, UpgradeReason } from '@/components/UpgradeModal';

export interface RosterStudent {
  id: string;
  full_name: string;
  roll_no: string | null;
}

interface JobSnapshot {
  files: File[];
  studentId: string;
  studentName: string;
  rollNo: string;
}

interface QueueJob {
  id: string;
  label: string;
  pageCount: number;
  status: 'uploading' | 'grading' | 'done' | 'failed';
  message?: string;
  retryable: boolean; // true only if upload itself never succeeded (no table row to retry from there)
}

export function AddSubmissionForm({
  paperId,
  roster,
  onSubmissionGraded,
}: {
  paperId: string;
  roster: RosterStudent[];
  onSubmissionGraded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [downscaling, setDownscaling] = useState(false);
  const [queue, setQueue] = useState<QueueJob[]>([]);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);

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
        const form = new FormData();
        form.append('paperId', paperId);
        if (snapshot.studentId) form.append('student_id', snapshot.studentId);
        if (snapshot.studentName) form.append('student_name', snapshot.studentName);
        if (snapshot.rollNo) form.append('roll_no', snapshot.rollNo);
        snapshot.files.forEach(f => form.append('files', f));

        const createRes = await fetch('/api/checker/submissions', { method: 'POST', body: form });
        const createData = await createRes.json();
        if (!createRes.ok) {
          if (createData.error === 'subscription_required') {
            setUpgradeReason('subscription_required');
            stopReasonRef.current = 'Paper Checker requires an upgraded plan.';
          }
          throw new Error(stopReasonRef.current || createData.error || 'Upload failed');
        }
        uploaded = true;

        // Row now exists — it's visible (and retryable) from the
        // submissions table below regardless of what happens next.
        onSubmissionGraded();
        updateJob(id, { status: 'grading' });

        const gradeRes = await fetch('/api/checker/grade-mcq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submission_id: createData.submission.id }),
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

        updateJob(id, {
          status: 'done',
          retryable: false,
          message: `${gradeData.mcq_score}/${gradeData.max_mcq_score}${gradeData.needs_review ? ' — needs review' : ''}`,
        });
        onSubmissionGraded();
        setTimeout(() => removeJob(id), 4000);
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

    setDownscaling(true);
    try {
      const downscaled = await Promise.all(picked.map(f => downscaleImage(f)));
      setFiles(prev => [...prev, ...downscaled]);
    } catch {
      // best-effort — leave existing pages intact, just report the failure
      setQueue(prev => [...prev, { id: crypto.randomUUID(), label: 'Selected file(s)', pageCount: 0, status: 'failed', message: 'Could not process one of the selected images — try again.', retryable: false }]);
    } finally {
      setDownscaling(false);
    }
  };

  const handleCameraCapture = async (file: File) => {
    try {
      const downscaled = await downscaleImage(file);
      setFiles(prev => [...prev, downscaled]);
    } catch {
      setQueue(prev => [...prev, { id: crypto.randomUUID(), label: 'Captured photo', pageCount: 0, status: 'failed', message: 'Could not process the captured photo — try again.', retryable: false }]);
    }
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleRosterChange = (id: string) => {
    setStudentId(id);
    const student = roster.find(r => r.id === id);
    if (student) {
      setStudentName(student.full_name);
      setRollNo(student.roll_no || '');
    }
  };

  const enqueueCurrent = () => {
    if (files.length === 0) return;

    // A fresh, manual "add" is a reasonable signal to give the queue
    // another chance even after an earlier quota/subscription block —
    // otherwise closing the upgrade modal and upgrading in another tab
    // would leave every future submission auto-failing for the rest of
    // this page's lifetime.
    stopReasonRef.current = null;

    const snapshot: JobSnapshot = { files, studentId, studentName, rollNo };
    const id = crypto.randomUUID();
    const label = studentName
      ? `${studentName}${rollNo ? ` · Roll ${rollNo}` : ''}`
      : `${files.length} page${files.length === 1 ? '' : 's'}`;

    setQueue(prev => [...prev, { id, label, pageCount: files.length, status: 'uploading', retryable: true }]);
    snapshotsRef.current.set(id, snapshot);
    pendingRef.current.push({ id, snapshot });

    // Clear the staging area right away — this is the whole point: the
    // teacher can start photographing the next student immediately while
    // this job uploads/grades in the background.
    setFiles([]);
    setStudentId('');
    setStudentName('');
    setRollNo('');

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

  return (
    <div className="chk-add">
      <UpgradeModal open={upgradeReason !== null} onClose={() => setUpgradeReason(null)} reason={upgradeReason ?? 'subscription_required'} />

      {cameraOpen && (
        <CameraCapture
          pageCount={files.length}
          onCapture={handleCameraCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <div className="chk-add-capture">
        <button
          type="button"
          className="chk-btn chk-btn-primary chk-add-camera-btn"
          onClick={() => setCameraOpen(true)}
          disabled={downscaling}
        >
          <Camera size={16} /> Use camera
        </button>
        <button
          type="button"
          className="chk-btn chk-btn-ghost chk-add-camera-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={downscaling}
        >
          <FolderOpen size={16} /> Choose files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFilesSelected}
          className="chk-add-hidden-input"
        />
      </div>

      {files.length > 0 && (
        <ul className="chk-add-pages">
          {files.map((f, i) => (
            <li key={i}>
              <span>Page {i + 1} · {(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => removeFile(i)} aria-label="Remove page"><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="chk-add-fields">
        {roster.length > 0 ? (
          <select value={studentId} onChange={e => handleRosterChange(e.target.value)}>
            <option value="">— Choose from roster (optional) —</option>
            {roster.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}{s.roll_no ? ` (${s.roll_no})` : ''}</option>
            ))}
          </select>
        ) : (
          <Link href="/dashboard/checker/students" className="chk-add-roster-hint">
            <UserPlus size={14} /> No students registered yet — add students to pick them here
          </Link>
        )}
        <input
          type="text" placeholder="Student name (optional)" value={studentName}
          onChange={e => { setStudentId(''); setStudentName(e.target.value); }}
        />
        <input
          type="text" placeholder="Roll number (optional)" value={rollNo}
          onChange={e => { setStudentId(''); setRollNo(e.target.value); }}
        />
      </div>

      <button type="button" className="chk-btn chk-btn-primary chk-add-submit" onClick={enqueueCurrent} disabled={downscaling || files.length === 0}>
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
                  {job.status === 'grading' && 'Grading…'}
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
        .chk-add-capture { display: flex; gap: 8px; }
        .chk-add-camera-btn { flex: 1; }
        .chk-add-pages { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        .chk-add-pages li {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--chk-bg); border-radius: var(--chk-radius-sm); padding: 6px 10px;
          font-size: 0.82rem; color: var(--chk-muted);
        }
        .chk-add-pages button { border: none; background: none; color: var(--chk-danger); cursor: pointer; display: flex; }
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
