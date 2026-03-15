// src/app/api/classes/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    let data, error;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await supabaseAdmin
        .from('classes')
        .select('*')
        .order('name', { ascending: true });
      data = result.data;
      error = result.error;
      if (!error) break;
      if (attempt < 3) {
        console.log(`Classes fetch attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching classes after retries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch classes' },
      { status: 500 }
    );
  }
}
