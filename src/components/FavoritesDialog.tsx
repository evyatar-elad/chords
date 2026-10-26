import { Star, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Favorite } from "@/lib/api";

interface FavoritesListProps {
  favorites: Favorite[];
  onOpen: (favorite: Favorite) => void;
  onRemove: (favorite: Favorite) => void;
}

export const formatTransposition = (v: number) => {
  if (Object.is(v, -0) || v === 0) return "0";
  return v > 0 ? `+${v}` : `${v}`;
};

/** Saved songs: tap to open in the saved key, trash to remove. */
export function FavoritesList({ favorites, onOpen, onRemove }: FavoritesListProps) {
  if (!favorites.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        עוד אין שירים שמורים. לחץ על <Star className="inline h-4 w-4 -mt-0.5" /> ליד שם השיר כדי לשמור אותו.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/50">
      {favorites.map((f) => (
        <li key={f.url} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpen(f)}
            className="flex-1 min-w-0 text-right rounded-md px-2 py-2 hover:bg-secondary focus:bg-secondary focus:outline-none"
          >
            <div className="font-medium text-foreground truncate">{f.title}</div>
            <div className="text-xs text-muted-foreground truncate">
              {f.artist}
              {f.artist ? " · " : ""}
              סולם <span dir="ltr" className="font-mono">{formatTransposition(f.transposition)}</span>
            </div>
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(f)}
            className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
            title="הסר מהשמורים"
            aria-label={`הסר את ${f.title} מהשמורים`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

interface FavoritesDialogProps extends FavoritesListProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FavoritesDialog({ open, onOpenChange, ...listProps }: FavoritesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[85dvh] overflow-hidden flex flex-col p-4 sm:max-w-md [&>button]:right-auto [&>button]:left-4">
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle>שירים שמורים</DialogTitle>
          <DialogDescription>כל שיר נפתח בסולם שבו נשמר</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto -mx-2">
          <FavoritesList {...listProps} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
