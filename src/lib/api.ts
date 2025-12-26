import { supabase } from "@/integrations/supabase/client";

export interface ChordUnit {
  chord: string | null;
  text: string;
}

export interface SongLine {
  type: 'lyrics' | 'chords-only' | 'section' | 'empty';
  units?: ChordUnit[];
  text?: string;
}

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
