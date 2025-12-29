import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QuickSongInputProps {
  onSubmit: (input: string) => void;
  isLoading: boolean;
  loadingMessage?: string;
}

export function QuickSongInput({ onSubmit, isLoading, loadingMessage }: QuickSongInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input.trim());
      setInput("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2" dir="rtl">
      <Input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="חפש שיר או הזן לינק..."
        className="w-40 md:w-52 h-8 text-sm text-right bg-secondary/50 border-border/50"
        dir="rtl"
        disabled={isLoading}
      />
      <Button
        type="submit"
        size="sm"
        className="h-8 px-3"
        disabled={!input.trim() || isLoading}
      >
        {isLoading ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingMessage && <span className="text-xs">{loadingMessage}</span>}
          </span>
        ) : (
          "הצג"
        )}
      </Button>
    </form>
  );
}
