// After a new deploy (or a dev-server restart), a browser tab that's been open
// since the previous build still references old, now-missing chunk filenames.
// Any client-side navigation to a not-yet-visited route then throws
// ChunkLoadError instead of just fetching HTML fresh. Detect that specific
// error and force one hard reload so the tab picks up the current build.
const FLAG_KEY = 'examly:chunk-reload-at';
const RELOAD_COOLDOWN_MS = 10_000;

export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, message } = error as { name?: string; message?: string };
  return name === 'ChunkLoadError' || /Loading (chunk|CSS chunk) [\w.-]+ failed/i.test(message ?? '');
}

// Returns true if a reload was triggered, false if one already ran recently
// (avoids a reload loop when the failure isn't actually a stale-build issue).
export function reloadForChunkError(): boolean {
  const last = Number(sessionStorage.getItem(FLAG_KEY) || 0);
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
  sessionStorage.setItem(FLAG_KEY, String(Date.now()));
  window.location.reload();
  return true;
}
