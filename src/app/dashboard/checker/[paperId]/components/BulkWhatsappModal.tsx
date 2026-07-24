// Bulk WhatsApp result sender — a "send queue" the teacher taps through,
// not a true one-click broadcast. There is no WhatsApp Business API/Twilio
// integration anywhere in this project (see lib/checker/whatsapp.ts): each
// wa.me link only opens a pre-filled chat for ONE recipient at a time, and
// only the person signed into that browser's WhatsApp can actually hit
// Send — nothing server-side can do that on their behalf. This still saves
// real effort over the single-submission flow (open review page -> find
// the button -> come back, once per student): everything is queued here,
// each tap opens the right chat pre-filled, and the queue tracks who's
// already been done for this session.
'use client';

import { useState } from 'react';
import { MessageCircle, X, Check } from 'lucide-react';
import { buildWhatsappLink, buildResultMessage, ResultCardSection } from '@/lib/checker/whatsapp';

export interface BulkSendItem {
  id: string;
  studentName: string | null;
  rollNo: string | null;
  whatsappNumber: string;
  mcq: ResultCardSection | null;
  subjective: ResultCardSection | null;
  totalAwarded: number | null;
  totalMax: number;
}

export function BulkWhatsappModal({
  items,
  schoolName,
  className,
  subjectName,
  paperTitle,
  onClose,
}: {
  items: BulkSendItem[];
  schoolName: string | null;
  className: string | null;
  subjectName: string | null;
  paperTitle: string | null;
  onClose: () => void;
}) {
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);

  const send = async (item: BulkSendItem) => {
    setSendingId(item.id);
    // Open the tab synchronously (inside the click handler) so browser
    // popup blockers don't treat it as an unsolicited window — its
    // destination is set once the signed PDF URL below comes back.
    const tab = window.open('', '_blank', 'noopener,noreferrer');
    try {
      let annotatedPdfUrl: string | null = null;
      try {
        const res = await fetch(`/api/checker/submissions/${item.id}/annotated-url`, { method: 'POST' });
        if (res.ok) annotatedPdfUrl = (await res.json()).url ?? null;
      } catch { /* no annotated PDF yet — message still sends without the link */ }

      const message = buildResultMessage({
        schoolName,
        studentName: item.studentName,
        rollNo: item.rollNo,
        className,
        subjectName,
        paperTitle,
        mcq: item.mcq,
        subjective: item.subjective,
        totalAwarded: item.totalAwarded,
        totalMax: item.totalMax,
        annotatedPdfUrl,
      });
      const href = buildWhatsappLink(item.whatsappNumber, message);
      if (href && tab) tab.location.href = href;
      else tab?.close();
      setSentIds(prev => new Set(prev).add(item.id));
    } finally {
      setSendingId(null);
    }
  };

  const sentCount = items.filter(i => sentIds.has(i.id)).length;

  return (
    <div className="chk-bwa-backdrop" onClick={onClose}>
      <div className="chk-bwa-panel" onClick={e => e.stopPropagation()}>
        <div className="chk-bwa-hd">
          <div>
            <h2 className="chk-bwa-title"><MessageCircle size={16} /> Send results on WhatsApp</h2>
            <p className="chk-bwa-sub">{sentCount} of {items.length} sent this session</p>
          </div>
          <button type="button" className="chk-bwa-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <p className="chk-bwa-hint">
          Each "Send" opens WhatsApp with the result pre-filled for that student — you still tap Send yourself in WhatsApp, one chat at a time.
        </p>

        <ul className="chk-bwa-list">
          {items.map(item => {
            const sent = sentIds.has(item.id);
            return (
              <li key={item.id} className="chk-bwa-row">
                <div className="chk-bwa-info">
                  <span className="chk-bwa-name">{item.studentName || 'Unnamed'}</span>
                  <span className="chk-bwa-meta">
                    {item.rollNo ? `Roll ${item.rollNo} · ` : ''}
                    <span className="chk-mono">{item.totalAwarded ?? '—'}/{item.totalMax}</span>
                    {' · '}{item.whatsappNumber}
                  </span>
                </div>
                <button
                  type="button"
                  className={`chk-btn ${sent ? 'chk-btn-ghost' : 'chk-btn-primary'} chk-bwa-send-btn`}
                  onClick={() => send(item)}
                  disabled={sendingId === item.id}
                >
                  {sendingId === item.id ? 'Preparing…' : sent ? <><Check size={14} /> Sent — resend</> : <>Send</>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <style jsx>{`
        .chk-bwa-backdrop {
          position: fixed; inset: 0; background: rgba(16, 25, 53, 0.45); z-index: 1000;
          display: flex; align-items: center; justify-content: center; padding: 1rem;
        }
        .chk-bwa-panel {
          background: var(--chk-surface); border-radius: var(--chk-radius-lg); box-shadow: var(--chk-shadow-md);
          width: 100%; max-width: 30rem; max-height: 85vh; display: flex; flex-direction: column;
          padding: 1.1rem; gap: 0.75rem;
        }
        .chk-bwa-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .chk-bwa-title { margin: 0; font-size: 1rem; font-weight: 800; color: var(--chk-navy); display: flex; align-items: center; gap: 8px; }
        .chk-bwa-sub { margin: 2px 0 0; font-size: 0.8rem; color: var(--chk-muted); }
        .chk-bwa-close { border: none; background: none; cursor: pointer; color: var(--chk-muted); padding: 4px; display: flex; }
        .chk-bwa-hint { margin: 0; font-size: 0.78rem; color: var(--chk-muted); line-height: 1.4; }

        .chk-bwa-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
        .chk-bwa-row {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 0.6rem 0.7rem; background: var(--chk-bg); border-radius: var(--chk-radius-md); flex-wrap: wrap;
        }
        .chk-bwa-info { display: flex; flex-direction: column; min-width: 0; }
        .chk-bwa-name { font-weight: 600; color: var(--chk-navy); font-size: 0.87rem; }
        .chk-bwa-meta { font-size: 0.76rem; color: var(--chk-muted); }
        .chk-bwa-send-btn { padding: 0.4rem 0.85rem; font-size: 0.78rem; flex-shrink: 0; }
      `}</style>
    </div>
  );
}
