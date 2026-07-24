// src/lib/entitlements.ts
// Server-only helpers wrapping the subscription-entitlement RPCs
// (get_active_package, has_feature, can_add_member, consume_scan — all
// SECURITY DEFINER, already deployed). This is the single place API routes
// go through to answer "can this user do X" instead of reading
// profiles.subscription_status / allowed_papers / papers_generated
// directly — those legacy columns are no longer a source of truth for
// gating decisions.
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type Feature = 'paper_generation' | 'paper_checker';

export interface ActivePackage {
  userPackageId: string;
  packageId: string;
  features: string[];
  papersRemaining: number | null;
  scansRemaining: number | null;
  viaAcademy: string | null;
}

/** Resolves the CALLER's own active package (derived from auth.uid() inside
 *  the RPC — the `supabase` client passed in must be session-authenticated
 *  as that user, never supabaseAdmin, or auth.uid() resolves to null), or
 *  the one inherited from their academy owner if they're a teacher member.
 *  Null if neither exists. */
export async function getActivePackage(
  supabase: SupabaseClient
): Promise<ActivePackage | null> {
  const { data, error } = await supabase.rpc('get_active_package');
  if (error) {
    console.error('get_active_package RPC error:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    userPackageId: row.user_package_id,
    packageId: row.package_id,
    features: row.features || [],
    papersRemaining: row.papers_remaining ?? null,
    scansRemaining: row.scans_remaining ?? null,
    viaAcademy: row.via_academy ?? null,
  };
}

/** The single source of truth for "can this user use feature X" — true for
 *  'paper_generation' under both package types, 'paper_checker' only for
 *  checker packages (personal or inherited via academy). `supabase` must be
 *  session-authenticated as the user in question (see getActivePackage). */
export async function hasFeature(
  supabase: SupabaseClient,
  feature: Feature
): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_feature', { p_feature: feature });
  if (error) {
    console.error('has_feature RPC error:', error.message);
    return false;
  }
  return Boolean(data);
}

/** Route-handler guard: returns a 403 NextResponse if the feature is
 *  missing, or null when the caller may proceed. Use as:
 *    const gate = await requireFeature(auth.supabase, 'paper_checker');
 *    if (gate) return gate;
 */
export async function requireFeature(
  supabase: SupabaseClient,
  feature: Feature
): Promise<NextResponse | null> {
  const ok = await hasFeature(supabase, feature);
  if (ok) return null;
  return NextResponse.json({ error: 'subscription_required', feature }, { status: 403 });
}

/** Admin/super_admin bypass everywhere feature-gating applies — same role
 *  check already used by the admin route guards (requireRole) and the
 *  checker ownership helpers. */
export async function isAdminUser(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return Boolean(profile && ['admin', 'super_admin'].includes(profile.role));
}

/** Combined "require feature unless admin" guard — the shape almost every
 *  checker/paper route actually wants. */
export async function requireFeatureOrAdmin(
  supabase: SupabaseClient,
  userId: string,
  feature: Feature
): Promise<NextResponse | null> {
  if (await isAdminUser(supabase, userId)) return null;
  return requireFeature(supabase, feature);
}

/** Atomically-enough decrements scans_remaining on the correct
 *  user_package (personal or academy owner's) via the consume_scan RPC.
 *  Returns false if the user has no paper_checker access or no scan quota
 *  left — callers must not proceed with grading in that case. */
export async function consumeScan(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('consume_scan', { p_user_id: userId });
  if (error) {
    console.error('consume_scan RPC error:', error.message);
    return false;
  }
  return Boolean(data);
}

/** True if the academy can add another member without exceeding the
 *  owner's package seat count. */
export async function canAddMember(supabase: SupabaseClient, academyId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_add_member', { p_academy_id: academyId });
  if (error) {
    console.error('can_add_member RPC error:', error.message);
    return false;
  }
  return Boolean(data);
}

export type ConsumePaperGenerationResult =
  | { ok: true }
  | { ok: false; reason: 'no_active_package' | 'quota_exhausted' };

/** Decrements papers_remaining on the resolved user_package_id (which may
 *  be the academy owner's row for academy teachers — quotas are pooled by
 *  design). No-ops for unlimited packages (papers_remaining === null).
 *  Not a single atomic SQL statement (no RPC exists for this — only
 *  consume_scan does its own decrement), so this does a guarded
 *  read-then-write, same non-atomic pattern already used by
 *  /api/profile/increment-count for papers_generated. */
export async function consumePaperGeneration(
  supabase: SupabaseClient
): Promise<ConsumePaperGenerationResult> {
  const pkg = await getActivePackage(supabase);
  if (!pkg || !pkg.features.includes('paper_generation')) {
    return { ok: false, reason: 'no_active_package' };
  }
  if (pkg.papersRemaining === null) {
    return { ok: true }; // unlimited plan — nothing to decrement
  }
  if (pkg.papersRemaining <= 0) {
    return { ok: false, reason: 'quota_exhausted' };
  }

  const { error } = await supabaseAdmin
    .from('user_packages')
    .update({ papers_remaining: pkg.papersRemaining - 1 })
    .eq('id', pkg.userPackageId)
    .eq('papers_remaining', pkg.papersRemaining);

  if (error) {
    console.error('Failed to decrement papers_remaining:', error.message);
  }
  return { ok: true };
}
