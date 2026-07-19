// app/api/academy/members/route.ts
// Academy seat management for academy owners. "Owner" here means a row in
// `academies` with owner_id === the caller — role === 'academy' alone
// isn't sufficient (mirrors the task's explicit "only if they own an
// academies row" scoping), so every handler resolves the owned academy
// first and 403s if none exists.
//
// GET   — list members (academy_members joined to profiles) + seat usage
//         + the subject catalog (so the owner-facing UI has everything it
//         needs in one request — this route isn't reachable by non-owners,
//         and academy owners aren't admins, so it can't reuse the
//         admin-only /api/admin/lookups route the admin user forms use).
// POST  — add a teacher by email. Requires can_add_member(academy_id);
//         invite-by-email for non-registered users is out of scope — the
//         caller is told to ask the teacher to sign up first.
// PATCH — set a member's subjects (?userId= in body). Informational only
//         right now — it does NOT restrict which papers a teacher can see
//         in the checker (that's still strictly created_by = self); it's
//         stored for display/future use, same scope as profiles.subjects.
// DELETE — remove a teacher (?userId=). The owner row can never be removed
//          this way.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { getActivePackage, canAddMember } from '@/lib/entitlements';
import { buildSubjectOptions } from '@/lib/subjectOptions';

async function getOwnedAcademy(userId: string) {
  const { data } = await supabaseAdmin
    .from('academies')
    .select('id, name, owner_id')
    .eq('owner_id', userId)
    .maybeSingle();
  return data;
}

export async function GET() {
  const auth = await getSessionFromRequest();
  if (auth.error) return auth.error;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) return NextResponse.json({ error: 'Not an academy owner' }, { status: 403 });

  const [{ data: memberRows, error: membersErr }, { data: subjectRows }, { data: classSubjectRows }] = await Promise.all([
    supabaseAdmin
      .from('academy_members')
      .select('user_id, member_role, created_at, subjects')
      .eq('academy_id', academy.id)
      .order('created_at', { ascending: true }),
    supabaseAdmin.from('subjects').select('id, name, name_ur').order('name'),
    // Same subject NAME legitimately appears on multiple rows here — this
    // app models a subject per class level, not one row shared across
    // classes — so the class link is what keeps same-named rows
    // distinguishable in the UI (see buildSubjectOptions).
    supabaseAdmin.from('class_subjects').select('subject_id, class:classes(name)'),
  ]);
  if (membersErr) return NextResponse.json({ error: membersErr.message }, { status: 500 });

  const subjectOptions = buildSubjectOptions(
    subjectRows || [],
    ((classSubjectRows || []) as unknown as { subject_id: string; class: { name: string } | null }[])
  );

  const userIds = (memberRows || []).map(m => m.user_id);
  let profileById = new Map<string, { full_name: string | null; email: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    profileById = new Map((profiles || []).map(p => [p.id, { full_name: p.full_name, email: p.email }]));
  }

  const members = (memberRows || []).map(m => ({
    userId: m.user_id,
    memberRole: m.member_role,
    createdAt: m.created_at,
    subjects: m.subjects || [],
    fullName: profileById.get(m.user_id)?.full_name ?? null,
    email: profileById.get(m.user_id)?.email ?? null,
  }));

  // Seats come from the owner's package — get_active_package doesn't
  // return `seats` itself (it's a packages column, not a per-package-
  // instance one), so it's a small follow-up lookup keyed off the
  // resolved package_id.
  const activePackage = await getActivePackage(supabaseAdmin, academy.owner_id);
  let seatsTotal: number | null = null;
  if (activePackage) {
    const { data: pkgRow } = await supabaseAdmin
      .from('packages')
      .select('seats')
      .eq('id', activePackage.packageId)
      .maybeSingle();
    seatsTotal = pkgRow?.seats ?? null;
  }

  return NextResponse.json({
    academy: { id: academy.id, name: academy.name },
    members,
    seatsUsed: members.length,
    seatsTotal,
    subjectOptions: subjectOptions || [],
  });
}

export async function POST(req: NextRequest) {
  const auth = await getSessionFromRequest();
  if (auth.error) return auth.error;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) return NextResponse.json({ error: 'Not an academy owner' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const canAdd = await canAddMember(supabaseAdmin, academy.id);
  if (!canAdd) return NextResponse.json({ error: 'seats_exhausted' }, { status: 403 });

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .ilike('email', email)
    .maybeSingle();
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });
  if (!profile) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const { data: existingMember } = await supabaseAdmin
    .from('academy_members')
    .select('user_id')
    .eq('academy_id', academy.id)
    .eq('user_id', profile.id)
    .maybeSingle();
  if (existingMember) {
    return NextResponse.json({ error: 'This teacher is already a member' }, { status: 400 });
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('academy_members')
    .insert({ academy_id: academy.id, user_id: profile.id, member_role: 'teacher' })
    .select('created_at')
    .single();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({
    member: {
      userId: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      memberRole: 'teacher',
      createdAt: inserted.created_at,
    },
  }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await getSessionFromRequest();
  if (auth.error) return auth.error;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) return NextResponse.json({ error: 'Not an academy owner' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.userId === 'string' ? body.userId : '';
  const subjects = Array.isArray(body?.subjects)
    ? body.subjects.filter((s: unknown): s is string => typeof s === 'string')
    : null;
  if (!userId || subjects === null) {
    return NextResponse.json({ error: 'userId and subjects are required' }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from('academy_members')
    .update({ subjects })
    .eq('academy_id', academy.id)
    .eq('user_id', userId)
    .select('user_id, subjects')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  return NextResponse.json({ member: { userId: updated.user_id, subjects: updated.subjects || [] } });
}

export async function DELETE(req: NextRequest) {
  const auth = await getSessionFromRequest();
  if (auth.error) return auth.error;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) return NextResponse.json({ error: 'Not an academy owner' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  if (userId === academy.owner_id) {
    return NextResponse.json({ error: 'Cannot remove the academy owner' }, { status: 400 });
  }

  const { error: deleteErr } = await supabaseAdmin
    .from('academy_members')
    .delete()
    .eq('academy_id', academy.id)
    .eq('user_id', userId);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
