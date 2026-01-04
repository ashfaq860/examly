import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Helper to generate unique 8-char referral code
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
    const { name, email, password, referralCode } = await req.json();

    if (!name || !email || !password || password.length < 6) {
      return NextResponse.json(
        { error: 'Invalid input. Name, email, and password (6+ chars) are required.' },
        { status: 400 }
      );
    }

    // 1️⃣ Create auth user via service_role
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      email_confirm: true, // Supabase will send confirmation email
      user_metadata: {
        name: name.trim()
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    const userId = authData.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'Failed to create auth user.' },
        { status: 500 }
      );
    }

    // 2️⃣ Generate unique referral code for profile
    let newReferralCode = generateReferralCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('referral_code', newReferralCode)
        .maybeSingle();

      if (!existing) break;
      newReferralCode = generateReferralCode();
      attempts++;
    }

    // 3️⃣ Use UPSERT instead of INSERT (update if exists, insert if not)
    const profileData = {
      id: userId,
      full_name: name.trim(),
      email: email.trim(),
      role: 'teacher',
      institution: '',
      subjects: [],
      allowed_papers: 0,
      papers_generated: 0,
      subscription_status: 'inactive',
      trial_given: false,
      login_method: 'email',
      referral_code: newReferralCode,
      logo: '',
      cellno: null,
      trial_ends_at: null,
      updated_at: new Date().toISOString(),
    };

    console.log('Upserting profile with data:', profileData);

    // Use upsert to handle both insert and update scenarios
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id', // Conflict on primary key
        ignoreDuplicates: false
      });

    if (profileError) {
      console.error('Profile upsert failed details:', {
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code
      });
      
      // Clean up auth user if profile creation fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.log('Cleaned up auth user after profile failure');
      } catch (deleteError) {
        console.error('Failed to delete auth user:', deleteError);
      }
      
      return NextResponse.json(
        { error: `Failed to create/update user profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    console.log('Profile upsert successful for user:', userId);

    // 4️⃣ Handle referral if provided
    if (referralCode?.trim()) {
      const { data: referrer } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('referral_code', referralCode.trim().toUpperCase())
        .maybeSingle();

      if (referrer?.id && referrer.id !== userId) {
        // Avoid duplicate referrals
        const { data: existingReferral } = await supabaseAdmin
          .from('referrals')
          .select('id')
          .eq('referrer_id', referrer.id)
          .eq('referred_user_id', userId)
          .maybeSingle();

        if (!existingReferral) {
          await supabaseAdmin.from('referrals').insert({
            referrer_id: referrer.id,
            referred_user_id: userId,
            reward_given: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json({
      message: 'Account created successfully! Please check your email to confirm.',
      email,
    });

  } catch (err: any) {
    console.error('Signup API error:', err);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}