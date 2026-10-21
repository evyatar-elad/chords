import type { CSSProperties } from "react";
import type { ChordsOnlySegment } from "./types";
import { transposeChordLabel } from "@/lib/chords";

interface TabBlockProps {
  rows: string[];
  chords?: ChordsOnlySegment[];
  transposition: number;
}

/** Guitar tablature (e|---0---|), monospace and shrunk to fit the column width. */
export function TabBlock({ rows, chords, transposition }: TabBlockProps) {
  const semitones = Math.round(transposition * 2);
  const chordRowWidth = chords?.reduce((n, seg) => n + seg.text.length, 0) ?? 0;
  const cols = Math.max(1, chordRowWidth, ...rows.map((r) => r.length));

  return (
    <pre className="tab-block" dir="ltr" style={{ "--tab-cols": cols } as CSSProperties}>
      {chords?.length ? (
        <>
          {chords.map((seg, idx) =>
            seg.chord ? (
              <span key={idx} className="chord-item-new">
                {transposeChordLabel(seg.text, semitones).join(" ")}
              </span>
            ) : (
              <span key={idx}>{seg.text}</span>
            )
          )}
          {"\n"}
        </>
      ) : null}
      {rows.join("\n")}
    </pre>
  );
}
