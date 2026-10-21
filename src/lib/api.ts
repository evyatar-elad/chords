import { supabase } from "@/integrations/supabase/client";

// Mirrors supabase/functions/scrape-song/parser.ts
export interface ChordPosition {
  chord: string;
  at: number; // index of the first lyric character under the chord (may be past the end)
}

export interface LyricsLine {
  type: 'lyrics';
  lyrics: string;
  chords: ChordPosition[];
}

export interface ChordsOnlySegment {
  text: string;
  chord?: boolean;
}

export interface ChordsOnlyLine {
  type: 'chords-only';
  chords: string[];
  segments?: ChordsOnlySegment[];
}

export interface TabLine {
  type: 'tab';
  rows: string[];
  chords?: ChordsOnlySegment[]; // chord row above the tab, padded to line up with it
}

export interface SectionLine {
  type: 'section';
  text: string;
}

export interface EmptyLine {
  type: 'empty';
}

export type SongLine = LyricsLine | ChordsOnlyLine | TabLine | SectionLine | EmptyLine;

export interface SongData {
  title: string;
  artist: string;
  lines: SongLine[];
  transposition: number;
  hasEasyVersion: boolean;
  direction?: 'rtl' | 'ltr';
}

export interface ScrapeSongResponse {
  success: boolean;
  data?: SongData;
  error?: string;
}

export interface SearchResult {
  title: string;
  artist: string;
  url: string;
}

export interface SearchSongResponse {
  url?: string;
  results?: SearchResult[];
  error?: string;
  message?: string;
}

const RATE_LIMIT_MESSAGE = 'יותר מדי בקשות בדקה האחרונה, נסה שוב בעוד רגע';
const SEARCH_FALLBACK = 'לא נמצא שיר מתאים, נסה לדייק את שם השיר או להזין לינק ישיר';
const SCRAPE_FALLBACK = 'לא הצלחתי לטעון את השיר, נסה שוב או הזן לינק ישיר';

function parseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Pull a human-readable line out of whatever the function sent back. */
function messageFromValue(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const msg =
      typeof obj.message === 'string' ? obj.message : typeof obj.error === 'string' ? obj.error : undefined;
    return msg?.trim() || undefined;
  }
  return undefined;
}

/**
 * supabase.functions.invoke throws on every non-2xx reply, and the raw text it carries
 * (`Edge function returned 404: Error, {"error":...}`) is not something to show a user.
 * This turns any of those shapes — the Response on error.context, an embedded JSON body,
 * or a bare message string — into one short Hebrew line.
 */
async function invokeErrorMessage(error: unknown, fallback: string): Promise<string> {
  const err = error as { context?: unknown; message?: unknown };
  const context = err?.context;

  if (context instanceof Response) {
    const text = await context.clone().text().catch(() => '');
    const fromBody = messageFromValue(parseJson(text));
    if (fromBody) return fromBody;
    if (context.status === 429) return RATE_LIMIT_MESSAGE;
    if (context.status === 404) return fallback;
  }

  const raw = typeof err?.message === 'string' ? err.message : '';

  // Newer supabase-js embeds the response body in the message: `Edge function returned 404: Error, {...}`
  const embedded = raw.match(/\{[\s\S]*\}\s*$/);
  if (embedded) {
    const fromBody = messageFromValue(parseJson(embedded[0]));
    if (fromBody) return fromBody;
  }

  if (/rate limit/i.test(raw)) return RATE_LIMIT_MESSAGE;
  return raw.trim() || fallback;
}

/**
 * Search for a song on tab4u.com
 * @param query - The search query text
 */
export async function searchSong(query: string): Promise<SearchSongResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('search-song', {
      body: { query },
    });

    if (error) {
      console.error('Error calling search-song function:', error);
      const message = await invokeErrorMessage(error, SEARCH_FALLBACK);
      return { error: message, message, results: [] };
    }

    return data as SearchSongResponse;
  } catch (err) {
    console.error('Error searching song:', err);
    const message = err instanceof Error ? err.message.trim() || SEARCH_FALLBACK : SEARCH_FALLBACK;
    return { error: message, message, results: [] };
  }
}

/**
 * Scrape a song from tab4u.com
 * @param url - The URL of the song page on tab4u.com
 */
export async function scrapeSong(url: string): Promise<ScrapeSongResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('scrape-song', {
      body: { url },
    });

    if (error) {
      console.error('Error calling scrape-song function:', error);
      return { success: false, error: await invokeErrorMessage(error, SCRAPE_FALLBACK) };
    }

    return data as ScrapeSongResponse;
  } catch (err) {
    console.error('Error scraping song:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message.trim() || SCRAPE_FALLBACK : SCRAPE_FALLBACK,
    };
  }
}
