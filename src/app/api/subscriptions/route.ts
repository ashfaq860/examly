import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';

// GET → return all available packages (public — no auth needed)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('packages')
      .select('*')
      .order('price', { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error('GET /api/subscriptions error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST → request subscription (session-authenticated; userId comes from session, not body)
export async function POST(req: NextRequest) {
  const auth = await getSessionFromRequest();
  if (auth.error) return auth.error;

  // Always use the authenticated user's own ID — never trust userId from the body
  const userId = auth.user.id;

  try {
    const { packageId } = await req.json();

    if (!packageId) {
      return NextResponse.json({ error: 'Missing packageId' }, { status: 400 });
    }

    // 1. Validate profile completion
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, cellno')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.full_name || !profile.cellno) {
      return NextResponse.json(
        { error: 'Please complete your profile and add your phone number before subscribing.' },
        { status: 400 }
      );
    }

    // 2. Ensure no active or pending subscription
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('user_packages')
      .select('id, is_active, expires_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (existingError) throw new Error(existingError.message);

    const hasPending = existing?.some(
      (sub) => sub.is_active || (sub.expires_at && new Date(sub.expires_at) > new Date())
    );

    if (hasPending) {
      return NextResponse.json(
        { error: 'You already have a pending or active subscription.' },
        { status: 400 }
      );
    }

    // 3. Insert new subscription request
    const { data, error } = await supabaseAdmin
      .from('user_packages')
      .insert([{ user_id: userId, package_id: packageId, is_active: false }])
      .select('*, packages(id, name)')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/subscriptions error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
