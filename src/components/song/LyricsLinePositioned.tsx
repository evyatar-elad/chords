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

  console.log('[normalizeChordTokens] Input:', raw);

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

  console.log('[normalizeChordTokens] Output:', tokens);
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
      // Compute a stable start position for THIS chord (snapped to word boundary)
      const computeSnappedAt = (at: number) => {
        let clampedAt = Math.min(Math.max(0, at), lyrics.length);
        const prevSpace = lyrics.lastIndexOf(" ", clampedAt - 1);
        const wordStart = prevSpace >= 0 ? prevSpace + 1 : 0;
        if (wordStart >= lastEnd && wordStart < clampedAt) {
          clampedAt = wordStart;
        }
        return clampedAt;
      };

      const startAt = computeSnappedAt(sorted[i].at);

      // Any text before this chord position (no chord above it)
      if (startAt > lastEnd) {
        result.push({ text: lyrics.slice(lastEnd, startAt), chordTokens: null });
      }

      // Merge chords that land on the SAME startAt (Tab4U sometimes emits back-to-back chords with identical positions)
      const mergedChordTokens: string[] = [];
      let j = i;
      while (j < sorted.length && computeSnappedAt(sorted[j].at) === startAt) {
        const tokens = transposeChordLabel(sorted[j].chord, semitones);
        if (tokens.length) mergedChordTokens.push(...tokens);
        j++;
      }

      // This chord segment extends to the next chord (or end of line)
      const nextAt = sorted[j]?.at ?? lyrics.length;
      const clampedNext = Math.min(Math.max(startAt, nextAt), lyrics.length);
      let segmentText = lyrics.slice(startAt, clampedNext);

      // Only trim trailing spaces if this is the LAST segment (end of line)
      // Keep spaces between segments to maintain word/chord separation
      const isLastChordSegment = j >= sorted.length && clampedNext >= lyrics.length;
      if (isLastChordSegment) {
        segmentText = segmentText.trimEnd();
      }

      result.push({
        text: segmentText || "\u00A0",
        chordTokens: mergedChordTokens.length ? mergedChordTokens : ["\u00A0"],
      });

      lastEnd = clampedNext;
      i = j - 1;
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
