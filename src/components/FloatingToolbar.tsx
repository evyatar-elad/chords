import { TranspositionControl } from "./TranspositionControl";
import { FontSizeControl } from "./FontSizeControl";
import { AutoScrollControl } from "./AutoScrollControl";
import { Separator } from "@/components/ui/separator";

interface FloatingToolbarProps {
  transposition: number;
  onTranspositionChange: (value: number) => void;
  fontSize: number;
  onFontSizeChange: (value: number) => void;
  originalTransposition?: number;
  onResetToOriginal?: () => void;
}

export function FloatingToolbar({
  transposition,
  onTranspositionChange,
  fontSize,
  onFontSizeChange,
  originalTransposition,
  onResetToOriginal,
}: FloatingToolbarProps) {
  return (
    <div className="glass rounded-full px-3 py-2 shadow-lg flex items-center gap-2">
      {/* Auto Scroll */}
      <AutoScrollControl />
      
      <Separator orientation="vertical" className="h-5 bg-border/50" />
      
      {/* Font Size */}
      <FontSizeControl
        value={fontSize}
        onChange={onFontSizeChange}
      />
      
      <Separator orientation="vertical" className="h-5 bg-border/50" />
      
      {/* Transposition */}
      <TranspositionControl
        value={transposition}
        onChange={onTranspositionChange}
        originalTransposition={originalTransposition}
        onResetToOriginal={onResetToOriginal}
      />
    </div>
  );
}