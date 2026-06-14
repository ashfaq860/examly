// app/api/auth/get-role/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Required in Next.js 15 for route handlers that read cookies
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createSupabaseRouteHandlerClient();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;

    // maybeSingle() returns null (not an error) when no row is found
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[get-role] DB error:', profileError);
      return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 });
    }

    // No profile yet — create one with default role 'teacher'
    if (!profile) {
      const fallbackName =
        session.user.user_metadata?.full_name ||
        session.user.user_metadata?.name ||
        session.user.email?.split('@')[0] ||
        'User';

      const { data: newProfile, error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          email: session.user.email,
          full_name: fallbackName,
          role: 'teacher',
          login_method: 'email',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('role')
        .single();

      if (insertError || !newProfile) {
        console.error('[get-role] Insert error:', insertError);
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
      }

      return NextResponse.json({ role: newProfile.role });
    }

    return NextResponse.json({ role: profile.role });

  } catch (err) {
    console.error('[get-role] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}