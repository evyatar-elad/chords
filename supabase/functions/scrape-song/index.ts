const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  url: string;
}

interface SongData {
  title: string;
  artist: string;
  content: string;
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

    console.log('Parsed song:', songData.title, 'by', songData.artist);

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
  let content = '';
  
  // Find the song content container
  const songContentMatch = html.match(/<div[^>]*id="songContentTPL"[^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]*id="|<\/div>\s*<\/div>)/i);
  
  if (songContentMatch) {
    content = parseSongContent(songContentMatch[1]);
    console.log('Parsed song content, length:', content.length);
  } else {
    // Fallback: look for tables with song/chords classes
    const tablesMatch = html.match(/<table[^>]*>[\s\S]*?class="(?:song|chords)"[\s\S]*?<\/table>/gi);
    if (tablesMatch) {
      content = parseSongContent(tablesMatch.join('\n'));
    }
  }

  return {
    title: title || 'שיר ללא שם',
    artist: artist || 'אמן לא ידוע',
    content,
    transposition,
    hasEasyVersion,
  };
}

function parseSongContent(html: string): string {
  const lines: string[] = [];
  
  // Process tables - each table is typically a section
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableContent = tableMatch[1];
    const rows = parseTableRows(tableContent);
    lines.push(...rows);
    lines.push(''); // Empty line between tables
  }

  // If no tables found, try processing raw HTML
  if (lines.length === 0) {
    return cleanFallbackContent(html);
  }

  return lines.join('\n').trim();
}

function parseTableRows(tableHtml: string): string[] {
  const lines: string[] = [];
  
  // Find all rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowContent = rowMatch[1];
    
    // Find the td
    const tdMatch = rowContent.match(/<td[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/td>/i);
    if (!tdMatch) continue;
    
    const tdClass = tdMatch[1];
    const tdContent = tdMatch[2];
    
    if (tdClass.includes('chords')) {
      // This is a chords row
      const chordsLine = parseChordsRow(tdContent);
      if (chordsLine) {
        lines.push(chordsLine);
      }
    } else if (tdClass.includes('song')) {
      // This is a lyrics row or section title
      const lyricsLine = parseLyricsRow(tdContent);
      if (lyricsLine) {
        lines.push(lyricsLine);
      }
    }
  }
  
  return lines;
}

function parseChordsRow(html: string): string {
  // Extract chords from spans like: <span id="c_1" class="c_C">Cm</span>
  const chords: string[] = [];
  const spacings: string[] = [];
  
  // Split by chord spans to understand spacing
  const parts = html.split(/<span[^>]*class="c_C"[^>]*>/i);
  
  for (let i = 1; i < parts.length; i++) {
    // Extract the chord name from the beginning of this part
    const chordEndMatch = parts[i].match(/^([^<]+)<\/span>([\s&;nbsp]*)/i);
    if (chordEndMatch) {
      const chord = chordEndMatch[1].trim();
      if (chord) {
        chords.push(`[${chord}]`);
      }
      // Count spaces after this chord
      const spacingAfter = chordEndMatch[2] || '';
      const spaceCount = (spacingAfter.match(/&nbsp;/g) || []).length + 
                         (spacingAfter.match(/\s/g) || []).length;
      spacings.push(' '.repeat(Math.max(1, Math.floor(spaceCount / 2))));
    }
  }
  
  // Build the chord line with appropriate spacing
  let result = '';
  for (let i = 0; i < chords.length; i++) {
    result += chords[i] + (spacings[i] || ' ');
  }
  
  return result.trim();
}

function parseLyricsRow(html: string): string {
  // Check if this is a section title
  const titleMatch = html.match(/<span[^>]*class="titLine"[^>]*>([^<]*)<\/span>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }
  
  // Regular lyrics - clean up HTML
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
  
  // Clean up whitespace but preserve intentional spacing
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

function cleanFallbackContent(html: string): string {
  // Fallback parsing for when table structure isn't found
  let content = html;
  
  // Remove script and style tags
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Convert br to newlines
  content = content.replace(/<br\s*\/?>/gi, '\n');
  
  // Convert chord spans to [CHORD] format
  content = content.replace(/<span[^>]*class="c_C"[^>]*>([^<]+)<\/span>/gi, '[$1]');
  
  // Remove remaining HTML tags
  content = content.replace(/<[^>]+>/g, '');
  
  // Clean up entities and whitespace
  content = content.replace(/&nbsp;/g, ' ');
  content = content.replace(/&amp;/g, '&');
  content = content.replace(/\n{3,}/g, '\n\n');
  
  return content.trim();
}
