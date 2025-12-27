import { useMemo } from "react";
import type { ChordPosition } from "./types";
import { transposeChord } from "@/lib/transposition";

interface LyricsLinePositionedProps {
  lyrics: string;
  chords: ChordPosition[];
  transposition: number;
}

/**
 * Renders a lyrics line with chords positioned above based on character offsets.
 * 
 * Strategy:
 * - Split the lyrics into segments based on chord positions
 * - Each segment is rendered as an inline-block with the chord absolutely positioned above
 * - The line itself is RTL, but we control segment order explicitly
 */
export function LyricsLinePositioned({
  lyrics,
  chords,
  transposition,
}: LyricsLinePositionedProps) {
  const semitones = Math.round(transposition * 2);

  // Build segments: each segment has text and optionally a chord at its start
  const segments = useMemo(() => {
    if (chords.length === 0) {
      return [{ text: lyrics, chord: null as string | null }];
    }

    // Sort chords by position (should already be sorted, but ensure)
    const sorted = [...chords].sort((a, b) => a.at - b.at);
    const result: { text: string; chord: string | null }[] = [];

    let lastPos = 0;

    for (let i = 0; i < sorted.length; i++) {
      const { chord, at } = sorted[i];
      const nextAt = sorted[i + 1]?.at ?? lyrics.length;

      // If there's text before the first chord, add it without a chord
      if (i === 0 && at > 0) {
        result.push({ text: lyrics.slice(0, at), chord: null });
      }

      // Add the segment from this chord position to the next
      result.push({
        text: lyrics.slice(at, nextAt),
        chord: transposeChord(chord, semitones),
      });

      lastPos = nextAt;
    }

    // Any remaining text after last chord
    if (lastPos < lyrics.length) {
      const remaining = lyrics.slice(lastPos);
      if (remaining) {
        result.push({ text: remaining, chord: null });
      }
    }

    return result;
  }, [lyrics, chords, semitones]);

  return (
    <div className="lyrics-line-positioned">
      {segments.map((seg, idx) => (
        <span key={idx} className="lyrics-segment">
          {seg.chord && (
            <span className="segment-chord">{seg.chord}</span>
          )}
          <span className="segment-text">{seg.text || "\u00A0"}</span>
        </span>
      ))}
    </div>
  );
}
