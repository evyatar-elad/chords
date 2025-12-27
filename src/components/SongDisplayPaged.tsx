import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SongLine } from "@/lib/api";
import { SongLineRenderer } from "@/components/song/SongLineRenderer";
import type { SongLineData } from "@/components/song/types";

interface SongDisplayPagedProps {
  lines: SongLine[];
  transposition: number;
  fontSize: number;
  currentPage?: number;
  onTotalPagesChange?: (total: number) => void;
}

function getColumnCount(width: number) {
  if (width >= 900) return 3;
  if (width >= 600) return 2;
  return 1;
}

// Convert API SongLine to component SongLineData
function toSongLineData(line: SongLine): SongLineData {
  switch (line.type) {
    case "lyrics": {
      // Tab4U content often contains leading/trailing newlines/tabs/spaces.
      // Trim ONLY the edges (keep inner spaces) and shift chord positions accordingly.
      const raw = line.lyrics ?? "";
      const leading = raw.match(/^\s*/)?.[0].length ?? 0;
      const trailing = raw.match(/\s*$/)?.[0].length ?? 0;
      const cleanedLyrics = raw.slice(leading, Math.max(leading, raw.length - trailing));

      return {
        type: "lyrics",
        lyrics: cleanedLyrics,
        chords: line.chords.map((c) => ({
          chord: c.chord,
          at: Math.max(0, c.at - leading),
        })),
      };
    }

    case "chords-only":
      return {
        type: "chords-only",
        chords: line.chords,
      };
    case "section":
      return {
        type: "section",
        text: line.text,
      };
    case "empty":
      return { type: "empty" };
  }
}

export function SongDisplayPaged({
  lines,
  transposition,
  fontSize,
  currentPage = 0,
  onTotalPagesChange,
}: SongDisplayPagedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const [columnCount, setColumnCount] = useState(1);
  const [pages, setPages] = useState<SongLine[][][]>([]);

  const inputSignature = useMemo(() => {
    return `${lines.length}|${transposition}|${fontSize}`;
  }, [lines.length, transposition, fontSize]);

  // Track container width for column count
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const width = el.clientWidth || window.innerWidth;
      setColumnCount(getColumnCount(width));
    });

    ro.observe(el);
    setColumnCount(getColumnCount(el.clientWidth || window.innerWidth));

    return () => ro.disconnect();
  }, []);

  // Calculate pagination based on available height
  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const cs = window.getComputedStyle(container);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    // Extra safety margin to ensure content stays well within viewport
    const safetyPx = 48;
    const containerHeight = Math.max(0, container.clientHeight - padTop - padBottom - safetyPx);
    const containerWidth = container.clientWidth;
    const cols = columnCount;

    if (!containerHeight || !containerWidth || cols === 0) return;

    const colPadding = 12;
    const totalPadding = colPadding * (cols - 1);
    const columnWidth = Math.floor((containerWidth - totalPadding) / cols);

    measure.style.width = `${columnWidth}px`;
    measure.style.fontSize = `${fontSize}px`;

    const raf = requestAnimationFrame(() => {
      const nodes = measure.querySelectorAll<HTMLElement>("[data-line-idx]");
      if (!nodes.length) {
        setPages([[lines]]);
        return;
      }

      const heights: number[] = [];
      nodes.forEach((node) => {
        heights.push(Math.ceil(node.getBoundingClientRect().height));
      });

      const newPages: SongLine[][][] = [];
      let pageCols: SongLine[][] = [];
      let colLines: SongLine[] = [];
      let colHeight = 0;

      for (let i = 0; i < lines.length; i++) {
        const h = heights[i] ?? 0;

        if (colLines.length > 0 && colHeight + h > containerHeight) {
          pageCols.push(colLines);
          colLines = [];
          colHeight = 0;

          if (pageCols.length === cols) {
            newPages.push(pageCols);
            pageCols = [];
          }
        }

        colLines.push(lines[i]);
        colHeight += h;
      }

      if (colLines.length > 0) {
        pageCols.push(colLines);
      }
      if (pageCols.length > 0) {
        newPages.push(pageCols);
      }

      const padded = newPages.map((p) => {
        const copy = [...p];
        while (copy.length < cols) copy.push([]);
        return copy;
      });

      setPages(padded);
    });

    return () => cancelAnimationFrame(raf);
  }, [inputSignature, lines, fontSize, transposition, columnCount]);

  useEffect(() => {
    onTotalPagesChange?.(Math.max(1, pages.length));
  }, [pages.length, onTotalPagesChange]);

  // Get current page columns - DO NOT reverse, let CSS direction:rtl handle visual order
  const currentPageCols = pages[currentPage] || [];
  const visualColumns = currentPageCols.length
    ? currentPageCols
    : Array.from({ length: columnCount }, () => [] as SongLine[]);

  return (
    <div
      ref={containerRef}
      className="song-container"
      style={{ fontSize: `${fontSize}px` }}
    >
      <div className="song-columns">
        {visualColumns.map((columnLines, colIdx) => (
          <div 
            key={colIdx} 
            className="song-col"
          >
            {columnLines.map((line, lineIdx) => (
              <SongLineRenderer 
                key={`${currentPage}-${colIdx}-${lineIdx}`}
                line={toSongLineData(line)} 
                transposition={transposition} 
              />
            ))}
          </div>
        ))}
      </div>

      {/* Hidden measurement container */}
      <div
        ref={measureRef}
        style={{
          visibility: "hidden",
          position: "absolute",
          pointerEvents: "none",
          left: 0,
          top: 0,
          width: 0,
          overflow: "visible",
        }}
        aria-hidden="true"
      >
        {lines.map((line, idx) => (
          <div key={idx} data-line-idx={idx}>
            <SongLineRenderer line={toSongLineData(line)} transposition={transposition} />
          </div>
        ))}
      </div>
    </div>
  );
}
