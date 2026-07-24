// src/app/api/profile/update/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';

async function getUser() {
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
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      console.error('Error fetching profile:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!existingProfile) {
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      return NextResponse.json(newProfile);
    }

    return NextResponse.json(existingProfile);
  } catch (error) {
    console.error('Unexpected server error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, institution, cellno } = body;

    if (cellno) {
      const cleanCellno = cellno.replace(/\D/g, '');
      if (!/^03\d{9}$/.test(cleanCellno)) {
        return NextResponse.json(
          { error: 'Phone number must be 11 digits starting with 03' },
          { status: 400 }
        );
      }

      const { data: existingProfile, error: checkError } = await supabaseAdmin
        .from('profiles')
        .select('id, cellno')
        .eq('cellno', cleanCellno)
        .neq('id', user.id)
        .maybeSingle();

      if (checkError) {
        return NextResponse.json(
          { error: 'Error checking phone number availability' },
          { status: 500 }
        );
      }

      if (existingProfile) {
        return NextResponse.json(
          { error: 'Phone number already registered with another account' },
          { status: 400 }
        );
      }
    }

    // cellno is set-once (enforced by the protect_profile_columns trigger
    // for non-service-role writes, but even here — a service-role write —
    // it must never be omitted-means-clear: a form submission that simply
    // doesn't resend cellno (e.g. a disabled field once already set) must
    // leave the existing value alone, not null it out.
    const updatePayload: Record<string, unknown> = {
      full_name,
      institution,
      address: body.address || null,
      updated_at: new Date().toISOString(),
    };
    if (cellno) {
      updatePayload.cellno = cellno.replace(/\D/g, '');
    }

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      if (updateError.code === '23505' && updateError.details?.includes('cellno')) {
        return NextResponse.json(
          { error: 'Phone number already registered with another account' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error('Unexpected server error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}