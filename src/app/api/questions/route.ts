//api/questions/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { buildPoolCacheKey, getCachedPool, setCachedPool } from '@/lib/questionPoolCache';

const flattenQuestion = (q: any) => ({
  ...q,
  id: String(q.id),
  chapterNo: q.topics?.chapters?.chapterNo || 'N/A',
  chapterName: q.topics?.chapters?.name || 'N/A',
  topicName: q.topics?.name || 'General',
  // source_type is a text[] — a question can carry more than one source tag
  // (e.g. it's in the book AND a past paper). `source` stays a single
  // display string for any consumer expecting one.
  source: Array.isArray(q.source_type) && q.source_type.length > 0
    ? q.source_type.join(', ')
    : (q.source_type || 'book')
});

// Same sampling `fetchForSource` used to do per chapter via a dedicated
// query: shuffle within each chapter bucket, take a fair share from each,
// combine, shuffle again, slice to targetCount. `numChapterBuckets === 1`
// (topic-based lookups have no chapter subdivision) degrades this to a
// plain shuffle-and-slice over the whole set, matching the old PATH A.
function pickFairShareByChapter(rows: any[], numChapterBuckets: number, targetCount: number): any[] {
  if (numChapterBuckets <= 1) {
    return [...rows].sort(() => Math.random() - 0.5).slice(0, targetCount);
  }
  const fairSharePerChapter = Math.ceil(targetCount / numChapterBuckets);
  const byChapter = new Map<string, any[]>();
  for (const row of rows) {
    const key = row.topics?.chapter_id ?? 'null';
    const bucket = byChapter.get(key);
    if (bucket) bucket.push(row); else byChapter.set(key, [row]);
  }
  const picked = Array.from(byChapter.values()).flatMap(bucket =>
    [...bucket].sort(() => Math.random() - 0.5).slice(0, fairSharePerChapter)
  );
  return [...picked].sort(() => Math.random() - 0.5).slice(0, targetCount);
}

// Reconstructs the same two-phase per-source quota algorithm the route used
// to run as up to 10 sequential network round trips (5 sources x 2 passes),
// now computed in memory against one already-fetched pool: every source
// gets an initial fair share (itself chapter-fair-shared), then any deficit
// against totalTarget is backfilled from sources that had surplus rows.
//
// source_type is a text[] — a row can be tagged with more than one source
// (e.g. in the book AND a past paper), so a plain Map<sourceName, rows[]>
// partition no longer works (a row can't live in two disjoint buckets at
// once). Instead each source draws from a shared pool filtered to "rows
// tagged with this source that no other source has already claimed" — a
// row is eligible under any of its tags but is only ever picked once,
// tracked via `used`. Source processing order is randomized per call so
// repeated generations don't always let the same source have first pick of
// shared rows.
function distributeAcrossSourcesAndChapters(
  rows: any[],
  sourcesToQuery: string[],
  numChapterBuckets: number,
  totalTarget: number,
): any[] {
  const used = new Set<string>();
  const poolFor = (source: string) =>
    rows.filter(r => !used.has(String(r.id)) && Array.isArray(r.source_type) && r.source_type.includes(source));

  const initialPerSource = Math.ceil(totalTarget / sourcesToQuery.length);
  const orderedSources = [...sourcesToQuery].sort(() => Math.random() - 0.5);
  const picked = new Map<string, any[]>();

  for (const source of orderedSources) {
    const selected = pickFairShareByChapter(poolFor(source), numChapterBuckets, initialPerSource);
    selected.forEach(r => used.add(String(r.id)));
    picked.set(source, selected);
  }

  // Backfill any deficit against totalTarget, repeatedly — a SINGLE pass
  // silently under-delivered whenever a "surplus" source (one that already
  // hit its initial quota) is itself capped below the grown quota by
  // pickFairShareByChapter's per-chapter ceiling. Concretely: a source
  // whose rows only exist in 2 of N chapter buckets can never contribute
  // more than 2 x its per-chapter cap, no matter how high newLimit goes —
  // one pass asked it to grow, it silently couldn't, and the stranded
  // deficit was never handed to a DIFFERENT source that actually had rows
  // in every chapter and could have covered it. Looping re-checks the
  // real deficit after each attempt and keeps redistributing it among
  // whichever sources still have room to grow, stopping only once the
  // target is met or a full round produces no growth anywhere (a genuine
  // data shortage, not an algorithm shortfall). Bounded by
  // sourcesToQuery.length rounds — each round either closes the gap or
  // proves nothing can grow further, so it can't run meaningfully longer.
  for (let round = 0; round < sourcesToQuery.length; round++) {
    const totalFetched = Array.from(picked.values()).reduce((sum, r) => sum + r.length, 0);
    const deficit = totalTarget - totalFetched;
    if (deficit <= 0) break;

    const sourcesWithSurplus = orderedSources.filter(
      s => (picked.get(s)?.length || 0) >= initialPerSource
    );
    if (sourcesWithSurplus.length === 0) break;

    const extraPerSource = Math.ceil(deficit / sourcesWithSurplus.length);
    let anyGrew = false;
    for (const source of sourcesWithSurplus) {
      // Release this source's own prior picks back into its pool before
      // re-selecting at the larger target, so they're still eligible
      // alongside anything freed up by other sources not needing them.
      const prior = picked.get(source) || [];
      const newLimit = prior.length + extraPerSource;
      prior.forEach(r => used.delete(String(r.id)));
      const reselected = pickFairShareByChapter(poolFor(source), numChapterBuckets, newLimit);
      if (reselected.length > prior.length) anyGrew = true;
      reselected.forEach(r => used.add(String(r.id)));
      picked.set(source, reselected);
    }
    if (!anyGrew) break; // no source could grow this round — remaining deficit is a genuine data shortage
  }

  const combined = Array.from(picked.values()).flat();
  // A round can overshoot totalTarget when multiple sources grow in the
  // same pass — trim back down (shuffled first, so no source is
  // systematically favored by the trim).
  return combined.length > totalTarget
    ? [...combined].sort(() => Math.random() - 0.5).slice(0, totalTarget)
    : combined;
}

