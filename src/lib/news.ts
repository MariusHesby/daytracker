// News feed integration – multi-source
// Stores config in localStorage, syncs to Supabase, fetches via /api/news proxy

import { supabase } from './supabase';

const STORAGE_KEY = 'news_sources';
const CACHE_PREFIX = 'news_cache_';
const HIDDEN_PREFIX = 'news_hidden_';
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

/** Strip protocol + "www." + path for display, e.g. "https://www.filmweb.no/filmnytt" → "filmweb.no" */
export function formatSourceName(url: string): string {
  const stripped = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
  // Return only the domain (everything before the first /)
  const domain = stripped.split('/')[0];
  return domain;
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
  syncNewsToSupabase();
  window.dispatchEvent(new Event('newsConfigUpdated'));
}

export function removeNewsSource(url: string): void {
  const sources = getNewsSources();
  const norm = url.trim().toLowerCase().replace(/\/$/, '');
  const filtered = sources.filter(s => s.url.trim().toLowerCase().replace(/\/$/, '') !== norm);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  // Clear cache for this source
  localStorage.removeItem(cacheKeyFor(url));
  syncNewsToSupabase();
  window.dispatchEvent(new Event('newsConfigUpdated'));
}

/** Update a news source (e.g. change URL or count) */
export function updateNewsSource(oldUrl: string, updated: NewsSource): void {
  const sources = getNewsSources();
  const norm = oldUrl.trim().toLowerCase().replace(/\/$/, '');
  const idx = sources.findIndex(s => s.url.trim().toLowerCase().replace(/\/$/, '') === norm);
  if (idx === -1) return;
  // Clear old cache if URL changed
  if (sources[idx].url !== updated.url) {
    localStorage.removeItem(cacheKeyFor(oldUrl));
  }
  sources[idx] = { url: updated.url.trim(), count: updated.count };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
  syncNewsToSupabase();
  window.dispatchEvent(new Event('newsConfigUpdated'));
}

// ─── News visibility toggle ─────────────────────────────

const VISIBLE_KEY = 'news_visible';

/** Check if news section should be visible on front page */
export function getNewsVisible(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(VISIBLE_KEY);
  if (stored === null) return true; // default visible
  return stored === 'true';
}

/** Toggle news section visibility on front page */
export function setNewsVisible(visible: boolean): void {
  localStorage.setItem(VISIBLE_KEY, visible ? 'true' : 'false');
  window.dispatchEvent(new Event('newsConfigUpdated'));
}

export function clearAllNewsSources(): void {
  const sources = getNewsSources();
  sources.forEach(s => localStorage.removeItem(cacheKeyFor(s.url)));
  localStorage.removeItem(STORAGE_KEY);
  syncNewsToSupabase();
  window.dispatchEvent(new Event('newsConfigUpdated'));
}

// ─── Supabase Sync ───────────────────────────────────────

async function syncNewsToSupabase(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Merge with existing settings
    const { data: existing } = await supabase
      .from('profiles')
      .select('settings')
      .eq('user_id', user.id)
      .single();

    const settings: Record<string, unknown> = (existing?.settings as Record<string, unknown>) ?? {};
    const sources = getNewsSources();
    if (sources.length > 0) {
      settings.news_sources = sources;
    } else {
      delete settings.news_sources;
    }

    await supabase
      .from('profiles')
      .update({ settings })
      .eq('user_id', user.id);
  } catch (err) {
    console.error('Failed to sync news settings:', err);
  }
}

export async function loadNewsFromSupabase(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('settings')
      .eq('user_id', user.id)
      .single();

    if (!data?.settings) return;

    const settings = data.settings as Record<string, unknown>;

    // Only load from Supabase if localStorage is empty (avoids overwriting local edits)
    if (settings.news_sources && getNewsSources().length === 0) {
      const sources = settings.news_sources as NewsSource[];
      if (Array.isArray(sources) && sources.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
        window.dispatchEvent(new Event('newsConfigUpdated'));
      }
    }
  } catch (err) {
    console.error('Failed to load news settings:', err);
  }
}

// ─── Hidden headlines ────────────────────────────────────

function hiddenKeyFor(url: string): string {
  return HIDDEN_PREFIX + url.trim().toLowerCase().replace(/\/$/, '');
}

/** Get the set of hidden article links for a source */
export function getHiddenHeadlines(sourceUrl: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(hiddenKeyFor(sourceUrl));
    if (!stored) return new Set();
    return new Set(JSON.parse(stored));
  } catch {
    return new Set();
  }
}

/** Hide a specific headline (by link) for a source */
export function hideHeadline(sourceUrl: string, articleLink: string): void {
  const hidden = getHiddenHeadlines(sourceUrl);
  hidden.add(articleLink);
  localStorage.setItem(hiddenKeyFor(sourceUrl), JSON.stringify([...hidden]));
}

/** Reset hidden headlines for a source (show all latest again) */
export function resetHiddenHeadlines(sourceUrl: string): void {
  localStorage.removeItem(hiddenKeyFor(sourceUrl));
  // Also clear cache so fresh articles are fetched
  localStorage.removeItem(cacheKeyFor(sourceUrl));
}

// ─── Fetch news ──────────────────────────────────────────

/** Fetch headlines for a single source, filtering out hidden ones */
export async function fetchNewsForSource(source: NewsSource): Promise<NewsItem[]> {
  if (!source.url) return [];

  const hidden = getHiddenHeadlines(source.url);
  // Request extra articles to backfill hidden ones
  const fetchCount = source.count + hidden.size + 10;

  const cached = getCachedNews(source.url);
  if (cached) {
    const filtered = cached.filter(item => !hidden.has(item.link));
    return filtered.slice(0, source.count);
  }

  try {
    const res = await fetch(`/api/news?url=${encodeURIComponent(source.url)}&count=${fetchCount}`);
    if (!res.ok) return [];
    const data = await res.json();
    const items: NewsItem[] = data.items || [];
    setCachedNews(source.url, items);
    const filtered = items.filter(item => !hidden.has(item.link));
    return filtered.slice(0, source.count);
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

/** Get cached news instantly (no network). Returns whatever is in cache. */
export function getCachedAllNews(): Record<string, NewsItem[]> {
  const sources = getNewsSources();
  if (sources.length === 0) return {};
  const results: Record<string, NewsItem[]> = {};
  for (const src of sources) {
    const hidden = getHiddenHeadlines(src.url);
    const cached = getCachedNews(src.url);
    if (cached) {
      const filtered = cached.filter(item => !hidden.has(item.link));
      results[src.url] = filtered.slice(0, src.count);
    }
  }
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
    // Invalidate cache if none of the items have images (legacy cache before image support)
    if (cache.items.length > 0 && !cache.items.some(item => item.image)) {
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
