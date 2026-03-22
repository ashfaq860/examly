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
    /**
     * OPTIMIZED QUERY:
     * We query 'class_subjects' but use the inner join syntax to 
     * pull the actual subject details in one go.
     */
    const { data, error } = await supabaseAdmin
      .from('class_subjects')
      .select(`
        id,
        subject:subjects (
          id,
          name,
          name_ur,
          description
        )
      `)
      .eq('class_id', classId);

    if (error) throw error;

    // Flatten the data so the frontend receives an array of subject objects
    // This removes the "subject" nesting created by the join
    const formattedSubjects = data
      ?.map((item: any) => item.subject)
      .filter(Boolean) || [];

    return NextResponse.json(formattedSubjects);
  } catch (error: any) {
    console.error('Error fetching subjects via join:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch subjects', details: error.message },
      { status: 500 }
    );
  }
}