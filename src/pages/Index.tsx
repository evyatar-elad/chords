import { useState, useEffect, useCallback } from "react";
import { Guitar, ChevronLeft, ChevronRight } from "lucide-react";
import { SongInput } from "@/components/SongInput";
import { SongDisplayPaged } from "@/components/SongDisplayPaged";
import { FloatingToolbar } from "@/components/FloatingToolbar";
import { QuickSongInput } from "@/components/QuickSongInput";
import { Button } from "@/components/ui/button";
import { scrapeSong, SongData } from "@/lib/api";

const Index = () => {
  const [song, setSong] = useState<SongData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [transposition, setTransposition] = useState(0);
  const [originalTransposition, setOriginalTransposition] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const handleSubmit = async (url: string) => {
    setIsLoading(true);
    setSong(null);
    setTransposition(0);
    setOriginalTransposition(0);
    setCurrentPage(0);

    try {
      const response = await scrapeSong(url);

      if (response.success && response.data) {
        setSong(response.data);
        if (response.data.transposition !== 0) {
          setTransposition(response.data.transposition);
          setOriginalTransposition(response.data.transposition);
        }
      }
    } catch (error) {
      console.error("Error fetching song:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, totalPages]);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goToNextPage();
      } else if (e.key === "ArrowRight") {
        goToPrevPage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNextPage, goToPrevPage]);

  const handleBack = () => {
    setSong(null);
    setTransposition(0);
    setOriginalTransposition(0);
  };

  const handleResetToOriginal = () => {
    setTransposition(originalTransposition);
  };

  return (
    <div className="min-h-screen bg-gradient-dark" dir="rtl">
      {/* Header always visible */}
      <header className="sticky top-0 z-40 glass">
        <div className="container max-w-6xl mx-auto px-4 py-2">
          <div className="flex items-center gap-3">
            {song ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                חזור
              </Button>
            ) : (
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 shrink-0">
                <Guitar className="w-5 h-5 text-primary" />
              </div>
            )}

            <div className="flex-1 min-w-0 text-center">
              <h1 className="text-lg font-bold text-foreground truncate">
                {song ? song.title : "האקורדים של אביתר"}
              </h1>
              <p className="text-sm text-muted-foreground truncate">
                {song ? song.artist : "שירים בגרסאות קלות ועוד"}
              </p>
            </div>

            <div className="shrink-0">
              <FloatingToolbar
                transposition={transposition}
                onTranspositionChange={setTransposition}
                fontSize={fontSize}
                onFontSizeChange={setFontSize}
                originalTransposition={originalTransposition}
                onResetToOriginal={handleResetToOriginal}
              />
            </div>

            <div
              className={`shrink-0 flex items-center gap-1 bg-secondary/50 rounded-full px-2 py-1 ${
                !song || totalPages <= 1 ? "opacity-50" : ""
              }`}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrevPage}
                disabled={!song || currentPage === 0 || totalPages <= 1}
                className="h-7 w-7"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-1 tabular-nums">
                {song ? `${currentPage + 1} / ${totalPages}` : "—"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextPage}
                disabled={!song || currentPage >= totalPages - 1 || totalPages <= 1}
                className="h-7 w-7"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            <div className="shrink-0">
              <QuickSongInput onSubmit={handleSubmit} isLoading={isLoading} />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="min-h-[calc(100vh-56px)]">
        {!song ? (
          <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-4 py-12">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
                <Guitar className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                האקורדים של אביתר
              </h2>
              <p className="text-lg text-muted-foreground max-w-md mx-auto">
                שירים בגרסאות קלות ועוד
              </p>
            </div>
          </div>
        ) : (
          <div className="h-[calc(100vh-56px)] flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden relative">
              <div className="h-full container max-w-6xl mx-auto px-4 pt-2 pb-1">
                <SongDisplayPaged
                  lines={song.lines}
                  transposition={transposition}
                  fontSize={fontSize}
                  currentPage={currentPage}
                  onTotalPagesChange={setTotalPages}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;