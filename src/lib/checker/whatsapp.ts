// Shared WhatsApp helpers for the checker feature. No WhatsApp Business
// API/Twilio integration exists anywhere in this project (confirmed by
// search) — sending is done via a plain wa.me deep link (opens WhatsApp
// with the message pre-filled; the teacher taps send themselves), the same
// no-credentials pattern already used by contact/page.tsx and
// ReferralSection.tsx.
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
