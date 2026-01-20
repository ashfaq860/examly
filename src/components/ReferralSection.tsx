"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift,
  Share2,
  Mail,
  Link as LinkIcon,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

interface FloatingReferralButtonProps {
  referralCode: string;
}

export default function FloatingReferralButton({
  referralCode,
}: FloatingReferralButtonProps) {
  const [open, setOpen] = useState(false);

  const referralLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/signup?ref=${referralCode}`
      : "";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied!");
  };

  return (
    <div
      className="position-fixed end-0 top-50 translate-middle-y"
      style={{ zIndex: 1050 }}
    >
      {/* Floating Main Button */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen(!open)}
        className="btn btn-success rounded-circle shadow d-flex align-items-center justify-content-center"
        style={{
          width: "56px",
          height: "56px",
        }}
        aria-label="Refer & Earn"
      >
        {open ? <X size={22} /> : <Gift size={22} />}
      </motion.button>

      {/* Slide-out Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="bg-white shadow-lg rounded-4 p-3 mt-2 me-2 border"
            style={{ width: "260px" }}
          >
            <div className="text-center mb-3">
              <div className="fw-bold text-success">
                🎁 Get 1 Month Free
              </div>
              <small className="text-muted">
                Invite friends & earn rewards
              </small>
            </div>

            <div className="d-grid gap-2">
              <a
                href={`https://wa.me/?text=Join%20using%20my%20referral%20link:%20${encodeURIComponent(
                  referralLink
                )}`}
                target="_blank"
                className="btn btn-success btn-sm d-flex align-items-center justify-content-center gap-2 rounded-3"
              >
                <Share2 size={16} /> WhatsApp
              </a>

              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                  referralLink
                )}`}
                target="_blank"
                className="btn btn-primary btn-sm d-flex align-items-center justify-content-center gap-2 rounded-3"
              >
                <Share2 size={16} /> Facebook
              </a>

              <a
                href={`mailto:?subject=Get 1 Month Free&body=Join using my referral link: ${encodeURIComponent(
                  referralLink
                )}`}
                className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center gap-2 rounded-3"
              >
                <Mail size={16} /> Email
              </a>

              <button
                onClick={copyToClipboard}
                className="btn btn-outline-success btn-sm d-flex align-items-center justify-content-center gap-2 rounded-3"
              >
                <LinkIcon size={16} /> Copy Link
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
