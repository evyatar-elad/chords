import { useMemo, useEffect, useRef } from "react";
import { SongLine, ChordUnit } from "@/lib/api";
import { transposeChord } from "@/lib/transposition";

interface SongDisplayProps {
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
  
  const text = unit.text || '\u00A0';
  
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
    case 'lyrics':
      return line.units ? (
        <LyricsLine key={idx} units={line.units} transposition={transposition} />
      ) : null;
      
    case 'chords-only':
      return line.units ? (
        <ChordsOnlyLine key={idx} units={line.units} transposition={transposition} />
      ) : null;
      
    case 'section':
      return (
        <div key={idx} className="section-header">
          {line.text}
        </div>
      );
      
    case 'empty':
      return <div key={idx} className="empty-line" />;
      
    default:
      return null;
  }
}

export function SongDisplay({ 
  lines, 
  transposition, 
  fontSize, 
  currentPage = 0,
  onTotalPagesChange 
}: SongDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  
  // Calculate how many columns fit and how to distribute lines
  const { pages, columnCount } = useMemo(() => {
    // Determine column count based on screen width
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    let cols = 1;
    if (width >= 1400) cols = 3;
    else if (width >= 1024) cols = 2;
    
    // For now, distribute lines evenly across columns per page
    // This is a simplified approach - we'll split lines into chunks
    const linesPerColumn = Math.ceil(lines.length / cols);
    const linesPerPage = linesPerColumn * cols;
    const totalPages = Math.max(1, Math.ceil(lines.length / linesPerPage));
    
    const pagesArray: SongLine[][] = [];
    for (let p = 0; p < totalPages; p++) {
      const start = p * linesPerPage;
      const end = Math.min(start + linesPerPage, lines.length);
      pagesArray.push(lines.slice(start, end));
    }
    
    return { pages: pagesArray, columnCount: cols };
  }, [lines]);

  useEffect(() => {
    if (onTotalPagesChange) {
      onTotalPagesChange(pages.length);
    }
  }, [pages.length, onTotalPagesChange]);

  const currentPageLines = pages[currentPage] || [];
  
  // Split current page lines into columns
  const columns = useMemo(() => {
    const linesPerColumn = Math.ceil(currentPageLines.length / columnCount);
    const cols: SongLine[][] = [];
    
    for (let i = 0; i < columnCount; i++) {
      const start = i * linesPerColumn;
      const end = Math.min(start + linesPerColumn, currentPageLines.length);
      cols.push(currentPageLines.slice(start, end));
    }
    
    return cols;
  }, [currentPageLines, columnCount]);

  return (
    <div 
      ref={containerRef}
      className="song-display"
      style={{ fontSize: `${fontSize}px` }}
    >
      <div className="song-page">
        {columns.map((columnLines, colIdx) => (
          <div key={colIdx} className="song-column">
            {columnLines.map((line, idx) => 
              renderLine(line, idx, transposition)
            )}
          </div>
        ))}
      </div>
      
      {/* Hidden measure container for future height calculations */}
      <div ref={measureRef} style={{ visibility: 'hidden', position: 'absolute', pointerEvents: 'none' }} />
    </div>
  );
}
