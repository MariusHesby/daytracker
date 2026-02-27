// News feed integration – multi-source
// Stores config in localStorage, fetches via /api/news proxy

const STORAGE_KEY = 'news_sources';
const CACHE_PREFIX = 'news_cache_';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export interface NewsSource {
  url: string;
  count: number;
}

export interface NewsItem {
  title: string;
  link: string;
  pubDate?: string;
  image?: string;
}

interface NewsCache {
  items: NewsItem[];
  fetchedAt: number;
}

// ─── Display helpers ─────────────────────────────────────

/** Strip protocol + "www." for display, e.g. "www.tek.no" → "tek.no" */
export function formatSourceName(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

// ─── Config management ───────────────────────────────────

export function getNewsSources(): NewsSource[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    // Migrate from old single-config format { url, count }
    if (parsed && !Array.isArray(parsed) && parsed.url) {
      const migrated: NewsSource[] = [{ url: parsed.url, count: parsed.count ?? 5 }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      // Clean old keys
      localStorage.removeItem('news_config');
      localStorage.removeItem('news_cache');
      return migrated;
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addNewsSource(source: NewsSource): void {
  const sources = getNewsSources();
  // Avoid duplicates (normalise)
  const norm = source.url.trim().toLowerCase().replace(/\/$/, '');
  if (sources.some(s => s.url.trim().toLowerCase().replace(/\/$/, '') === norm)) return;
  sources.push({ url: source.url.trim(), count: source.count });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
  window.dispatchEvent(new Event('newsConfigUpdated'));
}

export function removeNewsSource(url: string): void {
  const sources = getNewsSources();
  const norm = url.trim().toLowerCase().replace(/\/$/, '');
  const filtered = sources.filter(s => s.url.trim().toLowerCase().replace(/\/$/, '') !== norm);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  // Clear cache for this source
  localStorage.removeItem(cacheKeyFor(url));
  window.dispatchEvent(new Event('newsConfigUpdated'));
}

export function clearAllNewsSources(): void {
  const sources = getNewsSources();
  sources.forEach(s => localStorage.removeItem(cacheKeyFor(s.url)));
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('newsConfigUpdated'));
}

// ─── Fetch news ──────────────────────────────────────────

/** Fetch headlines for a single source */
export async function fetchNewsForSource(source: NewsSource): Promise<NewsItem[]> {
  if (!source.url) return [];

  const cached = getCachedNews(source.url);
  if (cached) return cached.slice(0, source.count);

  try {
    const res = await fetch(`/api/news?url=${encodeURIComponent(source.url)}&count=${source.count}`);
    if (!res.ok) return [];
    const data = await res.json();
    const items: NewsItem[] = data.items || [];
    setCachedNews(source.url, items);
    return items.slice(0, source.count);
  } catch {
    return [];
  }
}

/** Fetch headlines for ALL configured sources.
 *  Returns a map: displayName → NewsItem[] */
export async function fetchAllNews(): Promise<Record<string, NewsItem[]>> {
  const sources = getNewsSources();
  if (sources.length === 0) return {};

  const results: Record<string, NewsItem[]> = {};
  await Promise.all(
    sources.map(async (src) => {
      const items = await fetchNewsForSource(src);
      results[src.url] = items;
    }),
  );
  return results;
}

// ─── Per-source cache ────────────────────────────────────

function cacheKeyFor(url: string): string {
  return CACHE_PREFIX + url.trim().toLowerCase().replace(/\/$/, '');
}

function getCachedNews(url: string): NewsItem[] | null {
  try {
    const stored = localStorage.getItem(cacheKeyFor(url));
    if (!stored) return null;
    const cache: NewsCache = JSON.parse(stored);
    if (Date.now() - cache.fetchedAt > CACHE_TTL) {
      localStorage.removeItem(cacheKeyFor(url));
      return null;
    }
    return cache.items;
  } catch {
    return null;
  }
}

function setCachedNews(url: string, items: NewsItem[]): void {
  try {
    const cache: NewsCache = { items, fetchedAt: Date.now() };
    localStorage.setItem(cacheKeyFor(url), JSON.stringify(cache));
  } catch {
    // localStorage full
  }
}
