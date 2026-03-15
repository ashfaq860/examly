//app/dashboard/generate-paper/loading.tsx
"use client";
import { motion } from "framer-motion";

export default function Loading() {
  // Flapping animation settings
  const wingTransition = {
    duration: 0.8,
    repeat: Infinity,
    repeatType: "mirror" as const,
    ease: "easeInOut",
  };

  return (
    <div className="d-flex flex-column justify-content-center align-items-center" style={{ height: '80vh' }}>
      <div className="position-relative" style={{ width: '200px', height: '200px' }}>
        
        {/* PIECE 1: Left Wing */}
        <motion.div
          animate={{ 
            rotateY: [0, 45], // Flaps "back" in 3D space
            skewY: [0, -10],  // Adds a natural organic lift
          }}
          transition={wingTransition}
          className="position-absolute w-100 h-100"
          style={{
            clipPath: 'inset(0 66% 0 0)',
            transformOrigin: 'center', // Pivots from the edge of the center pillar
          }}
        >
          <img src="/loading.png" alt="logo-left" className="w-100 h-100 object-fit-contain" />
        </motion.div>

        {/* PIECE 2: Center Pillar (Body) */}
        <motion.div
          animate={{ 
            y: [0, -10, 0], // Subtle bobbing up and down
          }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="position-absolute w-100 h-100"
          style={{
            clipPath: 'inset(0 34% 0 34%)',
          }}
        >
          <img src="/loading.png" alt="logo-center" className="w-100 h-100 object-fit-contain" />
        </motion.div>

        {/* PIECE 3: Right Wing */}
        <motion.div
          animate={{ 
            rotateY: [0, -45], 
            skewY: [0, 10],
          }}
          transition={wingTransition}
          className="position-absolute w-100 h-100"
          style={{
            clipPath: 'inset(0 0 0 66%)',
            transformOrigin: 'center',
          }}
        >
          <img src="/loading.png" alt="logo-right" className="w-100 h-100 object-fit-contain" />
        </motion.div>

      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="mt-4 text-muted small fw-bold text-uppercase"
        style={{ letterSpacing: '3px' }}
      >
        Loading...
      </motion.div>
    </div>
  );
}