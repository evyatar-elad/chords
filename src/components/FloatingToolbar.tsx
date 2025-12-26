import { TranspositionControl } from "./TranspositionControl";
import { FontSizeControl } from "./FontSizeControl";
import { AutoScrollControl } from "./AutoScrollControl";
import { Separator } from "@/components/ui/separator";
import { Music } from "lucide-react";

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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="glass rounded-full px-4 py-2 shadow-2xl flex items-center gap-2">
        {/* Transposition */}
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-muted-foreground" />
          <TranspositionControl
            value={transposition}
            onChange={onTranspositionChange}
            originalTransposition={originalTransposition}
            onResetToOriginal={onResetToOriginal}
          />
        </div>
        
        <Separator orientation="vertical" className="h-6 bg-border/50" />
        
        {/* Font Size */}
        <FontSizeControl
          value={fontSize}
          onChange={onFontSizeChange}
        />
        
        <Separator orientation="vertical" className="h-6 bg-border/50" />
        
        {/* Auto Scroll */}
        <AutoScrollControl />
      </div>
    </div>
  );
}
