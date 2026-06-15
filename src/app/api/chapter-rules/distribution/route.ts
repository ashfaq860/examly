// app/api/chapter-rules/distribution/route.ts

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
    
    // Fetch rules
    const { data: rules, error } = await supabase
      .from('subject_chapter_rules')
      .select('*')
      .eq('subject_id', subjectId)
      .in('chapter_id', chapterIds);
    
    if (error) {
      console.error('Error fetching rules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch rules' },
        { status: 500 }
      );
    }
    
    // Get chapters info
    const { data: chapters } = await supabase
      .from('chapters')
      .select('id, name, chapterNo')
      .in('id', chapterIds)
      .order('chapterNo');
    
    return NextResponse.json({
      rules: rules || [],
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