import type { ChordsOnlySegment } from "./types";
import { transposeChordLabel } from "@/lib/chords";

interface ChordsOnlyLineNewProps {
  chords: string[];
  segments?: ChordsOnlySegment[];
  transposition: number;
  direction: "rtl" | "ltr";
}

/**
 * A line of chords without lyrics (intro, interlude). Shown like tab4u shows it:
 * left to right, with the original spacing and separators ("|", "x2"),
 * aligned to the reading side of the song.
 */
export function ChordsOnlyLineNew({ chords, segments, transposition, direction }: ChordsOnlyLineNewProps) {
  const semitones = Math.round(transposition * 2);
  const align = direction === "rtl" ? "chords-only-line-new--end" : "";

  if (segments?.length) {
    return (
      <div className={`chords-only-line-new ${align}`} dir="ltr">
        {segments.map((seg, idx) =>
          seg.chord ? (
            <span key={idx} className="chord-item-new">
              {transposeChordLabel(seg.text, semitones).join(" ")}
            </span>
          ) : (
            <span key={idx} className="chords-only-sep">
              {seg.text}
            </span>
          )
        )}
      </div>
    );
  }

  // Older responses: chord names only
  const rendered = chords.flatMap((label) => transposeChordLabel(label, semitones));
  return (
    <div className={`chords-only-line-new ${align}`} dir="ltr">
      {rendered.map((text, idx) => (
        <span key={idx}>
          {idx > 0 ? <span className="chords-only-sep">{"   "}</span> : null}
          <span className="chord-item-new">{text}</span>
        </span>
      ))}
    </div>
  );
}
