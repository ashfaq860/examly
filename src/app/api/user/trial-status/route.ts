//api/user/trial-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    if (userId !== auth.user.id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', auth.user.id)
        .maybeSingle();

      if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
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

    // Fetch all active packages — user may have multiple is_active=true rows
    // (e.g. an expired plan that was never deactivated + a new active plan)
    const { data: activePackages, error: packageError } = await supabaseAdmin
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
      .order('created_at', { ascending: false });

    if (packageError) {
      console.error('Package fetch error:', packageError);
      return NextResponse.json({ error: 'Failed to fetch package' }, { status: 500 });
    }

    // Prefer the first non-expired package; fall back to the most recent one
    const userPackage = activePackages?.find(
      (pkg) => !pkg.expires_at || new Date(pkg.expires_at) > now
    ) ?? activePackages?.[0] ?? null;

    let hasActiveSubscription = false;
    let papersRemaining: number | 'unlimited' = 0;

    if (userPackage) {
      const isNotExpired = userPackage.expires_at
        ? new Date(userPackage.expires_at) > now
        : true;

      hasActiveSubscription = isNotExpired;

      if (isNotExpired) {
        if (userPackage.package?.type === 'paper_pack') {
          papersRemaining = userPackage.papers_remaining ?? 0;
          // no papers left = effectively inactive
          if (papersRemaining === 0) hasActiveSubscription = false;
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