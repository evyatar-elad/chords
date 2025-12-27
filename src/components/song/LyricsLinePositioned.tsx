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
      const clampedAt = Math.min(Math.max(0, at), lyrics.length);

      // Any text before this chord position (no chord above it)
      if (clampedAt > lastEnd) {
        result.push({ text: lyrics.slice(lastEnd, clampedAt), chord: null });
      }

      // This chord's segment extends to the next chord (or end of line)
      const nextAt = sorted[i + 1]?.at ?? lyrics.length;
      const clampedNext = Math.min(Math.max(clampedAt, nextAt), lyrics.length);
      const segmentText = lyrics.slice(clampedAt, clampedNext);

      result.push({
        text: segmentText || "\u00A0",
        chord: transposeChord(chord, semitones),
      });

      lastEnd = clampedNext;
    }

    // Remaining text after last chord
    if (lastEnd < lyrics.length) {
      result.push({ text: lyrics.slice(lastEnd), chord: null });
    }

    // Heuristic 1: prevent "tiny" chord segments by borrowing from the next segment.
    // Using 4 chars makes wrapping much more stable in narrow columns.
    const MIN_SEG_CHARS = 4;

    for (let i = 0; i < result.length - 1; i++) {
      const curr = result[i];
      const next = result[i + 1];
      if (!curr.chord) continue;
      const currText = curr.text === "\u00A0" ? "" : curr.text;
      const nextText = next.text === "\u00A0" ? "" : next.text;

      if (currText.length >= MIN_SEG_CHARS || nextText.length === 0) continue;

      const need = Math.min(MIN_SEG_CHARS - currText.length, nextText.length);
      const take = nextText.slice(0, need);
      const rest = nextText.slice(need);

      curr.text = (currText + take) || "\u00A0";
      next.text = rest || "\u00A0";
    }

    // Heuristic 2 (RTL-specific): the *visual first* segment is the last in the array.
    // If that last segment is short, it tends to wrap to the next line ("first letters drop").
    // Stabilize it by borrowing chars from the previous segment's END.
    for (let i = result.length - 1; i > 0; i--) {
      const curr = result[i];
      const prev = result[i - 1];
      const currText = curr.text === "\u00A0" ? "" : curr.text;
      const prevText = prev.text === "\u00A0" ? "" : prev.text;

      if (currText.length >= MIN_SEG_CHARS || prevText.length === 0) continue;

      const need = Math.min(MIN_SEG_CHARS - currText.length, prevText.length);
      const take = prevText.slice(Math.max(0, prevText.length - need));
      const rest = prevText.slice(0, Math.max(0, prevText.length - need));

      prev.text = rest || "\u00A0";
      curr.text = (take + currText) || "\u00A0";
    }

    return result;
  }, [lyrics, chords, semitones]);

  if (segments.length === 0) {
    return <div className="empty-line" />;
  }

  return (
    <div className="lyrics-row">
      {segments.map((seg, idx) => (
        <span key={idx} className="segment">
          <span className="segment-chord">{seg.chord || "\u00A0"}</span>
          <span className="segment-text">{seg.text}</span>
        </span>
      ))}
    </div>
  );
}
