import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Await the cookies function
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const classId = searchParams.get('classId');

    if (!subjectId) {
      return NextResponse.json(
        { error: 'Subject ID is required' },
        { status: 400 }
      );
    }

    
    // Build query
    let query = supabase
      .from('chapter_range_rules')
      .select('*')
      .eq('subject_id', subjectId);

    // Add class_id filter if provided
    if (classId) {
      query = query.or(`class_id.is.null,class_id.eq.${classId}`);
    }

    // Execute query
    const { data: rules, error } = await query
      .order('chapter_start', { ascending: true })
      .order('chapter_end', { ascending: true });

    if (error) {
      console.error('Error fetching rules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch rules' },
        { status: 500 }
      );
    }

    return NextResponse.json(rules || []);
  } catch (error: any) {
    console.error('Error in GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Await the cookies function
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const body = await request.json();

    const {
      subject_id,
      class_id,
      chapter_start,
      chapter_end,
      question_type,
      rule_mode,
      min_questions,
      max_questions
    } = body;

    // Validate required fields
    if (!subject_id || !chapter_start || !chapter_end || !question_type || !rule_mode || min_questions === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check for overlapping rules (consider class-specific and general rules)
    let query = supabase
      .from('chapter_range_rules')
      .select('*')
      .eq('subject_id', subject_id)
      .eq('question_type', question_type)
      .or(`and(chapter_start.lte.${chapter_end},chapter_end.gte.${chapter_start})`);

    // If class_id is provided, check for rules with same class_id or null class_id
    if (class_id) {
      query = query.or(`class_id.eq.${class_id},class_id.is.null`);
    } else {
      query = query.is('class_id', null);
    }

    const { data: existingRules, error: checkError } = await query;

    if (checkError) {
      console.error('Error checking existing rules:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing rules' },
        { status: 500 }
      );
    }

    if (existingRules && existingRules.length > 0) {
      return NextResponse.json(
        { error: 'Overlapping rule already exists for this question type and chapter range' },
        { status: 409 }
      );
    }

    // Insert new rule
    const { data, error } = await supabase
      .from('chapter_range_rules')
      .insert([{
        subject_id,
        class_id: class_id || null, // Store as null if not provided
        chapter_start,
        chapter_end,
        question_type,
        rule_mode,
        min_questions,
        max_questions
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating rule:', error);
      return NextResponse.json(
        { error: 'Failed to create rule' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Await the cookies function
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('id');
    const body = await request.json();

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const {
      subject_id,
      class_id,
      chapter_start,
      chapter_end,
      question_type,
      rule_mode,
      min_questions,
      max_questions
    } = body;

    // Check for overlapping rules (excluding current rule)
    let query = supabase
      .from('chapter_range_rules')
      .select('*')
      .eq('subject_id', subject_id)
      .eq('question_type', question_type)
      .not('id', 'eq', ruleId)
      .or(`and(chapter_start.lte.${chapter_end},chapter_end.gte.${chapter_start})`);

    // If class_id is provided, check for rules with same class_id or null class_id
    if (class_id) {
      query = query.or(`class_id.eq.${class_id},class_id.is.null`);
    } else {
      query = query.is('class_id', null);
    }

    const { data: existingRules, error: checkError } = await query;

    if (checkError) {
      console.error('Error checking existing rules:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing rules' },
        { status: 500 }
      );
    }

    if (existingRules && existingRules.length > 0) {
      return NextResponse.json(
        { error: 'Overlapping rule already exists for this question type and chapter range' },
        { status: 409 }
      );
    }

    // Update rule
    const { data, error } = await supabase
      .from('chapter_range_rules')
      .update({
        chapter_start,
        chapter_end,
        question_type,
        rule_mode,
        min_questions,
        max_questions,
        class_id: class_id || null, // Update class_id
        updated_at: new Date().toISOString()
      })
      .eq('id', ruleId)
      .select()
      .single();

    if (error) {
      console.error('Error updating rule:', error);
      return NextResponse.json(
        { error: 'Failed to update rule' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Await the cookies function
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('id');

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('chapter_range_rules')
      .delete()
      .eq('id', ruleId);

    if (error) {
      console.error('Error deleting rule:', error);
      return NextResponse.json(
        { error: 'Failed to delete rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}