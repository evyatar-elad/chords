// New deterministic data model for song lines

export interface ChordPosition {
  chord: string;
  at: number; // character offset in the lyrics string
}

export interface LyricsLineData {
  type: "lyrics";
  lyrics: string; // full lyrics text as-is from source
  chords: ChordPosition[]; // chords with their character offsets
}

export interface ChordsOnlyLineData {
  type: "chords-only";
  chords: string[]; // just chord names in order
}

export interface SectionLineData {
  type: "section";
  text: string;
}

export interface EmptyLineData {
  type: "empty";
}

export type SongLineData =
  | LyricsLineData
  | ChordsOnlyLineData
  | SectionLineData
  | EmptyLineData;

// Legacy types for backward compatibility during migration
export interface LegacyChordUnit {
  chord: string | null;
  text: string;
}

export interface LegacySongLine {
  type: "lyrics" | "chords-only" | "section" | "empty";
  units?: LegacyChordUnit[];
  text?: string;
}
