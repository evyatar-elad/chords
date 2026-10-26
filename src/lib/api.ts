import { supabase } from "@/integrations/supabase/client";

// Pin the edge functions to Frankfurt: tab4u's search returns nothing to some regions
// (seen in ap-south-1), and Frankfurt is close to Israel anyway. Passed as a query
// parameter rather than invoke's `region` option, which also adds an x-region header
// that the functions' CORS preflight may not allow.
const inRegion = (fn: string) => `${fn}?forceFunctionRegion=eu-central-1`;

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

/** supabase.functions.invoke hides the response body of non-2xx replies; dig our error message out. */
async function invokeErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (body?.message) return body.message;
      if (body?.error) return body.error;
    } catch {
      // not JSON
    }
  }
  return error instanceof Error ? error.message : 'Unknown error occurred';
}

/**
 * Search for a song on tab4u.com
 * @param query - The search query text
 */
export async function searchSong(query: string): Promise<SearchSongResponse> {
  try {
    const { data, error } = await supabase.functions.invoke(inRegion('search-song'), {
      body: { query },
    });

    if (error) {
      console.error('Error calling search-song function:', error);
      return { error: await invokeErrorMessage(error) };
    }

    return data as SearchSongResponse;
  } catch (err) {
    console.error('Error searching song:', err);
    return {
      error: err instanceof Error ? err.message : 'Unknown error occurred'
    };
  }
}

/**
 * Scrape a song from tab4u.com
 * @param url - The URL of the song page on tab4u.com
 */
export async function scrapeSong(url: string): Promise<ScrapeSongResponse> {
  try {
    const { data, error } = await supabase.functions.invoke(inRegion('scrape-song'), {
      body: { url },
    });

    if (error) {
      console.error('Error calling scrape-song function:', error);
      return { success: false, error: await invokeErrorMessage(error) };
    }

    return data as ScrapeSongResponse;
  } catch (err) {
    console.error('Error scraping song:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred'
    };
  }
}

export interface Favorite {
  url: string;
  title: string;
  artist: string;
  transposition: number;
  savedAt: string;
}

export type FavoritesAction =
  | { action: 'list' }
  | { action: 'save'; favorite: Omit<Favorite, 'savedAt'> }
  | { action: 'remove'; url: string };

/** The shared favorites list; every action returns the whole updated list. */
export async function favoritesRequest(body: FavoritesAction): Promise<Favorite[]> {
  const { data, error } = await supabase.functions.invoke(inRegion('favorites'), { body });
  if (error) throw new Error(await invokeErrorMessage(error));
  return (data?.favorites ?? []) as Favorite[];
}

/** Same song regardless of ?ton= or #hash (matches the favorites function). */
export function normalizeSongUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete('ton');
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}
