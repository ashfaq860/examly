// app/api/questions/bulk-delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';
import { invalidateQuestionPoolCache } from '@/lib/questionPoolCache';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** POST /api/questions/bulk-delete  body: { ids: string[] } */
export async function POST(req: NextRequest) {
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }
    const { error } = await supabase.from('questions').delete().in('id', ids);
    if (error) throw error;
    invalidateQuestionPoolCache();
    return NextResponse.json({ deleted: ids.length });
  } catch (err: any) {
    console.error('[POST /api/questions/bulk-delete]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}