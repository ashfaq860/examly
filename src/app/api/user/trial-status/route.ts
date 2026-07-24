//api/user/trial-status/route.ts
// Package resolution now goes through getActivePackage (get_active_package
// RPC) instead of querying user_packages directly — this is what makes
// academy-inherited packages count correctly for teacher members (the old
// direct query only ever looked at the caller's own user_packages rows),
// and it's the same resolver /api/me/entitlements uses, so
// trialStatus.hasActiveSubscription and useEntitlements().features never
// disagree about whether a user has an active plan.
//
// profiles.subscription_status is no longer read at all — it was never
// kept in sync with user_packages/admin order approval, so it was already
// dead weight for gating. profiles.papers_generated remains a pure
// display counter (see /api/profile/increment-count for where it's
// bumped) and is not used for any gating decision here or elsewhere.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { getActivePackage } from '@/lib/entitlements';

// Always resolves the CALLING user's own trial/package status — the
// route used to accept a ?userId= query param (with an admin-role
// escape hatch for cross-user lookups), but nothing in the app ever
// requested another user's id through it, get_active_package() can no
// longer answer for an arbitrary user anyway (it derives auth.uid()
// internally), and a client-suppliable id selecting whose data comes
// back is exactly the request-body/query-string user-id pattern that
// caused the breach. Admin "view another teacher's status" tooling, if
// ever needed, should be its own admin-gated route reading tables
// directly via supabaseAdmin — not this one.
export async function GET() {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const userId = auth.user.id;

    // Fetch profile with cellno check
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, created_at, papers_generated, trial_ends_at, trial_given, cellno, referral_code')
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

    const activePackage = await getActivePackage(auth.supabase);

    let hasActiveSubscription = false;
    let papersRemaining: number | 'unlimited' = 0;
    let subscriptionName: string | null = null;
    let subscriptionType: string | null = null;
    let subscriptionEndDate: string | null = null;

    if (activePackage && activePackage.features.includes('paper_generation')) {
      if (activePackage.papersRemaining === null) {
        papersRemaining = 'unlimited';
        hasActiveSubscription = true;
      } else {
        papersRemaining = activePackage.papersRemaining;
        hasActiveSubscription = activePackage.papersRemaining > 0;
      }

      const [{ data: pkgRow }, { data: userPkgRow }] = await Promise.all([
        supabaseAdmin.from('packages').select('name, type').eq('id', activePackage.packageId).maybeSingle(),
        supabaseAdmin.from('user_packages').select('expires_at').eq('id', activePackage.userPackageId).maybeSingle(),
      ]);
      subscriptionName = pkgRow?.name ?? null;
      subscriptionType = pkgRow?.type ?? null;
      subscriptionEndDate = userPkgRow?.expires_at ?? null;
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
      subscriptionName,
      subscriptionType,
      subscriptionEndDate: subscriptionEndDate ? new Date(subscriptionEndDate) : null,
      hasCellno, // Expose cell number status
      trialEligible: hasCellno && !hasActiveSubscription && !isTrial,
      referral_code: profile.referral_code || null,
      role: profile.role || null,
      viaAcademy: activePackage?.viaAcademy ?? null,
      message: !hasCellno
        ? "Update your profile with a valid cell number to activate your 3 Months free trial."
        : null
    });

  } catch (error: any) {
    console.error('Trial status route hard fail:', error.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
