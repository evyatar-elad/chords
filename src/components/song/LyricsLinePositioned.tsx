import { useMemo } from "react";
import type { ChordPosition } from "./types";
import { transposeChordLabel } from "@/lib/chords";

interface LyricsLinePositionedProps {
  lyrics: string;
  chords: ChordPosition[];
  transposition: number;
  direction: "rtl" | "ltr";
}

interface Segment {
  text: string;
  chordTokens: string[] | null;
}

const NBSP = String.fromCharCode(160);

/**
 * Lyrics split into columns at every chord position:
 * each column = chord above + the text from that chord up to the next one.
 * - Positions are used exactly as given (tab4u is character precise, chords can start mid-word)
 * - A column is only wider than its text when the chord label is, which keeps labels from overlapping
 * - Chords played after the last word are placed in padding after the text
 */
export function LyricsLinePositioned({ lyrics, chords, transposition, direction }: LyricsLinePositionedProps) {
  const semitones = Math.round(transposition * 2);

  const segments = useMemo<Segment[]>(() => {
    const sorted = [...chords].sort((a, b) => a.at - b.at);
    const lastAt = sorted.length ? sorted[sorted.length - 1].at : -1;
    // pad so chords past the end of the line keep their distance from the text
    const text = lastAt >= lyrics.length ? lyrics + " ".repeat(lastAt - lyrics.length + 1) : lyrics;

    const result: Segment[] = [];
    const firstAt = sorted.length ? Math.max(0, sorted[0].at) : text.length;
    if (firstAt > 0) result.push({ text: text.slice(0, firstAt), chordTokens: null });

    for (let i = 0; i < sorted.length; ) {
      const at = Math.max(0, sorted[i].at);
      const tokens: string[] = [];
      while (i < sorted.length && Math.max(0, sorted[i].at) === at) {
        tokens.push(...transposeChordLabel(sorted[i].chord, semitones));
        i++;
      }
      const end = i < sorted.length ? Math.max(0, sorted[i].at) : text.length;
      result.push({ text: text.slice(at, end) || NBSP, chordTokens: tokens.length ? tokens : [NBSP] });
    }
    return result;
  }, [lyrics, chords, semitones]);

  if (!lyrics && chords.length === 0) {
    return <div className="empty-line" />;
  }

  // No chords above this line: don't reserve an empty chord row
  if (chords.length === 0) {
    return (
      <div className="lyrics-row lyrics-row--plain" dir={direction}>
        <span className="segment-text">{lyrics}</span>
      </div>
    );
  }

  return (
    <div className="lyrics-row" dir={direction}>
      {segments.map((seg, idx) => (
        <span key={idx} className={seg.chordTokens ? "segment segment--chord" : "segment"}>
          <span className="segment-chord">
            {seg.chordTokens
              ? seg.chordTokens.map((t, tIdx) => (
                  <span key={tIdx} className="chord-token">
                    {t}
                  </span>
                ))
              : null}
          </span>
          <span className="segment-text">{seg.text}</span>
        </span>
      ))}
    </div>
  );
}
