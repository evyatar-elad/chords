import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SongLine } from "@/lib/api";
import { SongLineRenderer } from "@/components/song/SongLineRenderer";
import { PaginationDebugOverlay, type PaginationDebugInfo } from "@/components/song/PaginationDebugOverlay";

interface SongDisplayPagedProps {
  lines: SongLine[];
  transposition: number;
  fontSize: number;
  direction?: "rtl" | "ltr";
  currentPage?: number;
  onTotalPagesChange?: (total: number) => void;
  debug?: boolean;
}

/** Smallest automatic shrink applied so long lines fit their column; longer lines wrap. */
const MIN_FONT_SCALE = 0.75;

function getColumnCount(width: number, height: number) {
  // Desktop: 3 columns (large screen with normal height)
  if (width >= 900 && height > 700) return 3;

  // Mobile Portrait: 2 columns
  if (height > width) return 2;

  // Mobile Landscape: 3 columns (height < 700px)
  if (height <= 700) return 3;

  // Fallback: 2 columns
  return 2;
}

// Older scrape-song responses kept tab4u's surrounding whitespace in the lyrics; trim it and shift chords.
function normalizeLine(line: SongLine): SongLine {
  if (line.type !== "lyrics") return line;
  const raw = line.lyrics ?? "";
  const leading = raw.match(/^\s*/)?.[0].length ?? 0;
  const trailing = raw.match(/\s*$/)?.[0].length ?? 0;
  if (!leading && !trailing) return line;
  return {
    type: "lyrics",
    lyrics: raw.slice(leading, Math.max(leading, raw.length - trailing)),
    chords: line.chords.map((c) => ({ chord: c.chord, at: Math.max(0, c.at - leading) })),
  };
}

/**
 * Fill columns top to bottom (line indices), never exceeding `limit` px per column.
 * - a column never starts with an empty line
 * - a section header is not left alone at the bottom of a column; it moves with the next line
 */
function fillColumns(indices: number[], lines: SongLine[], heights: number[], limit: number): number[][] {
  const columns: number[][] = [];
  let col: number[] = [];
  let colHeight = 0;
  const isGlue = (i: number) => lines[i].type === "section" || lines[i].type === "empty";

  for (const i of indices) {
    const h = heights[i] ?? 0;
    if (col.length === 0 && lines[i].type === "empty") continue;

    if (col.length && colHeight + h > limit) {
      let carry: number[] = [];
      while (col.length && isGlue(col[col.length - 1])) carry.unshift(col.pop()!);
      if (!col.length) {
        col = carry;
        carry = [];
      }
      columns.push(col);
      col = carry.filter((j) => lines[j].type !== "empty");
      colHeight = col.reduce((sum, j) => sum + (heights[j] ?? 0), 0);
      if (lines[i].type === "empty") continue;
    }

    col.push(i);
    colHeight += h;
  }
  if (col.length) columns.push(col);

  for (const c of columns) while (c.length > 1 && lines[c[c.length - 1]].type === "empty") c.pop();
  return columns;
}

function paginate(lines: SongLine[], heights: number[], limit: number, cols: number): number[][][] {
  const all = lines.map((_, i) => i);
  const columns = fillColumns(all, lines, heights, limit);
  const pages: number[][][] = [];
  for (let i = 0; i < columns.length; i += cols) pages.push(columns.slice(i, i + cols));
  if (!pages.length) return [[]];

  // Balance the last page: same number of columns, but as even as possible
  const last = pages[pages.length - 1];
  if (last.length > 1) {
    const indices = last.flat();
    let lo = Math.max(...indices.map((i) => heights[i] ?? 0));
    let hi = limit;
    let best = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) / 2;
      const attempt = fillColumns(indices, lines, heights, mid);
      if (attempt.length <= last.length) {
        best = attempt;
        hi = mid;
      } else {
        lo = mid;
      }
    }
    pages[pages.length - 1] = best;
  }
  return pages;
}