// Flat cap for the raw pool fetch, independent of any one caller's
// totalTarget — this is what gets cached, so it's sized for the largest
// realistic ask (the manual browser's default 500) rather than the
// smallest (a single board-pattern rule wanting 3 questions), so every
// caller's distribution step below has enough rows to work with regardless
// of which one happened to trigger the cache fill.
const POOL_FETCH_LIMIT = 1500;

// One round trip for the WHOLE rule — every source and every chapter in
// range at once — instead of a query per source (and, before that, a query
// per chapter per source). Cached by filter signature (see
// questionPoolCache) since paper generation re-requests the same
// subject/class/chapter/type/source combo repeatedly (regenerate, multiple
// rules sharing a subject) — only the DB round trip is cached; the
// fairness distribution below still runs fresh on every call.
const fetchRawPool = async (
  sourcesToQuery: string[],
  questionType: string,
  classId: string | null,
  subjectId: string | null,
  resolvedChapterIds: string[],
  requestedTopicIds: string[],
  language: string | null,
  difficulty: string | null,
  categoryId: string | null,
): Promise<any[]> => {
  const cacheKey = buildPoolCacheKey({
    questionType, sources: sourcesToQuery, classId, subjectId,
    chapterIds: resolvedChapterIds, topicIds: requestedTopicIds,
    categoryId, language, difficulty,
  });
  const cached = getCachedPool(cacheKey);
  if (cached) return cached;

  const isTopicBased = requestedTopicIds.length > 0;

  let q = supabaseAdmin
    .from('questions')
    .select(`
      *,
      topics!inner (
        id, name, chapter_id,
        chapters!inner (
          id, name, "chapterNo",
          class_subjects!inner ( class_id, subject_id )
        )
      )
    `)
    .eq('question_type', questionType)
    .overlaps('source_type', sourcesToQuery);

  if (isTopicBased) {
    q = q.in('topic_id', requestedTopicIds);
  } else if (resolvedChapterIds.length > 0) {
    q = q.in('topics.chapter_id', resolvedChapterIds);
  }

  if (classId)   q = q.eq('topics.chapters.class_subjects.class_id', classId);
  if (subjectId) q = q.eq('topics.chapters.class_subjects.subject_id', subjectId);
  if (categoryId) q = q.eq('question_category_id', categoryId);
  if (language === 'urdu') q = q.not('question_text_ur', 'is', null);
  if (difficulty && difficulty !== 'any') q = q.eq('difficulty', difficulty);

  q = q.limit(POOL_FETCH_LIMIT);

  const { data, error } = await q;
  if (error) { console.error('questions pool error:', error.message); return []; }

  const rows = data || [];
  setCachedPool(cacheKey, rows);
  return rows;
};

