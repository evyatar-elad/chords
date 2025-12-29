import { supabase } from "@/integrations/supabase/client";

// New deterministic data model
export interface ChordPosition {
  chord: string;
  at: number; // character offset in lyrics
}

export interface LyricsLine {
  type: 'lyrics';
  lyrics: string;
  chords: ChordPosition[];
}

export interface ChordsOnlyLine {
  type: 'chords-only';
  chords: string[];
}

export interface SectionLine {
  type: 'section';
  text: string;
}

export interface EmptyLine {
  type: 'empty';
}

export type SongLine = LyricsLine | ChordsOnlyLine | SectionLine | EmptyLine;

export interface SongData {
  title: string;
  artist: string;
  lines: SongLine[];
  transposition: number;
  hasEasyVersion: boolean;
}

export interface ScrapeSongResponse {
  success: boolean;
  data?: SongData;
  error?: string;
}

export interface SearchSongResponse {
  url?: string;
  error?: string;
  message?: string;
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
      return { error: error.message };
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
    const { data, error } = await supabase.functions.invoke('scrape-song', {
      body: { url },
    });

    if (error) {
      console.error('Error calling scrape-song function:', error);
      return { success: false, error: error.message };
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
