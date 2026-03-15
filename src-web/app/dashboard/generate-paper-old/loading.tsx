"use client";
import { motion } from "framer-motion";

export default function Loading() {
  // Animation settings for a high-end feel
  const transition = {
    duration: 1.5,
    repeat: Infinity,
    repeatType: "reverse" as const,
    ease: [0.16, 1, 0.3, 1], // Premium cubic-bezier easing
  };

  return (
    <div className="d-flex flex-column justify-content-center align-items-center" style={{ height: '80vh', backgroundColor: '#fff' }}>
      <div className="position-relative" style={{ width: '250px', height: '100px' }}>
        
        {/* PIECE 1: Left Wing (Clipped) */}
        <motion.div
          initial={{ x: -60, y: 20, rotate: -15, opacity: 0 }}
          animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          transition={transition}
          className="position-absolute w-100 h-100"
          style={{
            clipPath: 'inset(0 65% 0 0)', // Shows only the left side
          }}
        >
          <img src="/examly.png" alt="logo-left" className="w-100 h-100 object-fit-contain" />
        </motion.div>

        {/* PIECE 2: Center Pillar (Clipped) */}
        <motion.div
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ ...transition, duration: 1 }}
          className="position-absolute w-100 h-100"
          style={{
            clipPath: 'inset(0 35% 0 35%)', // Shows only the middle
          }}
        >
          <img src="/examly.png" alt="logo-center" className="w-100 h-100 object-fit-contain" />
        </motion.div>

        {/* PIECE 3: Right Wing (Clipped) */}
        <motion.div
          initial={{ x: 60, y: -20, rotate: 15, opacity: 0 }}
          animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          transition={transition}
          className="position-absolute w-100 h-100"
          style={{
            clipPath: 'inset(0 0 0 65%)', // Shows only the right side
          }}
        >
          <img src="/examly.png" alt="logo-right" className="w-100 h-100 object-fit-contain" />
        </motion.div>

      </div>

      {/* Subtle Progress Text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="mt-4 text-muted small fw-bold tracking-widest text-uppercase"
        style={{ letterSpacing: '3px' }}
      >
        Loading...
      </motion.div>
    </div>
  );
}