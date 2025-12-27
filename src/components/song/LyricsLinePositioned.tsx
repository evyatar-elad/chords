import { useLayoutEffect, useRef, useState } from "react";
import type { ChordPosition } from "./types";
import { transposeChord } from "@/lib/transposition";

interface LyricsLinePositionedProps {
  lyrics: string;
  chords: ChordPosition[];
  transposition: number;
}

/**
 * Renders lyrics with chords positioned above using actual text measurement.
 * No segment splitting - renders full text and positions chords absolutely.
 */
export function LyricsLinePositioned({
  lyrics,
  chords,
  transposition,
}: LyricsLinePositionedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [measuredChords, setMeasuredChords] = useState<Array<{ chord: string; rightOffset: number }>>([]);

  const semitones = Math.round(transposition * 2);

  // Measure chord positions after render
  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl || !textEl.firstChild || chords.length === 0) {
      setMeasuredChords([]);
      return;
    }

    const textNode = textEl.firstChild as Text;
    const containerRect = container.getBoundingClientRect();
    
    const positions: Array<{ chord: string; rightOffset: number }> = [];

    for (const { chord, at } of chords) {
      try {
        const range = document.createRange();
        // Clamp position to valid range
        const pos = Math.min(Math.max(0, at), textNode.length);
        range.setStart(textNode, pos);
        range.setEnd(textNode, pos);
        
        const rects = range.getClientRects();
        if (rects.length > 0) {
          const rect = rects[0];
          // For RTL: measure from container's right edge
          const rightOffset = containerRect.right - rect.right;
          positions.push({
            chord: transposeChord(chord, semitones),
            rightOffset: Math.max(0, rightOffset),
          });
        }
      } catch (e) {
        // Skip invalid positions
        console.warn("Failed to measure chord position:", e);
      }
    }

    setMeasuredChords(positions);
  }, [lyrics, chords, semitones]);

  return (
    <div ref={containerRef} className="lyrics-line-measured">
      {/* Chords layer - absolutely positioned */}
      <div className="chords-layer">
        {measuredChords.map((c, i) => (
          <span
            key={i}
            className="measured-chord"
            style={{ right: `${c.rightOffset}px` }}
          >
            {c.chord}
          </span>
        ))}
      </div>
      {/* Lyrics text - plain RTL */}
      <span ref={textRef} className="lyrics-text-plain">
        {lyrics}
      </span>
    </div>
  );
}
