import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRole } from '@/lib/api-auth';

export async function GET() {
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

  const { data, error } = await supabaseAdmin
    .from('packages')
    .select('*')
    .order('price');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}
