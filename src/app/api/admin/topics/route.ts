// app/api/topics/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get('classId');
  const subjectId = searchParams.get('subjectId');
  const chapterId = searchParams.get('chapterId');

  try {
    // Start building our query precisely matching your schema
    let query = supabaseAdmin
      .from('topics')
      .select(`
        id,
        name,
        chapter_id,
        chapters!inner (
          id,
          name,
          chapterNo,
          class_subjects!inner (
            id,
            class_id,
            subject_id,
            classes (id, name),
            subjects (id, name)
          )
        )
      `);

    // Server-side filtering using PostgREST !inner joins
    if (chapterId) {
      query = query.eq('chapter_id', chapterId);
    }
    if (classId) {
      query = query.eq('chapters.class_subjects.class_id', classId);
    }
    if (subjectId) {
      query = query.eq('chapters.class_subjects.subject_id', subjectId);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;

    // Flatten on the server side so the client gets a clean array
    const flattened = (data || []).map((t: any) => {
      const chapter = Array.isArray(t.chapters) ? t.chapters[0] : t.chapters;
      const classSubject = Array.isArray(chapter?.class_subjects) ? chapter.class_subjects[0] : chapter?.class_subjects;
      const classInfo = Array.isArray(classSubject?.classes) ? classSubject.classes[0] : classSubject?.classes;
      const subjectInfo = Array.isArray(classSubject?.subjects) ? classSubject.subjects[0] : classSubject?.subjects;

      return {
        id: t.id,
        name: t.name,
        chapter_id: t.chapter_id,
        chapter_name: chapter?.name,
        chapter_no: chapter?.chapterNo,
        class_id: classInfo?.id,
        class_name: classInfo?.name,
        subject_id: subjectInfo?.id,
        subject_name: subjectInfo?.name,
      };
    });

    return NextResponse.json(flattened);
  } catch (error: any) {
    console.error('API Topics Fetch Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch filtered topics', details: error.message },
      { status: 500 }
    );
  }
}