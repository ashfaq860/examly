import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireFeatureOrAdmin, consumePaperGeneration } from '@/lib/entitlements';
import { NextResponse } from 'next/server';

// Called once per printed/downloaded paper (PaperBuilderApp's handlePrint).
// Bumps the informational profiles.papers_generated counter (unchanged
// from before) AND — new — decrements papers_remaining on the caller's
// resolved active package (personal or, for academy teachers, their
// academy owner's pooled package) via consumePaperGeneration.
//
// The free-trial mechanism (profiles.trial_ends_at/trial_given) predates
// the package/entitlement system and isn't a package row at all, so it's
// intentionally NOT run through hasFeature('paper_generation') here — a
// trial user has no user_packages row to resolve, and gating them the
// same way as a package holder would incorrectly 403 every trial user.
// Trial users keep the old unlimited/ungated behavior; only past-trial
// users relying on a purchased package hit the new enforcement.
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    // 2. Fetch current count using Admin (to ensure we see the latest value)
    const { data: currentProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('papers_generated, cellno, trial_ends_at, trial_given')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const now = new Date();
    const trialEndsAt = currentProfile.trial_ends_at ? new Date(currentProfile.trial_ends_at) : null;
    const isTrial = Boolean(currentProfile.cellno) && !!trialEndsAt && trialEndsAt > now && currentProfile.trial_given;

    if (!isTrial) {
      const gate = await requireFeatureOrAdmin(supabaseAdmin, userId, 'paper_generation');
      if (gate) return gate;

      const consumeResult = await consumePaperGeneration(supabaseAdmin, userId);
      if (!consumeResult.ok) {
        return NextResponse.json(
          { error: consumeResult.reason === 'quota_exhausted' ? 'quota_exhausted' : 'subscription_required' },
          { status: 403 }
        );
      }
    }

    const newCount = (currentProfile?.papers_generated || 0) + 1;

    // 3. Update using Admin (Bypasses RLS perfectly)
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        papers_generated: newCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      profile: updatedProfile
    });

  } catch (error: any) {
    console.error("Internal Increment Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
