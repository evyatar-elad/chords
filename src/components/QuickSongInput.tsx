import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QuickSongInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function QuickSongInput({ onSubmit, isLoading }: QuickSongInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
      setUrl("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2" dir="rtl">
      <Input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="לינק לשיר..."
        className="w-40 md:w-52 h-8 text-sm text-right bg-secondary/50 border-border/50"
        dir="rtl"
        disabled={isLoading}
      />
      <Button
        type="submit"
        size="sm"
        className="h-8 px-3"
        disabled={!url.trim() || isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "הצג"
        )}
      </Button>
    </form>
  );
}
