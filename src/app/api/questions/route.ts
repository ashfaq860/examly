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
    const limit = parseInt(searchParams.get('limit') || '1000', 10);

    if (!subjectId || !questionType || !classId) {
      return NextResponse.json(
        { error: 'subjectId, classId and questionType are required' },
        { status: 400 }
      );
    }

    // First approach: Use a direct join with the correct syntax
    let query = supabaseAdmin
      .from('questions')
      .select(`
        *,
        chapters (
          id,
          name,
          class_id,
          subject_id
        )
      `)
      .eq('subject_id', subjectId)
      .eq('question_type', questionType)
      .limit(limit);

    // Add class filter through the chapters relationship
    query = query.eq('chapters.class_id', classId);

    if (difficulty && difficulty !== 'any') {
      query = query.eq('difficulty', difficulty);
    }

    if (chapterIds) {
      const chapterIdArray = chapterIds.split(',').map((id) => id.trim());
      if (chapterIdArray.length > 0) {
        query = query.in('chapter_id', chapterIdArray);
      }
    }

    if (sourceType && sourceType !== 'all') {
      query = query.eq('source_type', sourceType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}