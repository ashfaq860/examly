// Single source of truth for physical page dimensions, shared between
// PaperLayoutRenderer.tsx (actual sheet/slot sizing + print @page) and
// PaperBuilderApp.tsx (mobile preview scaling + screen/print CSS), so the
// two never drift out of sync when a new page size is added.
//
// px values assume the standard 96dpi CSS reference (1mm = 96/25.4px),
// matching how these dimensions were already hardcoded before this file
// existed (e.g. 210mm -> 793.7px).

export type PageSizeKey = 'a4' | 'legal';

interface PageSizeDef {
  /** Value for the print `@page { size: ... }` rule. */
  cssName: string;
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
}

const MM_TO_PX = 96 / 25.4;
const toPx = (mm: number) => Math.round(mm * MM_TO_PX * 10) / 10;

const dims = (cssName: string, widthMm: number, heightMm: number): PageSizeDef => ({
  cssName, widthMm, heightMm,
  widthPx: toPx(widthMm), heightPx: toPx(heightMm),
});

export const PAGE_SIZES: Record<PageSizeKey, PageSizeDef> = {
  a4:    dims('A4', 210, 297),
  legal: dims('legal', 215.9, 355.6),
};

export const getPageSize = (key?: string | null): PageSizeDef =>
  PAGE_SIZES[(key as PageSizeKey)] || PAGE_SIZES.a4;
