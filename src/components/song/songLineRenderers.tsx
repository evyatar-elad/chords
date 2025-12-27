import React from "react";
import { SongLine, ChordUnit } from "@/lib/api";
import { transposeChord } from "@/lib/transposition";

interface ChordUnitDisplayProps {
  unit: ChordUnit;
  transposition: number;
}

function ChordUnitDisplay({ unit, transposition }: ChordUnitDisplayProps) {
  const semitones = Math.round(transposition * 2);
  const transposedChord = unit.chord ? transposeChord(unit.chord, semitones) : null;

  // Keep a printable placeholder so the unit has width even when empty
  const text = unit.text || "\u00A0";

  if (!transposedChord) {
    return <span className="chord-text">{text}</span>;
  }

  return (
    <span className="chord-unit">
      <span className="chord-above" dir="ltr">
        {transposedChord}
      </span>
      <span className="chord-text">{text}</span>
    </span>
  );
}

interface LyricsLineProps {
  units: ChordUnit[];
  transposition: number;
}

function LyricsLine({ units, transposition }: LyricsLineProps) {
  // Units come from scraper in LTR order (by position in text).
  // We render them in the same order; CSS direction:rtl handles RTL display.
  // NO reversal - this was causing text corruption.
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
            <span className="chord" dir="ltr">
              {transposeChord(unit.chord, semitones)}
            </span>
          )}
          {unit.text && <span>{unit.text}</span>}
        </span>
      ))}
    </div>
  );
}

export function renderSongLine(line: SongLine, idx: number, transposition: number) {
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
