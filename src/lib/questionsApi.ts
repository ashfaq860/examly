// lib/questionsApi.ts
// All HTTP calls to /api/* — the page imports these instead of supabase.

export interface QuestionFilters {
  class_id?:      string;
  subject_id?:    string;
  chapter_id?:    string;
  topic_id?:      string;
  difficulty?:    string;
  question_type?: string;
  source_type?:   string;
}

export interface FetchQuestionsParams extends QuestionFilters {
  page:     number;
  per_page: number;
  search?:  string;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `API error ${res.status}`);
  return json as T;
}

/* ── Lookups ─────────────────────────────────────────────────────────────── */
export async function fetchLookups() {
  return apiFetch<{
    classes:       any[];
    subjects:      any[];
    chapters:      any[];
    topics:        any[];
    classSubjects: any[];
  }>('/api/admin/lookups');
}

/* ── Topics by chapter (always fresh — avoids stale cache after adding topics) */
// Uses the existing /api/admin/topics route which returns a flat array directly.
export async function fetchTopicsByChapter(chapterId: string) {
  return apiFetch<Array<{ id: string; name: string; chapter_id: string }>>(
    `/api/admin/topics?chapterId=${encodeURIComponent(chapterId)}`
  );
}

/* ── Questions list ──────────────────────────────────────────────────────── */
export async function fetchQuestions(params: FetchQuestionsParams) {
  const sp = new URLSearchParams();
  sp.set('page',     String(params.page));
  sp.set('per_page', String(params.per_page));
  if (params.search)        sp.set('search',        params.search);
  if (params.class_id)      sp.set('class_id',      params.class_id);
  if (params.subject_id)    sp.set('subject_id',    params.subject_id);
  if (params.chapter_id)    sp.set('chapter_id',    params.chapter_id);
  if (params.topic_id)      sp.set('topic_id',      params.topic_id);
  if (params.difficulty)    sp.set('difficulty',    params.difficulty);
  if (params.question_type) sp.set('question_type', params.question_type);
  if (params.source_type)   sp.set('source_type',   params.source_type);

  return apiFetch<{ data: any[]; total: number; page: number; per_page: number }>(
    `/api/admin/questions?${sp.toString()}`
  );
}

/* ── Single question create / update ─────────────────────────────────── */
export async function createQuestion(question: any) {
  return apiFetch<{ inserted: number }>('/api/admin/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: [question] }),
  });
}

export async function updateQuestion(id: string, question: any) {
  return apiFetch<{ data: any }>(`/api/admin/questions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(question),
  });
}

/* ── Single question delete ──────────────────────────────────────────────── */
export async function deleteQuestion(id: string) {
  return apiFetch<{ deleted: string }>(`/api/admin/questions/${id}`, { method: 'DELETE' });
}

/* ── Bulk delete ─────────────────────────────────────────────────────────── */
export async function bulkDeleteQuestions(ids: string[]) {
  return apiFetch<{ deleted: number }>('/api/admin/questions/bulk-delete', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ids }),
  });
}

/* ── Import (bulk insert) ───────────────────────────────────────────────── */
export async function importQuestions(rows: any[]) {
  return apiFetch<{ inserted: number }>('/api/admin/questions/import', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ questions: rows }),
  });
}

/* ── Export (fetch all for XLSX) ─────────────────────────────────────────── */
export async function exportQuestions(filters: QuestionFilters) {
  const sp = new URLSearchParams();
  if (filters.difficulty)    sp.set('difficulty',    filters.difficulty);
  if (filters.question_type) sp.set('question_type', filters.question_type);
  if (filters.source_type)   sp.set('source_type',   filters.source_type);
  if (filters.topic_id)      sp.set('topic_id',      filters.topic_id!);

  return apiFetch<{ data: any[] }>(`/api/admin/questions/export?${sp.toString()}`);
}