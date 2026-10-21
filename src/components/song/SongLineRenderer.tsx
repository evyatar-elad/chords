import type { SongLineData } from "./types";
import { LyricsLinePositioned } from "./LyricsLinePositioned";
import { ChordsOnlyLineNew } from "./ChordsOnlyLineNew";
import { TabBlock } from "./TabBlock";

interface SongLineRendererProps {
  line: SongLineData;
  transposition: number;
  direction: "rtl" | "ltr";
}

/**
 * Renders a single song line based on its type.
 */
export function SongLineRenderer({ line, transposition, direction }: SongLineRendererProps) {
  switch (line.type) {
    case "lyrics":
      return (
        <LyricsLinePositioned
          lyrics={line.lyrics}
          chords={line.chords}
          transposition={transposition}
          direction={direction}
        />
      );

    case "chords-only":
      return (
        <ChordsOnlyLineNew
          chords={line.chords}
          segments={line.segments}
          transposition={transposition}
          direction={direction}
        />
      );

    case "tab":
      return <TabBlock rows={line.rows} chords={line.chords} transposition={transposition} />;

    case "section":
      return (
        <div className="section-header" dir={direction}>
          {line.text}
        </div>
      );

    case "empty":
      return <div className="empty-line" />;

    default:
      return null;
  }
}
