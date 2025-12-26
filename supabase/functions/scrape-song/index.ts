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
  // Extract title - look for the song title in various places
  let title = 'שיר ללא שם';
  let artist = 'אמן לא ידוע';

  // Try to extract from h1 or title element
  const titleMatch = html.match(/<h1[^>]*class="[^"]*song-title[^"]*"[^>]*>([^<]+)</i) ||
                     html.match(/<title>([^<]+)<\/title>/i) ||
                     html.match(/<h1[^>]*>([^<]+)</i);
  
  if (titleMatch) {
    const fullTitle = titleMatch[1].trim();
    // Tab4u format is usually "Artist - Song Title" or "Song Title - Artist"
    const parts = fullTitle.split(' - ');
    if (parts.length >= 2) {
      // Try to determine which is artist and which is song
      artist = parts[0].trim().replace(/tab4u\.com/gi, '').replace(/אקורדים/gi, '').trim();
      title = parts.slice(1).join(' - ').trim().replace(/אקורדים/gi, '').trim();
    } else {
      title = fullTitle.replace(/tab4u\.com/gi, '').replace(/אקורדים/gi, '').trim();
    }
  }

  // Check for easy version button and get transposition value
  let transposition = 0;
  let hasEasyVersion = false;

  // Look for the easy version link with ton parameter
  const easyVersionMatch = html.match(/href="[^"]*ton=(\d+)[^"]*"[^>]*>[^<]*גרסה קלה/i) ||
                           html.match(/גרסה קלה[^<]*<\/a>[^<]*href="[^"]*ton=(\d+)/i);
  
  if (easyVersionMatch) {
    hasEasyVersion = true;
    transposition = parseInt(easyVersionMatch[1], 10) || 0;
    console.log('Found easy version with transposition:', transposition);
  }

  // Check if "אין גרסה קלה" exists
  if (html.includes('אין גרסה קלה')) {
    hasEasyVersion = false;
    transposition = 0;
  }

  // Extract the song content (chords and lyrics)
  let content = '';

  // Look for the main song content container - tab4u uses various class names
  const contentPatterns = [
    /<div[^>]*class="[^"]*song[_-]?content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div/i,
    /<div[^>]*id="[^"]*song[_-]?content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div/i,
    /<pre[^>]*class="[^"]*chords[^"]*"[^>]*>([\s\S]*?)<\/pre>/i,
    /<div[^>]*class="[^"]*tabs?[_-]?view[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
  ];

  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match) {
      content = match[1];
      break;
    }
  }

  // If no specific container found, try to find content between markers
  if (!content) {
    // Look for the text area with song content
    const songAreaMatch = html.match(/<div[^>]*class="[^"]*songtable[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (songAreaMatch) {
      content = songAreaMatch[1];
    }
  }

  // Clean up the HTML content
  content = cleanHtmlContent(content || html);

  return {
    title: title || 'שיר ללא שם',
    artist: artist || 'אמן לא ידוע',
    content,
    transposition,
    hasEasyVersion,
  };
}

function cleanHtmlContent(html: string): string {
  // Remove script and style tags
  let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Convert <br> tags to newlines
  content = content.replace(/<br\s*\/?>/gi, '\n');
  
  // Convert chord spans to marked format [CHORD]
  // Tab4u typically wraps chords in span tags with specific classes
  content = content.replace(/<span[^>]*class="[^"]*chords?[^"]*"[^>]*>([^<]+)<\/span>/gi, '[$1]');
  content = content.replace(/<b[^>]*class="[^"]*chords?[^"]*"[^>]*>([^<]+)<\/b>/gi, '[$1]');
  content = content.replace(/<strong[^>]*>([A-G][#b]?(?:m|maj|min|dim|aug|sus|add|7|9|11|13)*(?:\/[A-G][#b]?)?)<\/strong>/gi, '[$1]');
  
  // Remove remaining HTML tags but preserve structure
  content = content.replace(/<\/?(div|p|section)[^>]*>/gi, '\n');
  content = content.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  content = content.replace(/&nbsp;/g, ' ');
  content = content.replace(/&amp;/g, '&');
  content = content.replace(/&lt;/g, '<');
  content = content.replace(/&gt;/g, '>');
  content = content.replace(/&quot;/g, '"');
  content = content.replace(/&#39;/g, "'");
  content = content.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  
  // Clean up extra whitespace while preserving intentional spacing
  content = content.replace(/\n{3,}/g, '\n\n');
  content = content.trim();
  
  return content;
}
