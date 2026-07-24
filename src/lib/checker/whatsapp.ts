// Shared WhatsApp helpers for the checker feature. No WhatsApp Business
// API/Twilio integration exists anywhere in this project (confirmed by
// search) — sending is done via a plain wa.me deep link (opens WhatsApp
// with the message pre-filled; the teacher taps send themselves), the same
// no-credentials pattern already used by contact/page.tsx and
// ReferralSection.tsx. Since there's no Cloud API access token/phone
// number ID configured anywhere, a real document attachment isn't
// possible — the annotated PDF (see annotatePdf.ts) is linked as a signed
// Supabase Storage URL in the message text instead. Switching to the
// WhatsApp Cloud API later would let this send the card as a caption on an
// actual document message instead of a link.
//
// Numbers are stored locally in the same "03XXXXXXXXX" (11-digit) format
// as profiles.cellno (see api/profile/update/route.ts) for consistency
// with the rest of this app — wa.me links need the full international
// form instead, so that conversion only happens at send time, here.

const LOCAL_MOBILE_RE = /^03\d{9}$/;

/** Strips formatting and validates a Pakistani mobile number in local
 *  "03XXXXXXXXX" form. Returns the cleaned 11-digit string, or null if the
 *  input (once digits-only) doesn't match that shape. */
export function normalizeWhatsappNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return LOCAL_MOBILE_RE.test(digits) ? digits : null;
}

/** Builds a wa.me link from a local "03XXXXXXXXX" number and a message —
 *  wa.me requires the full international number with no leading 0/+, so
 *  "03XXXXXXXXX" becomes "92XXXXXXXXXX". */
export function buildWhatsappLink(localNumber: string, message: string): string | null {
  const cleaned = normalizeWhatsappNumber(localNumber);
  if (!cleaned) return null;
  const international = `92${cleaned.slice(1)}`;
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}

export interface ResultCardSection {
  /** null when the section's grading failed outright (see
   *  gradeOrchestrator.ts's SectionOutcome) — shown as "pending review"
   *  rather than a fabricated 0. */
  awarded: number | null;
  max: number;
  status: 'graded' | 'skipped' | 'needs_review';
}

export interface ResultCardParams {
  schoolName: string | null;
  studentName: string | null;
  rollNo: string | null;
  className: string | null;
  subjectName: string | null;
  /** Maps to papers.title — this schema has no separate paper-type/exam-
   *  type column, so the paper's own title fills that line of the card. */
  paperTitle: string | null;
  /** null (or status 'skipped') omits the Objective line entirely — the
   *  paper simply has no MCQ section. */
  mcq: ResultCardSection | null;
  /** Same, for the Subjective line. */
  subjective: ResultCardSection | null;
  totalAwarded: number | null;
  totalMax: number;
  /** Signed Supabase Storage URL to the annotated (ticks + red deduction
   *  comments) copy of the scan — see annotatePdf.ts. Omitted from the
   *  message entirely when not yet generated. */
  annotatedPdfUrl: string | null;
}

function sectionLine(label: string, section: ResultCardSection | null): string | null {
  if (!section || section.status === 'skipped') return null;
  const value = section.awarded == null ? 'pending review' : `${section.awarded} / ${section.max}`;
  return `- ${label}: ${value}`;
}

/** Builds the full "Result Card" text — every field sourced from DB
 *  columns (papers/profiles/submissions), nothing hard-coded. Section
 *  lines are omitted when the paper doesn't have that section; a section
 *  that failed to grade shows "pending review" instead of a number so a
 *  parent never mistakes an ungraded section for a real 0. Shared by the
 *  single-submission "Send result on WhatsApp" button (review page) and
 *  the bulk sender (submissions table) — kept in one place so the two
 *  never drift apart. */
export function buildResultMessage(params: ResultCardParams): string {
  const { schoolName, studentName, rollNo, className, subjectName, paperTitle, mcq, subjective, totalAwarded, totalMax, annotatedPdfUrl } = params;

  const classSubject = [className ? `Class ${className}` : null, subjectName].filter(Boolean).join(' — ');
  const pct = totalAwarded != null && totalMax > 0 ? Math.round((totalAwarded / totalMax) * 1000) / 10 : null;
  const totalValue = totalAwarded == null ? 'pending review' : `${totalAwarded} / ${totalMax}${pct != null ? ` (${pct}%)` : ''}`;

  const lines = [
    '📋 *Result Card*',
    '─────────────────',
    schoolName ? `🏫 ${schoolName}` : null,
    `👤 *${studentName || 'Student'}*${rollNo ? ` (Roll No. ${rollNo})` : ''}`,
    classSubject ? `📚 ${classSubject}` : null,
    paperTitle ? `📄 Paper: ${paperTitle}` : null,
    '',
    '*Marks Obtained*',
    sectionLine('Objective', mcq),
    sectionLine('Subjective', subjective),
    `- *Total: ${totalValue}*`,
    '',
    '✅ Checked with Examly AI Grading',
    annotatedPdfUrl ? `📎 Marked paper: ${annotatedPdfUrl}` : null,
  ];

  return lines.filter((l): l is string => l !== null).join('\n');
}
