// Chromatic scale for transposition (using sharps as default)
const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Map flats to their sharp equivalents
const FLAT_TO_SHARP: Record<string, string> = {
  'Db': 'C#',
  'Eb': 'D#',
  'Fb': 'E',
  'Gb': 'F#',
  'Ab': 'G#',
  'Bb': 'A#',
  'Cb': 'B',
};

// Map sharps to flats for display consistency
const SHARP_TO_FLAT: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
};

/**
 * Parse a chord string into its components
 * @param chord - The chord string (e.g., "Am7", "F#m", "Bb/D")
 * @returns Object with root, suffix, and optional bass note
 */
function parseChord(chord: string): { root: string; suffix: string; bass?: string } | null {
  if (!chord || typeof chord !== 'string') return null;
  
  // Handle slash chords (e.g., "C/G", "Am/E")
  const slashParts = chord.split('/');
  const mainChord = slashParts[0];
  const bassNote = slashParts[1];
  
  // Match root note (A-G with optional # or b)
  const rootMatch = mainChord.match(/^([A-G][#b]?)/);
  if (!rootMatch) return null;
  
  const root = rootMatch[1];
  const suffix = mainChord.slice(root.length);
  
  return { root, suffix, bass: bassNote };
}

/**
 * Get the index of a note in the chromatic scale
 * @param note - The note (e.g., "C", "F#", "Bb")
 */
function getNoteIndex(note: string): number {
  // Convert flat to sharp if needed
  const normalizedNote = FLAT_TO_SHARP[note] || note;
  return CHROMATIC_SCALE.indexOf(normalizedNote);
}

/**
 * Get the note at a specific index in the chromatic scale
 * @param index - The index (0-11)
 * @param preferFlat - Whether to prefer flat notation
 */
function getNoteAtIndex(index: number, preferFlat: boolean = false): string {
  // Normalize index to 0-11 range
  const normalizedIndex = ((index % 12) + 12) % 12;
  const note = CHROMATIC_SCALE[normalizedIndex];
  
  if (preferFlat && SHARP_TO_FLAT[note]) {
    return SHARP_TO_FLAT[note];
  }
  
  return note;
}

/**
 * Transpose a single note by a number of semitones
 * @param note - The note to transpose
 * @param semitones - Number of semitones to transpose (positive = up, negative = down)
 */
function transposeNote(note: string, semitones: number): string {
  const preferFlat = note.includes('b');
  const index = getNoteIndex(note);
  
  if (index === -1) return note; // Return unchanged if not a valid note
  
  return getNoteAtIndex(index + semitones, preferFlat);
}

/**
 * Transpose a chord by a number of semitones
 * @param chord - The chord to transpose (e.g., "Am7", "F#m", "Bb/D")
 * @param semitones - Number of semitones to transpose
 */
export function transposeChord(chord: string, semitones: number): string {
  const semitonesInt = Math.round(semitones);
  if (semitonesInt === 0) return chord;
  
  const parsed = parseChord(chord);
  if (!parsed) return chord;
  
  const { root, suffix, bass } = parsed;
  const newRoot = transposeNote(root, semitonesInt);
  
  let result = newRoot + suffix;
  
  if (bass) {
    const newBass = transposeNote(bass, semitonesInt);
    result += '/' + newBass;
  }
  
  return result;
}

/**
 * Find all chords in a text and transpose them
 * Chords are marked with [CHORD] format
 * @param text - The text containing chords in [CHORD] format
 * @param semitones - Number of semitones to transpose
 */
export function transposeAllChords(text: string, semitones: number): string {
  if (semitones === 0) return text;
  
  // Match chords in [CHORD] format
  return text.replace(/\[([^\]]+)\]/g, (match, chord) => {
    const transposed = transposeChord(chord.trim(), semitones);
    return `[${transposed}]`;
  });
}

/**
 * Parse song content and separate chords from lyrics while maintaining position
 * This is crucial for maintaining the exact spacing
 */
export function parseSongContent(content: string): { lines: ParsedLine[] } {
  const lines = content.split('\n');
  const parsedLines: ParsedLine[] = [];
  
  for (const line of lines) {
    const parsedLine = parseLine(line);
    parsedLines.push(parsedLine);
  }
  
  return { lines: parsedLines };
}

export interface ChordPosition {
  chord: string;
  position: number;
}

export interface ParsedLine {
  text: string;
  chords: ChordPosition[];
  isChordOnlyLine: boolean;
}

/**
 * Parse a single line to extract chords and their positions
 */
function parseLine(line: string): ParsedLine {
  const chords: ChordPosition[] = [];
  let textWithoutChords = '';
  let currentPos = 0;
  
  // Process the line character by character
  let i = 0;
  while (i < line.length) {
    if (line[i] === '[') {
      // Find the closing bracket
      const closeIndex = line.indexOf(']', i);
      if (closeIndex !== -1) {
        const chord = line.slice(i + 1, closeIndex);
        chords.push({ chord, position: currentPos });
        i = closeIndex + 1;
        continue;
      }
    }
    
    textWithoutChords += line[i];
    currentPos++;
    i++;
  }
  
  // Determine if this is a chord-only line (no meaningful text)
  const isChordOnlyLine = textWithoutChords.trim().length === 0 && chords.length > 0;
  
  return {
    text: textWithoutChords,
    chords,
    isChordOnlyLine,
  };
}

/**
 * Reconstruct a line with transposed chords maintaining original positions
 */
export function reconstructLine(parsedLine: ParsedLine, semitones: number): string {
  if (parsedLine.chords.length === 0) {
    return parsedLine.text;
  }
  
  const { text, chords } = parsedLine;
  
  // Build the line with chords at their positions
  let result = '';
  let textIndex = 0;
  
  // Sort chords by position
  const sortedChords = [...chords].sort((a, b) => a.position - b.position);
  
  for (const { chord, position } of sortedChords) {
    // Add text up to this position
    while (textIndex < position && textIndex < text.length) {
      result += text[textIndex];
      textIndex++;
    }
    
    // Pad with spaces if needed
    while (result.length < position) {
      result += ' ';
    }
    
    // Add the transposed chord
    const transposedChord = transposeChord(chord, semitones);
    result += `[${transposedChord}]`;
  }
  
  // Add remaining text
  while (textIndex < text.length) {
    result += text[textIndex];
    textIndex++;
  }
  
  return result;
}
