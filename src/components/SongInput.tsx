import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SongInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function SongInput({ onSubmit, isLoading }: SongInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto" dir="rtl">
      <div className="flex gap-3 flex-row-reverse">
        <Button
          type="submit"
          disabled={!url.trim() || isLoading}
          className="h-14 px-8 text-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin ml-2" />
              טוען...
            </>
          ) : (
            "הצג שיר"
          )}
        </Button>
        
        <div className="relative flex-1">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="הדבק לינק לשיר מ-tab4u.com..."
            className="h-14 pr-4 pl-12 text-lg bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 text-right"
            dir="rtl"
            disabled={isLoading}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </form>
  );
}
