import { transposeChord } from "@/lib/transposition";

/** tab4u's "no chord" marker, as emitted by the scraper. Never transposed or split. */
export const NO_CHORD = "N.C.";

/**
 * Remove spaces before common modifiers.
 * Fixes cases like "Bm7 b5" → "Bm7b5", "C #9" → "C#9"
 */
function cleanChordLabel(chordLabel: string): string {
  return chordLabel
    .replace(/\s+([b#♭♯])(\d+)/g, "$1$2")
    .replace(/\s+([b#♭♯])$/g, "$1")
    .trim();
}

/**
 * Split a possibly glued chord label ("E7Am", "AmDm", "Dm7G7") into separate chords.
 * - Any uppercase A-G starts a new chord, except a bass note after '/'
 * - A lowercase root starts a new chord only right after a digit ("E7am"), but "b5"/"b9" is a modifier
 * The scraper already splits labels; this keeps older responses working.
 */
export function splitChordLabel(chordLabel: string): string[] {
  const raw = cleanChordLabel(chordLabel ?? "");
  if (!raw) return [];
  if (raw === NO_CHORD) return [NO_CHORD];

  const tokens: string[] = [];
  let current = "";

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const prevChar = i > 0 ? raw[i - 1] : "";
    const nextChar = i + 1 < raw.length ? raw[i + 1] : "";

    if (/[\s,\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(ch)) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }

    const isUpperRoot = /[A-G]/.test(ch);
    const isFlatModifier = ch === "b" && /[0-9]/.test(nextChar);
    const isLowerRoot = /[a-g]/.test(ch) && !!current && /[0-9)]/.test(prevChar) && !isFlatModifier;

    if ((isUpperRoot || isLowerRoot) && current && prevChar !== "/") {
      tokens.push(current);
      current = "";
    }

    if (isUpperRoot || isLowerRoot || ch === "/" || /[a-z0-9#♯♭+°ø()-]/i.test(ch)) current += ch;
  }
  if (current) tokens.push(current);

  return tokens;
}

export function transposeChordLabel(chordLabel: string, semitones: number): string[] {
  return splitChordLabel(chordLabel).map((t) => (t === NO_CHORD ? t : transposeChord(t, semitones)));
}
