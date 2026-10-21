// Pure tab4u HTML → SongData parser (no Deno/Node APIs, so it can be unit-tested).
//
// How tab4u lays a song out (from its CSS):
//   - chord rows (td.chords) are `direction: ltr; text-align: right` in a monospace font
//   - lyric rows (td.song) are RTL (right aligned) in the same monospace font
//   - English songs use td.chords_en (`direction: ltr; text-align: left`) and LTR lyric rows
// Every character is one column, so a chord's position is fully determined by its
// column in the chord row and the length of that row. We reproduce that exactly.

export interface ChordPosition {
  chord: string;
  /** Index (in the lyrics string) of the first lyric character under the chord. May be >= lyrics.length. */
  at: number;
}

export interface LyricsLine {
  type: "lyrics";
  lyrics: string;
  chords: ChordPosition[];
}

export interface ChordsOnlySegment {
  text: string;
  chord?: boolean;
}

export interface ChordsOnlyLine {
  type: "chords-only";
  chords: string[];
  /** The row as tab4u shows it, left to right: chords plus separators like "|" or "x2". */
  segments?: ChordsOnlySegment[];
}

export interface TabLine {
  type: "tab";
  rows: string[];
  /** Chords written above the tab, already padded so their columns line up with the rows. */
  chords?: ChordsOnlySegment[];
}

export interface SectionLine {
  type: "section";
  text: string;
}

export interface EmptyLine {
  type: "empty";
}

export type SongLine = LyricsLine | ChordsOnlyLine | TabLine | SectionLine | EmptyLine;

export interface SongData {
  title: string;
  artist: string;
  lines: SongLine[];
  transposition: number;
  hasEasyVersion: boolean;
  direction: "rtl" | "ltr";
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: "\u00a0",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 ? String.fromCodePoint(cp) : m;
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m;
  });
}

const stripTags = (s: string) =>
  decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/[\s\u00a0]+/g, " ").trim();

const hasClass = (attrs: string, cls: string) => {
  const m = attrs.match(/class\s*=\s*["']([^"']*)["']/i);
  return !!m && m[1].split(/\s+/).includes(cls);
};

// ============================================
// Cell rendering (mimics browser whitespace handling)
// ============================================

interface CellChord {
  label: string;
  /** Column of the chord's first character in the rendered row. */
  k: number;
  /** Offset in the row text with all chord labels removed (for chords written inline in lyrics). */
  plainAt: number;
}

interface RenderedCell {
  text: string;
  plain: string;
  chords: CellChord[];
}

export const NO_CHORD = "N.C.";

const CELL_TOKEN =
  /<span\b[^>]*class\s*=\s*["'][^"']*\bc_C\b[^"']*["'][^>]*>([\s\S]*?)<\/span>|<img\b[^>]*class\s*=\s*["'][^"']*\bnoCI\b[^"']*["'][^>]*>|<br\s*\/?>|<[^>]+>/gi;

/**
 * Render a td's inner HTML the way a browser lays it out on one line:
 * runs of collapsible whitespace become one space and are trimmed at the edges,
 * &nbsp; is kept. Chord spans and "no chord" icons are recorded with their column.
 */
export function renderCell(html: string): RenderedCell {
  let text = "";
  let plain = "";
  const chords: CellChord[] = [];

  const appendText = (raw: string) => {
    let t = decodeEntities(raw).replace(/[ \t\n\r\f]+/g, " ");
    if (text.endsWith(" ") && t.startsWith(" ")) t = t.slice(1);
    text += t;
    plain += t;
  };
  const appendChord = (label: string) => {
    chords.push({ label, k: text.length, plainAt: plain.length });
    text += label;
  };

  let last = 0;
  CELL_TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CELL_TOKEN.exec(html)) !== null) {
    appendText(html.slice(last, m.index));
    last = CELL_TOKEN.lastIndex;
    const tag = m[0];
    if (m[1] !== undefined) {
      const label = stripTags(m[1]);
      if (label) appendChord(label);
    } else if (/^<img/i.test(tag)) {
      // tab4u's "no chord" icon takes about one column
      chords.push({ label: NO_CHORD, k: text.length, plainAt: plain.length });
      text += "\u00a0";
    } else if (/^<br/i.test(tag)) {
      appendText(" ");
    }
  }
  appendText(html.slice(last));

  // Trim collapsible spaces (not nbsp) at the edges, shifting columns accordingly
  const lead = text.match(/^ */)![0].length;
  const plainLead = plain.match(/^ */)![0].length;
  return {
    text: text.slice(lead).replace(/ +$/, ""),
    plain: plain.slice(plainLead).replace(/ +$/, ""),
    chords: chords.map((c) => ({ ...c, k: c.k - lead, plainAt: c.plainAt - plainLead })),
  };
}

