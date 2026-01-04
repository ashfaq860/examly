import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Generate unique 8-char referral code
const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export async function POST(req: NextRequest) {
  try {
    const { userId, full_name, email } = await req.json();

    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing userId or email' }, { status: 400 });
    }

    // Check if profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    // If profile exists, nothing to do
    if (existingProfile?.id) {
      return NextResponse.json({ message: 'Profile already exists' });
    }

    // Generate unique referral code
    let referralCode = generateReferralCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: codeExists } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('referral_code', referralCode)
        .maybeSingle();

      if (!codeExists) break;
      referralCode = generateReferralCode();
      attempts++;
    }

    // Insert profile
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
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

    if (profileError) {
      console.error('Profile insert error:', profileError);
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Profile created successfully', referral_code: referralCode });
  } catch (err) {
    console.error('Google callback error:', err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
