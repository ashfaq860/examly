// src/components/DiagramView.tsx
'use client';
import React from 'react';

// The `diagram` field is stored as either a URL to an externally hosted
// image, OR raw inline SVG markup (e.g. `<svg xmlns="...">...</svg>`) —
// most existing rows are the latter, pasted/imported directly rather than
// uploaded somewhere and linked. A raw SVG string can't be used as an
// <img src> value (it just renders as a broken image), so it needs its
// own dangerouslySetInnerHTML render path instead.
const isRawSvgMarkup = (value: string): boolean => /^\s*<svg[\s>]/i.test(value);

// SVG markup isn't sanitized on the way in (it was never treated as an
// HTML-rendering sink before), and inline SVG rendered via
// dangerouslySetInnerHTML — unlike `<img src="x.svg">` — DOES execute
// embedded <script>/event-handler content. Strip the same categories the
// rest of the app already strips from rich-text fields (see
// src/lib/sanitizeHtml.ts) before it ever reaches the DOM.
const sanitizeSvgMarkup = (svg: string): string => {
  let s = svg;
  s = s.replace(/<(script|iframe|object|embed|style|link|meta|form)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<(script|iframe|object|embed|style|link|meta|form)\b[^>]*\/?>/gi, '');
  s = s.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  s = s.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  s = s.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  s = s.replace(/(href|src|xlink:href)\s*=\s*"(?:\s*javascript|\s*vbscript):[^"]*"/gi, '$1="#"');
  s = s.replace(/(href|src|xlink:href)\s*=\s*'(?:\s*javascript|\s*vbscript):[^']*'/gi, "$1='#'");
  return s;
};

interface DiagramViewProps {
  diagram?: string | null;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  alt?: string;
  title?: string;
}

export const DiagramView: React.FC<DiagramViewProps> = ({ diagram, className, style, onClick, alt = 'Diagram', title }) => {
  if (!diagram) return null;

  if (isRawSvgMarkup(diagram)) {
    return (
      <div
        className={className}
        style={style}
        onClick={onClick}
        title={title}
        role={onClick ? 'button' : undefined}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(diagram) }}
      />
    );
  }

  return (
    <img
      src={diagram}
      alt={alt}
      title={title}
      className={className}
      style={style}
      onClick={onClick}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
};
