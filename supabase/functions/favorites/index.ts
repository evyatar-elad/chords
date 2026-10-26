// Shared favorites list ("bookmarks"), stored as one JSON file in Supabase Storage.
// One list for everyone who uses the site (the owner chose an open list, no login).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
};

const BUCKET = 'app-data';
const FILE = 'favorites.json';
const MAX_FAVORITES = 500;

interface Favorite {
  url: string;
  title: string;
  artist: string;
  transposition: number;
  savedAt: string;
}

type FavoritesRequest =
  | { action: 'list' }
  | { action: 'save'; favorite: Omit<Favorite, 'savedAt'> }
  | { action: 'remove'; url: string };

// ============================================
// RATE LIMITING
// ============================================
// Simple in-memory rate limiter (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const checkRateLimit = (clientKey: string, maxRequests = 60, windowMs = 60000): boolean => {
  const now = Date.now();
  const limit = rateLimitMap.get(clientKey);
  if (!limit || limit.resetAt < now) {
    rateLimitMap.set(clientKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (limit.count >= maxRequests) return false;
  limit.count++;
  return true;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

async function readFavorites(): Promise<Favorite[]> {
  const { data, error } = await supabase.storage.from(BUCKET).download(FILE);
  if (error || !data) return []; // no file (or bucket) yet
  try {
    const parsed = JSON.parse(await data.text());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFavorites(favorites: Favorite[]): Promise<void> {
  const body = new Blob([JSON.stringify(favorites)], { type: 'application/json' });
  let { error } = await supabase.storage.from(BUCKET).upload(FILE, body, { upsert: true, contentType: 'application/json' });
  if (error) {
    // First write ever: create the (private) bucket and retry
    await supabase.storage.createBucket(BUCKET, { public: false });
    ({ error } = await supabase.storage.from(BUCKET).upload(FILE, body, { upsert: true, contentType: 'application/json' }));
  }
  if (error) throw new Error(`Could not save favorites: ${error.message}`);
}

/** Only tab4u song pages, without ?ton= or #hash, so the same song is always one entry. */
function normalizeSongUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    if (host !== 'tab4u.com' && !host.endsWith('.tab4u.com')) return null;
    u.searchParams.delete('ton');
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

const cleanText = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const clientKey = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(clientKey)) return json({ error: 'Rate limit exceeded. Try again later.' }, 429);

  try {
    const body = (await req.json()) as FavoritesRequest;
    let favorites = await readFavorites();

    if (body.action === 'list') return json({ favorites });

    if (body.action === 'save') {
      const url = normalizeSongUrl(body.favorite?.url ?? '');
      if (!url) return json({ error: 'Invalid song URL' }, 400);
      const t = Number(body.favorite.transposition);
      const favorite: Favorite = {
        url,
        title: cleanText(body.favorite.title, 200) || 'שיר ללא שם',
        artist: cleanText(body.favorite.artist, 200),
        transposition: Number.isFinite(t) ? Math.max(-6, Math.min(6, t)) : 0,
        savedAt: new Date().toISOString(),
      };
      favorites = [favorite, ...favorites.filter((f) => f.url !== url)].slice(0, MAX_FAVORITES);
      await writeFavorites(favorites);
      return json({ favorites });
    }

    if (body.action === 'remove') {
      const url = normalizeSongUrl(body.url ?? '');
      if (!url) return json({ error: 'Invalid song URL' }, 400);
      favorites = favorites.filter((f) => f.url !== url);
      await writeFavorites(favorites);
      return json({ favorites });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('Error in favorites:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
