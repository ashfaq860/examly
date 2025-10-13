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

    // Fetch profile data using admin client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    // Fetch user packages
    const { data: userPackages, error: packagesError } = await supabaseAdmin
      .from('user_packages')
      .select('*, packages(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (packagesError) {
      console.error('Packages fetch error:', packagesError)
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