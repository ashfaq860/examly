// /dashboard/students — register/manage the teacher's own class roster.
// This is what populates the "Add submission" roster dropdown
// (api/checker/papers' roster query, owner_id-scoped) and the bulk
// WhatsApp result sender — before this page existed there was no way to
// add a `students` row at all; every teacher had to type free-text
// name/roll on every single submission.
//
// Lives at its own top-level route (sibling of /dashboard/checker, not a
// child of it) — a class roster is useful on its own even outside the
// paper-checking workflow, so it gets its own sidebar identity. It still
// shares the checker's visual system and 'paper_checker' feature gate
// (see /dashboard/students/layout.tsx + CheckerDesignRoot) since roster
// management has no independent product tier of its own.
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Plus, Pencil, RotateCcw, UserX, Search, MessageCircle } from 'lucide-react';
import { useCheckerAuthGuard } from '@/app/dashboard/checker/hooks/useCheckerAuthGuard';
import { BilingualLabel } from '@/app/dashboard/checker/components/BilingualLabel';
import { StatusBadge } from '@/app/dashboard/checker/components/StatusBadge';
import Loading from '@/app/dashboard/generate-paper/loading';

interface Student {
  id: string;
  full_name: string;
  father_name: string | null;
  roll_no: string | null;
  class_name: string | null;
  section: string | null;
  whatsapp_number: string | null;
  is_active: boolean;
  created_at: string;
}

interface EditDraft {
  full_name: string;
  father_name: string;
  roll_no: string;
  class_name: string;
  section: string;
  whatsapp_number: string;
}

interface ClassOption {
  id: string;
  name: string;
}

