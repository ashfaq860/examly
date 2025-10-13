// src/app/api/subjects/route.ts
import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
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
    const { data, error } = await supabaseAdmin
      .from('class_subjects')
      .select('subject_id')
      .eq('class_id', classId);

    if (error) throw error;

    const subjectIds = data.map(item => item.subject_id);
    const { data: subjects, error: subjectsError } = await supabaseAdmin
      .from('subjects')
      .select('*')
      .in('id', subjectIds);

    if (subjectsError) throw subjectsError;

    return NextResponse.json(subjects);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch subjects' },
      { status: 500 }
    );
  }
}