// src/hooks/useEntitlements.ts
// Client-side entitlement state, backed by GET /api/me/entitlements
// (itself backed by the get_active_package RPC). This is the ONLY thing
// that should decide what the UI shows/hides — the API routes underneath
// still enforce everything server-side via requireFeature/hasFeature, so
// this hook is purely for nav locks, upgrade prompts, and the
// scans-remaining badge, never the last line of defense.
'use client';
import { useCallback, useEffect, useState } from 'react';

export interface Entitlements {
  features: string[];
  papersRemaining: number | null;
  scansRemaining: number | null;
  viaAcademy: string | null;
}

const EMPTY: Entitlements = {
  features: [],
  papersRemaining: null,
  scansRemaining: null,
  viaAcademy: null,
};

export function useEntitlements() {
  const [entitlements, setEntitlements] = useState<Entitlements>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/me/entitlements');
      if (!res.ok) {
        setEntitlements(EMPTY);
        return;
      }
      const data = await res.json();
      setEntitlements({
        features: data.features || [],
        papersRemaining: data.papersRemaining ?? null,
        scansRemaining: data.scansRemaining ?? null,
        viaAcademy: data.viaAcademy ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entitlements');
      setEntitlements(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const hasFeature = useCallback(
    (feature: string) => entitlements.features.includes(feature),
    [entitlements.features]
  );

  return { ...entitlements, hasFeature, loading, error, refresh };
}
