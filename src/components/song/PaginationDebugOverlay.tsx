import { memo } from "react";

export type PaginationDebugInfo = {
  cols: number;
  columnWidth: number;
  columnHeight: number;
  fontSize: number;
  fontScale: number;
  widestLine: number;
  totalHeight: number;
  pages: number;
};

export const PaginationDebugOverlay = memo(function PaginationDebugOverlay({
  info,
}: {
  info: PaginationDebugInfo | null;
}) {
  if (!info) return null;

  return (
    <aside
      dir="ltr"
      className="pointer-events-none absolute left-2 top-2 z-50 rounded-md border border-border bg-card/70 px-3 py-2 font-mono text-[12px] leading-5 text-foreground backdrop-blur"
    >
      <div className="font-semibold">DEBUG pagination</div>
      <div>cols: {info.cols}</div>
      <div>
        column: {Math.round(info.columnWidth)} x {Math.round(info.columnHeight)}px
      </div>
      <div>
        font: {info.fontSize}px x {info.fontScale.toFixed(3)}
      </div>
      <div>widest line: {Math.round(info.widestLine)}px</div>
      <div>total height: {Math.round(info.totalHeight)}px</div>
      <div>pages: {info.pages}</div>
    </aside>
  );
});
