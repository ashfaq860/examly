import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';

export async function GET(_request: NextRequest) {
  // Verify the caller is authenticated and use their own session userId.
  // Never trust a userId from the query string — that lets any user query
  // any other user's subscription/trial data.
  const auth = await getSessionFromRequest();
  if (auth.error) return auth.error;

  const userId = auth.session.user.id;

  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, created_at, papers_generated, trial_ends_at, trial_given, cellno, subscription_status, referral_code')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    const hasCellno = !!profile.cellno;
    const now = new Date();
    const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    const isTrial = hasCellno && trialEndsAt && trialEndsAt > now && profile.trial_given;
    const daysRemaining = isTrial
      ? Math.max(0, Math.ceil((trialEndsAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const { data: userPackage, error: packageError } = await supabaseAdmin
      .from('user_packages')
      .select(`
        *,
        package:packages (
          name,
          type,
          paper_quantity,
          duration_days
        )
      `)
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
      hasCellno,
      trialEligible: hasCellno && !hasActiveSubscription && !isTrial,
      referral_code: profile.referral_code || null,
      message: !hasCellno
        ? 'Update your profile with a valid cell number to activate your 3 Months free trial.'
        : null,
    });
  } catch (error: any) {
    console.error('Trial status route error:', error.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
