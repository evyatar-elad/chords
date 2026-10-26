import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Favorite } from "@/lib/api";

interface FavoriteStarProps {
  saved: Favorite | undefined;
  transposition: number;
  onClick: () => void;
  className?: string;
  iconClassName?: string;
}

/**
 * Empty star: save the song with the current key. Full star: saved in this key (click removes).
 * Dim full star: saved in another key (click updates the saved key).
 */
export function FavoriteStar({ saved, transposition, onClick, className, iconClassName }: FavoriteStarProps) {
  const otherKey = !!saved && saved.transposition !== transposition;
  const title = !saved ? "שמור שיר (עם הסולם הנוכחי)" : otherKey ? "עדכן את הסולם השמור לסולם הנוכחי" : "הסר מהשמורים";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn("shrink-0", className)}
      title={title}
      aria-label={title}
      aria-pressed={!!saved}
    >
      <Star
        className={cn(
          "h-4 w-4",
          saved ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
          otherKey && "opacity-50",
          iconClassName
        )}
      />
    </Button>
  );
}
