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

  const decodeEntities = (s: string) =>
    s
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

  const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

  // Prefer extracting from the visible H1, but do it in a tag-agnostic way
  const h1Block = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Block) {
    const h1Text = stripTags(h1Block[1]);
    // Example: "אקורדים לשיר מעליות של דודו טסה ו רוני אלטר"
    const m = h1Text.match(/אקורדים לשיר\s+(.+?)\s+של\s+(.+)$/);
    if (m) {
      title = m[1].trim();
      artist = m[2].replace(/\s+ו\s+/g, ' ו ').trim();
      console.log('Extracted from h1 (text):', { title, artist });
    }
  }

  // Fallback: extract from <title>
  if (title === 'שיר ללא שם') {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      const titleText = stripTags(titleMatch[1]);
      // Common format: "אקורדים לשיר SONG - ARTIST | tab4u"
      const parsedTitle = titleText.match(/אקורדים לשיר\s+(.+?)\s+-\s+(.+?)\s*(?:\||$)/);
      if (parsedTitle) {
        title = parsedTitle[1].trim();
        artist = parsedTitle[2].trim();
        console.log('Extracted from title tag:', { title, artist });
      }
    }
  }

  // Final fallback: from URL
  if (title === 'שיר ללא שם') {
    const urlMatch = url.match(/songs\/\d+_([^_]+)_-_([^.]+)\.html/);
    if (urlMatch) {
      artist = decodeURIComponent(urlMatch[1]).replace(/_/g, ' ');
      title = decodeURIComponent(urlMatch[2]).replace(/_/g, ' ');
      console.log('Extracted from URL:', { title, artist });
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
  let inlineChordLyricsRows = 0;

  while (i < rows.length) {
    const row = rows[i];

    if (row.type === 'section') {
      // Section title
      const titleMatch = row.content.match(/<span[^>]*class="titLine"[^>]*>([^<]*)<\/span>/i);
      if (titleMatch) {
        result.push({ type: 'section', text: titleMatch[1].trim() });
      }
      i++;
      continue;
    }

    if (row.type === 'chords') {
      // Parse chords with their positions
      const chordPositions = extractChordPositions(row.content);

      // Check if next row is lyrics
      if (i + 1 < rows.length && rows[i + 1].type === 'lyrics') {
        const lyricsText = extractLyricsText(rows[i + 1].content);

        // NOTE: Tab4U chord positions are effectively measured from the LEFT edge of the rendered line,
        // while Hebrew lyrics render RTL. Convert "position" to an RTL-friendly offset into the string.
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
          chords: chordsWithAt,
        });
        i += 2;
      } else {
        // Chords only line (intro/transition)
        // Sort by position DESCENDING so the chord that was on the right (higher position)
        // comes first in the array. Combined with RTL display, this gives correct order.
        if (chordPositions.length > 0) {
          const sortedChords = [...chordPositions]
            .sort((a, b) => b.position - a.position)
            .map((cp) => cp.chord);
          result.push({
            type: 'chords-only',
            chords: sortedChords,
          });
        }
        i++;
      }
      continue;
    }

    if (row.type === 'lyrics') {
      // Lyrics row may contain INLINE chords ("c_C" spans) inside the lyrics itself.
      // In that case, treat it as a full lyrics+chords line extracted from the same row.
      const hasInlineChords = /class="c_C"/i.test(row.content);

      if (hasInlineChords) {
        inlineChordLyricsRows++;

        const extracted = extractChordPositions(row.content);
        const lyricsText = extractLyricsTextWithoutChords(row.content);

        const len = lyricsText.length;
        const chordsWithAt: ChordPosition[] = extracted
          .map((cp) => ({
            chord: cp.chord,
            at: Math.min(len, Math.max(0, len - cp.position)),
          }))
          .sort((a, b) => a.at - b.at);

        if (lyricsText.trim() || chordsWithAt.length) {
          result.push({
            type: 'lyrics',
            lyrics: lyricsText,
            chords: chordsWithAt,
          });
        }

        i++;
        continue;
      }

      // Lyrics without chords above
      const lyricsText = extractLyricsText(row.content);
      if (lyricsText.trim()) {
        result.push({
          type: 'lyrics',
          lyrics: lyricsText,
          chords: [],
        });
      }
      i++;
      continue;
    }

    i++;
  }

  if (inlineChordLyricsRows > 0) {
    console.log('Found inline-chord lyrics rows:', inlineChordLyricsRows);
  }

  return result;
}

