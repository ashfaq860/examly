
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    let data = null;
    let error = null;

    // Retry logic with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await supabaseAdmin
        .from('classes')
        .select('id, name, description') // Explicitly selecting columns from your schema
        .order('name', { ascending: true });

      data = result.data;
      error = result.error;

      if (!error) break;

      if (attempt < 3) {
        console.warn(`Classes fetch attempt ${attempt} failed: ${error.message}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    if (error) {
      console.error('Final attempt to fetch classes failed:', error);
      throw error;
    }

    // Optional: Add a Cache-Control header to improve performance for this static-ish data
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
      },
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch classes', details: error.message },
      { status: 500 }
    );
  }
}