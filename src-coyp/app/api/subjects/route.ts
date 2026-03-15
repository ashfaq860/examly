// src/app/api/subjects/route.ts
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
    const { data, error } = await supabase
      .from('class_subjects')
      .select('subject_id')
      .eq('class_id', classId);

    if (error) throw error;

    const subjectIds = data.map(item => item.subject_id);
    
    if (subjectIds.length === 0) {
      return NextResponse.json([]);
    }
    
    const { data: subjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('*')
      .in('id', subjectIds);

    if (subjectsError) throw subjectsError;

    return NextResponse.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subjects' },
      { status: 500 }
    );
  }
}