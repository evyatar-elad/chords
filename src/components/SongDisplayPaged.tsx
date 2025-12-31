import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SongLine } from "@/lib/api";
import { SongLineRenderer } from "@/components/song/SongLineRenderer";
import type { SongLineData } from "@/components/song/types";
import { PaginationDebugOverlay, type PaginationDebugInfo } from "@/components/song/PaginationDebugOverlay";

interface SongDisplayPagedProps {
  lines: SongLine[];
  transposition: number;
  fontSize: number;
  currentPage?: number;
  onTotalPagesChange?: (total: number) => void;
  debug?: boolean;
}

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
  debug = false,
}: SongDisplayPagedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const [columnCount, setColumnCount] = useState(1);
  const [pages, setPages] = useState<SongLine[][][]>([]);
  const [measureKey, setMeasureKey] = useState(0);
  const [debugInfo, setDebugInfo] = useState<PaginationDebugInfo | null>(null);
  const [fontScale, setFontScale] = useState(1);

  const inputSignature = useMemo(() => {
    return `${lines.length}|${transposition}|${fontSize}|${measureKey}`;
  }, [lines.length, transposition, fontSize, measureKey]);


  // Detect "merged chord" situations (multiple chords landing on the same snapped position in a lyrics line)
  const mergedChordInfoByLineIdx = useMemo(() => {
    const map = new Map<number, { groups: Array<{ startAt: number; labels: string[] }> }>();

    const computeForLine = (line: SongLine, originalIdx: number) => {
      if (line.type !== "lyrics") return;

      const raw = line.lyrics ?? "";
      const leading = raw.match(/^\s*/)?.[0].length ?? 0;
      const trailing = raw.match(/\s*$/)?.[0].length ?? 0;
      const lyrics = raw.slice(leading, Math.max(leading, raw.length - trailing));

      const chords = (line.chords ?? [])
        .map((c) => ({ chord: c.chord, at: Math.max(0, c.at - leading) }))
        .sort((a, b) => a.at - b.at);

      if (!lyrics || chords.length < 2) return;

      const groups: Array<{ startAt: number; labels: string[] }> = [];
      let lastEnd = 0;

      const computeSnappedAt = (at: number) => {
        let clampedAt = Math.min(Math.max(0, at), lyrics.length);
        const prevSpace = lyrics.lastIndexOf(" ", clampedAt - 1);
        const wordStart = prevSpace >= 0 ? prevSpace + 1 : 0;
        if (wordStart >= lastEnd && wordStart < clampedAt) {
          clampedAt = wordStart;
        }
        return clampedAt;
      };

      for (let i = 0; i < chords.length; i++) {
        const startAt = computeSnappedAt(chords[i].at);
        const labels: string[] = [chords[i].chord];

        let j = i + 1;
        while (j < chords.length && computeSnappedAt(chords[j].at) === startAt) {
          labels.push(chords[j].chord);
          j++;
        }

        if (labels.length > 1) {
          groups.push({ startAt, labels });
        }

        const nextAt = chords[j]?.at ?? lyrics.length;
        lastEnd = Math.min(Math.max(startAt, nextAt), lyrics.length);
        i = j - 1;
      }

      if (groups.length) {
        map.set(originalIdx, { groups });
      }
    };

    lines.forEach((l, idx) => computeForLine(l, idx));
    return map;
  }, [lines]);

  const mergedChordPreview = useMemo(() => {
    const preview: string[] = [];
    const entries = Array.from(mergedChordInfoByLineIdx.entries()).slice(0, 8);
    for (const [idx, info] of entries) {
      const first = info.groups[0];
      preview.push(`#${idx}: ${first.labels.join(" + ")}`);
    }
    if (mergedChordInfoByLineIdx.size > entries.length) {
      preview.push(`… +${mergedChordInfoByLineIdx.size - entries.length} more`);
    }
    return preview;
  }, [mergedChordInfoByLineIdx]);

  // Track container size changes (both width AND height)
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const width = el.clientWidth || window.innerWidth;
      const height = el.clientHeight || window.innerHeight;
      setColumnCount(getColumnCount(width, height));
      // Trigger re-measurement when container size changes
      setMeasureKey(k => k + 1);
    });

    ro.observe(el);
    const width = el.clientWidth || window.innerWidth;
    const height = el.clientHeight || window.innerHeight;
    setColumnCount(getColumnCount(width, height));

    return () => ro.disconnect();
  }, []);

  // Wait for fonts to load, then re-measure
  useEffect(() => {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        setMeasureKey(k => k + 1);
      });
    }
  }, []);

  // Calculate pagination based on available height
  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const cs = window.getComputedStyle(container);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    
    const lineHeightPx = fontSize * 1.8;
    const containerWidth = container.clientWidth;
    const rawContainerHeight = container.clientHeight;

    // Determine display mode for safety margin calculation
    const isPortrait = rawContainerHeight > containerWidth;
    const isLandscape = !isPortrait && rawContainerHeight <= 700;
    const isDesktop = !isPortrait && rawContainerHeight > 700 && containerWidth >= 900;

    // Dynamic safety margin based on display mode:
    // - Portrait: minimal safety (lots of vertical space available)
    // - Landscape Mobile: moderate safety (limited height)
    // - Desktop: comfortable safety margin
    let safetyPx: number;
    if (isPortrait) {
      safetyPx = lineHeightPx * 1.5; // ~1.5 lines - portrait has plenty of height
    } else if (isLandscape) {
      safetyPx = lineHeightPx * 2; // ~2 lines - landscape is tight
    } else {
      safetyPx = lineHeightPx * 2.5; // ~2.5 lines - desktop is comfortable
    }

    const containerHeight = Math.max(0, rawContainerHeight - padTop - padBottom - safetyPx);
    const cols = columnCount;

    if (!containerHeight || !containerWidth || cols === 0) return;

    // Our columns use CSS padding that varies by screen size. To make pagination deterministic,
    // measure using the inner content width (what the text actually wraps within).
    const colWidth = Math.floor(containerWidth / cols);

    // Calculate padding based on screen mode (must match CSS media queries)
    let colPadX: number;
    if (isPortrait) {
      colPadX = 4; // 0.25rem ≈ 4px (Portrait)
    } else if (isLandscape) {
      colPadX = 1.6; // 0.1rem ≈ 1.6px (Landscape Mobile)
    } else if (isDesktop) {
      colPadX = 8; // 0.5rem ≈ 8px (Desktop)
    } else {
      colPadX = 8; // Fallback: 0.5rem ≈ 8px
    }

    const measureWidth = Math.max(120, colWidth - (colPadX * 2 + 1)); // subtract padding + divider

    measure.style.width = `${measureWidth}px`;
    measure.style.fontSize = `${fontSize}px`;

    // Double RAF for stability after layout
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        const nodes = measure.querySelectorAll<HTMLElement>("[data-line-idx]");
        if (!nodes.length) {
          setPages([[lines]]);
          return;
        }

        const heights: number[] = [];
        nodes.forEach((node) => {
          // Use offsetHeight for more stable measurement
          heights.push(Math.ceil(node.offsetHeight));
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
         if (debug) {
           setDebugInfo({
             cols,
             containerWidth,
             containerHeight,
             padTop,
             padBottom,
             safetyPx,
             columnWidth: colWidth,
             measureWidth,
             fontSize,
             pages: Math.max(1, padded.length),
             mergedChordLinesCount: mergedChordInfoByLineIdx.size,
             mergedChordLinesPreview: mergedChordPreview,
           });
         } else {
           setDebugInfo(null);
         }
      });

      return () => cancelAnimationFrame(raf2);
    });

    return () => cancelAnimationFrame(raf1);
  }, [
    inputSignature,
    lines,
    fontSize,
    transposition,
    columnCount,
    debug,
    mergedChordInfoByLineIdx,
    mergedChordPreview,
  ]);

  useEffect(() => {
    onTotalPagesChange?.(Math.max(1, pages.length));
  }, [pages.length, onTotalPagesChange]);

  // Auto-scale font in portrait mode to prevent content cutoff
  useEffect(() => {
    if (!containerRef.current) return;

    // Only apply in portrait mode
    const isPortrait = window.innerHeight > window.innerWidth;
    if (!isPortrait) {
      setFontScale(1);
      return;
    }

    // Give the DOM time to render
    const timeoutId = setTimeout(() => {
      if (!containerRef.current) return;

      // Get column width
      const columns = containerRef.current.querySelectorAll('.song-col');
      if (columns.length === 0) {
        setFontScale(1);
        return;
      }

      const columnWidth = columns[0].clientWidth;

      // Measure all lyrics rows
      const lyricsRows = containerRef.current.querySelectorAll('.lyrics-row');
      let maxOverflow = 0;

      lyricsRows.forEach(row => {
        const scrollWidth = row.scrollWidth;
        if (scrollWidth > columnWidth) {
          const overflow = scrollWidth - columnWidth;
          if (overflow > maxOverflow) maxOverflow = overflow;
        }
      });

      // Calculate needed scale to fit content with safety margin
      if (maxOverflow > 0) {
        const maxWidth = columnWidth + maxOverflow;
        const scale = (columnWidth / maxWidth) * 0.97; // 3% safety margin to prevent edge cutoff
        // Apply scale with minimum of 70% to prevent text from being too small
        setFontScale(Math.max(0.7, scale));
      } else {
        setFontScale(1);
      }
    }, 50); // Small delay to ensure DOM is ready

    return () => clearTimeout(timeoutId);
  }, [currentPage, fontSize, transposition, pages.length]);

  // Get current page columns - DO NOT reverse, let CSS direction:rtl handle visual order
  const currentPageCols = pages[currentPage] || [];
  const visualColumns = currentPageCols.length
    ? currentPageCols
    : Array.from({ length: columnCount }, () => [] as SongLine[]);

  // Map line object references to their original index (debug labeling)
  const lineIndexByRef = useMemo(() => {
    const m = new WeakMap<object, number>();
    lines.forEach((l, idx) => {
      // SongLine is an object (from the backend). Use ref identity.
      m.set(l as unknown as object, idx);
    });
    return m;
  }, [lines]);

  return (
    <div
      ref={containerRef}
      className="song-container relative"
      style={{ fontSize: `${fontSize * fontScale}px` }}
    >
      {debug ? <PaginationDebugOverlay info={debugInfo} /> : null}

      <div className="song-columns">
        {visualColumns.map((columnLines, colIdx) => (
          <div key={colIdx} className="song-col">
            {columnLines.map((line, lineIdx) => {
              const originalIdx = lineIndexByRef.get(line as unknown as object);
              const hasMerged =
                debug && typeof originalIdx === "number" && mergedChordInfoByLineIdx.has(originalIdx);

              return (
                <div
                  key={`${currentPage}-${colIdx}-${lineIdx}`}
                  className={
                    debug
                      ? [
                          "relative rounded-sm ring-1",
                          hasMerged
                            ? "bg-destructive/5 ring-destructive/35"
                            : "bg-accent/5 ring-accent/25",
                        ].join(" ")
                      : undefined
                  }
                >
                  {debug && typeof originalIdx === "number" ? (
                    <div className="absolute -top-2 left-1 flex items-center gap-1 select-none rounded border border-border bg-background/80 px-1 text-[10px] font-mono text-muted-foreground">
                      <span>#{originalIdx}</span>
                      {hasMerged ? (
                        <span className="rounded bg-destructive/10 px-1 text-[10px] text-destructive">
                          merged
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <SongLineRenderer line={toSongLineData(line)} transposition={transposition} />
                </div>
              );
            })}
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
          fontFamily: "var(--font-hebrew)",
          lineHeight: "1.8",
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
