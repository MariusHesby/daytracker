import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const count = parseInt(searchParams.get('count') || '5', 10);

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Normalize the URL
  let targetUrl = url;
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    // First try to find and parse an RSS feed
    let items = await tryRSS(targetUrl, count);
    if (items.length === 0) {
      // Fallback: scrape <a> tags with heuristics for news headlines
      items = await scrapeHeadlines(targetUrl, count);
    }

    // For items missing images, try fetching og:image from the article page
    const needImages = items.filter(it => !it.image).slice(0, 5); // limit to 5 fetches
    if (needImages.length > 0) {
      await Promise.allSettled(
        needImages.map(async (item) => {
          try {
            const ogImage = await fetchOgImage(item.link);
            if (ogImage) {
              (item as Record<string, unknown>).image = ogImage;
            }
          } catch { /* ignore */ }
        }),
      );
    }

    // Decode HTML entities in all fields (titles, links, images)
    for (const item of items) {
      item.title = decodeEntities(item.title);
      if (item.link) item.link = decodeEntities(item.link);
      if (item.image) item.image = decodeEntities(item.image);
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.error('News fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}

// ─── RSS parsing ─────────────────────────────────────────

async function tryRSS(siteUrl: string, count: number) {
  // Common RSS feed paths to try
  const feedPaths = [
    '/feed',
    '/rss',
    '/rss.xml',
    '/feed.xml',
    '/atom.xml',
    '/feeds/posts/default',
    '/?feed=rss2',
  ];

  // First, try to discover feed URL from the HTML page
  try {
    const pageRes = await fetch(siteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DayTracker/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    const html = await pageRes.text();

    // Look for <link rel="alternate" type="application/rss+xml" href="...">
    const feedMatch = html.match(
      /<link[^>]*type=["']application\/(rss|atom)\+xml["'][^>]*href=["']([^"']+)["']/i
    );
    if (feedMatch) {
      let feedUrl = feedMatch[2];
      if (feedUrl.startsWith('/')) {
        const base = new URL(siteUrl);
        feedUrl = `${base.origin}${feedUrl}`;
      } else if (!feedUrl.startsWith('http')) {
        feedUrl = `${siteUrl.replace(/\/$/, '')}/${feedUrl}`;
      }
      const items = await parseFeed(feedUrl, count);
      if (items.length > 0) return items;
    }
  } catch {
    // ignore and try common paths
  }

  // Try common feed paths
  const base = new URL(siteUrl);
  for (const path of feedPaths) {
    try {
      const feedUrl = `${base.origin}${path}`;
      const items = await parseFeed(feedUrl, count);
      if (items.length > 0) return items;
    } catch {
      continue;
    }
  }

  return [];
}

async function parseFeed(feedUrl: string, count: number) {
  const res = await fetch(feedUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DayTracker/1.0)' },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return [];

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  // Check if it looks like XML/RSS
  if (!text.includes('<rss') && !text.includes('<feed') && !text.includes('<channel') && !contentType.includes('xml')) {
    return [];
  }

  const items: { title: string; link: string; pubDate?: string; image?: string }[] = [];

  // Parse RSS <item> elements
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(text)) !== null && items.length < count) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link') || extractAttr(itemXml, 'link', 'href');
    const pubDate = extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'published');
    const image = extractImage(itemXml);
    if (title && link) {
      items.push({ title: decodeEntities(title), link, pubDate, ...(image ? { image } : {}) });
    }
  }

  // Parse Atom <entry> elements if no RSS items found
  if (items.length === 0) {
    const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(text)) !== null && items.length < count) {
      const entryXml = match[1];
      const title = extractTag(entryXml, 'title');
      const link = extractAttr(entryXml, 'link', 'href') || extractTag(entryXml, 'link');
      const pubDate = extractTag(entryXml, 'published') || extractTag(entryXml, 'updated');
      const image = extractImage(entryXml);
      if (title && link) {
        items.push({ title: decodeEntities(title), link, pubDate, ...(image ? { image } : {}) });
      }
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  // Handle CDATA
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'));
  if (cdataMatch) return cdataMatch[1].trim();

  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["']`, 'i'));
  return match ? match[1] : null;
}

/** Fetch og:image meta tag from an article page */
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DayTracker/1.0)' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    // Only read the first 50KB to find the meta tag quickly
    const reader = res.body?.getReader();
    if (!reader) return null;
    let html = '';
    while (html.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
    }
    reader.cancel();

    // og:image
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogMatch) return ogMatch[1];

    // twitter:image
    const twMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    if (twMatch) return twMatch[1];

    return null;
  } catch {
    return null;
  }
}

