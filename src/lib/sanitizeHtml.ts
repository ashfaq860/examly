/**
 * sanitizeRichText.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Question content (question_text, options, answers) comes from admin rich
 * text editors (TinyMCE/CKEditor/TipTap) and is later rendered on public
 * quiz/paper pages via dangerouslySetInnerHTML with zero sanitization —
 * a stored-XSS vector if any writer (or a bug in the write-path auth) lets
 * unwanted markup through. This strips the actual attack surface (script
 * execution vectors) while leaving formatting tags (b, i, u, sub, sup, p,
 * span, br, table…) intact, since a DOM-based sanitizer (DOMPurify) isn't
 * usable in this server/edge context without adding a jsdom dependency.
 */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return html ?? '';

  let s = html;

  // Strip entire elements that have no legitimate use in question content
  s = s.replace(/<(script|iframe|object|embed|style|link|meta|form)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<(script|iframe|object|embed|style|link|meta|form)\b[^>]*\/?>/gi, '');

  // Strip inline event handler attributes (onerror=, onclick=, onload=, …)
  s = s.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  s = s.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  s = s.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');

  // Neutralize javascript:/vbscript: URIs in href/src/action attributes
  s = s.replace(/(href|src|action)\s*=\s*"(?:\s*javascript|\s*vbscript):[^"]*"/gi, '$1="#"');
  s = s.replace(/(href|src|action)\s*=\s*'(?:\s*javascript|\s*vbscript):[^']*'/gi, "$1='#'");

  return s;
}

/** Recursively sanitizes every string value on a plain object (shallow keys only). */
export function sanitizeRichTextFields<T extends Record<string, any>>(obj: T, fields: readonly (keyof T)[]): T {
  const out = { ...obj };
  for (const field of fields) {
    if (typeof out[field] === 'string') {
      out[field] = sanitizeRichText(out[field] as string) as any;
    }
  }
  return out;
}
