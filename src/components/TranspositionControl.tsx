import { useMemo } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
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

  const isAtOriginal = originalTransposition !== undefined && 
                       value === originalTransposition;

  const handleUp = () => {
    const currentIndex = options.indexOf(value);
    if (currentIndex < options.length - 1) {
      onChange(options[currentIndex + 1]);
    } else {
      // Cycle to beginning
      onChange(options[0]);
    }
  };

  const handleDown = () => {
    const currentIndex = options.indexOf(value);
    if (currentIndex > 0) {
      onChange(options[currentIndex - 1]);
    } else {
      // Cycle to end
      onChange(options[options.length - 1]);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDown}
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        aria-label="הורד טון"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>

      <Select value={String(value)} onValueChange={(v) => onChange(parseFloat(v))}>
        <SelectTrigger className="w-16 h-8 bg-transparent border-border/50 text-primary font-mono font-semibold justify-center tabular-nums [&>svg]:hidden">
          <SelectValue className="text-center tabular-nums">
            {formatValue(value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="min-w-[56px]">
          {options.map((opt) => (
            <SelectItem
              key={opt}
              value={String(opt)}
              className="justify-center text-center"
            >
              <span className="w-full text-center tabular-nums">
                {formatValue(opt)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleUp}
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        aria-label="העלה טון"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>

      {/* Easy version button - always visible */}
      {originalTransposition !== undefined && onResetToOriginal && (
        <Button
          variant="ghost"
          size="sm"
          onClick={isAtOriginal ? undefined : onResetToOriginal}
          disabled={isAtOriginal}
          className={`h-7 px-2 text-xs mr-1 ${
            isAtOriginal
              ? "text-primary/50 cursor-default"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          גרסה קלה
        </Button>
      )}
    </div>
  );
}