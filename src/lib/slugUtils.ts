export const toSlug = (name: string): string =>
  name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export const chapterSlug = (chapterNo: number | null, fallbackIndex: number): string =>
  `chapter-${chapterNo ?? fallbackIndex + 1}`;

export const chapterNoFromSlug = (slug: string): number =>
  parseInt(slug.replace('chapter-', ''), 10);
