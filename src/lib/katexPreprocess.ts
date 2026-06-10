/**
 * katexPreprocess.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Problem:
 *   KaTeX cannot render raw Urdu/Arabic glyphs in math mode.
 *   e.g.  \[ \overline{حاکمیت} \]  →  KaTeX error / garbled output
 *
 * Solution:
 *   Before passing HTML to dangerouslySetInnerHTML, scan every math
 *   delimiter pair and wrap any non-ASCII (Urdu/Arabic/Hindi) character
 *   sequences with \text{...} so KaTeX treats them as text runs.
 *
 *   e.g.  \overline{حاکمیت}  →  \overline{\text{حاکمیت}}
 *         \frac{کمیت}{زمان}  →  \frac{\text{کمیت}}{\text{زمان}}
 *
 * Usage:
 *   import { preprocessMathHtml } from '@/lib/katexPreprocess';
 *   <div dangerouslySetInnerHTML={{ __html: preprocessMathHtml(html) }} />
 *
 * This file is pure TypeScript with no dependencies — safe to import in
 * both browser and Node (SSR) contexts.
 */

/** Matches a contiguous run of Arabic/Urdu/Persian Unicode characters.
 *  Includes:
 *    U+0600–U+06FF  Arabic block (covers Urdu)
 *    U+0750–U+077F  Arabic Supplement
 *    U+FB50–U+FDFF  Arabic Presentation Forms-A
 *    U+FE70–U+FEFF  Arabic Presentation Forms-B
 *    U+0660–U+0669  Arabic-Indic digits (already inside 06xx)
 *  Also includes spaces and zero-width characters so multi-word Urdu
 *  phrases don't get split at word boundaries inside math.
 */
const URDU_RUN = /([\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u200C\u200D\u200F ]+)/g;

/**
 * Wrap bare Urdu/Arabic runs inside a LaTeX math expression with \text{}.
 *
 * Already-wrapped runs (\text{...}) are left untouched.
 * Pure-whitespace runs are left untouched.
 */
function wrapUrduInMath(mathContent: string): string {
  // We need to avoid double-wrapping text that's already inside \text{…}
  // Strategy: split on \text{…} boundaries, only process the non-\text parts.

  // Tokenise: alternate between \text{…} chunks and everything else.
  const parts: string[] = [];
  let cursor = 0;
  // Match \text{ ... } — handle nested braces one level deep
  const textCmd = /\\text\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let m: RegExpExecArray | null;

  while ((m = textCmd.exec(mathContent)) !== null) {
    // Push the segment before this \text{} — this needs Urdu wrapping
    if (m.index > cursor) {
      parts.push(wrapSegment(mathContent.slice(cursor, m.index)));
    }
    // Push the \text{…} verbatim — already safe
    parts.push(m[0]);
    cursor = m.index + m[0].length;
  }
  // Remaining tail
  if (cursor < mathContent.length) {
    parts.push(wrapSegment(mathContent.slice(cursor)));
  }

  return parts.join('');
}

/** Replace Urdu runs in a raw LaTeX segment with \text{run}. */
function wrapSegment(segment: string): string {
  return segment.replace(URDU_RUN, (run) => {
    // Don't wrap if it's only whitespace
    if (/^\s+$/.test(run)) return run;
    return `\\text{${run.trim()}}`;
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   Delimiter pairs to scan.  We process both inline \(…\) and display \[…\]
   as well as $$…$$.  We deliberately skip $…$ (single dollar) to avoid
   false positives with currency/prices in question text.
────────────────────────────────────────────────────────────────────────── */
interface DelimPair {
  open: string;
  close: string;
  display: boolean;
}

const DELIMITERS: DelimPair[] = [
  { open: '\\[',  close: '\\]',  display: true  },
  { open: '\\(',  close: '\\)',  display: false },
  { open: '$$',   close: '$$',   display: true  },
];

/**
 * Scan an HTML string, find all LaTeX delimiter pairs, and rewrite any
 * bare Urdu/Arabic text inside them with \text{…}.
 *
 * We intentionally work at the string level (not DOM level) so this
 * function is safe on both client and server.  We also skip content inside
 * HTML tags (attributes) to avoid corrupting e.g. class="…" values.
 */
export function preprocessMathHtml(html: string | null | undefined): string {
  if (!html) return html ?? '';

  // Quick bailout — nothing to do if no LaTeX delimiters present
  const hasUrdu = URDU_RUN.test(html);
  URDU_RUN.lastIndex = 0; // reset stateful regex
  if (!hasUrdu) return html;

  let result = html;

  for (const delim of DELIMITERS) {
    result = rewriteDelimPairs(result, delim);
  }

  return result;
}

function rewriteDelimPairs(html: string, delim: DelimPair): string {
  const { open, close } = delim;
  const out: string[] = [];
  let pos = 0;

  while (pos < html.length) {
    const openIdx = html.indexOf(open, pos);
    if (openIdx === -1) {
      out.push(html.slice(pos));
      break;
    }

    // Push everything before the opening delimiter verbatim
    out.push(html.slice(pos, openIdx));

    // Find the matching close delimiter
    const closeIdx = html.indexOf(close, openIdx + open.length);
    if (closeIdx === -1) {
      // Unclosed delimiter — push rest verbatim and stop
      out.push(html.slice(openIdx));
      pos = html.length;
      break;
    }

    const mathContent = html.slice(openIdx + open.length, closeIdx);
    const processed   = wrapUrduInMath(mathContent);

    out.push(open + processed + close);
    pos = closeIdx + close.length;
  }

  return out.join('');
}

/* ──────────────────────────────────────────────────────────────────────────
   Convenience: also export a plain-text version (strips HTML first)
────────────────────────────────────────────────────────────────────────── */
export function preprocessMathText(text: string | null | undefined): string {
  if (!text) return text ?? '';
  return preprocessMathHtml(text);
}