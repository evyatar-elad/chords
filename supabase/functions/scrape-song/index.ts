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

import { parseSongFromHtml } from "./parser.ts";

interface ScrapeRequest {
  url: string;
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const looksLikeSongPage = (html: string) => /id\s*=\s*["']songContentTPL["']/i.test(html);

/** Fetch tab4u directly (fast, free); fall back to Firecrawl if that is blocked or fails. */
async function fetchSongHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'he,en;q=0.8' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const html = await res.text();
      if (looksLikeSongPage(html)) return html;
      console.warn('Direct fetch returned no song content, falling back to Firecrawl');
    } else {
      console.warn('Direct fetch failed with status', res.status);
    }
  } catch (e) {
    console.warn('Direct fetch error:', e);
  }

  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) throw new Error('Could not load the song page');

  const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['html'], onlyMainContent: false, waitFor: 2000 }),
  });
  const scrapeData = await scrapeResponse.json();
  if (!scrapeResponse.ok || !scrapeData.success) {
    console.error('Firecrawl error:', scrapeData);
    throw new Error(scrapeData.error || 'Failed to scrape page');
  }
  return scrapeData.data?.html || '';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientKey = getRateLimitKey(req);
  if (!checkRateLimit(clientKey)) {
    console.warn('Rate limit exceeded for client:', clientKey);
    return new Response(
      JSON.stringify({ success: false, error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('Request from:', clientKey);

  try {
    const { url } = await req.json() as ScrapeRequest;

    if (!url) {
      console.error('No URL provided');
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Strict URL validation to prevent SSRF attacks
    try {
      const parsedUrl = new URL(url);
      
      // 1. Validate protocol (only http/https)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        console.error('Invalid protocol:', parsedUrl.protocol);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid URL protocol' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // 2. Validate hostname exactly matches or is subdomain of tab4u.com
      const hostname = parsedUrl.hostname.toLowerCase();
      if (hostname !== 'tab4u.com' && 
          hostname !== 'www.tab4u.com' &&
          !hostname.endsWith('.tab4u.com')) {
        console.error('Invalid hostname:', hostname);
        return new Response(
          JSON.stringify({ success: false, error: 'Only tab4u.com URLs are supported' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // 3. Block localhost and private IP ranges
      if (hostname === 'localhost' || 
          hostname === '127.0.0.1' ||
          /^10\./.test(hostname) ||
          /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
          /^192\.168\./.test(hostname)) {
        console.error('Private IP or localhost blocked:', hostname);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid URL' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
    } catch (e) {
      console.error('URL parsing error:', e);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // A "?ton=" link is already transposed server-side by tab4u. Load the original
    // chords and apply the transposition on our side instead (otherwise it is applied twice).
    const parsedUrl = new URL(url);
    const urlTon = parseFloat(parsedUrl.searchParams.get('ton') ?? '');
    parsedUrl.searchParams.delete('ton');
    parsedUrl.hash = '';
    const cleanUrl = parsedUrl.toString();

    console.log('Scraping URL:', cleanUrl);
    const html = await fetchSongHtml(cleanUrl);
    console.log('Received HTML length:', html.length);

    const songData = parseSongFromHtml(html, cleanUrl);
    if (Number.isFinite(urlTon)) songData.transposition = urlTon;

    if (!songData.lines.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'לא נמצאו אקורדים בעמוד הזה' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsed song:', songData.title, 'by', songData.artist, 'lines:', songData.lines.length);

    return new Response(
      JSON.stringify({ success: true, data: songData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scrape-song:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
