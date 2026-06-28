// app/api/chapter-rules/distribution/route.ts
//
// Originally queried subject_chapter_rules by exact chapter_id match.
// Since migration 005 merged everything into chapter_question_rules
// (range-based: chapter_start/chapter_end), this now:
//   1. Looks up the chapterNo for each requested chapterId
//   2. Fetches ALL rules for the subject (small table, fetch-then-filter
//      is simpler and fast enough than building a complex overlap OR
//      clause per chapter number)
//   3. Filters in JS to rules whose [chapter_start, chapter_end] range
//      contains at least one of the requested chapters' numbers
//
// Response shape is unchanged ({ rules, chapters, timestamp }) so any
// existing caller of this route doesn't need to change how it reads
// the response — only the matching logic underneath changed.

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { subjectId, chapterIds, questionTypes } = await request.json();

    if (!subjectId || !chapterIds || !chapterIds.length) {
      return NextResponse.json(
        { error: 'Subject ID and chapter IDs are required' },
        { status: 400 }
      );
    }

    // Get chapters info FIRST — we need chapterNo to match against rule ranges.
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, name, chapterNo')
      .in('id', chapterIds)
      .order('chapterNo');

    if (chaptersError) {
      console.error('Error fetching chapters:', chaptersError);
      return NextResponse.json(
        { error: 'Failed to fetch chapters' },
        { status: 500 }
      );
    }

    const chapterNumbers = (chapters || [])
      .map(c => Number(c.chapterNo))
      .filter(n => !Number.isNaN(n));

    // Fetch all rules for this subject (optionally narrowed by question
    // type if the caller asked for specific types — keeps the query small
    // without needing per-chapter-number OR clauses).
    let rulesQuery = supabase
      .from('chapter_question_rules')
      .select('*')
      .eq('subject_id', subjectId);

    if (Array.isArray(questionTypes) && questionTypes.length > 0) {
      rulesQuery = rulesQuery.in('question_type', questionTypes);
    }

    const { data: allRules, error: rulesError } = await rulesQuery;

    if (rulesError) {
      console.error('Error fetching rules:', rulesError);
      return NextResponse.json(
        { error: 'Failed to fetch rules' },
        { status: 500 }
      );
    }

    // Keep only rules whose range overlaps at least one requested chapter.
    const rules = (allRules || []).filter(rule =>
      chapterNumbers.some(n => n >= rule.chapter_start && n <= rule.chapter_end)
    );

    return NextResponse.json({
      rules,
      chapters: chapters || [],
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in distribution API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}