/** Extract the best image URL from an RSS/Atom item */
function extractImage(xml: string): string | null {
  // 1. <media:content url="...">
  const mediaContent = xml.match(/<media:content[^>]*url=["']([^"']+)["']/i);
  if (mediaContent) return mediaContent[1];

  // 2. <media:thumbnail url="...">
  const mediaThumbnail = xml.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
  if (mediaThumbnail) return mediaThumbnail[1];

  // 3. <enclosure url="..." type="image/...">
  const enclosure = xml.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image\/[^"']+["']/i)
    || xml.match(/<enclosure[^>]*type=["']image\/[^"']+["'][^>]*url=["']([^"']+)["']/i);
  if (enclosure) return enclosure[1] || enclosure[2];

  // 4. <img src="..."> inside <description> or <content:encoded>
  const descOrContent = extractTag(xml, 'description') || extractTag(xml, 'content:encoded') || extractTag(xml, 'content');
  if (descOrContent) {
    const imgMatch = descOrContent.match(/<img[^>]*src=["']([^"']+)["']/i)
      || descOrContent.match(/src=(?:&quot;|&#34;)([^&]+)(?:&quot;|&#34;)/i);
    if (imgMatch) return decodeEntities(imgMatch[1]);
  }

  return null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&laquo;/g, '\u00AB')
    .replace(/&raquo;/g, '\u00BB')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&nbsp;/g, ' ');
}

// ─── Fallback HTML scraping ──────────────────────────────

async function scrapeHeadlines(siteUrl: string, count: number) {
  const res = await fetch(siteUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DayTracker/1.0)' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return [];

  const html = await res.text();
  const items: { title: string; link: string }[] = [];
  const seen = new Set<string>();

  // Look for heading tags inside <a> tags or <a> tags inside headings
  // Pattern 1: <a href="..."><h2>Title</h2></a> or similar
  // Pattern 2: <h2><a href="...">Title</a></h2>
  const headingLinkRegex = /<(?:h[1-3]|article)[^>]*>[\s\S]*?<a[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/(?:h[1-3]|article)>/gi;

  let match;
  while ((match = headingLinkRegex.exec(html)) !== null && items.length < count * 2) {
    const link = resolveUrl(match[1], siteUrl);
    const title = stripTags(match[2]).trim();
    if (title.length > 10 && title.length < 200 && !seen.has(title) && link) {
      seen.add(title);
      // Try to find a nearby <img> in the surrounding context
      const contextStart = Math.max(0, (match.index || 0) - 500);
      const contextEnd = Math.min(html.length, (match.index || 0) + match[0].length + 500);
      const context = html.slice(contextStart, contextEnd);
      const imgMatch = context.match(/<img[^>]*src=["']([^"']+)["']/i);
      const image = imgMatch ? resolveUrl(imgMatch[1], siteUrl) : undefined;
      items.push({ title, link, ...(image ? { image } : {}) });
    }
  }

  // Pattern 3: <a href="..." class="...title...">Text</a>
  if (items.length < count) {
    const titleLinkRegex = /<a[^>]*href=["']([^"'#]+)["'][^>]*class=["'][^"']*(?:title|heading|headline)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = titleLinkRegex.exec(html)) !== null && items.length < count * 2) {
      const link = resolveUrl(match[1], siteUrl);
      const title = stripTags(match[2]).trim();
      if (title.length > 10 && title.length < 200 && !seen.has(title) && link) {
        seen.add(title);
        items.push({ title, link });
      }
    }
  }

  return items.slice(0, count);
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function resolveUrl(href: string, base: string): string | null {
  try {
    if (href.startsWith('http')) return href;
    const baseUrl = new URL(base);
    if (href.startsWith('/')) return `${baseUrl.origin}${href}`;
    return `${baseUrl.origin}/${href}`;
  } catch {
    return null;
  }
}
