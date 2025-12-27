import { transposeChord } from "@/lib/transposition";

interface ChordsOnlyLineNewProps {
  chords: string[];
  transposition: number;
}

/**
 * Simple and reliable chord tokenizer:
 * - Any uppercase A-G starts a NEW chord
 * - Exception: A-G after '/' is a bass note (part of current chord)
 * - Consume everything else (modifiers, numbers) until next A-G root
 */
function normalizeChordTokens(chordLabel: string): string[] {
  const raw = (chordLabel ?? "").trim();
  if (!raw) return [];

  const tokens: string[] = [];
  let current = "";
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];

    // Skip whitespace and separators
    if (/[\s(),\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      i++;
      continue;
    }

    // Check if this is a chord root (A-G uppercase)
    if (/[A-G]/.test(ch)) {
      // If we already have a chord building, save it first
      // Exception: if previous char was '/', this is a bass note
      const prevChar = i > 0 ? raw[i - 1] : "";
      if (current && prevChar !== "/") {
        tokens.push(current);
        current = "";
      }
      current += ch;
      i++;

      // Optional sharp or flat immediately after root
      if (i < raw.length && /[#b♯♭]/.test(raw[i])) {
        current += raw[i];
        i++;
      }
      continue;
    }

    // Slash - could be slash chord bass note coming
    if (ch === "/") {
      current += ch;
      i++;
      continue;
    }

    // Any other character (modifiers, numbers) - add to current chord
    if (/[a-z0-9]/i.test(ch)) {
      current += ch;
      i++;
      continue;
    }

    // Unknown character - skip
    i++;
  }

  // Don't forget the last chord
  if (current) tokens.push(current);

  return tokens;
}

function transposeChordLabel(chordLabel: string, semitones: number): string[] {
  const tokens = normalizeChordTokens(chordLabel);
  if (tokens.length === 0) return [];
  return tokens.map((t) => transposeChord(t, semitones));
}

/**
 * Renders a line of chords only (no lyrics), e.g., intro/transition.
 * Also splits concatenated chord strings (e.g. "E7Am") into separate tokens.
 */
export function ChordsOnlyLineNew({ chords, transposition }: ChordsOnlyLineNewProps) {
  const semitones = Math.round(transposition * 2);

  const rendered = chords.flatMap((label, chordIdx) => {
    const parts = transposeChordLabel(label, semitones);
    if (parts.length === 0) return [];

    return parts.map((p, partIdx) => ({
      key: `${chordIdx}-${partIdx}`,
      text: p,
    }));
  });

  return (
    <div className="chords-only-line-new">
      {rendered.map((item) => (
        <span key={item.key} className="chord-item-new">
          {item.text}
        </span>
      ))}
    </div>
  );
}
