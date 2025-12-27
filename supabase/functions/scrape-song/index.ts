const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  url: string;
}

// New deterministic data model
interface ChordPosition {
  chord: string;
  at: number; // character offset in lyrics
}

interface LyricsLine {
  type: 'lyrics';
  lyrics: string;
  chords: ChordPosition[];
}

interface ChordsOnlyLine {
  type: 'chords-only';
  chords: string[];
}

interface SectionLine {
  type: 'section';
  text: string;
}

interface EmptyLine {
  type: 'empty';
}

type SongLine = LyricsLine | ChordsOnlyLine | SectionLine | EmptyLine;

interface SongData {
  title: string;
  artist: string;
  lines: SongLine[];
  transposition: number;
  hasEasyVersion: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json() as ScrapeRequest;

    if (!url) {
      console.error('No URL provided');
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate it's a tab4u.com URL
    if (!url.includes('tab4u.com')) {
      console.error('Invalid URL - not tab4u.com:', url);
      return new Response(
        JSON.stringify({ success: false, error: 'Only tab4u.com URLs are supported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping URL:', url);

    // Use Firecrawl to scrape the page
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['html'],
        waitFor: 2000, // Wait for dynamic content
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok || !scrapeData.success) {
      console.error('Firecrawl error:', scrapeData);
      return new Response(
        JSON.stringify({ success: false, error: scrapeData.error || 'Failed to scrape page' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = scrapeData.data?.html || '';
    console.log('Received HTML length:', html.length);

    // Parse the song data from the HTML
    const songData = parseSongFromHtml(html, url);

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

function parseSongFromHtml(html: string, url: string): SongData {
  let title = 'שיר ללא שם';
  let artist = 'אמן לא ידוע';

  // Extract title and artist from h1: "אקורדים לשיר SONG_NAME של ARTIST_NAME"
  const h1Match = html.match(/<h1[^>]*>.*?אקורדים לשיר\s+([^<]+?)\s+של\s+(?:<a[^>]*>)?([^<]+?)(?:<\/a>)?<\/font><\/h1>/is);
  if (h1Match) {
    title = h1Match[1].trim();
    artist = h1Match[2].trim();
    console.log('Extracted from h1:', { title, artist });
  } else {
    // Fallback: try alternative h1 pattern
    const altH1Match = html.match(/<h1[^>]*>[^<]*אקורדים לשיר\s+(.+?)\s+של\s+<a[^>]*>([^<]+)<\/a>/is);
    if (altH1Match) {
      title = altH1Match[1].trim();
      artist = altH1Match[2].trim();
      console.log('Extracted from alt h1:', { title, artist });
    }
  }

  // Check for easy version link and get transposition value
  let transposition = 0;
  let hasEasyVersion = false;

  // Look for the easy version link with ton parameter (can be negative like ton=-1.5)
  const easyVersionMatch = html.match(/href="[^"]*\?ton=(-?[\d.]+)[^"]*"[^>]*>[^<]*גרסה קלה/i) ||
                           html.match(/id="eLinkZ"[^>]*href="[^"]*\?ton=(-?[\d.]+)/i);
  
  if (easyVersionMatch) {
    hasEasyVersion = true;
    transposition = parseFloat(easyVersionMatch[1]) || 0;
    console.log('Found easy version with transposition:', transposition);
  }

  // Also check if the current URL has a ton parameter
  const urlTonMatch = url.match(/[?&]ton=(-?[\d.]+)/);
  if (urlTonMatch) {
    transposition = parseFloat(urlTonMatch[1]) || 0;
    console.log('URL has ton parameter:', transposition);
  }

  // Extract the song content from the songContentTPL div
  let lines: SongLine[] = [];
  
  // Find the song content container
  const songContentMatch = html.match(/<div[^>]*id="songContentTPL"[^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]*id="|<\/div>\s*<\/div>)/i);
  
  if (songContentMatch) {
    lines = parseSongContent(songContentMatch[1]);
    console.log('Parsed song content, lines:', lines.length);
  } else {
    // Fallback: look for tables with song/chords classes
    const tablesMatch = html.match(/<table[^>]*>[\s\S]*?class="(?:song|chords)"[\s\S]*?<\/table>/gi);
    if (tablesMatch) {
      lines = parseSongContent(tablesMatch.join('\n'));
    }
  }

  return {
    title: title || 'שיר ללא שם',
    artist: artist || 'אמן לא ידוע',
    lines,
    transposition,
    hasEasyVersion,
  };
}

function parseSongContent(html: string): SongLine[] {
  const lines: SongLine[] = [];
  
  // Process tables - each table is typically a section
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableContent = tableMatch[1];
    const tableLines = parseTableRows(tableContent);
    lines.push(...tableLines);
    lines.push({ type: 'empty' }); // Empty line between tables
  }

  // If no tables found, return empty
  if (lines.length === 0) {
    return [];
  }

  return lines;
}

function parseTableRows(tableHtml: string): SongLine[] {
  const result: SongLine[] = [];
  
  // Find all rows in pairs (chords row followed by lyrics row)
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows: { type: 'chords' | 'lyrics' | 'section'; content: string }[] = [];
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowContent = rowMatch[1];
    
    // Find the td
    const tdMatch = rowContent.match(/<td[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/td>/i);
    if (!tdMatch) continue;
    
    const tdClass = tdMatch[1];
    const tdContent = tdMatch[2];
    
    if (tdClass.includes('chords')) {
      rows.push({ type: 'chords', content: tdContent });
    } else if (tdClass.includes('song')) {
      // Check if it's a section title
      if (tdContent.includes('titLine')) {
        rows.push({ type: 'section', content: tdContent });
      } else {
        rows.push({ type: 'lyrics', content: tdContent });
      }
    }
  }
  
  // Process rows - pair chords with lyrics
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    
    if (row.type === 'section') {
      // Section title
      const titleMatch = row.content.match(/<span[^>]*class="titLine"[^>]*>([^<]*)<\/span>/i);
      if (titleMatch) {
        result.push({ type: 'section', text: titleMatch[1].trim() });
      }
      i++;
    } else if (row.type === 'chords') {
      // Parse chords with their positions
      const chordPositions = extractChordPositions(row.content);
      
      // Check if next row is lyrics
      if (i + 1 < rows.length && rows[i + 1].type === 'lyrics') {
        // Combine chords with lyrics - new format
        const lyricsText = extractLyricsText(rows[i + 1].content);

        // NOTE: Tab4U chord positions are effectively measured from the LEFT edge of the rendered line,
        // while Hebrew lyrics render RTL. Convert "position" to an RTL-friendly offset into the string.
        // This fixes the apparent reversed chord order.
        const len = lyricsText.length;
        const chordsWithAt: ChordPosition[] = chordPositions
          .map((cp) => ({
            chord: cp.chord,
            at: Math.min(len, Math.max(0, len - cp.position)),
          }))
          .sort((a, b) => a.at - b.at);
        
        result.push({ 
          type: 'lyrics', 
          lyrics: lyricsText, 
          chords: chordsWithAt 
        });
        i += 2;
      } else {
        // Chords only line (intro/transition)
        if (chordPositions.length > 0) {
          result.push({ 
            type: 'chords-only', 
            chords: chordPositions.map(cp => cp.chord) 
          });
        }
        i++;
      }
    } else if (row.type === 'lyrics') {
      // Lyrics without chords above
      const lyricsText = extractLyricsText(row.content);
      if (lyricsText.trim()) {
        result.push({ 
          type: 'lyrics', 
          lyrics: lyricsText,
          chords: []
        });
      }
      i++;
    } else {
      i++;
    }
  }
  
  return result;
}

interface ExtractedChordPosition {
  chord: string;
  position: number;
}

function extractChordPositions(html: string): ExtractedChordPosition[] {
  const chords: ExtractedChordPosition[] = [];
  const chordRegex = /<span[^>]*class="c_C"[^>]*>([^<]*)<\/span>/gi;
  
  let processedHtml = html.replace(/&nbsp;/g, ' ');
  let match;
  
  while ((match = chordRegex.exec(processedHtml)) !== null) {
    const chord = match[1].trim();
    if (chord) {
      // Calculate position based on text before this match (excluding HTML tags)
      const textBefore = processedHtml.substring(0, match.index).replace(/<[^>]+>/g, '');
      chords.push({ chord, position: textBefore.length });
    }
  }
  
  return chords;
}

function extractLyricsText(html: string): string {
  let text = html;
  
  // Replace &nbsp; with regular space
  text = text.replace(/&nbsp;/g, ' ');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode remaining entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  
  return text;
}
