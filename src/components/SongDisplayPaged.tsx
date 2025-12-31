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
        // Give extra time for fonts to render
        setTimeout(() => {
          setMeasureKey(k => k + 1);
        }, 200);
      });
    }
  }, []);

  // Multiple re-measures to ensure accurate layout after fonts and DOM are ready
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    // First re-measure - catch early font loads
    timers.push(setTimeout(() => {
      setMeasureKey(k => k + 1);
    }, 150));

    // Second re-measure - catch slower font loads
    timers.push(setTimeout(() => {
      setMeasureKey(k => k + 1);
    }, 500));

    // Third re-measure - ensure fonts are rendered
    timers.push(setTimeout(() => {
      setMeasureKey(k => k + 1);
    }, 1000));

    // Final re-measure - catch very late loads (slow networks)
    timers.push(setTimeout(() => {
      setMeasureKey(k => k + 1);
    }, 2000));

    return () => timers.forEach(t => clearTimeout(t));
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
      safetyPx = lineHeightPx * 0.5; // ~0.5 line - minimal safety, maximize content space
    } else if (isLandscape) {
      safetyPx = lineHeightPx * 1.0; // ~1 line - landscape is tight
    } else {
      safetyPx = lineHeightPx * 1.5; // ~1.5 lines - desktop is comfortable
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
    // CRITICAL: Must match the actual displayed fontSize (fontSize * fontScale)
    // Otherwise measurements will be incorrect and cause excessive whitespace
    measure.style.fontSize = `${fontSize * fontScale}px`;

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

        // Build a fast lookup from line object reference to its original index
        // (Avoid lines.indexOf(...) which is slow and can break if references ever differ.)
        const lineIdxByRef = new WeakMap<object, number>();
        for (let i = 0; i < lines.length; i++) {
          lineIdxByRef.set(lines[i] as unknown as object, i);
        }

        // ============================================
        // STEP 1: GREEDY HARD LIMIT (Minimum Pages)
        // ============================================
        // Fill columns up to containerHeight to determine minimum columns/pages needed
        const greedyColumns: { lines: SongLine[]; height: number }[] = [];
        let greedyColLines: SongLine[] = [];
        let greedyColHeight = 0;

        for (let i = 0; i < lines.length; i++) {
          const h = heights[i] ?? 0;

          // Break column only when we would exceed containerHeight (hard limit)
          if (greedyColHeight > 0 && greedyColHeight + h > containerHeight) {
            greedyColumns.push({ lines: greedyColLines, height: greedyColHeight });
            greedyColLines = [];
            greedyColHeight = 0;
          }

          greedyColLines.push(lines[i]);
          greedyColHeight += h;
        }

        // Don't forget the last column
        if (greedyColLines.length > 0) {
          greedyColumns.push({ lines: greedyColLines, height: greedyColHeight });
        }

        // Calculate minimum pages needed
        const totalColumnsGreedy = greedyColumns.length;
        const totalPagesGreedy = Math.ceil(totalColumnsGreedy / cols);

        // ============================================
        // STEP 2: BALANCE WITHIN EACH PAGE ONLY
        // ============================================
        // Group greedy columns into pages, then redistribute lines within each page
        const newPages: SongLine[][][] = [];

        for (let pageIdx = 0; pageIdx < totalPagesGreedy; pageIdx++) {
          const startColIdx = pageIdx * cols;
          const endColIdx = Math.min(startColIdx + cols, totalColumnsGreedy);
          const pageGreedyColumns = greedyColumns.slice(startColIdx, endColIdx);

          // Collect all lines and heights for this page
          const pageLines: SongLine[] = [];
          const pageHeights: number[] = [];
          let pageTotalHeight = 0;

          for (const col of pageGreedyColumns) {
            for (const line of col.lines) {
              const originalIdx = lineIdxByRef.get(line as unknown as object);
              const h = typeof originalIdx === "number" ? (heights[originalIdx] ?? 0) : 0;
              pageLines.push(line);
              pageHeights.push(h);
              pageTotalHeight += h;
            }
          }

          // How many columns should this page actually have?
          // Last page might have fewer columns
          const activeColsInPage = pageGreedyColumns.length;

          // Target height per column for balanced distribution within this page
          const targetHeightPerColumn = pageTotalHeight / activeColsInPage;

          // ============================================
          // STEP 3: REDISTRIBUTE LINES WITHIN PAGE
          // ============================================
          const pageCols: SongLine[][] = [];
          let colLines: SongLine[] = [];
          let colHeight = 0;

          for (let i = 0; i < pageLines.length; i++) {
            const h = pageHeights[i];
            const remainingLines = pageLines.length - i;
            const remainingCols = activeColsInPage - pageCols.length;

            // Conditions for breaking to next column:
            // 1. Would exceed containerHeight (hard limit) - always break
            // 2. Would exceed targetHeightPerColumn AND there are enough lines for remaining columns
            const wouldExceedMax = colHeight > 0 && colHeight + h > containerHeight;
            const wouldExceedTarget = colHeight > 0 && colHeight + h > targetHeightPerColumn;
            const hasEnoughForRemainingCols = remainingLines >= remainingCols;

            const shouldBreak =
              wouldExceedMax ||
              (wouldExceedTarget && hasEnoughForRemainingCols && remainingCols > 1);

            // Only break if we haven't reached the last column yet
            // This ensures we don't create more columns than determined by greedy phase
            if (shouldBreak && pageCols.length < activeColsInPage - 1) {
              pageCols.push(colLines);
              colLines = [];
              colHeight = 0;
            }

            colLines.push(pageLines[i]);
            colHeight += h;
          }

          // Push last column
          if (colLines.length > 0) {
            pageCols.push(colLines);
          }

          // Pad to full column count for consistent layout
          while (pageCols.length < cols) {
            pageCols.push([]);
          }

          newPages.push(pageCols);
        }

        // If no content, ensure at least one empty page
        if (newPages.length === 0) {
          newPages.push(Array.from({ length: cols }, () => []));
        }

        setPages(newPages);

        // ============================================
        // STEP 4: ENHANCED DEBUG INFO
        // ============================================
        const totalHeight = heights.reduce((sum, h) => sum + h, 0);

        if (debug) {
          // Helps verify the new code is actually running in the user's session
          // eslint-disable-next-line no-console
          console.debug("[pagination-v2]", {
            cols,
            containerHeight: Math.round(containerHeight),
            totalHeight: Math.round(totalHeight),
            totalColumnsGreedy,
            totalPagesGreedy,
          });

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
            pages: Math.max(1, newPages.length),
            mergedChordLinesCount: mergedChordInfoByLineIdx.size,
            mergedChordLinesPreview: mergedChordPreview,
            // Enhanced debug info
            totalHeight,
            totalColumnsGreedy,
            totalPagesGreedy,
          } as PaginationDebugInfo);
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
    fontScale, // Re-measure when font scale changes
    transposition,
    columnCount,
    debug,
    mergedChordInfoByLineIdx,
    mergedChordPreview,
  ]);

  useEffect(() => {
    onTotalPagesChange?.(Math.max(1, pages.length));
  }, [pages.length, onTotalPagesChange]);

  // Auto-scale font to prevent content cutoff in all modes
  useEffect(() => {
    if (!containerRef.current) return;

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
        const scale = (columnWidth / maxWidth) * 0.98; // 2% safety margin to prevent edge cutoff
        // Apply scale with minimum of 75% to prevent text from being too small
        setFontScale(Math.max(0.75, scale));
      } else {
        setFontScale(1);
      }
    }, 100); // Increased delay to ensure DOM and fonts are ready

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
