// src/app/api/chapters/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get('subjectId');
  const classId = searchParams.get('classId'); // Add classId parameter

  if (!subjectId || !classId) {
    return NextResponse.json(
      { error: 'Subject ID and Class ID are required' },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('chapters')
      .select('*')
      .eq('subject_id', subjectId)
      .eq('class_id', classId) // Add class filter
      .order('chapterNo', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch chapters' },
      { status: 500 }
    );
  }
}