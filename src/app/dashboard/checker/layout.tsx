// Segment layout for /dashboard/checker/* — thin wrapper around the shared
// CheckerDesignRoot (fonts, --chk-* design tokens, 'paper_checker' server-
// side feature gate), which also backs /dashboard/students/layout.tsx so
// both segments share the exact same look and entitlement check without
// one being nested inside the other's route tree. See CheckerDesignRoot
// for the reasoning this used to live here inline.
import type { ReactNode } from 'react';
import { CheckerDesignRoot } from '@/components/checker/CheckerDesignRoot';

export default function CheckerLayout({ children }: { children: ReactNode }) {
  return <CheckerDesignRoot>{children}</CheckerDesignRoot>;
}
