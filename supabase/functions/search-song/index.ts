import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
};

// ============================================
// RATE LIMITING
// ============================================
// Simple in-memory rate limiter (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const getRateLimitKey = (req: Request): string => {
  return req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';
};

const checkRateLimit = (
  clientKey: string,
  maxRequests = 15,
  windowMs = 60000
): boolean => {
  const now = Date.now();
  const limit = rateLimitMap.get(clientKey);

  if (!limit || limit.resetAt < now) {
    rateLimitMap.set(clientKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (limit.count >= maxRequests) {
    return false;
  }

  limit.count++;
  return true;
};

interface SearchResult {
  title: string;
  artist: string;
  url: string;
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 ? String.fromCodePoint(cp) : m;
    }
    return ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()] ?? m;
  });

const textOf = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

/** Song links from tab4u's own search results page (resultsSimple). */
function parseSearchResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const linkRe = /<a\b[^>]*class\s*=\s*["'][^"']*\bruSongLink\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[0].match(/href\s*=\s*["']([^"']*tabs\/songs\/[^"']+)["']/i)?.[1];
    if (!href) continue;
    const url = new URL(decodeEntities(href), 'https://www.tab4u.com/').toString();
    if (seen.has(url)) continue;
    seen.add(url);
    const title = textOf(m[1].match(/class\s*=\s*["']sNameI19["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '').replace(/\s*\/$/, '');
    const artist = textOf(m[1].match(/class\s*=\s*["']aNameI19["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
    results.push({ title: title || url, artist, url });
  }
  return results;
}

/**
 * Results from tab4u's search page, fetched directly; Firecrawl only as a fallback.
 * Some regions get an empty page from tab4u (seen in ap-south-1), so an empty
 * direct result is retried through Firecrawl too.
 */
async function searchTab4u(query: string): Promise<SearchResult[]> {
  const searchUrl = `https://www.tab4u.com/resultsSimple?tab=songs&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'he,en;q=0.8' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const results = parseSearchResults(await res.text());
      if (results.length) return results;
      console.warn('Direct search returned no results, trying Firecrawl');
    } else {
      console.warn('Direct search failed with status', res.status);
    }
  } catch (e) {
    console.warn('Direct search error:', e);
  }

  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) throw new Error('Search is unavailable');
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: searchUrl, formats: ['html'], onlyMainContent: false }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to perform search');
  return parseSearchResults(data.data?.html || '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Rate limiting check
  const clientKey = getRateLimitKey(req);
  if (!checkRateLimit(clientKey)) {
    console.warn('Rate limit exceeded for client:', clientKey);
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('Request from:', clientKey);

  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid query parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmed = query.trim().slice(0, 100);
    const results = (await searchTab4u(trimmed)).slice(0, 15);
    console.log('Search', JSON.stringify(trimmed), '→', results.length, 'results');

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No song found', message: 'לא נמצא שיר מתאים, נסה לדייק את שם השיר או להזין לינק ישיר', results: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ url: results[0].url, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-song function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