// ============================================
// Chord labels
// ============================================

/** Remove spaces before modifiers: "Bm7 b5" → "Bm7b5", "C #9" → "C#9". Must run before tokenizing. */
function cleanChordLabel(label: string): string {
  return label
    .replace(/\s+([b#♭♯])(\d+)/g, "$1$2")
    .replace(/\s+([b#♭♯])$/g, "$1")
    .trim();
}

/**
 * Split a possibly glued chord label ("E7Am", "AmDm") into chords, keeping each one's
 * offset inside the label so its column stays exact.
 */
export function tokenizeChordLabel(label: string): Array<{ chord: string; offset: number; width: number }> {
  if (label === NO_CHORD) return [{ chord: NO_CHORD, offset: 0, width: 1 }];
  const raw = label;
  const tokens: Array<{ chord: string; offset: number; width: number }> = [];
  let current = "";
  let start = 0;
  let end = 0;
  const flush = () => {
    const cleaned = cleanChordLabel(current);
    if (cleaned) tokens.push({ chord: cleaned, offset: start, width: end - start });
    current = "";
  };

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const prev = i > 0 ? raw[i - 1] : "";
    const next = i + 1 < raw.length ? raw[i + 1] : "";

    if (/[\s,\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(ch)) {
      // "Bm7 b5": a space before a flat/sharp modifier belongs to the same chord
      if (current && /\s/.test(ch) && /[b#♭♯]/.test(next) && /\d/.test(raw[i + 2] ?? "")) continue;
      if (current) flush();
      continue;
    }

    const isUpperRoot = /[A-G]/.test(ch);
    // a lowercase root only starts a chord when glued after a digit ("E7am"); "b5" is a modifier
    const isLowerRoot = /[a-g]/.test(ch) && !!current && /[0-9)]/.test(prev) && !(ch === "b" && /\d/.test(next));

    if ((isUpperRoot || isLowerRoot) && current && prev !== "/") flush();
    if (!current) start = i;
    current += ch;
    end = i + 1;
  }
  if (current) flush();
  return tokens;
}

// ============================================
// Lines
// ============================================

const toSpaces = (s: string) => s.replace(/\u00a0/g, " ");

function buildLyricsLine(chordHtml: string, lyricHtml: string, rtl: boolean): LyricsLine {
  const chordCell = renderCell(chordHtml);
  const visual = toSpaces(renderCell(lyricHtml).plain);
  const lead = visual.match(/^\s*/)![0].length;
  const lyrics = visual.trim();
  const rowLen = chordCell.text.length;

  const chords: ChordPosition[] = [];
  for (const c of chordCell.chords) {
    for (const t of tokenizeChordLabel(c.label)) {
      const k = c.k + t.offset;
      // RTL: the chord row is LTR and right aligned, so column k counted from the left sits
      // (rowLen - k - len) columns from the right edge – where lyric index 0 is.
      const col = rtl ? rowLen - k - t.width : k;
      chords.push({ chord: t.chord, at: Math.max(0, col - lead) });
    }
  }
  chords.sort((a, b) => a.at - b.at);
  return { type: "lyrics", lyrics, chords };
}

function buildInlineChordLine(lyricHtml: string): LyricsLine {
  const cell = renderCell(lyricHtml);
  const visual = toSpaces(cell.plain);
  const lead = visual.match(/^\s*/)![0].length;
  const chords: ChordPosition[] = [];
  for (const c of cell.chords) {
    for (const t of tokenizeChordLabel(c.label)) chords.push({ chord: t.chord, at: Math.max(0, c.plainAt - lead) });
  }
  return { type: "lyrics", lyrics: visual.trim(), chords };
}

function buildChordsOnlyLine(chordHtml: string, keepPadding = false): ChordsOnlyLine | null {
  const cell = renderCell(chordHtml);
  if (!cell.chords.length) {
    const text = toSpaces(cell.text).trim();
    return text ? { type: "chords-only", chords: [], segments: [{ text }] } : null;
  }

  const segments: ChordsOnlySegment[] = [];
  const chords: string[] = [];
  let pos = 0;
  for (const c of cell.chords) {
    if (c.k > pos) segments.push({ text: toSpaces(cell.text.slice(pos, c.k)) });
    const tokens = tokenizeChordLabel(c.label);
    tokens.forEach((t, i) => {
      if (i > 0) segments.push({ text: " " });
      segments.push({ text: t.chord, chord: true });
      chords.push(t.chord);
    });
    pos = c.k + (c.label === NO_CHORD ? 1 : c.label.length);
  }
  if (pos < cell.text.length) segments.push({ text: toSpaces(cell.text.slice(pos)) });

  if (keepPadding) return { type: "chords-only", chords, segments };

  // padding at the row edges carries no meaning once the row is not right-aligned to lyrics
  while (segments.length && !segments[0].chord && !segments[0].text.trim()) segments.shift();
  while (segments.length && !segments[segments.length - 1].chord && !segments[segments.length - 1].text.trim()) segments.pop();
  if (segments.length && !segments[0].chord) segments[0].text = segments[0].text.trimStart();
  const lastSeg = segments[segments.length - 1];
  if (lastSeg && !lastSeg.chord) lastSeg.text = lastSeg.text.trimEnd();

  return { type: "chords-only", chords, segments };
}

function buildChordsOnlyFromSegments(segments: ChordsOnlySegment[]): ChordsOnlyLine | null {
  const segs = segments.map((seg) => ({ ...seg }));
  while (segs.length && !segs[0].chord && !segs[0].text.trim()) segs.shift();
  while (segs.length && !segs[segs.length - 1].chord && !segs[segs.length - 1].text.trim()) segs.pop();
  if (!segs.length) return null;
  return { type: "chords-only", chords: segs.filter((seg) => seg.chord).map((seg) => seg.text), segments: segs };
}

const SECTION_TITLE = /class\s*=\s*["'][^"']*\btitLine\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i;

interface Cell {
  kind: "chords" | "chords_en" | "song" | "tabs";
  html: string;
}

function readCells(tableHtml: string): Cell[] {
  const cells: Cell[] = [];
  const tdRe = /<td\b([^>]*)>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = tdRe.exec(tableHtml)) !== null) {
    const attrs = m[1];
    const kind = hasClass(attrs, "chords_en")
      ? "chords_en"
      : hasClass(attrs, "chords")
        ? "chords"
        : hasClass(attrs, "tabs")
          ? "tabs"
          : hasClass(attrs, "song")
            ? "song"
            : null;
    if (kind) cells.push({ kind, html: m[2] });
  }
  return cells;
}

/**
 * @param centeredTabChords the chord row came from its own centered table above a centered
 *   tab table (tab4u's intro layout), so it is centered over the tab instead of right-aligned
 */
function parseTable(cells: Cell[], centeredTabChords = false): SongLine[] {
  const out: SongLine[] = [];
  let tabRows: string[] = [];
  let tabChords: ChordsOnlySegment[] | null = null;
  const flushTab = () => {
    if (tabRows.length) {
      const tab: TabLine = { type: "tab", rows: tabRows };
      if (tabChords) {
        // tab4u right-aligns the chord row to the table, i.e. to the widest tab row
        const width = tabChords.reduce((n, seg) => n + seg.text.length, 0);
        const extra = Math.max(0, Math.max(...tabRows.map((r) => r.length)) - width);
        const pad = centeredTabChords ? Math.round(extra / 2) : extra;
        tab.chords = pad ? [{ text: " ".repeat(pad) }, ...tabChords] : tabChords;
        while (tab.chords.length && !tab.chords[tab.chords.length - 1].chord) tab.chords.pop();
      }
      out.push(tab);
    } else if (tabChords) {
      const line = buildChordsOnlyFromSegments(tabChords);
      if (line) out.push(line);
    }
    tabRows = [];
    tabChords = null;
  };

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell.kind === "tabs") {
      const row = toSpaces(renderCell(cell.html).text).trimEnd();
      if (row.trim()) tabRows.push(row);
      continue;
    }
    if (tabRows.length || tabChords) flushTab();

    if (cell.kind === "chords" || cell.kind === "chords_en") {
      const next = cells[i + 1];
      if (next && next.kind === "tabs") {
        tabChords = buildChordsOnlyLine(cell.html, true)?.segments ?? null;
        continue;
      }
      if (next && next.kind === "song" && !SECTION_TITLE.test(next.html)) {
        out.push(buildLyricsLine(cell.html, next.html, cell.kind === "chords"));
        i++;
      } else {
        const line = buildChordsOnlyLine(cell.html);
        if (line) out.push(line);
      }
      continue;
    }

    // song row
    const title = cell.html.match(SECTION_TITLE);
    if (title) {
      const text = stripTags(title[1]);
      if (text) out.push({ type: "section", text });
      continue;
    }
    if (/\bc_C\b/.test(cell.html)) {
      out.push(buildInlineChordLine(cell.html));
      continue;
    }
    const lyrics = toSpaces(renderCell(cell.html).plain).trim();
    if (!lyrics) {
      out.push({ type: "empty" });
    } else if (lyrics.length <= 25 && lyrics.split(" ").length <= 4 && /[:：]$/.test(lyrics)) {
      // "פתיחה:", "פזמון:", "Chorus:" – a short label with no chords above it
      out.push({ type: "section", text: lyrics });
    } else {
      out.push({ type: "lyrics", lyrics, chords: [] });
    }
  }
  flushTab();
  return out;
}

/** Inner HTML of the div with the given id, honoring nested divs. */
function extractDivById(html: string, id: string): string | null {
  const open = new RegExp(`<div\\b[^>]*\\bid\\s*=\\s*["']${id}["'][^>]*>`, "i").exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = start;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    if (m[0][1] === "/") depth--;
    else if (!m[0].endsWith("/>")) depth++;
    if (depth === 0) return html.slice(start, m.index);
  }
  return html.slice(start);
}

export function parseSongContent(contentHtml: string): SongLine[] {
  const lines: SongLine[] = [];
  let pendingBreak = false;
  const pushEmpty = () => {
    const prev = lines[lines.length - 1];
    if (prev && prev.type !== "empty") lines.push({ type: "empty" });
  };

  const blocks: Array<Cell[] | "br"> = [];
  const blockRe = /<table\b[\s\S]*?<\/table>|<br\s*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(contentHtml)) !== null) {
    blocks.push(/^<br/i.test(m[0]) ? "br" : readCells(m[0]));
  }

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    if (block === "br") {
      pendingBreak = true;
      continue;
    }
    // A table holding only a chord row, directly followed by a tab table: the chords belong to the tab
    let cells = block;
    let centered = false;
    const next = blocks[b + 1];
    if (cells.length === 1 && cells[0].kind !== "song" && cells[0].kind !== "tabs" && next !== "br" && next?.[0]?.kind === "tabs") {
      cells = [...cells, ...next];
      centered = true;
      b++;
    }

    const tableLines = parseTable(cells, centered);
    if (!tableLines.length) continue;
    if (pendingBreak) pushEmpty();
    pendingBreak = false;
    for (const line of tableLines) {
      if (line.type === "empty") pushEmpty();
      else lines.push(line);
    }
  }

  while (lines.length && lines[lines.length - 1].type === "empty") lines.pop();
  while (lines.length && lines[0].type === "empty") lines.shift();
  return lines;
}

