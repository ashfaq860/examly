// Reusable status pill for the checker UI, following this codebase's
// existing badge convention (a pill base + color-by-status lookup table,
// e.g. Question Bank's DIFF map for difficulty, users.css's .usr-badge--*
// modifiers) rather than importing a component that doesn't exist anywhere
// in the project.
import React from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'green' | 'amber' | 'red';

const TONE_STYLES: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--chk-bg)', fg: 'var(--chk-muted)' },
  accent: { bg: 'var(--chk-accent-soft)', fg: 'var(--chk-accent)' },
  green: { bg: 'var(--chk-green-soft)', fg: 'var(--chk-green)' },
  amber: { bg: 'var(--chk-amber-soft)', fg: 'var(--chk-amber)' },
  red: { bg: 'var(--chk-danger-soft)', fg: 'var(--chk-danger)' },
};

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const s = TONE_STYLES[tone];
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
        borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.02em',
        background: s.bg, color: s.fg, whiteSpace: 'nowrap', lineHeight: 1.4,
      }}
    >
      {label}
    </span>
  );
}

const SUBMISSION_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  uploaded: { label: 'Uploaded', tone: 'neutral' },
  processing: { label: 'Grading…', tone: 'accent' },
  graded: { label: 'Graded', tone: 'green' },
  in_review: { label: 'Needs review', tone: 'amber' },
  finalized: { label: 'Finalized', tone: 'accent' },
  failed: { label: 'Failed', tone: 'red' },
};

export function SubmissionStatusBadge({ status }: { status: string }) {
  const cfg = SUBMISSION_STATUS[status] || { label: status, tone: 'neutral' as BadgeTone };
  return <StatusBadge label={cfg.label} tone={cfg.tone} />;
}
