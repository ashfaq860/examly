// src/lib/questionPoolCache.ts
//
// In-memory cache for the raw (pre-randomization) question pool behind
// /api/questions. Paper generation re-fetches the same subject/class/
// chapter/type/source combo repeatedly — every rule in a board pattern,
// every "regenerate" click, every teacher generating for the same
// subject — and each fetch was a real network round trip to Supabase.
//
// Only the raw DB rows are cached, keyed by filter signature (NOT by how
// many questions the caller wants). Random selection/shuffling still runs
// fresh against the cached pool on every call, so repeat generations still
// get different questions — only the expensive round trip is skipped.
//
// Invalidated eagerly by any question write (see invalidate()) so paper
// generation never serves a pool containing stale/deleted rows; TTL is a
// backstop in case a write path is ever added without calling invalidate().

interface CacheEntry {
  data: any[];
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

export function buildPoolCacheKey(parts: {
  questionType: string;
  sources: string[];
  classId: string | null;
  subjectId: string | null;
  chapterIds: string[];
  topicIds: string[];
  categoryId: string | null;
  language: string | null;
  difficulty: string | null;
}): string {
  return JSON.stringify({
    t: parts.questionType,
    s: [...parts.sources].sort(),
    c: parts.classId,
    sub: parts.subjectId,
    ch: [...parts.chapterIds].sort(),
    tp: [...parts.topicIds].sort(),
    cat: parts.categoryId,
    lang: parts.language,
    diff: parts.difficulty,
  });
}

export function getCachedPool(key: string): any[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedPool(key: string, data: any[]): void {
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS });

  // Opportunistic cleanup so the map doesn't grow unbounded over the life
  // of the server process — cheap, just dropping already-expired entries.
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expiresAt) cache.delete(k);
    }
  }
}

// Called by every question write path (create/update/delete/import/bulk-delete).
export function invalidateQuestionPoolCache(): void {
  cache.clear();
}
