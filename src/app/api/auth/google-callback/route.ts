import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { userId, full_name, email } = await req.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing userId or email' },
        { status: 400 }
      );
    }

    // 1️⃣ Check if profile already exists
    const { data: existingProfile, error: fetchError } =
      await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', userId)
        .maybeSingle();

    if (fetchError) {
      console.error('Profile fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    if (existingProfile) {
      return NextResponse.json({
        message: 'Profile already exists',
        role: existingProfile.role,
      });
    }

    // 2️⃣ Generate unique referral code
    const generateReferralCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return code;
    };

    let referralCode = generateReferralCode();
    let attempts = 0;

    while (attempts < 10) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('referral_code', referralCode)
        .maybeSingle();

      if (!data) break;

      referralCode = generateReferralCode();
      attempts++;
    }

    // 3️⃣ Insert profile
    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({
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
      return NextResponse.json(
        { error: 'Failed to create profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Profile created successfully',
      role: 'teacher',
      referral_code: referralCode,
    });

  } catch (err) {
    console.error('Google callback server error:', err);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
