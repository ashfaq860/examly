// src/components/admin/SubjectsMultiSelect.tsx
// Replaces the old free-text "comma separated subjects" input on the admin
// create/edit user forms with a searchable checklist populated from the
// real `subjects` table.
//
// The same subject NAME can legitimately appear on several distinct rows
// here — this app models a subject per class level rather than one row
// shared across classes (e.g. "Biology" for class 9 and a separate
// "BIOLOGY" row for class 11 are two different subjects table rows,
// confirmed by their class_subjects links, not duplicate/dirty data). So
// options are never collapsed by name — instead each one is labelled with
// its class(es) via subjectOptionLabel (see lib/subjectOptions.ts) so
// same-named entries stay distinguishable, and that per-class label (not
// the bare name) is what gets stored in `value`, since a bare name alone
// couldn't tell two same-named class-scoped rows apart in a stored string
// array.
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { SubjectOption, subjectOptionLabel } from '@/lib/subjectOptions';

export type { SubjectOption };
export { buildSubjectOptions } from '@/lib/subjectOptions';

export function SubjectsMultiSelect({
  subjects,
  value,
  onChange,
  placeholder = 'Select subjects…',
}: {
  subjects: SubjectOption[];
  value: string[];
  onChange: (labels: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const options = useMemo(
    () => subjects.map(s => ({ subject: s, label: subjectOptionLabel(s) })),
    [subjects]
  );

  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

  const toggle = (label: string) => {
    onChange(value.includes(label) ? value.filter(v => v !== label) : [...value, label]);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(o => !o)}
        className="form-control"
        style={{ minHeight: 42, cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', height: 'auto' }}
      >
        {value.length === 0 ? (
          <span className="text-muted">{placeholder}</span>
        ) : (
          value.map(label => (
            <span
              key={label}
              className="badge bg-primary d-inline-flex align-items-center gap-1"
              style={{ fontWeight: 500 }}
            >
              {label}
              <X
                size={11}
                role="button"
                aria-label={`Remove ${label}`}
                onClick={e => { e.stopPropagation(); toggle(label); }}
              />
            </span>
          ))
        )}
      </div>

      {open && (
        <div
          className="shadow-sm border rounded bg-white"
          style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 260, overflowY: 'auto' }}
        >
          <input
            type="text"
            className="form-control border-0 border-bottom rounded-0"
            placeholder="Search subjects…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
            onClick={e => e.stopPropagation()}
          />
          {filtered.length === 0 ? (
            <div className="text-muted small p-2">No subjects found</div>
          ) : (
            filtered.map(({ subject, label }) => (
              <label
                key={subject.id}
                className="d-flex align-items-center gap-2 px-2 py-2"
                style={{ cursor: 'pointer' }}
                onClick={e => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={value.includes(label)}
                  onChange={() => toggle(label)}
                />
                <span>{label}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
