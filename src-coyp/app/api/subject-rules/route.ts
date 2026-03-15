// src/app/api/subject-rules/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const classSubjectId = searchParams.get('classSubjectId');
    
    console.log('Fetching rules for subject:', subjectId);
    
    if (!subjectId) {
      return NextResponse.json(
        { error: 'Subject ID is required' },
        { status: 400 }
      );
    }
    
    // First, get the basic rules
    let query = supabase
      .from('subject_chapter_rules')
      .select('*')
      .eq('subject_id', subjectId);
    
    if (classSubjectId) {
      query = query.eq('class_subject_id', classSubjectId);
    }
    
    const { data: rules, error: rulesError } = await query;
    
    if (rulesError) {
      console.error('Error fetching rules:', rulesError);
      return NextResponse.json(
        { error: 'Failed to fetch rules', details: rulesError.message },
        { status: 500 }
      );
    }
    
    // If no rules found, return empty array
    if (!rules || rules.length === 0) {
      return NextResponse.json([]);
    }
    
    // Enrich rules with chapter and subject details
    const enrichedRules = await Promise.all(
      rules.map(async (rule) => {
        // Fetch chapter details
        const { data: chapterData } = await supabase
          .from('chapters')
          .select('id, name, chapterNo')
          .eq('id', rule.chapter_id)
          .single();
        
        // Fetch subject details
        const { data: subjectData } = await supabase
          .from('subjects')
          .select('id, name')
          .eq('id', rule.subject_id)
          .single();
        
        // Fetch class_subject details if available
        let classSubjectData = null;
        if (rule.class_subject_id) {
          const { data: csData } = await supabase
            .from('class_subjects')
            .select('id, class_id, subject_id')
            .eq('id', rule.class_subject_id)
            .single();
          classSubjectData = csData;
        }
        
        return {
          ...rule,
          chapters: chapterData,
          subjects: subjectData,
          class_subjects: classSubjectData
        };
      })
    );
    
    // Sort by chapter number
    enrichedRules.sort((a: any, b: any) => {
      const chapterA = a.chapters?.chapterNo || 0;
      const chapterB = b.chapters?.chapterNo || 0;
      return chapterA - chapterB;
    });
    
    return NextResponse.json(enrichedRules);
    
  } catch (error: any) {
    console.error('Uncaught error in subject-rules API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// Update the POST method too
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    console.log('POST request body:', body);
    
    // Validate required fields
    if (!body.subject_id || !body.chapter_id) {
      return NextResponse.json(
        { error: 'Subject ID and Chapter ID are required' },
        { status: 400 }
      );
    }
    
    // Prepare data for insertion - only include fields that exist in the table
    const ruleData: any = {
      subject_id: body.subject_id,
      chapter_id: body.chapter_id,
      class_subject_id: body.class_subject_id || null,
      created_by: session.user.id,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    // Add all the rule fields with proper 0/null handling
    const ruleFields = [
      'mcq_min', 'mcq_max', 'short_min', 'short_max', 'long_min', 'long_max',
      'translate_urdu_min', 'translate_urdu_max', 'translate_english_min', 'translate_english_max',
      'idiom_phrases_min', 'idiom_phrases_max', 'passage_min', 'passage_max',
      'poetry_explanation_min', 'poetry_explanation_max', 'prose_explanation_min', 'prose_explanation_max',
      'sentence_correction_min', 'sentence_correction_max', 'sentence_completion_min', 'sentence_completion_max',
      'directindirect_min', 'directindirect_max', 'activepassive_min', 'activepassive_max',
      'darkhwast_khat_min', 'darkhwast_khat_max', 'kahani_makalma_min', 'kahani_makalma_max',
      'nasarkhulasa_markzikhyal_min', 'nasarkhulasa_markzikhyal_max'
    ];
    
    ruleFields.forEach(field => {
      const value = body[field];
      if (value !== undefined) {
        if (value === '' || value === null) {
          ruleData[field] = null;
        } else {
          ruleData[field] = isNaN(Number(value)) ? value : Number(value);
        }
      } else {
        // Set default values for min fields
        if (field.endsWith('_min')) {
          ruleData[field] = 0;
        } else {
          ruleData[field] = null;
        }
      }
    });
    
    // Validate at least one minimum count is set
    const hasRule = ruleFields
      .filter(field => field.endsWith('_min'))
      .some(field => (ruleData[field] || 0) > 0);
    
    if (!hasRule) {
      return NextResponse.json(
        { error: 'At least one question type must have a minimum count greater than 0' },
        { status: 400 }
      );
    }
    
    console.log('Inserting rule data:', ruleData);
    
    const { data, error } = await supabase
      .from('subject_chapter_rules')
      .insert([ruleData])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating rule:', error);
      
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A rule already exists for this subject and chapter combination' },
          { status: 400 }
        );
      } else if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Invalid subject_id or chapter_id. Please check your selections.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to create rule: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in subject-rules API:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// src/app/api/subject-rules/route.ts - UPDATE the PUT method

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    console.log('PUT request body:', body);
    
    if (!body.id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }
    
    // Prepare update data - only include fields that exist in the table
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    // Add all the rule fields that might be updated
    const updatableFields = [
      'mcq_min', 'mcq_max', 'short_min', 'short_max', 'long_min', 'long_max',
      'translate_urdu_min', 'translate_urdu_max', 'translate_english_min', 'translate_english_max',
      'idiom_phrases_min', 'idiom_phrases_max', 'passage_min', 'passage_max',
      'poetry_explanation_min', 'poetry_explanation_max', 'prose_explanation_min', 'prose_explanation_max',
      'sentence_correction_min', 'sentence_correction_max', 'sentence_completion_min', 'sentence_completion_max',
      'directindirect_min', 'directindirect_max', 'activepassive_min', 'activepassive_max',
      'darkhwast_khat_min', 'darkhwast_khat_max', 'kahani_makalma_min', 'kahani_makalma_max',
      'nasarkhulasa_markzikhyal_min', 'nasarkhulasa_markzikhyal_max',
      'class_subject_id'
    ];
    
    // Handle fields properly - preserve 0 values, convert empty strings to null
    updatableFields.forEach(field => {
      if (field in body) {
        const value = body[field];
        // Check if value is explicitly provided (not undefined)
        if (value !== undefined) {
          // For numeric fields, preserve 0, convert null/empty string to null
          if (value === '' || value === null) {
            updateData[field] = null;
          } else {
            // Convert to number if it's a string number
            updateData[field] = isNaN(Number(value)) ? value : Number(value);
          }
        }
      }
    });
    
    // Ensure at least one minimum field has a value > 0 (validation)
    const hasMinValue = updatableFields
      .filter(field => field.endsWith('_min'))
      .some(field => (updateData[field] || 0) > 0);
    
    if (!hasMinValue) {
      return NextResponse.json(
        { error: 'At least one question type must have a minimum count greater than 0' },
        { status: 400 }
      );
    }
    
    console.log('Updating rule with data:', updateData);
    
    const { data, error } = await supabase
      .from('subject_chapter_rules')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating rule:', error);
      console.error('Error details:', error);
      
      return NextResponse.json({ 
        error: 'Failed to update rule',
        details: error.message,
        code: error.code
      }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in subject-rules API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }
    
    const { error } = await supabase
      .from('subject_chapter_rules')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting rule:', error);
      return NextResponse.json({ 
        error: 'Failed to delete rule',
        details: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ message: 'Rule deleted successfully' });
  } catch (error: any) {
    console.error('Error in subject-rules API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}