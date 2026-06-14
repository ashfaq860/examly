// app/api/questions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** DELETE /api/questions/:id */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { error } = await supabase.from('questions').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ deleted: params.id });
  } catch (err: any) {
    console.error('[DELETE /api/questions/:id]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PUT /api/questions/:id */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const { error, data } = await supabase
      .from('questions')
      .update(body)
      .eq('id', params.id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[PUT /api/questions/:id]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}