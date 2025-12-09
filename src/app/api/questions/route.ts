// examly/src/app/api/questions/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const subjectId = searchParams.get('subjectId');
    const classId = searchParams.get('classId');
    const questionType = searchParams.get('questionType');
    const difficulty = searchParams.get('difficulty');
    const chapterIds = searchParams.get('chapterIds');
    const sourceType = searchParams.get('source_type');
    const questionIds = searchParams.get('questionIds');
    const limit = parseInt(searchParams.get('limit') || '1000', 10);

    // Handle fetching by question IDs (for manual selection preview)
    if (questionIds) {
      const ids = questionIds.split(',').map((id) => id.trim()).filter(id => id);
      
      if (ids.length === 0) {
        return NextResponse.json([], { status: 200 });
      }

      // Fetch questions by IDs - don't filter by class_id since it's not in questions table
      let query = supabaseAdmin
        .from('questions')
        .select(`
          *,
          chapters (
            id,
            name,
            chapterNo,
            class_id,
            subject_id
          )
        `)
        .in('id', ids);

      const { data, error } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      return NextResponse.json(data || []);
    }

    // Original logic for filtering by criteria
    if (!subjectId || !questionType || !classId) {
      return NextResponse.json(
        { error: 'subjectId, classId and questionType are required when not using questionIds' },
        { status: 400 }
      );
    }

    // For normal filtering, we need to join with chapters to filter by class
    // Since Supabase doesn't support direct filtering on joined tables in the same way,
    // we need a different approach

    // Option 1: First get chapters for the class and subject, then get questions
    // Step 1: Get chapter IDs for the given class and subject
    const { data: chaptersData, error: chaptersError } = await supabaseAdmin
      .from('chapters')
      .select('id')
      .eq('subject_id', subjectId)
      .eq('class_id', classId);

    if (chaptersError) {
      console.error('Supabase chapters query error:', chaptersError);
      throw chaptersError;
    }

    const chapterIdArray = chaptersData?.map(chapter => chapter.id) || [];
    
    if (chapterIdArray.length === 0) {
      return NextResponse.json([]);
    }

    // Step 2: Get questions for these chapters
    let query = supabaseAdmin
      .from('questions')
      .select(`
        *,
        chapters (
          id,
          name,
          chapterNo,
          class_id,
          subject_id
        )
      `)
      .in('chapter_id', chapterIdArray)
      .eq('question_type', questionType)
      .limit(limit);

    // Apply additional filters
    if (difficulty && difficulty !== 'any') {
      query = query.eq('difficulty', difficulty);
    }

    // If specific chapterIds are provided, intersect with those
    if (chapterIds) {
      const specificChapterIds = chapterIds.split(',').map((id) => id.trim());
      if (specificChapterIds.length > 0) {
        // Filter to only include questions from both the class/subject chapters AND specific chapters
        const filteredChapterIds = chapterIdArray.filter(id => specificChapterIds.includes(id));
        if (filteredChapterIds.length > 0) {
          query = query.in('chapter_id', filteredChapterIds);
        } else {
          // No overlap, return empty array
          return NextResponse.json([]);
        }
      }
    }

    if (sourceType && sourceType !== 'all') {
      query = query.eq('source_type', sourceType);
    }

    const { data: questionsData, error: questionsError } = await query;

    if (questionsError) {
      console.error('Supabase questions query error:', questionsError);
      throw questionsError;
    }

    return NextResponse.json(questionsData || []);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}