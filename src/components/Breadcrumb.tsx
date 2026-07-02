'use client';

import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  /** Omit for a non-navigable trail label (e.g. a sidebar group with no page of its own) */
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const SITE_URL = 'https://www.examly.pk';

export default function Breadcrumb({ items }: BreadcrumbProps) {
  if (!items || items.length === 0) return null;

  // Only items with a real URL belong in the structured data — a sidebar
  // grouping label with no page of its own isn't a valid breadcrumb target.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items
      .filter((item) => item.href)
      .map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.label,
        item: `${SITE_URL}${item.href}`,
      })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="breadcrumb" className="examly-breadcrumb">
        <ol className="breadcrumb mb-3">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            return (
              <li
                key={`${item.label}-${idx}`}
                className={`breadcrumb-item${isLast ? ' active' : ''}`}
                aria-current={isLast ? 'page' : undefined}
              >
                {isLast || !item.href ? item.label : <Link href={item.href}>{item.label}</Link>}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
