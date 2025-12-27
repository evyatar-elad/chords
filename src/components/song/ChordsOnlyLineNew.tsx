import { transposeChord } from "@/lib/transposition";

interface ChordsOnlyLineNewProps {
  chords: string[];
  transposition: number;
}

/**
 * Renders a line of chords only (no lyrics), e.g., intro/transition.
 * Chords come from scraper in LTR order, so we reverse for RTL display.
 */
export function ChordsOnlyLineNew({
  chords,
  transposition,
}: ChordsOnlyLineNewProps) {
  const semitones = Math.round(transposition * 2);
  // Reverse the array so it displays correctly in RTL
  const reversed = [...chords].reverse();

  return (
    <div className="chords-only-line-new">
      {reversed.map((chord, idx) => (
        <span key={idx} className="chord-item-new">
          {transposeChord(chord, semitones)}
        </span>
      ))}
    </div>
  );
}