export function parseSongFromHtml(html: string, url: string): SongData {
  let title = "";
  let artist = "";

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    // "אקורדים לשיר <title> של <a class=artistTitle>A</a> ו<a>B</a>". Split at the first artist
    // link, since titles may contain "של" themselves ("לא בקטע של גיי").
    const firstArtist = h1[1].search(/<a\b[^>]*\bartistTitle\b/i);
    if (firstArtist > 0) {
      const t = stripTags(h1[1].slice(0, firstArtist)).match(/אקורדים לשיר\s+(.+?)\s+של$/);
      if (t) {
        title = t[1].trim();
        artist = stripTags(h1[1].slice(firstArtist));
      }
    }
    if (!title) {
      // Tags are removed without adding spaces, so "X</a> ו<a>Y" stays "X וY"
      const m = stripTags(h1[1]).match(/אקורדים לשיר\s+(.+?)\s+של\s+(.+)$/);
      if (m) {
        title = m[1].trim();
        artist = m[2].trim();
      }
    }
  }

  if (!title) {
    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const m = t && stripTags(t[1]).match(/אקורדים לשיר\s+(.+?)\s+(?:-|של)\s+(.+?)\s*(?:\||$)/);
    if (m) {
      title = m[1].trim();
      artist = m[2].trim();
    }
  }

  if (!title) {
    const m = url.match(/songs\/\d+_([^/]+?)_-_([^/?#]+?)\.html/);
    if (m) {
      const dec = (s: string) => {
        try {
          return decodeURIComponent(s).replace(/_/g, " ");
        } catch {
          return s.replace(/_/g, " ");
        }
      };
      artist = dec(m[1]);
      title = dec(m[2]);
    }
  }

  // "Easy version" link: <a ... id='eLinkZ' href="?ton=1#song">…גרסה קלה</a> (attribute order/quotes vary)
  let transposition = 0;
  let hasEasyVersion = false;
  const easyTag = html.match(/<a\b[^>]*\bid\s*=\s*["']eLinkZ["'][^>]*>/i);
  const easyTon = easyTag?.[0].match(/[?&]ton=(-?[\d.]+)/);
  if (easyTon) {
    const v = parseFloat(easyTon[1]);
    if (Number.isFinite(v) && v !== 0) {
      hasEasyVersion = true;
      transposition = v;
    }
  }

  const content = extractDivById(html, "songContentTPL") ?? html;
  const lines = parseSongContent(content);
  const direction = /class\s*=\s*["'][^"']*\bchords_en\b/i.test(content) ? "ltr" : "rtl";

  return {
    title: title || "שיר ללא שם",
    artist: artist || "אמן לא ידוע",
    lines,
    transposition,
    hasEasyVersion,
    direction,
  };
}
