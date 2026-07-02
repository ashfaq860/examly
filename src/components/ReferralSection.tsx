"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Share2, Mail, Link as LinkIcon, X } from "lucide-react";
import toast from "react-hot-toast";

interface FloatingReferralButtonProps {
  referralCode: string;
}

export default function FloatingReferralButton({ referralCode }: FloatingReferralButtonProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // On generate-paper page a 56px settings FAB sits at bottom:24px right:24px — stack above it
  const bottomOffset = pathname?.startsWith("/dashboard/generate-paper") ? 92 : 24;

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
      style={{
        position: "fixed",
        bottom: bottomOffset,
        right: 27,
        zIndex: 1050,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 12,
      }}
    >
      {/* Panel slides up above the button */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{
              width: "min(280px, calc(100vw - 32px))",
              background: "#fff",
              borderRadius: 16,
              padding: "1rem 1.1rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.06)",
              border: "1px solid rgba(0,0,0,0.07)",
            }}
          >
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "0.92rem", color: "#1ba699" }}>
                🎁 Get 1 Month Free
              </p>
              <p style={{ margin: "3px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                Invite friends &amp; earn rewards
              </p>
            </div>

            {/* Share buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a
                href={`https://wa.me/?text=Join%20using%20my%20referral%20link:%20${encodeURIComponent(referralLink)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "0.5rem 0.75rem", borderRadius: 10, textDecoration: "none",
                  background: "#25D366", color: "#fff",
                  fontWeight: 600, fontSize: "0.82rem",
                }}
              >
                <Share2 size={15} /> WhatsApp
              </a>

              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "0.5rem 0.75rem", borderRadius: 10, textDecoration: "none",
                  background: "#1877F2", color: "#fff",
                  fontWeight: 600, fontSize: "0.82rem",
                }}
              >
                <Share2 size={15} /> Facebook
              </a>

              <a
                href={`mailto:?subject=Get 1 Month Free&body=Join using my referral link: ${encodeURIComponent(referralLink)}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "0.5rem 0.75rem", borderRadius: 10, textDecoration: "none",
                  background: "transparent", color: "#64748b",
                  fontWeight: 600, fontSize: "0.82rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <Mail size={15} /> Email
              </a>

              <button
                onClick={copyToClipboard}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "0.5rem 0.75rem", borderRadius: 10,
                  background: "transparent", color: "#1ba699",
                  fontWeight: 600, fontSize: "0.82rem", cursor: "pointer",
                  border: "1px solid rgba(27,166,153,0.35)",
                  fontFamily: "inherit",
                }}
              >
                <LinkIcon size={15} /> Copy Link
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating trigger button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => setOpen(!open)}
        aria-label="Refer & Earn"
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: "linear-gradient(135deg, #1ba699 0%, #0e7a71 100%)",
          boxShadow: "0 4px 18px rgba(27,166,153,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        <motion.span
          key={open ? "close" : "gift"}
          initial={{ rotate: -30, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.18 }}
          style={{ display: "flex" }}
        >
          {open ? <X size={20} /> : <Gift size={20} />}
        </motion.span>
      </motion.button>
    </div>
  );
}
