// api/admin/resolve-category/route.ts
//
// Mirrors /api/admin/resolve-topic exactly: POST an array of
// {type, category} pairs, get back a flat lookup map keyed by
// "type||category" (lowercased) -> question_categories.id (uuid).
//
// Used by questions/page.tsx's Excel import flow to resolve a
// "Question Category" column (free-text label, e.g. "Synonyms (all units)")
// against question_categories.label_en, so imported rows can get a real
// question_category_id instead of silently having no category.
//
// Matching is done against label_en (case-insensitive) since that's what
// a paper-setter would actually type into an Excel cell — they don't know
// or care about the internal category_value machine key. category_value
// is also accepted as a fallback match, for anyone re-importing an export
// that already used the machine key.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

interface CategoryPair {
  type: string;     // question_type, e.g. "mcq"
  category: string; // free-text label OR category_value, e.g. "Synonyms (all units)" or "synonym"
}

export async function POST(request: NextRequest) {
  try {
    const pairs: CategoryPair[] = await request.json();

    if (!Array.isArray(pairs) || pairs.length === 0) {
      return NextResponse.json({});
    }

    // Collect the distinct question_types actually referenced, so we only
    // fetch relevant rows from question_categories instead of the whole
    // table (small table either way, but keeps this consistent with how
    // resolve-topic scopes its own lookups).
    const types = Array.from(
      new Set(pairs.map(p => (p.type || '').trim().toLowerCase()).filter(Boolean))
    );

    if (types.length === 0) {
      return NextResponse.json({});
    }

    const { data: categories, error } = await supabaseAdmin
      .from('question_categories')
      .select('id, question_type, category_value, label_en')
      .in('question_type', types)
      .eq('is_active', true);

    if (error) {
      console.error('resolve-category error:', error.message);
      return NextResponse.json({ error: 'Failed to resolve categories' }, { status: 500 });
    }

    // Build the lookup map. Two keys per category row so either a
    // human-readable label OR the machine category_value resolves to the
    // same id — mirrors resolve-topic's normal/flipped key tolerance.
    const map: Record<string, string> = {};
    (categories || []).forEach(c => {
      const typeKey = c.question_type.toLowerCase();
      map[`${typeKey}||${c.label_en.toLowerCase()}`] = c.id;
      map[`${typeKey}||${c.category_value.toLowerCase()}`] = c.id;
    });

    return NextResponse.json(map);
  } catch (error: any) {
    console.error('resolve-category error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}