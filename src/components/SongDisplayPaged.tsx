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
  // Container is max-w-6xl (~1152px), so lower thresholds
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
    // stable signature for recalculation
    return `${lines.length}|${transposition}|${fontSize}`;
  }, [lines.length, transposition, fontSize]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const width = el.clientWidth || window.innerWidth;
      setColumnCount(getColumnCount(width));
    });

    ro.observe(el);
    // initial
    setColumnCount(getColumnCount(el.clientWidth || window.innerWidth));

    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const cs = window.getComputedStyle(container);
    const padY =
      (parseFloat(cs.paddingTop || "0") || 0) + (parseFloat(cs.paddingBottom || "0") || 0);

    // Safety margin to prevent rounding from cutting the last line
    const safetyPx = 8;

    const containerHeight = Math.max(0, container.clientHeight - padY - safetyPx);
    const containerWidth = container.clientWidth;
    const cols = columnCount;

    if (!containerHeight || !containerWidth) return;

    const gapPx = 6; // matches css gap ~0.4rem
    const columnWidth = Math.floor(
      (containerWidth - gapPx * Math.max(0, cols - 1)) / cols,
    );

    measure.style.width = `${columnWidth}px`;
    measure.style.fontSize = `${fontSize}px`;

    const raf = requestAnimationFrame(() => {
      const nodes = measure.querySelectorAll<HTMLElement>("[data-line-idx]");
      if (!nodes.length) {
        setPages([lines.map((l) => l)] as unknown as SongLine[][][]);
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

      // pad missing columns so layout stays consistent
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
    onTotalPagesChange?.(Math.max(1, pages.length || 1));
  }, [pages.length, onTotalPagesChange]);

  const current = pages[currentPage] || [];
  const columns = current.length
    ? current
    : Array.from({ length: columnCount }, () => [] as SongLine[]);

  return (
    <div
      ref={containerRef}
      className="song-display"
      style={{ fontSize: `${fontSize}px` }}
    >
      <div className="song-page">
        {columns.map((columnLines, colIdx) => (
          <div key={colIdx} className="song-column">
            {columnLines.map((line, idx) => renderSongLine(line, idx, transposition))}
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
          inset: 0,
          height: 0,
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
