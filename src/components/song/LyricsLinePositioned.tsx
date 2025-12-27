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
  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function transposeChordLabel(chordLabel: string, semitones: number): string[] {
  const tokens = normalizeChordTokens(chordLabel);
  if (tokens.length === 0) return [];
  return tokens.map((t) => transposeChord(t, semitones));
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
    const result: Array<{ text: string; chordTokens: string[] | null }> = [];

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
        result.push({ text: lyrics.slice(lastEnd, clampedAt), chordTokens: null });
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

      const chordTokens = transposeChordLabel(chord, semitones);

      result.push({
        text: segmentText || "\u00A0",
        chordTokens: chordTokens.length ? chordTokens : ["\u00A0"],
      });

      lastEnd = clampedNext;
    }

    // Remaining text after last chord - trim trailing spaces
    if (lastEnd < lyrics.length) {
      result.push({ text: lyrics.slice(lastEnd).trimEnd(), chordTokens: null });
    }

    return result;
  }, [lyrics, chords, semitones]);

  if (segments.length === 0) {
    return <div className="empty-line" />;
  }

  return (
    <div className="lyrics-row">
      {segments.map((seg, idx) => (
        <span key={idx} className={seg.chordTokens ? "segment segment--chord" : "segment"}>
          <span className="segment-chord">
            {seg.chordTokens?.map((t, tIdx) => (
              <span key={tIdx} className="chord-token">
                {t}
              </span>
            )) || "\u00A0"}
          </span>
          <span className="segment-text">{seg.text}</span>
        </span>
      ))}
    </div>
  );
}
