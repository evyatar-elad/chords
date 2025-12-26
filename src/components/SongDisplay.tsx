import { useMemo } from "react";
import { SongLine, ChordUnit } from "@/lib/api";
import { transposeChord } from "@/lib/transposition";

interface SongDisplayProps {
  lines: SongLine[];
  transposition: number;
  fontSize: number;
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
    // No chord - just render text normally
    return <span>{text}</span>;
  }
  
  // Chord exists - position it above the first character
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

export function SongDisplay({ lines, transposition, fontSize }: SongDisplayProps) {
  const renderedLines = useMemo(() => {
    return lines.map((line, idx) => {
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
    });
  }, [lines, transposition]);

  return (
    <div 
      className="song-display"
      style={{ fontSize: `${fontSize}px` }}
    >
      {renderedLines}
    </div>
  );
}