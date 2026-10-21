import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EasyVersionButtonProps {
  transposition: number;
  /** tab4u's easy version transposition (0 when the song has none) */
  easyTransposition: number;
  hasEasyVersion: boolean;
  onChange: (value: number) => void;
  className?: string;
}

/**
 * Switches between tab4u's easy version and the original key.
 * Songs without an easy version get a "back to original" button instead.
 */
export function EasyVersionButton({ transposition, easyTransposition, hasEasyVersion, onChange, className }: EasyVersionButtonProps) {
  const atEasy = hasEasyVersion && transposition === easyTransposition;
  const target = hasEasyVersion && !atEasy ? easyTransposition : 0;
  const label = hasEasyVersion && !atEasy ? "גרסה קלה" : "סולם מקורי";
  const disabled = !hasEasyVersion && transposition === 0;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onChange(target)}
      disabled={disabled}
      className={cn("shrink-0 text-xs text-muted-foreground hover:text-foreground", className)}
      title={hasEasyVersion ? (atEasy ? "עבור לסולם המקורי" : "עבור לגרסה הקלה של tab4u") : "חזור לסולם המקורי"}
    >
      {label}
    </Button>
  );
}
