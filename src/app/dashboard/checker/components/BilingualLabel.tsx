// No shared BilingualTextDisplay component exists anywhere in this
// codebase (confirmed by search) — the closest convention is QuestionCell
// in admin/management/questions/page.tsx (English stacked above Urdu,
// dir="rtl", divider). This adapts that for short UI labels too: `inline`
// (default) renders a compact "English — اردو" on one line for buttons/
// headings/badges where stacking would waste vertical space on a 360px
// screen; `stacked` mirrors QuestionCell's layout for longer copy
// (page titles, empty states).
'use client';
import React from 'react';

export interface BilingualLabelProps {
  en: string;
  ur?: string;
  mode?: 'inline' | 'stacked';
  className?: string;
  style?: React.CSSProperties;
}

export function BilingualLabel({ en, ur, mode = 'inline', className, style }: BilingualLabelProps) {
  if (!ur) {
    return <span className={className} style={style}>{en}</span>;
  }

  if (mode === 'stacked') {
    return (
      <span className={className} style={{ display: 'block', ...style }}>
        <span style={{ display: 'block' }}>{en}</span>
        <span
          dir="rtl"
          lang="ur"
          className="urdu-text"
          style={{ display: 'block', fontSize: '0.92em', color: 'var(--chk-muted)', marginTop: 2 }}
        >
          {ur}
        </span>
      </span>
    );
  }

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', ...style }}>
      <span>{en}</span>
      <span aria-hidden="true" style={{ color: 'var(--chk-border)' }}>—</span>
      <span dir="rtl" lang="ur" className="urdu-text" style={{ fontSize: '0.95em', color: 'var(--chk-muted)' }}>
        {ur}
      </span>
    </span>
  );
}
