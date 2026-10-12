/**
 * usePageData — Stale-While-Revalidate data fetching hook
 *
 * Pages render INSTANTLY from cache and silently refresh in background.
 * No more double-loading spinners. Data persists across navigations.
 *
 * Usage:
 *   const { data, loading, refresh } = usePageData('campaigns', () => api.get('/campaigns'));
 *   // `data` is available immediately on mount if cached, `loading` is only true on cold start
 */
import { useState, useEffect, useRef, useCallback } from 'react';

// ── In-memory LRU cache (survives across navigations, cleared on full reload) ──
const _memoryCache = new Map();
const MAX_CACHE_SIZE = 50;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes staleness

function setCache(key, data) {
  // Evict oldest if full
  if (_memoryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = _memoryCache.keys().next().value;
    _memoryCache.delete(oldestKey);
  }
  _memoryCache.set(key, { data, ts: Date.now() });
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('_pd_' + key, JSON.stringify({ data, ts: Date.now() }));
    } catch {}
  }
}

function getCache(key) {
  let entry = _memoryCache.get(key);
  if (!entry && typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('_pd_' + key);
      if (stored) {
        entry = JSON.parse(stored);
        _memoryCache.set(key, entry);
      }
    } catch {}
  }
  if (!entry) return null;
  return entry;
}

export function getFastCache(key, defaultValue = null) {
  const entry = getCache(key);
  return entry?.data !== undefined ? entry.data : defaultValue;
}

export function setFastCache(key, data) {
  setCache(key, data);
}

export function hasFastCache(key) {
  return getCache(key) !== null;
}


/**
 * @param {string} key       - Unique cache key (e.g. 'campaigns', 'contacts-page-1')
 * @param {Function} fetcher - Async function that returns the data (should return the processed data, not raw response)
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true]    - Set to false to disable auto-fetch
 * @param {number}  [options.ttl]             - Custom TTL in ms (default 5min)
 * @param {Array}   [options.deps=[]]         - Extra dependencies to re-fetch on change
 * @param {boolean} [options.skipCache=false]  - Skip cache entirely (always fetch fresh)
 */
export function usePageData(key, fetcher, options = {}) {
  const { enabled = true, ttl = CACHE_TTL_MS, deps = [], skipCache = false } = options;

  // Initialize state from cache for instant render
  const cached = !skipCache ? getCache(key) : null;
  const [data, setData] = useState(cached?.data ?? null);
  const [loading, setLoading] = useState(!cached?.data); // Only show loading if no cache
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const versionRef = useRef(0);

  const fetchData = useCallback(async (silent = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    // Only show loading spinner if we have NO data at all (cold start)
    if (!silent && !data) {
      setLoading(true);
    }
    setError(null);

    const version = ++versionRef.current;

    try {
      const result = await fetcher();
      // Ignore stale responses if a newer fetch has started
      if (!mountedRef.current || version !== versionRef.current) return;

      setData(result);
      setCache(key, result);
    } catch (err) {
      if (!mountedRef.current || version !== versionRef.current) return;
      setError(err);
      // Don't clear existing data on error — keep stale data visible
    } finally {
      if (mountedRef.current && version === versionRef.current) {
        setLoading(false);
        fetchingRef.current = false;
      }
    }
  }, [key, fetcher]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    const entry = !skipCache ? getCache(key) : null;

    if (entry?.data) {
      // We have cached data — show it immediately
      setData(entry.data);
      setLoading(false);

      // If cache is stale, revalidate silently in background
      const isStale = Date.now() - entry.ts > ttl;
      if (isStale || skipCache) {
        fetchData(true); // silent revalidation
      }
    } else {
      // No cache — fetch with loading spinner
      fetchData(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [key, enabled, ...deps]);

  // Manual refresh (always fetches fresh, shows data immediately + updates in bg)
  const refresh = useCallback(() => {
    fetchingRef.current = false; // Allow re-fetch
    return fetchData(!!data); // silent if we already have data
  }, [fetchData, data]);

  // Invalidate cache and refetch
  const invalidate = useCallback(() => {
    _memoryCache.delete(key);
    fetchingRef.current = false;
    return fetchData(false);
  }, [key, fetchData]);

  return { data, loading, error, refresh, invalidate };
}

/**
 * useMultiPageData — Fetch multiple endpoints in parallel with SWR caching
 *
 * Usage:
 *   const { data, loading } = useMultiPageData({
 *     overview: () => api.get('/analytics/overview').then(r => r.data.data),
 *     trends: () => api.get('/analytics/trends').then(r => r.data.data),
 *   });
 *   // data.overview, data.trends available instantly from cache
 */
export function useMultiPageData(fetcherMap, options = {}) {
  const { enabled = true, ttl = CACHE_TTL_MS, deps = [] } = options;
  const keys = Object.keys(fetcherMap);
  const compositeKey = keys.join('|');

  // Initialize from individual caches
  const initialData = {};
  let hasCachedData = false;
  keys.forEach(k => {
    const cached = getCache(`multi:${compositeKey}:${k}`);
    if (cached?.data) {
      initialData[k] = cached.data;
      hasCachedData = true;
    } else {
      initialData[k] = null;
    }
  });

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!hasCachedData);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  const fetchAll = useCallback(async (silent = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (!silent) setLoading(true);

    try {
      const results = await Promise.allSettled(
        keys.map(k => fetcherMap[k]())
      );

      if (!mountedRef.current) return;

      const newData = { ...data };
      keys.forEach((k, i) => {
        if (results[i].status === 'fulfilled') {
          newData[k] = results[i].value;
          setCache(`multi:${compositeKey}:${k}`, results[i].value);
        }
      });

      setData(newData);
    } catch {} finally {
      if (mountedRef.current) {
        setLoading(false);
        fetchingRef.current = false;
      }
    }
  }, [compositeKey]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    // Check staleness of any cached entry
    let anyStale = false;
    let allCached = true;
    keys.forEach(k => {
      const entry = getCache(`multi:${compositeKey}:${k}`);
      if (!entry?.data) allCached = false;
      if (!entry || Date.now() - entry.ts > ttl) anyStale = true;
    });

    if (allCached && !anyStale) {
      setLoading(false);
    } else if (allCached && anyStale) {
      fetchAll(true); // silent revalidation
    } else {
      fetchAll(false);
    }

    return () => { mountedRef.current = false; };
  }, [compositeKey, enabled, ...deps]);

  const refresh = useCallback(() => {
    fetchingRef.current = false;
    return fetchAll(Object.values(data).some(Boolean));
  }, [fetchAll, data]);

  return { data, loading, refresh };
}

// ── Utility: Preload data into cache before navigation ──
export async function preloadPageData(key, fetcher) {
  try {
    const result = await fetcher();
    setCache(key, result);
    return result;
  } catch {
    return null;
  }
}

// ── Utility: Invalidate a cache key ──
export function invalidateCache(key) {
  if (key) {
    // Delete exact key and any keys that start with the key
    for (const k of _memoryCache.keys()) {
      if (k === key || k.startsWith(key + ':') || k.startsWith(`multi:${key}`)) {
        _memoryCache.delete(k);
      }
    }
  } else {
    _memoryCache.clear();
  }
}
