// src/app/api/profile/mark-password-set/route.ts
// Called once, right after a Google-only account successfully sets its
// first password (dashboard/settings's "Create a Password" flow). Flips
// profiles.login_method from 'google' to 'email' so the settings page
// switches to the normal "Change Password" (current-password-required)
// flow on the next visit — the password itself is set directly against
// Supabase Auth via the browser client (supabase.auth.updateUser), not
// here; this route only updates our own denormalized signal for which UI
// to show.
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';

export async function POST() {
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

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ login_method: 'email', updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
