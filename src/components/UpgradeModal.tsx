// src/components/UpgradeModal.tsx
// Shared upgrade prompt for locked/exhausted subscription features —
// triggered either by a client-side lock (nav item click) or by an API
// response of { error: 'subscription_required' } / { error:
// 'scan_quota_exhausted' }. Two exports sharing the same bilingual copy:
//   - UpgradeModal: dismissible Bootstrap popup (same manual
//     modal-show-d-block pattern as EditPaperModal — no JS bootstrap
//     bundle needed), for use inside client components.
//   - UpgradeScreen: plain full-section variant with no close button, for
//     server-rendered guards (e.g. the checker route segment layout)
//     where hiding a link isn't enough and the page itself must refuse to
//     render the gated content.
'use client';
import Link from 'next/link';
import { Lock, Sparkles, ScanLine, X } from 'lucide-react';

export type UpgradeReason = 'subscription_required' | 'scan_quota_exhausted' | 'seats_exhausted';

const COPY: Record<UpgradeReason, { en: string; ur: string; benefits: { en: string; ur: string }[] }> = {
  subscription_required: {
    en: 'Paper Checker is a premium feature',
    ur: 'پرچہ چیکر ایک پریمیم فیچر ہے',
    benefits: [
      { en: 'Auto-grade MCQ answer sheets from a phone camera scan', ur: 'فون کیمرے سے اسکین کی گئی MCQ جوابی شیٹس کی خودکار جانچ' },
      { en: 'Instant per-question breakdown with manual override', ur: 'فوری سوال بہ سوال تفصیل، دستی تصحیح کے ساتھ' },
      { en: 'One-click gradebook export for the whole class', ur: 'پوری کلاس کی گریڈ بک ایک کلک میں برآمد کریں' },
    ],
  },
  scan_quota_exhausted: {
    en: "You've used all your scans on this plan",
    ur: 'اس پلان کے تمام اسکین استعمال ہو چکے ہیں',
    benefits: [
      { en: 'Upgrade for a larger monthly scan quota', ur: 'زیادہ ماہانہ اسکین کوٹے کے لیے اپ گریڈ کریں' },
      { en: 'Keep grading without interrupting your class', ur: 'اپنی کلاس میں خلل ڈالے بغیر جانچ جاری رکھیں' },
    ],
  },
  seats_exhausted: {
    en: "You've used all the teacher seats on this plan",
    ur: 'اس پلان کی تمام ٹیچر نشستیں استعمال ہو چکی ہیں',
    benefits: [
      { en: 'Upgrade to add more teachers to your academy', ur: 'اپنی اکیڈمی میں مزید اساتذہ شامل کرنے کے لیے اپ گریڈ کریں' },
      { en: 'Every teacher shares the same pooled paper & scan quota', ur: 'ہر ٹیچر ایک ہی مشترکہ پیپر اور اسکین کوٹہ استعمال کرتا ہے' },
    ],
  },
};

function UpgradeBody({ reason }: { reason: UpgradeReason }) {
  const copy = COPY[reason];
  const Icon = reason === 'scan_quota_exhausted' ? ScanLine : Lock;

  return (
    <>
      <div className="upg-icon"><Icon size={22} color="#fff" /></div>
      <h3 className="upg-title">{copy.en}</h3>
      <p className="upg-title-ur" dir="rtl" lang="ur">{copy.ur}</p>

      <ul className="upg-benefits">
        {copy.benefits.map((b, i) => (
          <li key={i}>
            <Sparkles size={14} className="upg-benefit-icon" />
            <span>
              <span className="upg-benefit-en">{b.en}</span>
              <span className="upg-benefit-ur" dir="rtl" lang="ur">{b.ur}</span>
            </span>
          </li>
        ))}
      </ul>

      <Link href="/dashboard/packages" className="upg-cta">
        View plans &amp; pricing <span dir="rtl" lang="ur">— پلانز دیکھیں</span>
      </Link>

      <style jsx>{`
        .upg-icon {
          width: 46px; height: 46px; border-radius: 12px; margin: 0 auto 0.9rem;
          background: linear-gradient(135deg, #101935 0%, #2f4fe0 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 18px rgba(47, 79, 224, 0.3);
        }
        .upg-title { margin: 0; font-size: 1.15rem; font-weight: 800; color: #101935; text-align: center; }
        .upg-title-ur { margin: 3px 0 0; font-size: 0.95rem; color: #686f8c; text-align: center; }
        .upg-benefits { list-style: none; margin: 1.25rem 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .upg-benefits li { display: flex; align-items: flex-start; gap: 9px; font-size: 0.85rem; color: #15192b; }
        .upg-benefit-icon { color: #2f4fe0; flex-shrink: 0; margin-top: 2px; }
        .upg-benefit-en { display: block; }
        .upg-benefit-ur { display: block; font-size: 0.85em; color: #686f8c; margin-top: 1px; }
        :global(.upg-cta) {
          display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap;
          width: 100%; padding: 0.75rem 1rem; border-radius: 11px; text-decoration: none;
          background: linear-gradient(135deg, #101935 0%, #2f4fe0 100%); color: #fff;
          font-weight: 700; font-size: 0.9rem; box-shadow: 0 6px 18px rgba(47, 79, 224, 0.28);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        :global(.upg-cta):hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(47, 79, 224, 0.34); color: #fff; }
      `}</style>
    </>
  );
}

export function UpgradeModal({
  open,
  onClose,
  reason = 'subscription_required',
}: {
  open: boolean;
  onClose: () => void;
  reason?: UpgradeReason;
}) {
  if (!open) return null;

  return (
    <div className="modal show d-block upg-backdrop" style={{ backgroundColor: 'rgba(16,25,53,0.55)' }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-content upg-card">
          <button type="button" className="upg-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
          <div className="upg-card-body">
            <UpgradeBody reason={reason} />
          </div>
        </div>
      </div>
      <style jsx>{`
        .upg-backdrop { z-index: 1200; }
        .upg-card { border: none; border-radius: 18px; overflow: hidden; }
        .upg-card-body { padding: 1.75rem 1.5rem 1.5rem; }
        .upg-close {
          position: absolute; top: 12px; right: 12px; z-index: 1;
          width: 30px; height: 30px; border-radius: 8px; border: none;
          background: #f5f6fb; color: #686f8c; display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .upg-close:hover { background: #eef1ff; color: #2f4fe0; }
      `}</style>
    </div>
  );
}

export function UpgradeScreen({ reason = 'subscription_required' }: { reason?: UpgradeReason }) {
  return (
    <div className="upg-screen">
      <div className="upg-screen-card">
        <UpgradeBody reason={reason} />
      </div>
      <style jsx>{`
        .upg-screen { display: flex; justify-content: center; padding: 3rem 1rem; }
        .upg-screen-card {
          width: 100%; max-width: 420px; background: #fff; border: 1px solid #e6e8f1;
          border-radius: 18px; padding: 2rem 1.5rem; box-shadow: 0 8px 24px rgba(16, 25, 53, 0.08);
        }
      `}</style>
    </div>
  );
}
