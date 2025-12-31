import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search tab4u.com using Google search via Firecrawl
    const searchUrl = `https://www.google.com/search?q=site:tab4u.com+${encodeURIComponent(query)}`;
    console.log('Searching with URL:', searchUrl);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['html'],
        waitFor: 2000,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error('Firecrawl API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to perform search' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await scrapeResponse.json();
    const html = data.data?.html;

    if (!html) {
      console.error('No HTML content in Firecrawl response');
      return new Response(
        JSON.stringify({ error: 'No search results found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse HTML to find first tab4u.com/tabs/songs/ link
    const linkRegex = /https?:\/\/(?:www\.)?tab4u\.com\/tabs\/songs\/[^"'\s<>]+/gi;
    const matches = html.match(linkRegex);

    if (!matches || matches.length === 0) {
      console.log('No tab4u song links found in search results');
      return new Response(
        JSON.stringify({ error: 'No song found', message: 'לא נמצא שיר מתאים, נסה לדייק את שם השיר או להזין לינק ישיר' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return the first match
    const songUrl = matches[0];
    console.log('Found song URL:', songUrl);

    return new Response(
      JSON.stringify({ url: songUrl }),
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
