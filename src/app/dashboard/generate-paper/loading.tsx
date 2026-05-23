"use client";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export default function Loading({
  fullScreen = false,
  message = "Loading...",
}: {
  fullScreen?: boolean;
  message?: string;
}) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // const timer = setTimeout(() => setIsReady(true), 3000);
    // return () => clearTimeout(timer);
  }, []);

  const size = fullScreen ? 200 : 120;

  const wingTransition = {
    duration: 0.5,
    repeat: Infinity,
    repeatType: "mirror" as const,
    ease: "easeInOut",
  };

  return (
    <div
      className={`d-flex flex-column justify-content-center align-items-center ${
        fullScreen
          ? "position-fixed top-0 start-0 w-100 vh-100 bg-white"
          : "w-100 h-100 py-5"
      }`}
      style={{
        zIndex: 9999,
        minHeight: fullScreen ? "auto" : "300px",
      }}
    >
      <motion.div
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: "preserve-3d",
        }}
        animate={
          isReady
            ? {
                x: [0, -50, 1000],
                y: [0, 50, -1000],
                scale: [1, 1.2, 0.3],
                opacity: [1, 1, 0],
              }
            : {
                y: [0, -10, 0],
              }
        }
        transition={
          isReady
            ? { duration: 1.2, ease: "easeIn" }
            : { duration: 2, repeat: Infinity }
        }
      >
        {/* LEFT WING */}
        <motion.div
          animate={{ rotateY: [0, 50] }}
          transition={wingTransition}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            transformOrigin: "35% center",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            willChange: "transform",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              clipPath: "inset(0 65% 0 0)",
            }}
          >
            <img
              src="/loading.png"
              alt="left wing"
              width={size}
              height={size}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          </div>
        </motion.div>

        {/* CENTER BODY — plain div, no Framer wrapper.
            translateZ(0) forces its own GPU layer so Chrome
            doesn't repaint it on every parent animation tick. */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            transform: "translateZ(0)",
            willChange: "transform",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              clipPath: "inset(0 33% 0 33%)",
            }}
          >
            <img
              src="/loading.png"
              alt="body"
              width={size}
              height={size}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          </div>
        </div>

        {/* RIGHT WING */}
        <motion.div
          animate={{ rotateY: [0, -50] }}
          transition={wingTransition}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            transformOrigin: "65% center",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            willChange: "transform",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              clipPath: "inset(0 0 0 65%)",
            }}
          >
            <img
              src="/loading.png"
              alt="right wing"
              width={size}
              height={size}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        animate={isReady ? { opacity: 0 } : { opacity: [0, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="mt-3 text-primary fw-bold text-uppercase"
        style={{
          letterSpacing: "3px",
          fontSize: fullScreen ? "14px" : "10px",
        }}
      >
        {isReady ? "Let's Go!" : message}
      </motion.div>
    </div>
  );
}