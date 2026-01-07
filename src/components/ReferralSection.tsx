// src/components/ReferralSection.tsx
"use client";

import { motion } from "framer-motion";
import { Share2, Mail as MailIcon, Link as LinkIcon } from "lucide-react";
import toast from "react-hot-toast";

interface ReferralSectionProps {
  referralCode: string;
}

export default function ReferralSection({ referralCode }: ReferralSectionProps) {
  const getReferralLink = () => `${window.location.origin}/auth/signup?ref=${referralCode}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copied!");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded shadow-sm p-4 mt-1 mb-4 border border-success"
    >
      <h5 className="fw-bold text-success mb-2">
        🎁 Invite Friends & Get 1 Month Free
      </h5>
      <p className="text-muted mb-3">
        Share your referral code or link. When someone signs up using it, you earn{" "}
        <strong>1 month free</strong>.
      </p>

      {/* Share Buttons + Referral Link */}
      <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
        <a
          href={`https://wa.me/?text=Join%20using%20my%20referral%20link%20and%20get%201%20month%20free%20trial:%20${encodeURIComponent(
            getReferralLink()
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-success d-flex align-items-center gap-1 flex-shrink-0"
        >
          <Share2 size={16} /> WhatsApp
        </a>

        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            getReferralLink()
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary d-flex align-items-center gap-1 flex-shrink-0"
        >
          <Share2 size={16} /> Facebook
        </a>

        <a
          href={`mailto:?subject=Join and Get 1 Month Free Trial&body=Sign up using my referral link and get 1 month free trial: ${encodeURIComponent(
            getReferralLink()
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline-secondary d-flex align-items-center gap-1 flex-shrink-0"
        >
          <Share2 size={16} /> Email <MailIcon size={16} />
        </a>

        {/* Referral Link & Copy */}
        <div
          className="d-flex align-items-center gap-2 px-3 py-2 rounded flex-shrink-0"
          style={{ background: "#f1f5f9", fontSize: "1rem" }}
        >
          <span className="text-dark text-truncate" style={{ maxWidth: "200px" }}>
            {getReferralLink()}
          </span>
          <button
            className="btn btn-outline-success btn-sm d-flex align-items-center gap-1"
            onClick={() => copyToClipboard(getReferralLink())}
          >
            <LinkIcon size={16} /> Copy
          </button>
        </div>
      </div>

      <small className="text-muted d-block mt-2">
        Referral code/link can be used by multiple users. You earn rewards every time.
      </small>
    </motion.div>
  );
}
