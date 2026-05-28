// api/auth/google-callback/route.ts
// This endpoint is only called from the server-side OAuth callback route
// (src/app/auth/callback/route.ts) which already has a verified session.
// We still verify the session here so this endpoint cannot be called
// with an arbitrary userId from an unauthenticated request.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  // Verify the caller has a valid session
  const auth = await getSessionFromRequest();
  if (auth.error) return auth.error;

  // Use the session userId — ignore any userId in the body
  const userId = auth.session.user.id;
  const { full_name, email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 });
  }

  try {
    // Check if profile already exists
    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Profile fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    if (existingProfile) {
      return NextResponse.json({ message: 'Profile already exists', role: existingProfile.role });
    }

    // Generate unique referral code
    const generateReferralCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    };

    let referralCode = generateReferralCode();
    for (let i = 0; i < 10; i++) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('referral_code', referralCode)
        .maybeSingle();
      if (!data) break;
      referralCode = generateReferralCode();
    }

    // Insert profile
    const { error: insertError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      full_name,
      email,
      role: 'teacher',
      login_method: 'google',
      referral_code: referralCode,
      allowed_papers: 0,
      papers_generated: 0,
      subscription_status: 'inactive',
      trial_given: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('Profile insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Profile created successfully', role: 'teacher', referral_code: referralCode });
  } catch (err) {
    console.error('Google callback server error:', err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
