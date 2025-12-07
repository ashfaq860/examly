"use client";

import useProgress from "@/lib/useProgress";

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  useProgress();
  return <>{children}</>;
}
