import type { SongLineData } from "./types";
import { LyricsLinePositioned } from "./LyricsLinePositioned";
import { ChordsOnlyLineNew } from "./ChordsOnlyLineNew";

interface SongLineRendererProps {
  line: SongLineData;
  transposition: number;
}

/**
 * Renders a single song line based on its type.
 */
export function SongLineRenderer({ line, transposition }: SongLineRendererProps) {
  switch (line.type) {
    case "lyrics":
      return (
        <LyricsLinePositioned
          lyrics={line.lyrics}
          chords={line.chords}
          transposition={transposition}
        />
      );

    case "chords-only":
      return (
        <ChordsOnlyLineNew
          chords={line.chords}
          transposition={transposition}
        />
      );

    case "section":
      return <div className="section-header">{line.text}</div>;

    case "empty":
      return <div className="empty-line" />;

    default:
      return null;
  }
}
