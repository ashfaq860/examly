// src/app/api/auth/get-role/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    // getUser() validates JWT server-side — more reliable than getSession()
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, is_disabled')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[get-role] DB error:', profileError);
      return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 });
    }

    if (profile?.is_disabled) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: 'account_disabled' }, { status: 403 });
    }

    if (!profile) {
      const fallbackName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'User';

      const { data: newProfile, error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
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