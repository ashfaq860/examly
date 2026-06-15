// src/app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('✅ API /api/profile was accessed');

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Fetch profile with retry
    let profile, profileError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      profile = result.data;
      profileError = result.error;
      if (!profileError) break;
      if (attempt < 3) {
        console.log(`Profile fetch attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    if (profileError) {
      console.error('Profile fetch error after retries:', profileError);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    // Fetch user packages with retry
    let userPackages, packagesError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await supabaseAdmin
        .from('user_packages')
        .select('*, packages(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      userPackages = result.data;
      packagesError = result.error;
      if (!packagesError) break;
      if (attempt < 3) {
        console.log(`Packages fetch attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    if (packagesError) {
      console.error('Packages fetch error after retries:', packagesError);
    }

    return NextResponse.json({
      profile,
      userPackages: userPackages || [],
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}