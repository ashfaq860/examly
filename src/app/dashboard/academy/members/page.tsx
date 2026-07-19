// src/app/dashboard/academy/members/page.tsx
// Seat management for academy owners: lists academy_members (joined to
// profiles), shows "X of Y seats used" (Y from the owner's package via
// get_active_package), and lets the owner add a teacher by email or
// remove one. All enforcement (ownership, can_add_member) happens
// server-side in /api/academy/members — this page only renders what that
// route returns and never assumes the caller is actually an owner.
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, UserPlus, Trash2, ShieldCheck, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { UpgradeModal, UpgradeReason } from '@/components/UpgradeModal';
import { SubjectsMultiSelect, SubjectOption } from '@/components/admin/SubjectsMultiSelect';
import Loading from '@/app/dashboard/generate-paper/loading';

interface Member {
  userId: string;
  memberRole: 'owner' | 'teacher' | string;
  createdAt: string;
  fullName: string | null;
  email: string | null;
  subjects: string[];
}

export default function AcademyMembersPage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [academyName, setAcademyName] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [seatsUsed, setSeatsUsed] = useState(0);
  const [seatsTotal, setSeatsTotal] = useState<number | null>(null);
  const [savingSubjectsFor, setSavingSubjectsFor] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/academy/members');
    if (res.status === 403) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setAcademyName(data.academy?.name ?? null);
      setMembers(data.members || []);
      setSeatsUsed(data.seatsUsed ?? 0);
      setSeatsTotal(data.seatsTotal ?? null);
      setSubjectOptions(data.subjectOptions || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch('/api/academy/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'seats_exhausted') { setUpgradeReason('seats_exhausted'); return; }
        if (data.error === 'user_not_found') {
          setAddError("No Examly account found for that email — ask the teacher to sign up first, then add them here.");
          return;
        }
        setAddError(data.error || 'Failed to add teacher');
        return;
      }
      toast.success('Teacher added');
      setEmail('');
      await fetchMembers();
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this teacher from your academy?')) return;
    setRemovingId(userId);
    try {
      const res = await fetch(`/api/academy/members?userId=${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to remove teacher');
        return;
      }
      toast.success('Teacher removed');
      await fetchMembers();
    } finally {
      setRemovingId(null);
    }
  };

  const handleSubjectsChange = async (userId: string, subjects: string[]) => {
    const prevMembers = members;
    setMembers(prev => prev.map(m => (m.userId === userId ? { ...m, subjects } : m)));
    setSavingSubjectsFor(userId);
    try {
      const res = await fetch('/api/academy/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subjects }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to update subjects');
        setMembers(prevMembers);
      }
    } catch {
      toast.error('Failed to update subjects');
      setMembers(prevMembers);
    } finally {
      setSavingSubjectsFor(null);
    }
  };

  if (loading) return <div className="text-center py-5"><Loading /></div>;

  if (forbidden) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-warning d-inline-block">
          This page is only available to academy owners.
          <br />
          <span dir="rtl" lang="ur">یہ صفحہ صرف اکیڈمی مالکان کے لیے دستیاب ہے۔</span>
        </div>
        <div><Link href="/dashboard" className="btn btn-link">Back to dashboard</Link></div>
      </div>
    );
  }

  const seatsFull = seatsTotal !== null && seatsUsed >= seatsTotal;

  return (
    <div className="container py-2">
      <UpgradeModal open={upgradeReason !== null} onClose={() => setUpgradeReason(null)} reason={upgradeReason ?? 'seats_exhausted'} />

      <div className="d-flex align-items-center gap-2 mb-3">
        <div
          style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Users size={18} color="#fff" />
        </div>
        <div>
          <h1 className="h4 fw-bold mb-0">
            Academy Members{academyName ? ` — ${academyName}` : ''}
          </h1>
          <p className="text-muted small mb-0" dir="rtl" lang="ur">اکیڈمی اراکین</p>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <ShieldCheck size={16} className="text-primary" />
            <span className="fw-semibold">
              {seatsUsed} of {seatsTotal ?? '∞'} seats used
            </span>
          </div>
          {seatsFull && (
            <span className="badge text-bg-warning">
              Seats full — upgrade to add more teachers
            </span>
          )}
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white fw-bold">Add a teacher</div>
        <div className="card-body">
          <form onSubmit={handleAdd} className="d-flex gap-2 flex-wrap">
            <input
              type="email"
              className="form-control"
              style={{ maxWidth: 320 }}
              placeholder="teacher@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={adding || seatsFull}
            />
            <button type="submit" className="btn btn-primary d-flex align-items-center gap-2" disabled={adding || seatsFull}>
              <UserPlus size={15} /> {adding ? 'Adding…' : 'Add teacher'}
            </button>
          </form>
          <p className="text-muted small mt-2 mb-0">
            The teacher must already have an Examly account — invite links for new sign-ups aren&apos;t supported yet.
          </p>
          {addError && <div className="alert alert-danger mt-3 mb-0 small">{addError}</div>}
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="bg-light text-muted small text-uppercase">
                <tr>
                  <th className="ps-4">Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th style={{ minWidth: 220 }}>Subjects</th>
                  <th>Joined</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.userId}>
                    <td className="ps-4 fw-semibold">{m.fullName || '—'}</td>
                    <td>{m.email || '—'}</td>
                    <td>
                      <span className={`badge ${m.memberRole === 'owner' ? 'text-bg-dark' : 'text-bg-secondary'}`}>
                        {m.memberRole}
                      </span>
                    </td>
                    <td style={{ minWidth: 220 }}>
                      <SubjectsMultiSelect
                        subjects={subjectOptions}
                        value={m.subjects}
                        onChange={(subjects) => handleSubjectsChange(m.userId, subjects)}
                        placeholder="No subjects assigned"
                      />
                      {savingSubjectsFor === m.userId && <span className="text-muted small">Saving…</span>}
                    </td>
                    <td className="text-muted small">{new Date(m.createdAt).toLocaleDateString()}</td>
                    <td className="text-end pe-4">
                      {m.memberRole !== 'owner' && (
                        <button
                          className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                          onClick={() => handleRemove(m.userId)}
                          disabled={removingId === m.userId}
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="text-muted small mt-2 mb-0">
        Subjects are a label for now — they don&apos;t yet restrict which papers a teacher can review in Paper Checker (every teacher still only sees papers they personally created).
      </p>

      <div className="mt-3">
        <Link href="/dashboard" className="text-muted small d-inline-flex align-items-center gap-1 text-decoration-none">
          <ArrowLeft size={13} /> Back to dashboard
        </Link>
      </div>
    </div>
  );
}
