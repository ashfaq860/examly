// "Add submission" flow, optimized for a phone camera. Two capture paths:
// a real in-app live camera (CameraCapture, via getUserMedia) as the
// primary option — needed because <input capture="environment"> is
// unreliable on several browsers (notably desktop Firefox, which ignores
// it and falls back to a plain file picker with no camera at all) — and a
// plain file input as a secondary "choose existing files" path for gallery/
// desktop uploads. Either path accumulates pages in local state (appended,
// never replaced) so multi-page papers and rapid one-tap-per-page batch
// capture both work the same way regardless of which path was used.
// The primary submit button is always labelled "Save & add next" so the
// same tap that submits the current student's sheet also leaves the form
// ready for the next one, per the batch-grading workflow.
'use client';

import { useRef, useState } from 'react';
import { Camera, FolderOpen, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { downscaleImage } from '@/lib/checker/downscaleImage';
import { CameraCapture } from './CameraCapture';

export interface RosterStudent {
  id: string;
  full_name: string;
  roll_no: string | null;
}

type Phase = 'idle' | 'downscaling' | 'uploading' | 'grading' | 'done' | 'failed';

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
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const busy = phase === 'downscaling' || phase === 'uploading' || phase === 'grading';

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // reset so the same input can be re-opened for the next page
    if (picked.length === 0) return;

    setPhase('downscaling');
    try {
      const downscaled = await Promise.all(picked.map(f => downscaleImage(f)));
      setFiles(prev => [...prev, ...downscaled]);
      setPhase('idle');
    } catch {
      setPhase('idle');
      setMessage('Could not process one of the selected images — try again.');
    }
  };

  const handleCameraCapture = async (file: File) => {
    try {
      const downscaled = await downscaleImage(file);
      setFiles(prev => [...prev, downscaled]);
    } catch {
      setMessage('Could not process the captured photo — try again.');
    }
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setFiles([]);
    setStudentId('');
    setStudentName('');
    setRollNo('');
  };

  const handleRosterChange = (id: string) => {
    setStudentId(id);
    const student = roster.find(r => r.id === id);
    if (student) {
      setStudentName(student.full_name);
      setRollNo(student.roll_no || '');
    }
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      setMessage('Add at least one scan image first.');
      return;
    }
    setMessage(null);
    setPhase('uploading');
    try {
      const form = new FormData();
      form.append('paperId', paperId);
      if (studentId) form.append('student_id', studentId);
      if (studentName) form.append('student_name', studentName);
      if (rollNo) form.append('roll_no', rollNo);
      files.forEach(f => form.append('files', f));

      const createRes = await fetch('/api/checker/submissions', { method: 'POST', body: form });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Upload failed');

      setPhase('grading');
      const gradeRes = await fetch('/api/checker/grade-mcq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: createData.submission.id }),
      });
      const gradeData = await gradeRes.json();
      if (!gradeRes.ok) throw new Error(gradeData.error || 'Grading failed');

      setPhase('done');
      setMessage(`Saved — ${gradeData.mcq_score}/${gradeData.max_mcq_score}${gradeData.needs_review ? ' (some answers need review)' : ''}`);
      resetForm();
      onSubmissionGraded();
    } catch (err: any) {
      setPhase('failed');
      setMessage(err.message || 'Something went wrong');
    }
  };

  return (
    <div className="chk-add">
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
          disabled={busy}
        >
          <Camera size={16} /> Use camera
        </button>
        <button
          type="button"
          className="chk-btn chk-btn-ghost chk-add-camera-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
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
              <button type="button" onClick={() => removeFile(i)} disabled={busy} aria-label="Remove page"><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="chk-add-fields">
        {roster.length > 0 && (
          <select value={studentId} onChange={e => handleRosterChange(e.target.value)} disabled={busy}>
            <option value="">— Choose from roster (optional) —</option>
            {roster.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}{s.roll_no ? ` (${s.roll_no})` : ''}</option>
            ))}
          </select>
        )}
        <input
          type="text" placeholder="Student name (optional)" value={studentName}
          onChange={e => { setStudentId(''); setStudentName(e.target.value); }} disabled={busy}
        />
        <input
          type="text" placeholder="Roll number (optional)" value={rollNo}
          onChange={e => { setStudentId(''); setRollNo(e.target.value); }} disabled={busy}
        />
      </div>

      <button type="button" className="chk-btn chk-btn-primary chk-add-submit" onClick={handleSubmit} disabled={busy || files.length === 0}>
        {phase === 'downscaling' && <><Loader2 size={16} className="chk-spin" /> Processing images…</>}
        {phase === 'uploading' && <><Loader2 size={16} className="chk-spin" /> Uploading…</>}
        {phase === 'grading' && <><Loader2 size={16} className="chk-spin" /> Grading…</>}
        {(phase === 'idle' || phase === 'done' || phase === 'failed') && 'Save & add next'}
      </button>

      {message && (
        <p className={`chk-add-msg ${phase === 'failed' ? 'chk-add-msg-error' : 'chk-add-msg-ok'}`}>
          {phase === 'failed' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />} {message}
        </p>
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
        .chk-add-submit { width: 100%; padding: 0.7rem; font-size: 0.9rem; }
        .chk-add-msg { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; margin: 0; }
        .chk-add-msg-ok { color: var(--chk-green); }
        .chk-add-msg-error { color: var(--chk-danger); }
        .chk-spin { animation: chk-spin 0.9s linear infinite; }
        @keyframes chk-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
