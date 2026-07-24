// app/api/students/[id]/route.ts
// PATCH-only: edits a student's fields, and doubles as the
// deactivate/reactivate toggle (is_active is just another field). No hard
// DELETE — submissions.student_id has a plain FK (no ON DELETE) to
// students, so a student with any submission history can't be removed
// outright without breaking that history; deactivating (which the roster
// query already filters on) is the safe equivalent and is reversible.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { normalizeWhatsappNumber } from '@/lib/checker/whatsapp';
import { verifyStudentOwnership } from '@/lib/checker/ownership';

const STUDENT_COLUMNS = 'id, full_name, father_name, roll_no, class_name, section, whatsapp_number, is_active, created_at';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const gate = await requireFeatureOrAdmin(auth.supabase, user.id, 'paper_checker');
    if (gate) return gate;

    const { id } = await params;
    const ownership = await verifyStudentOwnership(id, user.id);
    if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });

    const body = await req.json();
    const patch: Record<string, any> = {};
    if (typeof body.full_name === 'string') {
      const trimmed = body.full_name.trim();
      if (!trimmed) return NextResponse.json({ error: 'Student name is required' }, { status: 400 });
      patch.full_name = trimmed;
    }
    if (typeof body.father_name === 'string') patch.father_name = body.father_name.trim() || null;
    if (typeof body.roll_no === 'string') patch.roll_no = body.roll_no.trim() || null;
    if (typeof body.class_name === 'string') patch.class_name = body.class_name.trim() || null;
    if (typeof body.section === 'string') patch.section = body.section.trim() || null;
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
    if (typeof body.whatsapp_number === 'string') {
      if (!body.whatsapp_number.trim()) {
        patch.whatsapp_number = null;
      } else {
        const normalized = normalizeWhatsappNumber(body.whatsapp_number);
        if (!normalized) return NextResponse.json({ error: 'WhatsApp number must be 11 digits starting with 03' }, { status: 400 });
        patch.whatsapp_number = normalized;
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: student, error } = await supabaseAdmin
      .from('students')
      .update(patch)
      .eq('id', id)
      .select(STUDENT_COLUMNS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ student });
  } catch (error: any) {
    console.error('Error updating student:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
