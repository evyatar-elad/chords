import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface QuickSongInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function QuickSongInput({ onSubmit, isLoading }: QuickSongInputProps) {
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
      setUrl("");
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="שיר אחר"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <form onSubmit={handleSubmit} className="flex gap-2" dir="rtl">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="לינק לשיר..."
            className="flex-1 text-right"
            dir="rtl"
            disabled={isLoading}
            autoFocus
          />
          <Button
            type="submit"
            size="sm"
            disabled={!url.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "הצג"
            )}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
