import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = await cookies();
  // 1. Identify the user using the standard client (Session check)
const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Fetch current count using Admin (to ensure we see the latest value)
    const { data: currentProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('papers_generated')
      .eq('id', session.user.id)
      .single();

    if (fetchError) throw fetchError;

    const newCount = (currentProfile?.papers_generated || 0) + 1;

    // 3. Update using Admin (Bypasses RLS perfectly)
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        papers_generated: newCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ 
      success: true, 
      profile: updatedProfile 
    });

  } catch (error: any) {
    console.error("Internal Increment Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}