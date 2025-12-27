import { useMemo } from "react";
import type { ChordPosition } from "./types";
import { transposeChord } from "@/lib/transposition";

interface LyricsLinePositionedProps {
  lyrics: string;
  chords: ChordPosition[];
  transposition: number;
}

/**
 * Scan-forward tokenizer: extracts chords one-by-one from a potentially concatenated string.
 * Handles cases like "E7Am", "AmDm", "Dm7G7", "Cadd9Em7", slash chords "C/G", etc.
 */
function normalizeChordTokens(chordLabel: string): string[] {
  const raw = (chordLabel ?? "").trim();
  if (!raw) return [];

  const tokens: string[] = [];
  let i = 0;

  while (i < raw.length) {
    // Skip non-chord characters (spaces, parentheses, commas, bidi marks)
    if (/[\s(),\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(raw[i])) {
      i++;
      continue;
    }

    // Check for chord root: A-G
    if (/[A-G]/.test(raw[i])) {
      let chord = raw[i];
      i++;

      // Optional sharp or flat
      if (i < raw.length && /[#b♯♭]/.test(raw[i])) {
        chord += raw[i];
        i++;
      }

      // Consume modifiers: m, M, maj, min, dim, aug, sus, add, numbers, etc.
      // Continue until we hit another root letter (A-G) or end
      while (i < raw.length) {
        const ch = raw[i];
        
        // If we hit a slash, check if it's a bass note (slash chord)
        if (ch === '/') {
          // Look ahead for bass note
          if (i + 1 < raw.length && /[A-G]/.test(raw[i + 1])) {
            chord += ch;
            i++;
            chord += raw[i]; // bass root
            i++;
            // Optional sharp/flat on bass
            if (i < raw.length && /[#b♯♭]/.test(raw[i])) {
              chord += raw[i];
              i++;
            }
          } else {
            break;
          }
          continue;
        }

        // If we hit another root letter, stop (new chord starts)
        if (/[A-G]/.test(ch) && !/[0-9]/.test(raw[i - 1] || '')) {
          // But check if it's part of "add9", "sus4", "maj7" etc.
          // Letters m, a, d, s, u, i, g are valid modifier chars
          const lowerCh = ch.toLowerCase();
          if (!['a', 'd', 's', 'u', 'i', 'g', 'm'].includes(lowerCh)) {
            break; // It's a new chord root
          }
          // Check context: is this likely a modifier or a new chord?
          // If preceded by a letter that makes sense (like 'm' for 'maj'), continue
          // Otherwise if it's A-G uppercase and previous was a number, it's a new chord
          if (ch === ch.toUpperCase() && /[0-9]/.test(raw[i - 1] || '')) {
            break;
          }
        }

        // Valid modifier characters: letters, numbers
        if (/[a-zA-Z0-9]/.test(ch)) {
          chord += ch;
          i++;
        } else {
          break;
        }
      }

      if (chord) {
        tokens.push(chord);
      }
    } else {
      // Skip unknown character
      i++;
    }
  }

  // If tokenizer found nothing, fall back to space-split
  if (tokens.length === 0 && raw.length > 0) {
    return raw.split(/\s+/).map(t => t.trim()).filter(Boolean);
  }

  return tokens;
}

function transposeChordLabel(chordLabel: string, semitones: number): string {
  const tokens = normalizeChordTokens(chordLabel);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return transposeChord(tokens[0], semitones);
  return tokens.map((t) => transposeChord(t, semitones)).join(" ");
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

      // Clamp and then snap chord start to the nearest word boundary (space).
      // This prevents cases where a chord "splits" a word and leaves a single Hebrew letter
      // on the next line ("אותיות נופלות").
      let clampedAt = Math.min(Math.max(0, at), lyrics.length);
      const prevSpace = lyrics.lastIndexOf(" ", clampedAt - 1);
      const wordStart = prevSpace >= 0 ? prevSpace + 1 : 0;
      if (wordStart >= lastEnd && wordStart < clampedAt) {
        clampedAt = wordStart;
      }

      // Any text before this chord position (no chord above it)
      if (clampedAt > lastEnd) {
        result.push({ text: lyrics.slice(lastEnd, clampedAt), chord: null });
      }

      // This chord's segment extends to the next chord (or end of line)
      const nextAt = sorted[i + 1]?.at ?? lyrics.length;
      const clampedNext = Math.min(Math.max(clampedAt, nextAt), lyrics.length);
      let segmentText = lyrics.slice(clampedAt, clampedNext);

      // Only trim trailing spaces if this is the LAST segment (end of line)
      // Keep spaces between segments to maintain word/chord separation
      const isLastChordSegment = i === sorted.length - 1 && clampedNext >= lyrics.length;
      if (isLastChordSegment) {
        segmentText = segmentText.trimEnd();
      }

      result.push({
        text: segmentText || "\u00A0",
        chord: transposeChordLabel(chord, semitones) || "\u00A0",
      });

      lastEnd = clampedNext;
    }

    // Remaining text after last chord - trim trailing spaces
    if (lastEnd < lyrics.length) {
      result.push({ text: lyrics.slice(lastEnd).trimEnd(), chord: null });
    }

    return result;
  }, [lyrics, chords, semitones]);

  if (segments.length === 0) {
    return <div className="empty-line" />;
  }

  return (
    <div className="lyrics-row">
      {segments.map((seg, idx) => (
        <span key={idx} className={seg.chord ? "segment segment--chord" : "segment"}>
          <span className="segment-chord">{seg.chord || "\u00A0"}</span>
          <span className="segment-text">{seg.text}</span>
        </span>
      ))}
    </div>
  );
}
