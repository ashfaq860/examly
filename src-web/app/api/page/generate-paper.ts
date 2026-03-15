import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      subjectId,
      chapterOption,
      selectedChapters = [],
      mcqCount,
      mcqDifficulty,
      userId,
    } = body;

    // First create the paper record
    const { data: paper, error: paperError } = await supabase
      .from('papers')
      .insert({
        title,
        subject_id: subjectId,
        paper_type: 'custom',
        created_by: userId,
        chapter_ids: chapterOption === 'custom' ? selectedChapters : null,
      })
      .select()
      .single();

    if (paperError) throw paperError;

    // Determine which chapters to include
    let chapterIds: string[] = [];
    if (chapterOption === 'full_book') {
      const { data: chapters, error: chaptersError } = await supabase
        .from('chapters')
        .select('id')
        .eq('subject_id', subjectId);

      if (chaptersError) throw chaptersError;
      chapterIds = chapters.map(c => c.id);
    } else if (chapterOption === 'custom') {
      chapterIds = selectedChapters;
    }

    // Fetch questions based on criteria
    const questionsToAdd = [];

    // Fetch MCQs
    if (mcqCount > 0) {
      let query = supabase
        .from('questions')
        .select('id')
        .eq('question_type', 'mcq')
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false })
        .limit(mcqCount);

      if (chapterIds.length > 0) {
        query = query.in('chapter_id', chapterIds);
      }
      if (mcqDifficulty !== 'any') {
        query = query.eq('difficulty', mcqDifficulty);
      }

      const { data: mcqs, error: mcqsError } = await query;

      if (mcqsError) throw mcqsError;

      questionsToAdd.push(
        ...mcqs.map((q, i) => ({
          paper_id: paper.id,
          question_id: q.id,
          order_number: i + 1,
        }))
      );
    }

    // Insert paper_questions (batch insert)
    if (questionsToAdd.length > 0) {
      const { error: insertError } = await supabase
        .from('paper_questions')
        .insert(questionsToAdd);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ paperId: paper.id });
  } catch (error) {
    console.error('Error generating paper:', error);
    return NextResponse.json(
      { error: 'Failed to generate paper' },
      { status: 500 }
    );
  }
}