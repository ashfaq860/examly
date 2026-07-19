// app/api/checker/students/route.ts
// CRUD entry point for the caller's own class roster (the `students`
// table backing the checker's "Add submission" roster dropdown). RLS on
// `students` is select-only (owner_id = auth.uid()), so writes go through
// this service-role route, same convention as every other table in this
// project — see create_paper_checker_tables.sql's RLS comment.
//
// GET: every student owned by the caller (active and inactive — the
// management page needs both to offer reactivation; the roster dropdown
// itself filters to is_active=true separately in api/checker/papers).
// POST: create a new student, owned by the caller.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { normalizeWhatsappNumber } from '@/lib/checker/whatsapp';

const STUDENT_COLUMNS = 'id, full_name, father_name, roll_no, class_name, section, whatsapp_number, is_active, created_at';

export async function GET(req: NextRequest) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const gate = await requireFeatureOrAdmin(supabaseAdmin, user.id, 'paper_checker');
    if (gate) return gate;

    const { data: students, error } = await supabaseAdmin
      .from('students')
      .select(STUDENT_COLUMNS)
      .eq('owner_id', user.id)
      .order('full_name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ students: students || [] });
  } catch (error: any) {
    console.error('Error listing students:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const gate = await requireFeatureOrAdmin(supabaseAdmin, user.id, 'paper_checker');
    if (gate) return gate;

    const body = await req.json();
    const fullName: string | undefined = body?.full_name?.trim();
    if (!fullName) {
      return NextResponse.json({ error: 'Student name is required' }, { status: 400 });
    }

    let whatsappNumber: string | null = null;
    if (body?.whatsapp_number?.trim()) {
      whatsappNumber = normalizeWhatsappNumber(body.whatsapp_number);
      if (!whatsappNumber) {
        return NextResponse.json({ error: 'WhatsApp number must be 11 digits starting with 03' }, { status: 400 });
      }
    }

    const { data: student, error } = await supabaseAdmin
      .from('students')
      .insert({
        owner_id: user.id,
        full_name: fullName,
        father_name: body?.father_name?.trim() || null,
        roll_no: body?.roll_no?.trim() || null,
        class_name: body?.class_name?.trim() || null,
        section: body?.section?.trim() || null,
        whatsapp_number: whatsappNumber,
      })
      .select(STUDENT_COLUMNS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ student });
  } catch (error: any) {
    console.error('Error creating student:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
