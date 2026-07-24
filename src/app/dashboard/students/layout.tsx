// Segment layout for /dashboard/students — a sibling of /dashboard/checker,
// not a child of it (that's the whole point of moving this page here from
// /dashboard/checker/students). Shares CheckerDesignRoot with the checker
// segment so it gets the identical "ledger" look and the identical
// server-side 'paper_checker' feature gate, without the URL/route tree
// nesting.
import type { ReactNode } from 'react';
import { CheckerDesignRoot } from '@/components/checker/CheckerDesignRoot';

export default function StudentsLayout({ children }: { children: ReactNode }) {
  return <CheckerDesignRoot>{children}</CheckerDesignRoot>;
}
