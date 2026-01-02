// server-side API route
'use server';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
export async function POST(req: Request) {
  try {
   // const supabase = createRouteHandlerClient({ cookies });
   const supabase = supabaseAdmin; 
   const body = await req.json();
    const { user } = body;

    if (!user?.id) return NextResponse.json({ error: 'Missing user info' }, { status: 400 });

    // Check if profile exists
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!profileData) {
      // Create profile if first-time login
      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.name ?? 'New User',
        role: 'teacher',
        login_method: 'google',
        trial_given: true,
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subscription_status: 'active',
      });

      if (insertError) {
        console.error('Profile creation failed:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // Get role via RPC
    const { data: roleData, error: rpcError } = await supabase.rpc('get_user_role', { user_id: user.id });

    if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });

    return NextResponse.json({ role: roleData });
  } catch (err: any) {
    console.error('API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
