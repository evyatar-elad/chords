import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SongLine, ChordUnit } from "@/lib/api";
import { transposeChord } from "@/lib/transposition";

interface SongDisplayPagedProps {
  lines: SongLine[];
  transposition: number;
  fontSize: number;
  currentPage?: number;
  onTotalPagesChange?: (total: number) => void;
}

interface ChordUnitDisplayProps {
  unit: ChordUnit;
  transposition: number;
}

function ChordUnitDisplay({ unit, transposition }: ChordUnitDisplayProps) {
  const semitones = Math.round(transposition * 2);
  const transposedChord = unit.chord ? transposeChord(unit.chord, semitones) : null;

  const text = unit.text || "\u00A0";

  if (!transposedChord) {
    return <span>{text}</span>;
  }

  return (
    <span className="chord-unit">
      <span className="chord-above">{transposedChord}</span>
      <span className="chord-text">{text}</span>
    </span>
  );
}

interface LyricsLineProps {
  units: ChordUnit[];
  transposition: number;
}

function LyricsLine({ units, transposition }: LyricsLineProps) {
  return (
    <div className="lyrics-line">
      {units.map((unit, idx) => (
        <ChordUnitDisplay key={idx} unit={unit} transposition={transposition} />
      ))}
    </div>
  );
}

interface ChordsOnlyLineProps {
  units: ChordUnit[];
  transposition: number;
}

function ChordsOnlyLine({ units, transposition }: ChordsOnlyLineProps) {
  const semitones = Math.round(transposition * 2);

  return (
    <div className="chords-only-line">
      {units.map((unit, idx) => (
        <span key={idx} className="chord-item">
          {unit.chord && (
            <span className="chord">{transposeChord(unit.chord, semitones)}</span>
          )}
          {unit.text && <span>{unit.text}</span>}
        </span>
      ))}
    </div>
  );
}

function renderLine(line: SongLine, idx: number, transposition: number) {
  switch (line.type) {
    case "lyrics":
      return line.units ? (
        <LyricsLine key={idx} units={line.units} transposition={transposition} />
      ) : null;

    case "chords-only":
      return line.units ? (
        <ChordsOnlyLine key={idx} units={line.units} transposition={transposition} />
      ) : null;

    case "section":
      return (
        <div key={idx} className="section-header">
          {line.text}
        </div>
      );

    case "empty":
      return <div key={idx} className="empty-line" />;

    default:
      return null;
  }
}

function getColumnCount(width: number) {
  if (width >= 1400) return 3;
  if (width >= 1024) return 2;
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

    const containerHeight = container.clientHeight;
    const containerWidth = container.clientWidth;
    const cols = columnCount;

    if (!containerHeight || !containerWidth) return;

    const gapPx = 12; // matches css gap ~0.75rem
    const columnWidth = Math.floor(
      (containerWidth - gapPx * Math.max(0, cols - 1)) / cols,
    );

    measure.style.width = `${columnWidth}px`;
    measure.style.fontSize = `${fontSize}px`;

    // Let React paint measurement children, then measure heights
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
            {columnLines.map((line, idx) => renderLine(line, idx, transposition))}
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
            {renderLine(line, idx, transposition)}
          </div>
        ))}
      </div>
    </div>
  );
}
