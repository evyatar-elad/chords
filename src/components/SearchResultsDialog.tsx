import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SearchResult } from "@/lib/api";

interface SearchResultsDialogProps {
  query: string;
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
  onClose: () => void;
}

/** Lets the user pick the right song when tab4u's search returns several matches. */
export function SearchResultsDialog({ query, results, onSelect, onClose }: SearchResultsDialogProps) {
  return (
    <Dialog open={results.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl" className="max-h-[85dvh] overflow-hidden flex flex-col p-4 sm:max-w-md [&>button]:right-auto [&>button]:left-4">
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle>בחר שיר</DialogTitle>
          <DialogDescription>תוצאות עבור "{query}"</DialogDescription>
        </DialogHeader>
        <ul className="overflow-y-auto -mx-2">
          {results.map((r, idx) => (
            <li key={r.url}>
              <button
                type="button"
                autoFocus={idx === 0}
                onClick={() => onSelect(r)}
                className="w-full text-right rounded-md px-2 py-2 hover:bg-secondary focus:bg-secondary focus:outline-none"
              >
                <div className="font-medium text-foreground">{r.title}</div>
                <div className="text-xs text-muted-foreground">{r.artist}</div>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
