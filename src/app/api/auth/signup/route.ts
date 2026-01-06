// src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import nodemailer from 'nodemailer';

/* -------------------- helpers -------------------- */

const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

/* -------------------- route -------------------- */

export async function POST(req: NextRequest) {
  try {
    const { name, email, password,referralCode } = await req.json();

    if (!name || !email || !password || password.length < 6) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    /* -------------------- 1. Create auth user -------------------- */
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password: password.trim(),
        email_confirm: false,
        user_metadata: { name: name.trim() },
      });

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Auth failed' }, { status: 400 });
    }

    const userId = authData.user.id;

    /* -------------------- 2. Generate referral code -------------------- */
    let referral = generateReferralCode();
    for (let i = 0; i < 10; i++) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('referral_code', referral)
        .maybeSingle();

      if (!data) break;
      referral = generateReferralCode();
    }

    /* -------------------- 3. Create profile (no trial, no reward) -------------------- */
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: name.trim(),
        email: email.trim(),
        role: 'teacher',
        referral_code: referral,
         referred_by_code: referralCode?.trim() || null, 
        subscription_status: 'inactive',
        allowed_papers: 0,
        papers_generated: 0,
        login_method: 'email',
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    /* -------------------- 4. Generate signup confirmation link -------------------- */
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: email.trim(),
      redirectTo: process.env.CONFIRM_EMAIL || 'http://localhost:3000/auth/login',
    });

    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json({ error: 'Failed to generate signup link' }, { status: 500 });
    }

    /* -------------------- 5. Send confirmation email -------------------- */
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'muhmdashfaq@gmail.com',
        pass: process.env.GOOGLE_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"Examly.pk" <muhmdashfaq@gmail.com>`,
      to: email,
      subject: 'Confirm your Examly account',
      html: `<p>Hello ${name},</p>
             <p>Click the link below to confirm your email and activate your account:</p>
             <a href="${linkData.properties.action_link}">Confirm Email</a>
             <p>If you didn’t request this, ignore this email.</p>`,
    });

    /* -------------------- 6. Success -------------------- */
    return NextResponse.json({
      message: 'Account created successfully. Confirmation email sent!',
      email,
    });

  } catch (err: any) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: err.message || 'Unexpected server error' }, { status: 500 });
  }
}