export default function StudentsPage() {
  const { isAuthenticated, authChecked, authError } = useCheckerAuthGuard();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [adding, setAdding] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ full_name: '', father_name: '', roll_no: '', class_name: '', section: '', whatsapp_number: '' });
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    const res = await fetch('/api/students');
    if (res.ok) {
      const data = await res.json();
      setStudents(data.students || []);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => { setLoading(true); await fetchStudents(); setLoading(false); })();
  }, [isAuthenticated, fetchStudents]);

  // Class options come from the same `classes` table used by the rest of
  // the app (question bank / paper generation) rather than free text, so a
  // student's class always matches a real grade level. Public, cached
  // route — no auth gating needed.
  useEffect(() => {
    fetch('/api/classes').then(res => res.ok ? res.json() : []).then(data => setClasses(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const handleAdd = async () => {
    if (!fullName.trim()) { toast.error('Student name is required'); return; }
    setAdding(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, father_name: fatherName, roll_no: rollNo, class_name: className, section, whatsapp_number: whatsapp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add student');
      setStudents(prev => [...prev, data.student].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setFullName(''); setFatherName(''); setRollNo(''); setClassName(''); setSection(''); setWhatsapp('');
      toast.success('Student added');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (s: Student) => {
    setEditingId(s.id);
    setEditDraft({ full_name: s.full_name, father_name: s.father_name || '', roll_no: s.roll_no || '', class_name: s.class_name || '', section: s.section || '', whatsapp_number: s.whatsapp_number || '' });
  };

  const saveEdit = async (id: string) => {
    if (!editDraft.full_name.trim()) { toast.error('Student name is required'); return; }
    setSavingId(id);
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save changes');
      setStudents(prev => prev.map(s => (s.id === id ? data.student : s)));
      setEditingId(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (s: Student) => {
    setSavingId(s.id);
    try {
      const res = await fetch(`/api/students/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !s.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setStudents(prev => prev.map(x => (x.id === s.id ? data.student : x)));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter(s => showInactive || s.is_active)
      .filter(s => !q || s.full_name.toLowerCase().includes(q) || (s.father_name || '').toLowerCase().includes(q) || (s.roll_no || '').toLowerCase().includes(q) || (s.class_name || '').toLowerCase().includes(q));
  }, [students, search, showInactive]);

  if (!authChecked || (isAuthenticated && loading)) {
    return <div className="text-center py-5"><Loading /></div>;
  }
  if (authError) return <div className="chk-root"><div className="chk-empty">{authError}</div></div>;

  const activeCount = students.filter(s => s.is_active).length;

  return (
    <div className="chk-root chk-students">
      <Link href="/dashboard" className="chk-back"><ArrowLeft size={14} /> Dashboard</Link>

      <div className="chk-hd">
        <div>
          <h1 className="chk-h1"><BilingualLabel en="Manage Students" ur="طلبہ کا انتظام" /></h1>
          <p className="chk-sub">{activeCount} active student{activeCount === 1 ? '' : 's'}</p>
        </div>
      </div>

      <section className="chk-panel">
        <h2 className="chk-h2"><BilingualLabel en="Add student" ur="طالب علم شامل کریں" /></h2>
        <div className="chk-students-form">
          <input type="text" placeholder="Full name *" value={fullName} onChange={e => setFullName(e.target.value)} />
          <input type="text" placeholder="Father's name" value={fatherName} onChange={e => setFatherName(e.target.value)} />
          <input type="text" placeholder="Roll no." value={rollNo} onChange={e => setRollNo(e.target.value)} />
          <select value={className} onChange={e => setClassName(e.target.value)}>
            <option value="">Class</option>
            {classes.map(c => <option key={c.id} value={c.name}>Class {c.name}</option>)}
          </select>
          <input type="text" placeholder="Section (optional)" value={section} onChange={e => setSection(e.target.value)} />
          <input type="tel" placeholder="WhatsApp (03XXXXXXXXX)" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
          <button type="button" className="chk-btn chk-btn-primary chk-students-add-btn" onClick={handleAdd} disabled={adding}>
            <Plus size={15} /> {adding ? 'Adding…' : 'Add student'}
          </button>
        </div>
      </section>

      <section className="chk-panel">
        <div className="chk-students-toolbar">
          <div className="chk-students-search">
            <Search size={14} />
            <input type="text" placeholder="Search by name, roll no, or class" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <label className="chk-students-toggle">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show removed
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="chk-students-empty">
            {students.length === 0 ? 'No students yet — add your first one above.' : 'No students match this search.'}
          </p>
        ) : (
          <ul className="chk-students-list">
            {filtered.map(s => (
              <li key={s.id} className={`chk-students-row ${!s.is_active ? 'chk-students-row-inactive' : ''}`}>
                {editingId === s.id ? (
                  <div className="chk-students-edit">
                    <input type="text" value={editDraft.full_name} onChange={e => setEditDraft(d => ({ ...d, full_name: e.target.value }))} placeholder="Full name" />
                    <input type="text" value={editDraft.father_name} onChange={e => setEditDraft(d => ({ ...d, father_name: e.target.value }))} placeholder="Father's name" />
                    <input type="text" value={editDraft.roll_no} onChange={e => setEditDraft(d => ({ ...d, roll_no: e.target.value }))} placeholder="Roll no." />
                    <select value={editDraft.class_name} onChange={e => setEditDraft(d => ({ ...d, class_name: e.target.value }))}>
                      <option value="">Class</option>
                      {classes.map(c => <option key={c.id} value={c.name}>Class {c.name}</option>)}
                    </select>
                    <input type="text" value={editDraft.section} onChange={e => setEditDraft(d => ({ ...d, section: e.target.value }))} placeholder="Section" />
                    <input type="tel" value={editDraft.whatsapp_number} onChange={e => setEditDraft(d => ({ ...d, whatsapp_number: e.target.value }))} placeholder="WhatsApp (03XXXXXXXXX)" />
                    <div className="chk-students-edit-actions">
                      <button type="button" className="chk-btn chk-btn-primary" onClick={() => saveEdit(s.id)} disabled={savingId === s.id}>Save</button>
                      <button type="button" className="chk-btn chk-btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="chk-students-info">
                      <span className="chk-students-name">
                        {s.full_name}
                        {s.father_name && <span className="chk-students-father"> s/o {s.father_name}</span>}
                      </span>
                      <span className="chk-students-meta">
                        {s.roll_no ? `Roll ${s.roll_no}` : 'No roll no.'}
                        {s.class_name ? ` · Class ${s.class_name}` : ''}
                        {s.section ? ` · ${s.section}` : ''}
                        {s.whatsapp_number && (
                          <span className="chk-students-wa"><MessageCircle size={11} /> {s.whatsapp_number}</span>
                        )}
                      </span>
                    </div>
                    {!s.is_active && <StatusBadge label="Removed" tone="neutral" />}
                    <div className="chk-students-actions">
                      <button type="button" className="chk-students-icon-btn" onClick={() => startEdit(s)} aria-label="Edit"><Pencil size={14} /></button>
                      <button
                        type="button"
                        className="chk-students-icon-btn"
                        onClick={() => toggleActive(s)}
                        disabled={savingId === s.id}
                        aria-label={s.is_active ? 'Remove' : 'Restore'}
                        title={s.is_active ? 'Remove from roster' : 'Restore to roster'}
                      >
                        {s.is_active ? <UserX size={14} /> : <RotateCcw size={14} />}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <style jsx>{`
        .chk-students { padding-bottom: 2rem; display: flex; flex-direction: column; gap: 1.25rem; }
        .chk-back {
          display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--chk-muted);
          text-decoration: none; width: fit-content;
        }
        .chk-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
        .chk-h1 { margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--chk-navy); }
        .chk-sub { margin: 2px 0 0; font-size: 0.85rem; color: var(--chk-muted); }
        .chk-h2 { margin: 0 0 0.85rem; font-size: 0.95rem; font-weight: 700; color: var(--chk-navy); }

        .chk-panel {
          background: var(--chk-surface); border: 1px solid var(--chk-border); border-radius: var(--chk-radius-lg);
          padding: 1.1rem; box-shadow: var(--chk-shadow-sm);
        }

        .chk-empty {
          background: var(--chk-surface); border: 1px solid var(--chk-border); border-radius: var(--chk-radius-lg);
          padding: 2.5rem 1rem; text-align: center; color: var(--chk-muted);
        }

        .chk-students-form { display: grid; grid-template-columns: 1fr; gap: 8px; }
        .chk-students-form input, .chk-students-form select {
          width: 100%; padding: 0.55rem 0.75rem; border-radius: var(--chk-radius-md);
          border: 1px solid var(--chk-border); font-size: 0.85rem; font-family: inherit; outline: none; background: var(--chk-surface);
        }
        .chk-students-add-btn { width: 100%; }

        .chk-students-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 0.85rem; }
        .chk-students-search {
          display: flex; align-items: center; gap: 8px; flex: 1 1 220px; min-width: 0;
          border: 1px solid var(--chk-border); border-radius: var(--chk-radius-md); padding: 0.5rem 0.7rem; color: var(--chk-muted);
        }
        .chk-students-search input { border: none; outline: none; font-size: 0.85rem; width: 100%; font-family: inherit; color: var(--chk-text); }
        .chk-students-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--chk-muted); white-space: nowrap; }

        .chk-students-empty { color: var(--chk-muted); font-size: 0.85rem; text-align: center; padding: 1.5rem 0; margin: 0; }

        .chk-students-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .chk-students-row {
          display: flex; align-items: center; gap: 10px; padding: 0.65rem 0.8rem;
          background: var(--chk-bg); border-radius: var(--chk-radius-md); flex-wrap: wrap;
        }
        .chk-students-row-inactive { opacity: 0.6; }
        .chk-students-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .chk-students-name { font-weight: 600; color: var(--chk-navy); font-size: 0.9rem; }
        .chk-students-father { font-weight: 400; color: var(--chk-muted); font-size: 0.82rem; }
        .chk-students-meta { font-size: 0.78rem; color: var(--chk-muted); }
        .chk-students-wa { display: inline-flex; align-items: center; gap: 3px; margin-left: 8px; color: var(--chk-green); }
        .chk-students-actions { display: flex; align-items: center; gap: 4px; margin-left: auto; }
        .chk-students-icon-btn {
          border: none; background: none; cursor: pointer; display: flex; padding: 6px;
          color: var(--chk-muted); border-radius: var(--chk-radius-sm);
        }
        .chk-students-icon-btn:hover { background: var(--chk-surface); }
        .chk-students-icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .chk-students-edit { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; align-items: center; }
        .chk-students-edit input, .chk-students-edit select {
          flex: 1 1 130px; min-width: 0; padding: 0.45rem 0.65rem; border-radius: var(--chk-radius-sm);
          border: 1px solid var(--chk-border); font-size: 0.82rem; font-family: inherit; outline: none; background: var(--chk-surface);
        }
        .chk-students-edit-actions { display: flex; gap: 6px; flex-shrink: 0; }

        @media (min-width: 900px) {
          .chk-students-form { grid-template-columns: 1.4fr 1.2fr 0.8fr 0.8fr 0.8fr 1.1fr auto; align-items: center; }
          .chk-students-add-btn { width: auto; }
        }
      `}</style>
    </div>
  );
}
