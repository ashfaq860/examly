/**
 * renderHtmlWithMath.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces the old stripHtml() + <MathRenderer> pattern.
 *
 * Problem with the old approach:
 *   stripHtml() removes ALL HTML tags, destroying TinyMCE rich formatting:
 *   bold, italic, underline, subscript (H₂O), superscript (x²), line-breaks.
 *
 * This utility:
 *   1. Preserves safe HTML formatting tags from TinyMCE output
 *   2. Applies Urdu-in-math preprocessing (\text{} wrapping)
 *   3. Converts all LaTeX delimiters to static KaTeX HTML via renderToString()
 *      — static HTML is more reliable for print than React KaTeX components
 *   4. Returns an HTML string safe for dangerouslySetInnerHTML
 *
 * Supported delimiters (in processing order to avoid conflicts):
 *   \[…\]   display math
 *   $$…$$   display math (alt)
 *   \(…\)   inline math
 *   $…$     inline math (skips pure currency amounts like $5, $10.99)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import katex from 'katex';
import { preprocessMathHtml } from './katexPreprocess';

// ── helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderKatex(formula: string, displayMode: boolean): string {
  try {
    return katex.renderToString(formula.trim(), {
      displayMode,
      throwOnError: false,
      output: 'html',
      trust: false,
    });
  } catch {
    return `<span class="katex-error" style="color:#c92a2a;font-size:0.82em;font-family:monospace">${escapeHtml(formula)}</span>`;
  }
}

/** Looks like a LaTeX formula rather than plain currency (e.g. $5.00). */
function isMathNotCurrency(f: string): boolean {
  const t = f.trim();
  // Pure number: $5  $10.99  $1,000 → treat as currency
  if (/^\d[\d,]*([.]\d{1,2})?$/.test(t)) return false;
  return true;
}

// ── core normalisation ────────────────────────────────────────────────────────

function normalizeDelimiters(html: string): string {
  return html
    // Fix double-escaped delimiters that come from DB sanitization
    .replace(/\\\\\(/g, '\\(')
    .replace(/\\\\\)/g, '\\)')
    .replace(/\\\\\[/g, '\\[')
    .replace(/\\\\\]/g, '\\]')
    // TinyMCE sometimes encodes backslash in attribute values → decode
    .replace(/&#92;/g, '\\');
}

// ── main export ───────────────────────────────────────────────────────────────

/**
 * Convert an HTML string (TinyMCE / TipTap output) that may contain LaTeX
 * math delimiters into safe, print-ready HTML.
 *
 * - HTML formatting tags (strong, em, u, sub, sup, br, p, span…) are kept.
 * - Math formulas are rendered to static KaTeX HTML.
 * - Urdu text inside math is wrapped with \text{} automatically.
 *
 * Safe for dangerouslySetInnerHTML when the source is your own DB content.
 */
export function renderHtmlWithMath(html: string | null | undefined): string {
  if (!html) return '';

  // 1. Normalise escaped delimiters
  let s = normalizeDelimiters(html);

  // 2. Preprocess Urdu text inside math (wrap with \text{})
  s = preprocessMathHtml(s);

  // 3. Display math: \[…\]
  //    Wrapped in <span class="paper-math-display"> to stay inline-block in RTL contexts
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_, f) => {
    const rendered = renderKatex(f, true);
    return `<span class="paper-math-display">${rendered}</span>`;
  });

  // 4. Display math: $$…$$
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, f) => {
    const rendered = renderKatex(f, true);
    return `<span class="paper-math-display">${rendered}</span>`;
  });

  // 5. Inline math: \(…\)
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_, f) => renderKatex(f, false));

  // 6. Inline math: $…$  (carefully skip currency amounts)
  //    The negative look-ahead [^\$\n<>] keeps it from crossing tag boundaries.
  s = s.replace(/\$([^\$\n<>]{1,400}?)\$/g, (match, f) => {
    if (!isMathNotCurrency(f)) return match;
    return renderKatex(f, false);
  });

  // 7. Clean up TinyMCE paragraph margin so it matches the paper line-height
  //    (don't use margin:0 globally — it would affect spacing between lines)
  s = s.replace(/<p>/gi, '<p style="margin:0 0 0.12em 0">');
  s = s.replace(/<p style="[^"]*margin-bottom\s*:\s*[^;"]+[^"]*"/gi, (tag) =>
    tag.replace(/margin-bottom\s*:\s*[^;"]*/i, 'margin-bottom:0.12em')
  );

  return s;
}

/**
 * Strip HTML tags while preserving LaTeX math delimiters.
 * Use only for plain-text contexts (e.g. option length calculations,
 * EditableText value initialisation — NOT for paper rendering).
 */
export function stripHtmlKeepMath(html: string | null | undefined): string {
  if (!html) return '';
  let s = normalizeDelimiters(html);
  // Remove HTML tags; replace block-level tags with a space
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/?(p|div|li|tr|td|th|h[1-6])[^>]*>/gi, ' ');
  s = s.replace(/<\/?[^>]+(>|$)/g, '');
  s = s.replace(/&nbsp;/g, ' ');
  s = s.replace(/&amp;/g, '&');
  s = s.replace(/&lt;/g, '<');
  s = s.replace(/&gt;/g, '>');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}
