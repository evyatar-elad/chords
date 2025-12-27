import { Bug } from "lucide-react";
import { TranspositionControl } from "./TranspositionControl";
import { FontSizeControl } from "./FontSizeControl";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface FloatingToolbarProps {
  transposition: number;
  onTranspositionChange: (value: number) => void;
  fontSize: number;
  onFontSizeChange: (value: number) => void;
  originalTransposition?: number;
  onResetToOriginal?: () => void;
  debug?: boolean;
  onDebugToggle?: () => void;
}

export function FloatingToolbar({
  transposition,
  onTranspositionChange,
  fontSize,
  onFontSizeChange,
  originalTransposition,
  onResetToOriginal,
  debug,
  onDebugToggle,
}: FloatingToolbarProps) {
  return (
    <div className="glass rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2">
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

      {/* Debug toggle */}
      {onDebugToggle && (
        <>
          <Separator orientation="vertical" className="h-5 bg-border/50" />
          <Button
            variant="ghost"
            size="icon"
            onClick={onDebugToggle}
            className={`h-7 w-7 rounded-full ${debug ? "text-primary bg-primary/20" : "text-muted-foreground"}`}
            title="Toggle debug mode (Ctrl+Shift+D)"
          >
            <Bug className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
