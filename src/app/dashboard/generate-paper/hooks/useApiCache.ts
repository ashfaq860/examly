// src/app/dashboard/generate-paper/hooks/useApiCache.ts
import { useCallback, useRef } from 'react';
import axios from 'axios';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
}

export const useApiCache = () => {
  const cache = useRef<Map<string, CacheEntry<any>>>(new Map());
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get data from cache or fetch it
   */
  const cachedGet = useCallback(async <T = any>(url: string): Promise<T> => {
    const cached = cache.current.get(url);
    
    // Return cached data if valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    // Check if there's already a pending request for this URL
    if (cached?.promise) {
      return cached.promise;
    }

    // Create new request
    const promise = (async () => {
      try {
        const response = await axios.get(url);
        const data = response.data;
        
        cache.current.set(url, {
          data,
          timestamp: Date.now(),
          promise: undefined
        });
        
        return data;
      } catch (error) {
        // Remove from cache on error
        cache.current.delete(url);
        throw error;
      }
    })();

    // Store the promise while request is in flight
    cache.current.set(url, {
      data: null as any,
      timestamp: Date.now(),
      promise
    });

    return promise;
  }, []);

  /**
   * Post data and optionally invalidate cache
   */
  const cachedPost = useCallback(async <T = any>(
    url: string, 
    data: any,
    invalidateUrls?: string[]
  ): Promise<T> => {
    const response = await axios.post(url, data);
    
    // Invalidate related cache entries
    if (invalidateUrls) {
      invalidateUrls.forEach(invalidateUrl => {
        cache.current.delete(invalidateUrl);
      });
    }
    
    return response.data;
  }, []);

  /**
   * Put data and optionally invalidate cache
   */
  const cachedPut = useCallback(async <T = any>(
    url: string, 
    data: any,
    invalidateUrls?: string[]
  ): Promise<T> => {
    const response = await axios.put(url, data);
    
    if (invalidateUrls) {
      invalidateUrls.forEach(invalidateUrl => {
        cache.current.delete(invalidateUrl);
      });
    }
    
    return response.data;
  }, []);

  /**
   * Delete data and invalidate cache
   */
  const cachedDelete = useCallback(async (
    url: string,
    invalidateUrls?: string[]
  ): Promise<void> => {
    await axios.delete(url);
    
    cache.current.delete(url);
    
    if (invalidateUrls) {
      invalidateUrls.forEach(invalidateUrl => {
        cache.current.delete(invalidateUrl);
      });
    }
  }, []);

  /**
   * Invalidate specific cache entries
   */
  const invalidateCache = useCallback((urlPattern?: string | RegExp) => {
    if (!urlPattern) {
      cache.current.clear();
      return;
    }

    const keys = Array.from(cache.current.keys());
    
    keys.forEach(key => {
      if (typeof urlPattern === 'string') {
        if (key.includes(urlPattern)) {
          cache.current.delete(key);
        }
      } else if (urlPattern instanceof RegExp) {
        if (urlPattern.test(key)) {
          cache.current.delete(key);
        }
      }
    });
  }, []);

  /**
   * Prefetch multiple URLs
   */
  const prefetch = useCallback(async (urls: string[]): Promise<void> => {
    const promises = urls.map(url => 
      cachedGet(url).catch(() => null) // Silently fail prefetch
    );
    
    await Promise.all(promises);
  }, [cachedGet]);

  /**
   * Get cache stats
   */
  const getCacheStats = useCallback(() => {
    const stats = {
      totalEntries: cache.current.size,
      entries: [] as Array<{ url: string; age: number; hasPromise: boolean }>
    };

    cache.current.forEach((entry, url) => {
      stats.entries.push({
        url,
        age: Date.now() - entry.timestamp,
        hasPromise: !!entry.promise
      });
    });

    return stats;
  }, []);

  /**
   * Clear entire cache
   */
  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  return {
    cachedGet,
    cachedPost,
    cachedPut,
    cachedDelete,
    invalidateCache,
    prefetch,
    getCacheStats,
    clearCache
  };
};

// Optional: Create a singleton version for use outside React components
export const apiCache = {
  cache: new Map<string, CacheEntry<any>>(),
  
  async get<T>(url: string): Promise<T> {
    const cached = this.cache.get(url);
    const CACHE_DURATION = 5 * 60 * 1000;
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    const response = await axios.get(url);
    const data = response.data;
    
    this.cache.set(url, {
      data,
      timestamp: Date.now(),
      promise: undefined
    });
    
    return data;
  },

  invalidate(url?: string) {
    if (url) {
      this.cache.delete(url);
    } else {
      this.cache.clear();
    }
  }
};