export function SongDisplayPaged({
  lines: rawLines,
  transposition,
  fontSize,
  direction = "rtl",
  currentPage = 0,
  onTotalPagesChange,
  debug = false,
}: SongDisplayPagedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => rawLines.map(normalizeLine), [rawLines]);

  const [columnCount, setColumnCount] = useState(() => getColumnCount(window.innerWidth, window.innerHeight));
  const [pages, setPages] = useState<number[][][]>([]);
  const [fontScale, setFontScale] = useState(1);
  const [measureKey, setMeasureKey] = useState(0);
  const [debugInfo, setDebugInfo] = useState<PaginationDebugInfo | null>(null);

  // Track container size changes (both width AND height)
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setColumnCount(getColumnCount(el.clientWidth || window.innerWidth, el.clientHeight || window.innerHeight));
      setMeasureKey((k) => k + 1);
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, []);

  // Web fonts change text widths: measure again once they arrive
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    const remeasure = () => setMeasureKey((k) => k + 1);
    fonts.ready.then(remeasure);
    fonts.addEventListener?.("loadingdone", remeasure);
    return () => fonts.removeEventListener?.("loadingdone", remeasure);
  }, []);

  // Measure every line in a hidden copy of a column, pick a font scale, then paginate.
  useLayoutEffect(() => {
    const measure = measureRef.current;
    const cols = Array.from(columnsRef.current?.querySelectorAll<HTMLElement>(".song-col") ?? []);
    if (!measure || !cols.length) return;

    // Content box of the narrowest column (columns after the first also carry a divider border)
    let colWidth = Infinity;
    for (const col of cols) {
      const cs = window.getComputedStyle(col);
      const extra = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"].reduce(
        (sum, prop) => sum + (parseFloat(cs[prop as "paddingLeft"]) || 0),
        0
      );
      colWidth = Math.min(colWidth, col.getBoundingClientRect().width - extra);
    }
    colWidth = Math.floor(colWidth);
    const colHeight = cols[0].clientHeight;
    if (colWidth <= 0 || colHeight <= 0) return;

    measure.style.width = `${colWidth}px`;

    // 1. Natural (unwrapped) width of every lyrics line at the chosen size
    measure.style.fontSize = `${fontSize}px`;
    measure.classList.add("song-measure--natural");
    let widest = 0;
    measure.querySelectorAll<HTMLElement>(".lyrics-row").forEach((row) => {
      widest = Math.max(widest, row.getBoundingClientRect().width);
    });
    measure.classList.remove("song-measure--natural");

    const scale = widest > colWidth ? Math.max(MIN_FONT_SCALE, Math.floor((colWidth / widest) * 0.995 * 1000) / 1000) : 1;

    // 2. Heights at the final size (wrappers are flow-root, so margins are included)
    measure.style.fontSize = `${fontSize * scale}px`;
    const heights: number[] = new Array(lines.length).fill(0);
    measure.querySelectorAll<HTMLElement>("[data-line-idx]").forEach((node) => {
      heights[Number(node.dataset.lineIdx)] = node.getBoundingClientRect().height;
    });

    // 1px of slack for sub-pixel rounding
    const limit = colHeight - 1;
    const newPages = paginate(lines, heights, limit, columnCount);

    setFontScale(scale);
    setPages(newPages);

    if (debug) {
      setDebugInfo({
        cols: columnCount,
        columnWidth: colWidth,
        columnHeight: colHeight,
        fontSize,
        fontScale: scale,
        widestLine: widest,
        totalHeight: heights.reduce((a, b) => a + b, 0),
        pages: newPages.length,
      });
    } else {
      setDebugInfo(null);
    }
  }, [lines, fontSize, transposition, columnCount, measureKey, direction, debug]);

  useEffect(() => {
    onTotalPagesChange?.(Math.max(1, pages.length));
  }, [pages.length, onTotalPagesChange]);

  // Columns are laid out in reading order by the container's direction
  const pageCols = pages[Math.min(currentPage, Math.max(0, pages.length - 1))] ?? [];
  const visualColumns = Array.from({ length: columnCount }, (_, i) => pageCols[i] ?? []);

  return (
    <div
      ref={containerRef}
      className="song-container relative"
      dir={direction}
      style={{ fontSize: `${fontSize * fontScale}px`, textAlign: direction === "rtl" ? "right" : "left" }}
    >
      {debug ? <PaginationDebugOverlay info={debugInfo} /> : null}

      <div ref={columnsRef} className="song-columns" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
        {visualColumns.map((columnLines, colIdx) => (
          <div key={colIdx} className="song-col">
            {columnLines.map((lineIdx) => (
              <div
                key={lineIdx}
                data-line-idx={lineIdx}
                className={debug ? "song-line relative rounded-sm ring-1 ring-accent/25 bg-accent/5" : "song-line"}
              >
                {debug ? (
                  <div className="absolute -top-2 left-1 select-none rounded border border-border bg-background/80 px-1 text-[10px] font-mono text-muted-foreground">
                    #{lineIdx}
                  </div>
                ) : null}
                <SongLineRenderer line={lines[lineIdx]} transposition={transposition} direction={direction} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Hidden measurement copy of one column */}
      <div ref={measureRef} className="song-measure" aria-hidden="true">
        {lines.map((line, idx) => (
          <div key={idx} data-line-idx={idx} className="song-line">
            <SongLineRenderer line={line} transposition={transposition} direction={direction} />
          </div>
        ))}
      </div>
    </div>
  );
}
