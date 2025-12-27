import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SongLine } from "@/lib/api";
import { renderSongLine } from "@/components/song/songLineRenderers";

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

    // Get actual available height (subtract padding)
    const cs = window.getComputedStyle(container);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    
    // Use a significant safety margin to prevent any cutoff
    const safetyPx = 24;
    const containerHeight = Math.max(0, container.clientHeight - padTop - padBottom - safetyPx);
    const containerWidth = container.clientWidth;
    const cols = columnCount;

    if (!containerHeight || !containerWidth || cols === 0) return;

    // Calculate column width accounting for padding between columns
    const colPadding = 12; // 0.75rem * 2 sides = ~24px total, but shared
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

      // Measure each line's height
      const heights: number[] = [];
      nodes.forEach((node) => {
        heights.push(Math.ceil(node.getBoundingClientRect().height));
      });

      // Distribute lines into pages and columns
      const newPages: SongLine[][][] = [];
      let pageCols: SongLine[][] = [];
      let colLines: SongLine[] = [];
      let colHeight = 0;

      for (let i = 0; i < lines.length; i++) {
        const h = heights[i] ?? 0;

        // If adding this line would exceed column height, start new column
        if (colLines.length > 0 && colHeight + h > containerHeight) {
          pageCols.push(colLines);
          colLines = [];
          colHeight = 0;

          // If we've filled all columns on this page, start new page
          if (pageCols.length === cols) {
            newPages.push(pageCols);
            pageCols = [];
          }
        }

        colLines.push(lines[i]);
        colHeight += h;
      }

      // Add remaining content
      if (colLines.length > 0) {
        pageCols.push(colLines);
      }
      if (pageCols.length > 0) {
        newPages.push(pageCols);
      }

      // Pad incomplete pages with empty columns for consistent layout
      const padded = newPages.map((p) => {
        const copy = [...p];
        while (copy.length < cols) copy.push([]);
        return copy;
      });

      setPages(padded);
    });

    return () => cancelAnimationFrame(raf);
  }, [inputSignature, lines, fontSize, transposition, columnCount]);

  // Notify parent of total pages
  useEffect(() => {
    onTotalPagesChange?.(Math.max(1, pages.length));
  }, [pages.length, onTotalPagesChange]);

  // Get current page columns (reversed for RTL: first column appears on right)
  const currentPageCols = pages[currentPage] || [];
  const visualColumns = currentPageCols.length
    ? [...currentPageCols].reverse() // Reverse so first column is on the right
    : Array.from({ length: columnCount }, () => [] as SongLine[]);

  return (
    <div
      ref={containerRef}
      className="song-display"
      style={{ fontSize: `${fontSize}px` }}
    >
      <div className="song-page">
        {visualColumns.map((columnLines, colIdx) => (
          <div key={colIdx} className="song-column">
            {columnLines.map((line, lineIdx) => 
              renderSongLine(line, `${currentPage}-${colIdx}-${lineIdx}` as unknown as number, transposition)
            )}
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
            {renderSongLine(line, idx, transposition)}
          </div>
        ))}
      </div>
    </div>
  );
}