const fetchQuestionPool = async (
  sourcesToQuery: string[],
  questionType: string,
  classId: string | null,
  subjectId: string | null,
  resolvedChapterIds: string[],
  requestedTopicIds: string[],
  language: string | null,
  difficulty: string | null,
  categoryId: string | null,
  totalTarget: number,
): Promise<any[]> => {
  const numChapterBuckets = requestedTopicIds.length > 0
    ? 1
    : (resolvedChapterIds.length > 0 ? resolvedChapterIds.length : 1);

  const rows = await fetchRawPool(
    sourcesToQuery, questionType, classId, subjectId,
    resolvedChapterIds, requestedTopicIds, language, difficulty, categoryId,
  );

  return distributeAcrossSourcesAndChapters(rows, sourcesToQuery, numChapterBuckets, totalTarget);
};

export async function GET(request: NextRequest) {
  const auth = await getSessionFromRequest();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);

  try {
    const subjectId       = searchParams.get('subjectId');
    const classId         = searchParams.get('classId');
    const questionType    = searchParams.get('questionType');
    const difficulty      = searchParams.get('difficulty');
    const chapterIdsParam = searchParams.get('chapterIds');
    const topicIdsParam   = searchParams.get('topicIds');
    const questionIdsParam = searchParams.get('questionIds');
    const language        = searchParams.get('language');
    const sourceTypeParam = searchParams.get('source_type');
    const categoryId      = searchParams.get('categoryId');
    const limitParam      = searchParams.get('limit');
    const requestedLimit  = limitParam ? parseInt(limitParam, 10) : null;

    // --- CASE A: Fetch by specific IDs ---
    if (questionIdsParam) {
      const ids = questionIdsParam.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length === 0) return NextResponse.json([]);

      const { data, error } = await supabaseAdmin
        .from('questions')
        .select(`
          *,
          topics (
            id, name,
            chapters ( id, name, "chapterNo" )
          )
        `)
        .in('id', ids);

      if (error) throw error;
      return NextResponse.json((data || []).map(flattenQuestion));
    }

    // --- CASE B: Filtered Browse ---
    if (!questionType) {
      return NextResponse.json({ error: 'questionType is required' }, { status: 400 });
    }

    // 1. Resolve sources
    const allSources = ['book', 'model_paper', 'past_paper', 'custom', 'conceptual'];
    const isAll = !sourceTypeParam || sourceTypeParam === 'all';
    const sourcesToQuery: string[] = isAll
      ? allSources
      : sourceTypeParam.split(',').map(s => s.trim()).filter(Boolean);

    // When filtering by a specific category, a smaller, tighter target avoids
    // over-fetching for what's usually a narrow pool of category-tagged
    // questions (e.g. "Synonyms" bank for chapters 1-14).
    // Callers that know how many questions they actually need (paper
    // generation) pass `limit` — honor it instead of always pulling the
    // full 500/150-row browse target just to slice it down client-side.
    // Callers that omit it (the manual question browser) keep the wide
    // default pool unchanged.
    const TOTAL_TARGET = requestedLimit && requestedLimit > 0
      ? requestedLimit
      : (categoryId ? 150 : 500);

    // 2. Resolve chapters & topics
    const requestedTopicIds: string[] = topicIdsParam
      ? topicIdsParam.split(',').map(id => id.trim()).filter(Boolean)
      : [];

    const requestedChapterIds: string[] = chapterIdsParam
      ? chapterIdsParam.split(',').map(id => id.trim()).filter(Boolean)
      : [];

    let resolvedChapterIds: string[] = requestedChapterIds;
    if (requestedChapterIds.length === 0 && requestedTopicIds.length === 0 && classId && subjectId) {
      const { data: csData } = await supabaseAdmin
        .from('class_subjects')
        .select('id')
        .eq('class_id', classId)
        .eq('subject_id', subjectId)
        .single();

      if (csData) {
        const { data: chapData } = await supabaseAdmin
          .from('chapters')
          .select('id')
          .eq('class_subject_id', csData.id);

        resolvedChapterIds = chapData?.map(c => c.id) || [];
      }
    }

    // 3. One round trip for every source + every chapter in range, then
    // reconstruct source/chapter fairness in memory (see fetchQuestionPool).
    const picked = await fetchQuestionPool(
      sourcesToQuery, questionType, classId, subjectId,
      resolvedChapterIds, requestedTopicIds,
      language, difficulty, categoryId, TOTAL_TARGET
    );

    if (picked.length === 0) return NextResponse.json([]);

    // 4. Final shuffle
    const finalResult = [...picked].sort(() => Math.random() - 0.5);

    return NextResponse.json(finalResult.map(flattenQuestion));

  } catch (error: any) {
    console.error('DATABASE ERROR:', error.message, error.details);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message,
        hint: 'Check table names and relationship joins match your schema'
      },
      { status: 500 }
    );
  }
}
