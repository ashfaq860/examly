// src/lib/subjectOptions.ts
// Plain (non-'use client') shared logic for labelling `subjects` table rows
// by class, used by both SubjectsMultiSelect (a client component) and
// server routes (e.g. /api/academy/members) that need to build the same
// option list without pulling client-only code into a route handler's
// bundle.
export interface SubjectOption {
  id: string;
  name: string;
  name_ur?: string | null;
  /** Class name(s) this subject row is linked to via class_subjects, e.g. ["9"] or ["7","8","9"]. Omit/empty when not class-scoped. */
  classNames?: string[];
}

/** Builds SubjectOption[] with classNames attached, from the flat `subjects`
 *  rows and the class_subjects join rows /api/admin/lookups already
 *  returns — shared here so every consumer labels subjects the same way.
 *  The same subject NAME can legitimately appear on several distinct
 *  `subjects` rows (this app models a subject per class level, e.g.
 *  "Biology" for class 9 and a separate "BIOLOGY" row for class 11 are two
 *  different rows, not duplicate data), so rows are never collapsed by
 *  name — the class annotation is what keeps same-named rows
 *  distinguishable. */
export function buildSubjectOptions(
  subjects: { id: string; name: string; name_ur?: string | null }[],
  classSubjects: { subject_id: string; class?: { name: string } | null }[]
): SubjectOption[] {
  const classNamesBySubjectId = new Map<string, string[]>();
  for (const cs of classSubjects) {
    if (!cs.class?.name) continue;
    const list = classNamesBySubjectId.get(cs.subject_id) || [];
    list.push(cs.class.name);
    classNamesBySubjectId.set(cs.subject_id, list);
  }
  return subjects.map(s => ({ ...s, classNames: classNamesBySubjectId.get(s.id) || [] }));
}

/** The label shown AND the value stored/matched against a SubjectsMultiSelect
 *  `value` array — always includes the class when known, so "Biology"
 *  (class 9) and "Biology" (class 11) never collide as the same
 *  checkbox/stored string. */
export function subjectOptionLabel(s: SubjectOption): string {
  const base = s.classNames?.length ? `${s.name} — Class ${s.classNames.join(', ')}` : s.name;
  return s.name_ur ? `${base} (${s.name_ur})` : base;
}
