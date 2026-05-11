// src/app/dashboard/generate-paper/services/apiCache.ts
export class ApiCache {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static readonly DURATION = 5 * 60 * 1000;

  static async get<T>(url: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.DURATION) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(url, { data, timestamp: Date.now() });
    return data;
  }

  static clear() {
    this.cache.clear();
  }

  static invalidate(url: string) {
    this.cache.delete(url);
  }
}