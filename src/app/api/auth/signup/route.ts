// src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isRateLimited, getClientIp } from '@/lib/rateLimit';

// Plain anon-key client (no cookie/session persistence needed for a one-shot
// signup request) - used only so Supabase's own Auth service sends the
// confirmation email itself, the same way it would for a client-side signUp.
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/* -------------------- helpers -------------------- */

const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* -------------------- route -------------------- */

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (isRateLimited(`signup:${ip}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 });
    }

    const { name, email, password,referralCode } = await req.json();

    if (!name || !email || !password || password.length < 6) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(String(email).trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    /* -------------------- 1. Create auth user --------------------
       Uses the public signUp() (not the admin API) so Supabase's own Auth
       service sends the confirmation email itself - via whatever mailer is
       configured in the Supabase dashboard (default, or Custom SMTP). No
       manual link generation or nodemailer needed. */
    const { data: authData, error: authError } = await supabaseAnon.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        data: { name: name.trim() },
        emailRedirectTo: process.env.CONFIRM_EMAIL || 'http://localhost:3000/auth/login',
      },
    });

    if (authError || !authData.user) {
      console.error('Supabase signUp failed:', authError);
      // Retryable/5xx errors from Supabase (e.g. its mailer choking while
      // trying to send the confirmation email as part of the signup request)
      // carry an unhelpful or empty message - don't leak that raw text to
      // the user, give them something actionable instead.
      const isTransient = authError?.name === 'AuthRetryableFetchError' || (authError as any)?.status >= 500;
      const isWeakPassword = (authError as any)?.code === 'weak_password' || authError?.name === 'AuthWeakPasswordError';
      const message = isTransient
        ? 'Our signup service is temporarily unavailable. Please try again in a moment.'
        : isWeakPassword
        ? 'Password must include at least one lowercase letter, one uppercase letter, and one number.'
        : authError?.message || 'Auth failed';
      return NextResponse.json({ error: message }, { status: isTransient ? 503 : 400 });
    }

    // Supabase deliberately returns a "successful" response with no error
    // for an email that's already registered (anti-enumeration behavior) -
    // it just comes back with an empty `identities` array instead. Without
    // this check we'd fall through and overwrite the existing account's
    // profile (referral code, subscription status, paper counts, etc.).
    if (authData.user.identities && authData.user.identities.length === 0) {
      return NextResponse.json(
        { error: 'This email is already registered. Please log in instead.' },
        { status: 409 }
      );
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

    /* -------------------- 4. Success --------------------
       Supabase already sent the confirmation email as part of signUp() above. */
    return NextResponse.json({
      message: 'Account created successfully. Please check your email to confirm your account.',
      email,
    });

  } catch (err: any) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Something went wrong while creating your account. Please try again shortly.' }, { status: 500 });
  }
}
