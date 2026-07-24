// Lets a page give a dynamic URL segment (a paper/submission id, etc.) a
// human-readable breadcrumb label — BreadcrumbAuto only ever sees the raw
// URL, so on its own it title-cases whatever's in the segment, which for a
// UUID is just the UUID. AcademyLayout renders BreadcrumbAuto once for
// every /dashboard/* page, so a page several levels down (e.g.
// /dashboard/checker/[paperId]) has no direct way to reach it — this
// context is that channel: the page calls useBreadcrumbLabel(id, title),
// BreadcrumbAuto reads the result via useBreadcrumbLabels().
//
// Split into two contexts on purpose: the API (setLabel/clearLabel) is
// stable for the provider's whole lifetime (useCallback, empty deps), but
// the data (labels) changes every time a page registers one. A single
// context carrying both would hand useBreadcrumbLabel's effect a new
// object every time ANY page's label changed, and since that effect's own
// cleanup+run calls setLabel/clearLabel, that new object would re-trigger
// the effect — a clear-then-set infinite loop. Subscribing to the API
// context only means the effect's deps never change on their own.
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type LabelsMap = Record<string, string>;

interface BreadcrumbLabelsApi {
  setLabel: (segment: string, label: string) => void;
  clearLabel: (segment: string) => void;
}

const BreadcrumbLabelsDataContext = createContext<LabelsMap>({});
const BreadcrumbLabelsApiContext = createContext<BreadcrumbLabelsApi | null>(null);

export function BreadcrumbLabelsProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<LabelsMap>({});

  const setLabel = useCallback((segment: string, label: string) => {
    setLabels(prev => (prev[segment] === label ? prev : { ...prev, [segment]: label }));
  }, []);

  const clearLabel = useCallback((segment: string) => {
    setLabels(prev => {
      if (!(segment in prev)) return prev;
      const next = { ...prev };
      delete next[segment];
      return next;
    });
  }, []);

  const api = useMemo<BreadcrumbLabelsApi>(() => ({ setLabel, clearLabel }), [setLabel, clearLabel]);

  return (
    <BreadcrumbLabelsApiContext.Provider value={api}>
      <BreadcrumbLabelsDataContext.Provider value={labels}>
        {children}
      </BreadcrumbLabelsDataContext.Provider>
    </BreadcrumbLabelsApiContext.Provider>
  );
}

/** Read by BreadcrumbAuto — not meant to be called from a page directly. */
export function useBreadcrumbLabels(): LabelsMap {
  return useContext(BreadcrumbLabelsDataContext);
}

/** Call from a page to give one of its own dynamic URL segments (the raw
 *  string as it appears in the URL, e.g. a paper id) a real label in the
 *  shared dashboard breadcrumb. No-ops outside a BreadcrumbLabelsProvider
 *  (e.g. pages not under AcademyLayout) and while `label` isn't loaded yet. */
export function useBreadcrumbLabel(segment: string | undefined | null, label: string | undefined | null) {
  const api = useContext(BreadcrumbLabelsApiContext);
  useEffect(() => {
    if (!api || !segment || !label) return;
    api.setLabel(segment, label);
    return () => api.clearLabel(segment);
  }, [api, segment, label]);
}
