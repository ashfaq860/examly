// app/api/admin/resolve-topic/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

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
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

  try {
    const pairs: { chapter: string; topic: string }[] = await req.json();

    if (!Array.isArray(pairs) || pairs.length === 0) {
      return NextResponse.json({});
    }

    const norm = (s: string) => s.trim().toLowerCase();

    // Get unique chapter/topic names to match against
    const chapterNamesNorm = new Set(pairs.map(p => norm(p.chapter)).filter(Boolean));
    const topicNamesNorm   = new Set(pairs.map(p => norm(p.topic)).filter(Boolean));

    if (chapterNamesNorm.size === 0 || topicNamesNorm.size === 0) {
      return NextResponse.json({});
    }

    // Chapter/topic names in the DB sometimes carry stray leading/trailing
    // whitespace from manual data entry (confirmed: several dozen rows across
    // the tables). An exact `.in()` match against the raw column would
    // silently miss those — e.g. a chapter stored as "Laboratory and
    // Practical skills " (trailing space) would never match the trimmed
    // name from an import file, failing every row under it. Both tables are
    // small, so fetch and compare trimmed/lowercased names in JS instead.
    const { data: chapters, error: chapErr } = await supabase
      .from('chapters')
      .select('id, name');

    if (chapErr) throw chapErr;
    if (!chapters?.length) return NextResponse.json({});

    const matchedChapters = chapters.filter(c => chapterNamesNorm.has(norm(c.name)));
    if (!matchedChapters.length) return NextResponse.json({});

    const chapterIds = matchedChapters.map(c => c.id);

    // Fetch topics belonging to those chapters, then filter by normalized name
    const { data: topics, error: topErr } = await supabase
      .from('topics')
      .select('id, name, chapter_id')
      .in('chapter_id', chapterIds);

    if (topErr) throw topErr;
    if (!topics?.length) return NextResponse.json({});

    // Build result map: "chapter_name_lower||topic_name_lower" → topic_id
    const chapterMap = new Map(matchedChapters.map(c => [c.id, norm(c.name)]));
    const result: Record<string, string> = {};

    for (const topic of topics) {
      if (!topicNamesNorm.has(norm(topic.name))) continue;
      const chapterName = chapterMap.get(topic.chapter_id);
      if (!chapterName) continue;
      const key = `${chapterName}||${norm(topic.name)}`;
      result[key] = topic.id;
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[POST /api/admin/resolve-topic]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}