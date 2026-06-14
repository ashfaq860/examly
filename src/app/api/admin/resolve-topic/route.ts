// app/api/admin/resolve-topic/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/admin/resolve-topic
 * Body: [{ chapter: "Numbers Operations", topic: "Exercise 1.1" }, ...]
 * Returns: { "Numbers Operations||Exercise 1.1": "uuid", ... }
 *
 * Resolves topic IDs by querying the DB directly using exact names,
 * bypassing the 1000-row Supabase default limit on fetchLookups.
 */
export async function POST(req: NextRequest) {
  try {
    const pairs: { chapter: string; topic: string }[] = await req.json();

    if (!Array.isArray(pairs) || pairs.length === 0) {
      return NextResponse.json({});
    }

    // Get unique chapter names to query
    const chapterNames = [...new Set(pairs.map(p => p.chapter.trim()).filter(Boolean))];
    const topicNames   = [...new Set(pairs.map(p => p.topic.trim()).filter(Boolean))];

    if (chapterNames.length === 0 || topicNames.length === 0) {
      return NextResponse.json({});
    }

    // Fetch matching chapters by name
    const { data: chapters, error: chapErr } = await supabase
      .from('chapters')
      .select('id, name')
      .in('name', chapterNames);

    if (chapErr) throw chapErr;
    if (!chapters?.length) return NextResponse.json({});

    const chapterIds = chapters.map(c => c.id);

    // Fetch matching topics that belong to those chapters
    const { data: topics, error: topErr } = await supabase
      .from('topics')
      .select('id, name, chapter_id')
      .in('chapter_id', chapterIds)
      .in('name', topicNames);

    if (topErr) throw topErr;
    if (!topics?.length) return NextResponse.json({});

    // Build result map: "chapter_name_lower||topic_name_lower" → topic_id
    const chapterMap = new Map(chapters.map(c => [c.id, c.name.trim().toLowerCase()]));
    const result: Record<string, string> = {};

    for (const topic of topics) {
      const chapterName = chapterMap.get(topic.chapter_id);
      if (!chapterName) continue;
      const key = `${chapterName}||${topic.name.trim().toLowerCase()}`;
      result[key] = topic.id;
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[POST /api/admin/resolve-topic]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}