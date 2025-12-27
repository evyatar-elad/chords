import { memo } from "react";

export type PaginationDebugInfo = {
  cols: number;
  containerWidth: number;
  containerHeight: number;
  padTop: number;
  padBottom: number;
  safetyPx: number;
  columnWidth: number;
  measureWidth: number;
  fontSize: number;
  pages: number;
  mergedChordLinesCount: number;
  mergedChordLinesPreview: string[];
};

export const PaginationDebugOverlay = memo(function PaginationDebugOverlay({
  info,
}: {
  info: PaginationDebugInfo | null;
}) {
  if (!info) return null;

  return (
    <aside className="pointer-events-none absolute left-2 top-2 z-50 rounded-md border border-border bg-card/70 px-3 py-2 font-mono text-[12px] leading-5 text-foreground backdrop-blur">
      <div className="font-semibold">DEBUG pagination</div>
      <div>cols: {info.cols}</div>
      <div>containerWidth: {Math.round(info.containerWidth)}px</div>
      <div>containerHeight: {Math.round(info.containerHeight)}px</div>
      <div>
        padTop/padBottom: {Math.round(info.padTop)}/{Math.round(info.padBottom)}px
      </div>
      <div>safetyPx: {Math.round(info.safetyPx)}px</div>
      <div>columnWidth: {Math.round(info.columnWidth)}px</div>
      <div>measureWidth: {Math.round(info.measureWidth)}px</div>
      <div>fontSize: {info.fontSize}px</div>
      <div>pages: {info.pages}</div>

      <div className="mt-2 font-semibold">DEBUG chords</div>
      <div>mergedLines: {info.mergedChordLinesCount}</div>
      {info.mergedChordLinesPreview.length ? (
        <div className="max-w-[320px] whitespace-pre-wrap text-muted-foreground">
          {info.mergedChordLinesPreview.join("\n")}
        </div>
      ) : (
        <div className="text-muted-foreground">none</div>
      )}
    </aside>
  );
});
