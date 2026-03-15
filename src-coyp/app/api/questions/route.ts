// examly/src/app/api/questions/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    // --- 1. Extract and Clean Query Params ---
    const subjectId = searchParams.get('subjectId');
    const classId = searchParams.get('classId');
    const questionType = searchParams.get('questionType');
    const difficulty = searchParams.get('difficulty');
    const chapterIdsParam = searchParams.get('chapterIds');
    const questionIdsParam = searchParams.get('questionIds');
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const random = searchParams.get('random') === 'true';
    const randomSeed = searchParams.get('randomSeed');
    const ensureRandom = searchParams.get('ensureRandom') === 'true';

    // --- 2. Robust Source Type Extraction ---
    // This handles: source_type=book,past_paper OR source_type[]=book&source_type[]=past_paper
    let sourceTypes: string[] = [];
    const stRaw = searchParams.get('source_type');
    const stArray = searchParams.getAll('source_type[]');

    if (stRaw) {
      sourceTypes = stRaw.split(',').map(s => s.trim()).filter(Boolean);
    } else if (stArray.length > 0) {
      sourceTypes = stArray;
    }

    console.log('Final parsed sourceTypes:', sourceTypes);

    // --- 3. Handle Manual Selection (Fetching by IDs) ---
    if (questionIdsParam) {
      const ids = questionIdsParam.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length === 0) return NextResponse.json([]);

      const { data, error } = await supabaseAdmin
        .from('questions')
        .select(`
          *,
          chapters (id, name, chapterNo, class_id, subject_id)
        `)
        .in('id', ids);

      if (error) throw error;
      return NextResponse.json(data || []);
    }

    // --- 4. Validation ---
    if (!subjectId || !classId || !questionType) {
      return NextResponse.json(
        { error: 'subjectId, classId and questionType are required' },
        { status: 400 }
      );
    }

    // --- 5. Resolve Chapters ---
    const { data: chaptersData, error: chaptersError } = await supabaseAdmin
      .from('chapters')
      .select('id')
      .eq('subject_id', subjectId)
      .eq('class_id', classId);

    if (chaptersError) throw chaptersError;

    const dbChapterIds = chaptersData?.map(ch => ch.id) || [];
    if (dbChapterIds.length === 0) return NextResponse.json([]);

    // Intersect with user-selected chapters if provided
    let filteredChapterIds = dbChapterIds;
    if (chapterIdsParam) {
      const requestedIds = chapterIdsParam.split(',').map(id => id.trim());
      filteredChapterIds = dbChapterIds.filter(id => requestedIds.includes(id));
      if (filteredChapterIds.length === 0) return NextResponse.json([]);
    }

    // --- 6. Build and Execute Query ---
    let query = supabaseAdmin
      .from('questions')
      .select(`
        *,
        chapters (id, name, chapterNo, class_id, subject_id)
      `)
      .in('chapter_id', filteredChapterIds)
      .eq('question_type', questionType)
      .limit(limit);

    // Apply Filters
    if (difficulty && difficulty !== 'any') {
      query = query.eq('difficulty', difficulty);
    }

    // Fix: Only apply source filter if it's not 'all' and contains items
    if (sourceTypes.length > 0 && !sourceTypes.includes('all')) {
      query = query.in('source_type', sourceTypes);
    }

    // --- 7. Randomization & Fetch ---
    let questionsData: any[] = [];
    
    if (random) {
      // For true randomness with seed, we fetch all valid candidates first
      const { data: allQuestions, error: allQuestionsError } = await query;
      if (allQuestionsError) throw allQuestionsError;

      questionsData = allQuestions || [];

      // Seeded shuffle logic
      const seed = randomSeed ? parseInt(randomSeed) : Date.now();
      const seededRandom = (s: number) => {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
      };

      for (let i = questionsData.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(seed + i) * (i + 1));
        [questionsData[i], questionsData[j]] = [questionsData[j], questionsData[i]];
      }

      if (ensureRandom) {
        questionsData.sort(() => Math.random() - 0.5);
      }

      questionsData = questionsData.slice(0, limit);
    } else {
      // Standard fetch
      const { data, error } = await query.order('id', { ascending: true });
      if (error) throw error;
      questionsData = data || [];
    }

    return NextResponse.json(questionsData);

  } catch (error: any) {
    console.error('API Error:', error.message);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message }, 
      { status: 500 }
    );
  }
}