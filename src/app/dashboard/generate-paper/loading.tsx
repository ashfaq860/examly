"use client";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

// Added a prop to control if it should be full screen or local
export default function Loading({ fullScreen = false, message = "Loading..." }: { fullScreen?: boolean; message?: string }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const wingTransition = {
    duration: 0.5,
    repeat: Infinity,
    repeatType: "mirror" as const,
    ease: "easeInOut",
  };

  return (
    <div 
      className={`d-flex flex-column justify-content-center align-items-center 
        ${fullScreen ? 'position-fixed top-0 start-0 w-100 vh-100 bg-white' : 'w-100 h-100 py-5'}`} 
      style={{ zIndex: 9999, overflow: 'hidden', minHeight: fullScreen ? 'auto' : '300px' }}
    >
      <motion.div 
        className="position-relative" 
        style={{ 
          width: fullScreen ? '200px' : '120px', // Smaller scale when inside modal
          height: fullScreen ? '200px' : '120px', 
          transformStyle: 'preserve-3d' 
        }}
        animate={isReady ? { 
          x: [0, -50, 1000], 
          y: [0, 50, -1000], 
          scale: [1, 1.2, 0.3],
          opacity: [1, 1, 0],
          transition: { duration: 1.2, ease: "easeIn" }
        } : { 
          y: [0, -10, 0] 
        }}
        transition={!isReady ? { duration: 2, repeat: Infinity } : {}}
      >
        
        {/* LEFT WING */}
        <motion.div
          animate={{ rotateY: [0, 50] }}
          transition={wingTransition}
          className="position-absolute w-100 h-100"
          style={{
            clipPath: 'inset(0 65% 0 0)',
            transformOrigin: '35% center',
            backfaceVisibility: 'hidden'
          }}
        >
          <img src="/loading.png" alt="wing" className="w-100 h-100 object-fit-contain" />
        </motion.div>

        {/* CENTER BODY */}
        <motion.div
          className="position-absolute w-100 h-100"
          style={{ clipPath: 'inset(0 33% 0 33%)' }}
        >
          <img src="/loading.png" alt="body" className="w-100 h-100 object-fit-contain" />
        </motion.div>

        {/* RIGHT WING */}
        <motion.div
          animate={{ rotateY: [0, -50] }}
          transition={wingTransition}
          className="position-absolute w-100 h-100"
          style={{
            clipPath: 'inset(0 0 0 65%)',
            transformOrigin: '65% center',
            backfaceVisibility: 'hidden'
          }}
        >
          <img src="/loading.png" alt="wing" className="w-100 h-100 object-fit-contain" />
        </motion.div>

      </motion.div>

      <motion.div
        animate={isReady ? { opacity: 0 } : { opacity: [0, 1, 0.5] }}
        className="mt-3 text-primary fw-bold small text-uppercase"
        style={{ letterSpacing: '3px', fontSize: fullScreen ? '14px' : '10px' }}
      >
        {isReady ? "Let's Go!" : message}
      </motion.div>
    </div>
  );
}