// api/chapters/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get('subjectId');
  const classId = searchParams.get('classId');

  if (!subjectId || !classId) {
    return NextResponse.json(
      { error: 'Subject ID and Class ID are required' },
      { status: 400 }
    );
  }

  try {
    const { data: classSubject, error: joinError } = await supabaseAdmin
      .from('class_subjects')
      .select('id')
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .single();

    if (joinError || !classSubject) return NextResponse.json([], { status: 200 });

    // UPDATE: Select topics alongside chapters
    const { data, error } = await supabaseAdmin
      .from('chapters')
      .select(`
        id, 
        name, 
        chapterNo, 
        class_subject_id,
        topics (
          id,
          name
        )
      `)
      .eq('class_subject_id', classSubject.id)
      .order('chapterNo', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Chapters Fetch Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch chapters', details: error.message },
      { status: 500 }
    );
  }
}