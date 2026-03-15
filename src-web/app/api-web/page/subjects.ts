import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get('classId');

  if (!classId) {
    return NextResponse.json(
      { error: 'Class ID is required' },
      { status: 400 }
    );
  }

  try {
    // First get class_subjects for the class
    const { data: classSubjects, error: classSubjectsError } = await supabase
      .from('class_subjects')
      .select('subject_id')
      .eq('class_id', classId);

    if (classSubjectsError) throw classSubjectsError;

    const subjectIds = classSubjects.map(cs => cs.subject_id);

    // Then get the subjects
    const { data: subjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('*')
      .in('id', subjectIds)
      .order('name', { ascending: true });

    if (subjectsError) throw subjectsError;

    return NextResponse.json(subjects);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch subjects' },
      { status: 500 }
    );
  }
}