"use client";
import { useEffect } from "react";
import NProgress from "nprogress";
import { usePathname } from "next/navigation";

export default function useProgress() {
  const pathname = usePathname();

  useEffect(() => {
    NProgress.start();

    const timer = setTimeout(() => {
      NProgress.done();
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname]);
}
