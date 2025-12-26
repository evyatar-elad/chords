import { useEffect, useMemo, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TranspositionControlProps {
  value: number; // UI steps: 0.5 = half-step
  onChange: (value: number) => void;
}

export function TranspositionControl({ value, onChange }: TranspositionControlProps) {
  const min = -2.5;
  const max = 3;

  const clampAndSnap = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    return Math.round(clamped * 2) / 2; // snap to 0.5
  };

  const handleUp = () => {
    onChange(clampAndSnap(value + 0.5));
  };

  const handleDown = () => {
    onChange(clampAndSnap(value - 0.5));
  };

  const displayValue = useMemo(() => {
    if (Object.is(value, -0)) return "0";
    return value === 0 ? "0" : value > 0 ? `+${value}` : `${value}`;
  }, [value]);

  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commitDraft = () => {
    const parsed = Number(draft);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    onChange(clampAndSnap(parsed));
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDown}
        disabled={value <= min}
        className="h-8 w-8 text-foreground/70 hover:text-foreground hover:bg-muted disabled:opacity-30"
        aria-label="Transpose down"
      >
        <ChevronDown className="h-5 w-5" />
      </Button>

      <div className="min-w-[4.5rem]">
        <Input
          inputMode="decimal"
          type="number"
          step={0.5}
          min={min}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setDraft(String(value));
              e.currentTarget.blur();
            }
          }}
          className="h-8 px-2 text-center font-mono font-semibold text-primary bg-transparent"
          aria-label="Transpose value"
        />
        <div className="sr-only" aria-live="polite">
          {displayValue}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleUp}
        disabled={value >= max}
        className="h-8 w-8 text-foreground/70 hover:text-foreground hover:bg-muted disabled:opacity-30"
        aria-label="Transpose up"
      >
        <ChevronUp className="h-5 w-5" />
      </Button>
    </div>
  );
}

