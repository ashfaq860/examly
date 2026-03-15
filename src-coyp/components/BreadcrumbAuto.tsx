// components/BreadcrumbAuto.tsx
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const BreadcrumbAuto = () => {
  const pathname = usePathname(); // e.g., /courses/123
  const pathSegments = pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="breadcrumb">
      <ol className="breadcrumb">
        <li className="breadcrumb-item">
          <Link href="/">Home</Link>
        </li>
        {pathSegments.map((segment, idx) => {
          const href = '/' + pathSegments.slice(0, idx + 1).join('/');
          const isLast = idx === pathSegments.length - 1;
          // Capitalize
          const label = segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

          return (
            <li
              key={idx}
              className={`breadcrumb-item ${isLast ? 'active' : ''}`}
              aria-current={isLast ? 'page' : undefined}
            >
              {isLast ? label : <Link href={href}>{label}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default BreadcrumbAuto;
