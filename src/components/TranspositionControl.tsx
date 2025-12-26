import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TranspositionControlProps {
  value: number;
  onChange: (value: number) => void;
  originalTransposition?: number;
  onResetToOriginal?: () => void;
}

export function TranspositionControl({ 
  value, 
  onChange, 
  originalTransposition,
  onResetToOriginal 
}: TranspositionControlProps) {
  // Generate options from -2.5 to 3 in 0.5 steps
  const options = useMemo(() => {
    const opts: number[] = [];
    for (let v = -2.5; v <= 3; v += 0.5) {
      opts.push(v);
    }
    return opts;
  }, []);

  const formatValue = (v: number) => {
    if (Object.is(v, -0) || v === 0) return "0";
    return v > 0 ? `+${v}` : `${v}`;
  };

  const showResetButton = originalTransposition !== undefined && 
                          value !== originalTransposition;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={String(value)}
        onValueChange={(v) => onChange(parseFloat(v))}
      >
        <SelectTrigger className="w-20 h-8 bg-transparent border-border/50 text-primary font-mono font-semibold">
          <SelectValue>{formatValue(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={String(opt)}>
              {formatValue(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {showResetButton && onResetToOriginal && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetToOriginal}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          title="חזור לגרסה קלה"
        >
          <RotateCcw className="h-3 w-3 ml-1" />
          גרסה קלה
        </Button>
      )}
    </div>
  );
}