interface ExtractedChordPosition {
  chord: string;
  position: number;
}

/**
 * Clean chord label by removing spaces before common modifiers
 * Fixes cases like "Bm7 b5" → "Bm7b5", "C #9" → "C#9"
 * MUST run BEFORE tokenizeGluedChords to prevent incorrect splitting
 */
function cleanChordLabel(chordLabel: string): string {
  if (!chordLabel) return chordLabel;

  // Remove spaces before common modifiers: b5, b9, b13, #5, #9, #11, etc.
  return chordLabel
    .replace(/\s+([b#♭♯])(\d+)/g, '$1$2')  // "Bm7 b5" → "Bm7b5"
    .replace(/\s+([b#♭♯])$/g, '$1')        // "Bb " → "Bb"
    .trim();
}

/**
 * Tokenize a potentially glued chord string like "E7Am" or "AmDm" into separate chords.
 * Handles uppercase and lowercase roots (for cases like "E7am").
 */
function tokenizeGluedChords(chordLabel: string): string[] {
  const raw = cleanChordLabel(chordLabel ?? "").trim();
  if (!raw) return [];

  const tokens: string[] = [];
  let current = "";
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];

    // Skip whitespace and separators
    if (/[\s(),\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      i++;
      continue;
    }

    // Check if this is a chord root (A-G uppercase OR a-g lowercase when glued)
    const isUpperRoot = /[A-G]/.test(ch);
    const isLowerRoot = /[a-g]/.test(ch);

    // Lowercase root only starts new chord if:
    // - We already have content AND
    // - Previous char is a digit or closing paren (indicating end of previous chord modifier)
    // - BUT: lowercase 'b' followed by digit is a FLAT MODIFIER (b5, b9, b13), NOT a new chord!
    const prevChar = i > 0 ? raw[i - 1] : "";
    const nextChar = i + 1 < raw.length ? raw[i + 1] : "";
    const isFlatModifier = ch === 'b' && /[0-9]/.test(nextChar);
    const shouldSplitOnLower = isLowerRoot && current && /[0-9)]/.test(prevChar) && !isFlatModifier;
    
    if (isUpperRoot || shouldSplitOnLower) {
      // If we already have a chord building, save it first
      // Exception: if previous char was '/', this is a bass note
      if (current && prevChar !== "/") {
        tokens.push(current);
        current = "";
      }
      current += ch;
      i++;

      // Optional sharp or flat immediately after root
      if (i < raw.length && /[#b♯♭]/.test(raw[i])) {
        current += raw[i];
        i++;
      }
      continue;
    }

    // Slash - could be slash chord bass note coming
    if (ch === "/") {
      current += ch;
      i++;
      continue;
    }

    // Any other character (modifiers, numbers) - add to current chord
    current += ch;
    i++;
  }

  // Don't forget the last chord
  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function extractChordPositions(html: string): ExtractedChordPosition[] {
  const chords: ExtractedChordPosition[] = [];
  const chordRegex = /<span[^>]*class="c_C"[^>]*>([^<]*)<\/span>/gi;
  
  let processedHtml = html.replace(/&nbsp;/g, ' ');
  let match;
  
  while ((match = chordRegex.exec(processedHtml)) !== null) {
    const rawChord = match[1].trim();
    if (rawChord) {
      // Calculate position based on text before this match (excluding HTML tags)
      const textBefore = processedHtml.substring(0, match.index).replace(/<[^>]+>/g, '');
      const position = textBefore.length;
      
      // Split glued chords (e.g., "E7Am" -> ["E7", "Am"])
      const tokens = tokenizeGluedChords(rawChord);
      
      // Add each token as a separate chord at the same position
      for (const chord of tokens) {
        chords.push({ chord, position });
      }
    }
  }
  
  return chords;
}

function extractLyricsText(html: string): string {
  let text = html;

  // Replace &nbsp; with regular space
  text = text.replace(/&nbsp;/g, ' ');

  // IMPORTANT: remove inline chord spans from lyrics so chords never get "glued" into the lyrics text.
  // (Some pages embed chords directly inside the lyrics row.)
  text = text.replace(/<span[^>]*class="c_C"[^>]*>[\s\S]*?<\/span>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode remaining entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');

  return text;
}

function extractLyricsTextWithoutChords(html: string): string {
  // Alias for clarity at call sites.
  return extractLyricsText(html);
}
