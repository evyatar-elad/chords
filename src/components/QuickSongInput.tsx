import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QuickSongInputProps {
  onSubmit: (input: string) => void;
  isLoading: boolean;
  loadingMessage?: string;
  onFocus?: () => void;
}

export function QuickSongInput({ onSubmit, isLoading, loadingMessage, onFocus }: QuickSongInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input.trim());
      setInput("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5" dir="rtl">
      <Input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onFocus={onFocus}
        placeholder="חפש שיר..."
        className="flex-1 h-8 text-sm text-right bg-secondary/50 border-border/50"
        dir="rtl"
        disabled={isLoading}
      />
      <Button
        type="submit"
        size="sm"
        className="h-8 px-2 md:px-3 shrink-0"
        disabled={!input.trim() || isLoading}
      >
        {isLoading ? (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
            {loadingMessage && <span className="hidden md:inline text-xs">{loadingMessage}</span>}
          </span>
        ) : (
          <span className="text-xs md:text-sm">הצג</span>
        )}
      </Button>
    </form>
  );
}
