// app/api/me/entitlements/route.ts
// Backs useEntitlements() — the client-side source of truth for feature
// gating (nav lock icons, checker upgrade screens, scans-remaining badge).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { getActivePackage } from '@/lib/entitlements';

export async function GET() {
  const auth = await getSessionFromRequest();
  if (auth.error) return auth.error;

  const pkg = await getActivePackage(supabaseAdmin, auth.user.id);

  return NextResponse.json({
    features: pkg?.features ?? [],
    papersRemaining: pkg?.papersRemaining ?? null,
    scansRemaining: pkg?.scansRemaining ?? null,
    viaAcademy: pkg?.viaAcademy ?? null,
  });
}
