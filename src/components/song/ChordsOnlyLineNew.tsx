import { transposeChord } from "@/lib/transposition";

interface ChordsOnlyLineNewProps {
  chords: string[];
  transposition: number;
}

/**
 * Renders a line of chords only (no lyrics), e.g., intro/transition.
 * Uses the same segment structure as lyrics lines for consistent alignment.
 */
export function ChordsOnlyLineNew({ chords, transposition }: ChordsOnlyLineNewProps) {
  const semitones = Math.round(transposition * 2);

  return (
    <div className="chords-only-line-new">
      {chords.map((chord, idx) => (
        <span key={idx} className="chord-item-new">
          {transposeChord(chord, semitones)}
        </span>
      ))}
    </div>
  );
}
