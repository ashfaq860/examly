import type { MetadataRoute } from 'next';

const BASE_URL = 'https://www.examly.pk';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: '/', priority: 1, changeFrequency: 'weekly' as const },
    { path: '/about', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/how-examly-works', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/packages', priority: 0.9, changeFrequency: 'weekly' as const },
    { path: '/contact', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/quiz', priority: 0.6, changeFrequency: 'weekly' as const },
    { path: '/privacy-policy', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/terms-and-conditions', priority: 0.3, changeFrequency: 'yearly' as const },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
