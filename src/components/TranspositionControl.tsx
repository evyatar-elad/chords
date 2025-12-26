import { ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TranspositionControlProps {
  value: number;
  onChange: (value: number) => void;
}

export function TranspositionControl({ value, onChange }: TranspositionControlProps) {
  // Use 0.5 increments, limit to ±2.5
  const handleUp = () => {
    if (value < 2.5) {
      onChange(Math.round((value + 0.5) * 10) / 10);
    }
  };
  
  const handleDown = () => {
    if (value > -2.5) {
      onChange(Math.round((value - 0.5) * 10) / 10);
    }
  };

  // Format the value for display
  const displayValue = value === 0 ? "0" : value > 0 ? `+${value}` : `${value}`;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDown}
        disabled={value <= -2.5}
        className="h-8 w-8 text-foreground/70 hover:text-foreground hover:bg-muted disabled:opacity-30"
        aria-label="Transpose down"
      >
        <ChevronDown className="h-5 w-5" />
      </Button>
      
      <div className="min-w-[3rem] text-center">
        <span className="text-lg font-mono font-semibold text-primary">
          {displayValue}
        </span>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleUp}
        disabled={value >= 2.5}
        className="h-8 w-8 text-foreground/70 hover:text-foreground hover:bg-muted disabled:opacity-30"
        aria-label="Transpose up"
      >
        <ChevronUp className="h-5 w-5" />
      </Button>
    </div>
  );
}
