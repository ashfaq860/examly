import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const cookieStore = await cookies(); 
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // 1. Check Authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("Received Paper Save Request:", body);
    // Extract everything sent from the frontend payload
    const { 
      paperId, 
      title, 
      class_name, 
      subject_name, 
      content, 
      settings,
      layout,
      language 
    } = body;

    // 2. Prepare Payload mapping to your specific table columns
    const payload = {
      title: title || "New Paper",
      class_name,
      subject_name,
      content,      // This is the paperSections array
      settings,     // This is the typography/UI settings object
      layout,       // 'separate' | 'combined'
      language,     // 'english' | 'urdu' | 'bilingual'
      created_by: session.user.id,
      updated_at: new Date().toISOString(),
    };

    let result;

    if (paperId) {
      // UPDATE existing paper
      result = await supabase
        .from('papers')
        .update(payload)
        .eq('id', paperId)
        .eq('created_by', session.user.id) // Security: Ensure user owns the paper
        .select()
        .single();
    } else {
      // INSERT new paper
      result = await supabase
        .from('papers')
        .insert([payload])
        .select()
        .single();
    }

    if (result.error) {
       console.error("Supabase Database Error:", result.error);
       return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ id: result.data.id });

  } catch (error: any) {
    console.error("Internal API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process request" }, 
      { status: 500 }
    );
  }
}