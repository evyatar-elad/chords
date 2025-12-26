import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FontSizeControlProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function FontSizeControl({ 
  value, 
  onChange, 
  min = 12, 
  max = 24 
}: FontSizeControlProps) {
  const handleDecrease = () => {
    if (value > min) onChange(value - 1);
  };
  
  const handleIncrease = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDecrease}
        disabled={value <= min}
        className="h-8 w-8 text-foreground/70 hover:text-foreground hover:bg-muted disabled:opacity-30"
        aria-label="Decrease font size"
      >
        <span className="text-xs font-bold flex items-center gap-0.5">
          <span className="text-sm">A</span>
          <Minus className="h-3 w-3" />
        </span>
      </Button>
      
      <div className="min-w-[2.5rem] text-center">
        <span className="text-sm font-mono text-muted-foreground">
          {value}px
        </span>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleIncrease}
        disabled={value >= max}
        className="h-8 w-8 text-foreground/70 hover:text-foreground hover:bg-muted disabled:opacity-30"
        aria-label="Increase font size"
      >
        <span className="text-base font-bold flex items-center gap-0.5">
          <span className="text-lg">A</span>
          <Plus className="h-3 w-3" />
        </span>
      </Button>
    </div>
  );
}
