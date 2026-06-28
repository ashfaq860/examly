//api/questions/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const flattenQuestion = (q: any) => ({
  ...q,
  id: String(q.id),
  chapterNo: q.topics?.chapters?.chapterNo || 'N/A',
  chapterName: q.topics?.chapters?.name || 'N/A',
  topicName: q.topics?.name || 'General',
  source: q.source_type || 'book'
});

const fetchForSource = async (
  source: string,
  questionType: string,
  classId: string | null,
  subjectId: string | null,
  resolvedChapterIds: string[],
  requestedTopicIds: string[],
  language: string | null,
  difficulty: string | null,
  fetchLimit: number,
  categoryId: string | null,
): Promise<any[]> => {

  // --- PATH A: Topic-based ---
  if (requestedTopicIds.length > 0) {
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
      .eq('source_type', source)
      .in('topic_id', requestedTopicIds);

    if (classId)  q = q.eq('topics.chapters.class_subjects.class_id', classId);
    if (subjectId) q = q.eq('topics.chapters.class_subjects.subject_id', subjectId);
    if (categoryId) q = q.eq('question_category_id', categoryId);
    if (language === 'urdu') q = q.not('question_text_ur', 'is', null);
    if (difficulty && difficulty !== 'any') q = q.eq('difficulty', difficulty);

    const { data, error } = await q;
    if (error) { console.error(`[${source}] topic error:`, error.message); return []; }
    return [...(data || [])].sort(() => Math.random() - 0.5).slice(0, fetchLimit);
  }

  // --- PATH B: Chapter-based ---
  const chaptersToQuery = resolvedChapterIds.length > 0 ? resolvedChapterIds : [null];
  const fairSharePerChapter = Math.ceil(fetchLimit / chaptersToQuery.length);
  const perChapterFetchLimit = fairSharePerChapter * 3;

  const chapterBuckets = await Promise.all(
    chaptersToQuery.map(async (chapterId) => {
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
        .eq('source_type', source);

      if (classId)   q = q.eq('topics.chapters.class_subjects.class_id', classId);
      if (subjectId) q = q.eq('topics.chapters.class_subjects.subject_id', subjectId);
      if (chapterId) q = q.eq('topics.chapter_id', chapterId);
      if (categoryId) q = q.eq('question_category_id', categoryId);
      if (language === 'urdu') q = q.not('question_text_ur', 'is', null);
      if (difficulty && difficulty !== 'any') q = q.eq('difficulty', difficulty);

      q = q.limit(perChapterFetchLimit);

      const { data, error } = await q;
      if (error) { console.error(`[${source}][ch:${chapterId}] error:`, error.message); return []; }
      return data || [];
    })
  );

  const picked = chapterBuckets.flatMap(bucket =>
    [...bucket].sort(() => Math.random() - 0.5).slice(0, fairSharePerChapter)
  );

  return [...picked].sort(() => Math.random() - 0.5).slice(0, fetchLimit);
};

export async function GET(request: NextRequest) {
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
    // over-fetching across 5 sources for what's usually a narrow pool of
    // category-tagged questions (e.g. "Synonyms" bank for chapters 1-14).
    const TOTAL_TARGET = categoryId ? 150 : 500;
    const initialPerSource = Math.ceil(TOTAL_TARGET / sourcesToQuery.length);

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

    // 3. First pass — fetch initialPerSource from each source
    const firstPassResults: Record<string, any[]> = {};
    await Promise.all(
      sourcesToQuery.map(async (source) => {
        firstPassResults[source] = await fetchForSource(
          source, questionType, classId, subjectId,
          resolvedChapterIds, requestedTopicIds,
          language, difficulty, initialPerSource,
          categoryId
        );
      })
    );

    // 4. Redistribute quota from under-performing sources to others
    let totalFetched = Object.values(firstPassResults).reduce((sum, r) => sum + r.length, 0);
    let deficit = TOTAL_TARGET - totalFetched;

    if (deficit > 0) {
      const sourcesWithData = sourcesToQuery.filter(
        s => firstPassResults[s].length >= initialPerSource
      );

      if (sourcesWithData.length > 0) {
        const extraPerSource = Math.ceil(deficit / sourcesWithData.length);

        await Promise.all(
          sourcesWithData.map(async (source) => {
            const newLimit = initialPerSource + extraPerSource;
            firstPassResults[source] = await fetchForSource(
              source, questionType, classId, subjectId,
              resolvedChapterIds, requestedTopicIds,
              language, difficulty, newLimit, categoryId
            );
          })
        );
      }
    }

    // 5. Combine & shuffle
    const combined = Object.values(firstPassResults).flat();
    if (combined.length === 0) return NextResponse.json([]);

    const finalResult = [...combined].sort(() => Math.random() - 0.5);

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