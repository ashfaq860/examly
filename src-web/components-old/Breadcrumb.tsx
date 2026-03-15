'use client';

import Link from 'next/link';

interface BreadcrumbProps {
  items: { label: string; href?: string }[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" className="mb-4">
      <ol className="breadcrumb">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li
              key={idx}
              className={`breadcrumb-item${isLast ? ' active' : ''}`}
              {...(isLast ? { 'aria-current': 'page' } : {})}
            >
              {isLast ? (
                item.label
              ) : (
                <Link href={item.href ?? '#'}>{item.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
