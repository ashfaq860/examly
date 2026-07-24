'use client';

import { usePathname } from 'next/navigation';
import Breadcrumb, { type BreadcrumbItem } from './Breadcrumb';
import { useBreadcrumbLabels } from './BreadcrumbLabels';

interface BreadcrumbAutoProps {
  /** Override the auto-derived label for a specific raw URL segment, e.g. { [classId]: 'Class 9' } */
  labels?: Record<string, string>;
}

const toLabel = (segment: string) =>
  segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function BreadcrumbAuto({ labels = {} }: BreadcrumbAutoProps) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  // Labels a descendant page registered for one of its own dynamic
  // segments (e.g. a paper id -> the paper's title) via useBreadcrumbLabel
  // — the explicit `labels` prop wins if a page sets both.
  const contextLabels = useBreadcrumbLabels();

  if (segments.length === 0) return null; // no breadcrumb on the home page itself

  const items: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    ...segments.map((segment, idx) => ({
      label: labels[segment] ?? contextLabels[segment] ?? toLabel(segment),
      href: '/' + segments.slice(0, idx + 1).join('/'),
    })),
  ];

  return <Breadcrumb items={items} />;
}
