import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Fetch profile with cellno check
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, created_at, papers_generated, trial_ends_at, trial_given, cellno, subscription_status,referral_code')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    // Check if user has cellno to be eligible for trial
    const hasCellno = !!profile.cellno;
    
    // Check if user has an active trial (only if they have cellno)
    const now = new Date();
    const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    const isTrial = hasCellno && trialEndsAt && trialEndsAt > now && profile.trial_given;
    const daysRemaining = isTrial ? Math.max(0, Math.ceil((trialEndsAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

    // Fetch active subscriptions/paper packs
    const { data: userPackage, error: packageError } = await supabaseAdmin
      .from('user_packages')
      .select(
        `
        *,
        package:packages (
          name,
          type,
          paper_quantity,
          duration_days
        )
      `
      )
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (packageError && packageError.code !== 'PGRST116') {
      console.error('Package fetch error:', packageError);
      return NextResponse.json({ error: 'Failed to fetch package' }, { status: 500 });
    }

    let hasActiveSubscription = false;
    let papersRemaining: number | 'unlimited' = 0;

    if (userPackage) {
      hasActiveSubscription = true;
      const isNotExpired = userPackage.expires_at
        ? new Date(userPackage.expires_at) > now
        : true;

      if (isNotExpired) {
        if (userPackage.package?.type === 'paper_pack') {
          papersRemaining = userPackage.papers_remaining ?? 0;
        } else {
          papersRemaining = 'unlimited';
        }
      }
    } else if (isTrial) {
      // Trial users get unlimited papers (only if they have cellno)
      papersRemaining = 'unlimited';
    }

    return NextResponse.json({
  isTrial,
  trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
  daysRemaining,
  hasActiveSubscription,
  papersGenerated: profile.papers_generated || 0,
  papersRemaining,
  subscriptionName: userPackage?.package?.name || null,
  subscriptionType: userPackage?.package?.type || null,
  subscriptionEndDate: userPackage?.expires_at ? new Date(userPackage.expires_at) : null,
  hasCellno, // Expose cell number status
  trialEligible: hasCellno && !hasActiveSubscription && !isTrial,
  referral_code: profile.referral_code || null,
  message: !hasCellno
    ? "Update your profile with a valid cell number to activate your 3 Months free trial."
    : null
});

  } catch (error: any) {
    console.error('Trial status route hard fail:', error.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}