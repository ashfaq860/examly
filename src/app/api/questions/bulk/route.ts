import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
const supabase = supabaseAdmin;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      subjectId,
      classId,
      chapterIds,
      requirements,
      language,
      includeUrdu = false,
      sourceType = 'all',
      random = false,
      limits = { mcq: 50, short: 50, long: 20 }
    } = body;

    if (!subjectId || !classId || !chapterIds || !Array.isArray(chapterIds)) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Build the base query
    let query = supabase
      .from('questions')
      .select('*')
      .eq('subject_id', subjectId)
      .eq('class_id', classId)
      .in('chapter_id', chapterIds);

    // Add source type filter if specified
    if (sourceType !== 'all') {
      query = query.eq('source_type', sourceType);
    }

    // Fetch questions for each type
    const fetchQuestionsByType = async (questionType: string, limit: number) => {
      if (limit <= 0) return [];

      try {
        let typeQuery = query.eq('question_type', questionType);
        
        // Add random ordering if requested
        if (random) {
          typeQuery = typeQuery.order('id'); // You might want to use a random seed instead
        } else {
          typeQuery = typeQuery.order('created_at', { ascending: false });
        }

        const { data, error } = await typeQuery.limit(limit);

        if (error) {
          console.error(`Error fetching ${questionType} questions:`, error);
          return [];
        }

        return data || [];
      } catch (error) {
        console.error(`Error in ${questionType} query:`, error);
        return [];
      }
    };

    // Fetch all question types in parallel
    const [mcqQuestions, shortQuestions, longQuestions] = await Promise.all([
      fetchQuestionsByType('mcq', limits.mcq || 50),
      fetchQuestionsByType('short', limits.short || 50),
      fetchQuestionsByType('long', limits.long || 20)
    ]);

    // Apply requirements filtering if provided
    let finalMcq = mcqQuestions;
    let finalShort = shortQuestions;
    let finalLong = longQuestions;

    if (requirements) {
      finalMcq = mcqQuestions.slice(0, requirements.mcq || mcqQuestions.length);
      finalShort = shortQuestions.slice(0, requirements.short || shortQuestions.length);
      finalLong = longQuestions.slice(0, requirements.long || longQuestions.length);
    }

    // Apply random shuffling if requested
    if (random) {
      const shuffleArray = (array: any[]) => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      };

      finalMcq = shuffleArray(finalMcq);
      finalShort = shuffleArray(finalShort);
      finalLong = shuffleArray(finalLong);
    }

    return NextResponse.json({
      mcq: finalMcq,
      short: finalShort,
      long: finalLong,
      metadata: {
        totalFetched: {
          mcq: finalMcq.length,
          short: finalShort.length,
          long: finalLong.length
        },
        requested: requirements
      }
    });

  } catch (error) {
    console.error('Error in bulk questions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}