import { useMemo } from "react";
import type { ChordPosition } from "./types";
import { transposeChord } from "@/lib/transposition";

interface LyricsLinePositionedProps {
  lyrics: string;
  chords: ChordPosition[];
  transposition: number;
}

/**
 * Simple segment-based approach:
 * - Split lyrics into segments by chord positions
 * - Each segment = column (chord above + text below)
 * - Line direction RTL ensures right-to-left flow
 * - Text within each segment stays intact (no character splitting)
 */
export function LyricsLinePositioned({
  lyrics,
  chords,
  transposition,
}: LyricsLinePositionedProps) {
  const semitones = Math.round(transposition * 2);

  const segments = useMemo(() => {
    if (!lyrics) return [];
    
    if (chords.length === 0) {
      return [{ text: lyrics, chord: null as string | null }];
    }

    // Sort chords by 'at' (should already be sorted, but ensure)
    const sorted = [...chords].sort((a, b) => a.at - b.at);
    const result: Array<{ text: string; chord: string | null }> = [];

    let lastEnd = 0;

    for (let i = 0; i < sorted.length; i++) {
      const { chord, at } = sorted[i];

      // Clamp and then snap chord start to the nearest word boundary (space).
      // This prevents cases where a chord "splits" a word and leaves a single Hebrew letter
      // on the next line ("אותיות נופלות").
      let clampedAt = Math.min(Math.max(0, at), lyrics.length);
      const prevSpace = lyrics.lastIndexOf(" ", clampedAt - 1);
      const wordStart = prevSpace >= 0 ? prevSpace + 1 : 0;
      if (wordStart >= lastEnd && wordStart < clampedAt) {
        clampedAt = wordStart;
      }

      // Any text before this chord position (no chord above it)
      if (clampedAt > lastEnd) {
        result.push({ text: lyrics.slice(lastEnd, clampedAt), chord: null });
      }

      // This chord's segment extends to the next chord (or end of line)
      const nextAt = sorted[i + 1]?.at ?? lyrics.length;
      const clampedNext = Math.min(Math.max(clampedAt, nextAt), lyrics.length);
      let segmentText = lyrics.slice(clampedAt, clampedNext);
      
      // Only trim trailing spaces if this is the LAST segment (end of line)
      // Keep spaces between segments to maintain word/chord separation
      const isLastChordSegment = i === sorted.length - 1 && clampedNext >= lyrics.length;
      if (isLastChordSegment) {
        segmentText = segmentText.trimEnd();
      }

      result.push({
        text: segmentText || "\u00A0",
        chord: transposeChord(chord, semitones),
      });

      lastEnd = clampedNext;
    }

    // Remaining text after last chord - trim trailing spaces
    if (lastEnd < lyrics.length) {
      result.push({ text: lyrics.slice(lastEnd).trimEnd(), chord: null });
    }

    return result;
  }, [lyrics, chords, semitones]);

  if (segments.length === 0) {
    return <div className="empty-line" />;
  }

  return (
    <div className="lyrics-row">
      {segments.map((seg, idx) => (
        <span
          key={idx}
          className={seg.chord ? "segment segment--chord" : "segment"}
        >
          <span className="segment-chord">{seg.chord || "\u00A0"}</span>
          <span className="segment-text">{seg.text}</span>
        </span>
      ))}
    </div>
  );
}
