import { useLayoutEffect, useRef, useState } from "react";
import type { ChordPosition } from "./types";
import { transposeChord } from "@/lib/transposition";

interface LyricsLinePositionedProps {
  lyrics: string;
  chords: ChordPosition[];
  transposition: number;
}

/**
 * Deterministic renderer:
 * - Render the lyrics as ONE plain RTL text node (prevents Hebrew corruption)
 * - Place chords above using DOM Range caret measurement at character offsets
 */
export function LyricsLinePositioned({
  lyrics,
  chords,
  transposition,
}: LyricsLinePositionedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [placed, setPlaced] = useState<Array<{ chord: string; rightPx: number }>>([]);

  const semitones = Math.round(transposition * 2);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;

    if (!container || !textEl) return;

    const textNode = textEl.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE || chords.length === 0) {
      setPlaced([]);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const tn = textNode as Text;

    const next: Array<{ chord: string; rightPx: number }> = [];

    for (const { chord, at } of chords) {
      const pos = Math.min(Math.max(0, at), tn.length);
      try {
        const range = document.createRange();
        range.setStart(tn, pos);
        range.setEnd(tn, pos);

        // In RTL, the caret rect's LEFT corresponds to the visual insertion point.
        const rect = range.getBoundingClientRect();
        if (rect && rect.width !== 0 || rect.height !== 0) {
          const rightPx = Math.max(0, containerRect.right - rect.left);
          next.push({
            chord: transposeChord(chord, semitones),
            rightPx,
          });
        }
      } catch {
        // ignore
      }
    }

    setPlaced(next);
  }, [lyrics, chords, semitones]);

  return (
    <div ref={containerRef} className="lyrics-line-measured">
      <div className="chords-layer" aria-hidden="true">
        {placed.map((c, i) => (
          <span
            key={i}
            className="measured-chord"
            style={{ right: `${c.rightPx}px` }}
          >
            {c.chord}
          </span>
        ))}
      </div>
      <span ref={textRef} className="lyrics-text-plain">
        {lyrics}
      </span>
    </div>
  );
}
