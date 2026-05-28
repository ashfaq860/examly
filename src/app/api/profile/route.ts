import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';

export async function GET() {
  const auth = await getSessionFromRequest();
  if (auth.error) return auth.error;

  const userId = auth.session.user.id;

  try {
    // Run both queries in parallel — no sequential retry loops needed;
    // Supabase is reliable and retries add up to 6 s of latency on slow days.
    const [profileResult, packagesResult] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', userId).single(),
      supabaseAdmin
        .from('user_packages')
        .select('*, packages(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    if (profileResult.error) {
      console.error('Profile fetch error:', profileResult.error);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    return NextResponse.json({
      profile: profileResult.data,
      userPackages: packagesResult.data || [],
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
