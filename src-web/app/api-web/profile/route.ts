import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  console.log("✅ API /api/profile was accessed");

  try {
       // Get the user from the session using auth helpers - AWAIT cookies()
    const cookieStore = await cookies(); // Await the cookies function
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { data: { session } } = await supabase.auth.getSession()
    
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch profile data using admin client with retry
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
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }

    if (profileError) {
      console.error('Profile fetch error after retries:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
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
      console.error('Packages fetch error after retries:', packagesError)
      // We'll still return profile data even if packages fail
    }

    return NextResponse.json({
      profile,
      userPackages: userPackages || []
    })
  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}