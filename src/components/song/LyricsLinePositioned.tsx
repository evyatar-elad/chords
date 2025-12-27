import { useMemo } from "react";
import type { ChordPosition } from "./types";
import { transposeChord } from "@/lib/transposition";

interface LyricsLinePositionedProps {
  lyrics: string;
  chords: ChordPosition[];
  transposition: number;
}

/**
 * Renders lyrics with chords using a grid/flex approach.
 * Segments are NOT reversed - RTL flex handles visual ordering.
 */
export function LyricsLinePositioned({
  lyrics,
  chords,
  transposition,
}: LyricsLinePositionedProps) {
  const semitones = Math.round(transposition * 2);

  // Build segments from chord positions
  const segments = useMemo(() => {
    if (chords.length === 0) {
      return [{ text: lyrics, chord: null as string | null }];
    }

    // Sort chords by position
    const sorted = [...chords].sort((a, b) => a.at - b.at);
    const result: Array<{ text: string; chord: string | null }> = [];

    let lastEnd = 0;

    for (let i = 0; i < sorted.length; i++) {
      const { chord, at } = sorted[i];
      
      // Text before this chord position (no chord above it)
      if (at > lastEnd) {
        result.push({ text: lyrics.slice(lastEnd, at), chord: null });
      }

      // Find where this chord's segment ends
      const nextAt = sorted[i + 1]?.at ?? lyrics.length;
      const segmentText = lyrics.slice(at, nextAt);
      
      result.push({
        text: segmentText || "\u00A0",
        chord: transposeChord(chord, semitones),
      });

      lastEnd = nextAt;
    }

    // Any remaining text after last chord
    if (lastEnd < lyrics.length) {
      result.push({ text: lyrics.slice(lastEnd), chord: null });
    }

    return result;
  }, [lyrics, chords, semitones]);

  // Render segments in order - RTL flex will handle right-to-left visual flow
  return (
    <div className="lyrics-line-grid">
      {segments.map((seg, idx) => (
        <span key={idx} className="lyric-segment">
          <span className="seg-chord">{seg.chord || "\u00A0"}</span>
          <span className="seg-text">{seg.text}</span>
        </span>
      ))}
    </div>
  );
}
