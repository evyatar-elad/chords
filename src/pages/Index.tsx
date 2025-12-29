import { useState, useEffect, useCallback } from "react";
import { Guitar, ChevronLeft, ChevronRight, Maximize, Minimize } from "lucide-react";
import { SongInput } from "@/components/SongInput";
import { SongDisplayPaged } from "@/components/SongDisplayPaged";
import { FloatingToolbar } from "@/components/FloatingToolbar";
import { QuickSongInput } from "@/components/QuickSongInput";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { scrapeSong, searchSong, SongData } from "@/lib/api";

const Index = () => {
  const { toast } = useToast();
  const [song, setSong] = useState<SongData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [transposition, setTransposition] = useState(0);
  const [originalTransposition, setOriginalTransposition] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [debugPagination, setDebugPagination] = useState(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("debug");
    if (fromQuery === "1") return true;
    return localStorage.getItem("debugPagination") === "1";
  });

  const handleSubmit = async (input: string) => {
    setIsLoading(true);
    setSong(null);
    setTransposition(0);
    setOriginalTransposition(0);
    setCurrentPage(0);
    setLoadingMessage("");

    try {
      let urlToScrape = input;

      // Detect if input is a URL or search text
      const isUrl = input.startsWith('http://') || input.startsWith('https://') || input.includes('tab4u.com');

      if (!isUrl) {
        // It's a search query - search first
        setLoadingMessage("מחפש...");
        const searchResponse = await searchSong(input);

        if (searchResponse.error || !searchResponse.url) {
          toast({
            title: "לא נמצא שיר מתאים",
            description: searchResponse.message || "נסה לדייק את שם השיר או להזין לינק ישיר",
            variant: "destructive",
          });
          setIsLoading(false);
          setLoadingMessage("");
          return;
        }

        urlToScrape = searchResponse.url;
      }

      // Now scrape the song
      setLoadingMessage("טוען שיר...");
      const response = await scrapeSong(urlToScrape);

      if (response.success && response.data) {
        setSong(response.data);
        if (response.data.transposition !== 0) {
          setTransposition(response.data.transposition);
          setOriginalTransposition(response.data.transposition);
        }
      } else {
        toast({
          title: "שגיאה בטעינת השיר",
          description: response.error || "אנא נסה שנית",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching song:", error);
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה בטעינת השיר",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
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

  // Handle keyboard navigation (+ debug toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goToNextPage();
      } else if (e.key === "ArrowRight") {
        goToPrevPage();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        setDebugPagination((v) => {
          const next = !v;
          localStorage.setItem("debugPagination", next ? "1" : "0");
          return next;
        });
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

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Auto-hide header on scroll
  useEffect(() => {
    if (!song) return; // Only when displaying song

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target || target.scrollTop === undefined) return;

      const currentScrollY = target.scrollTop;

      if (currentScrollY <= 10) {
        // At top - always show header
        setHeaderVisible(true);
      } else if (currentScrollY > lastScrollY) {
        // Scrolling down - hide header
        setHeaderVisible(false);
      } else if (lastScrollY - currentScrollY > 5) {
        // Scrolling up - show header
        setHeaderVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    // Listen to scroll on main content
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll, { passive: true });
      return () => mainElement.removeEventListener('scroll', handleScroll);
    }
  }, [song, lastScrollY]);

  return (
    <div className="min-h-screen bg-gradient-dark" dir="rtl">
      {/* Header with auto-hide */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 glass transition-transform duration-300 ${
          headerVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
        ref={(node) => {
          if (!node) return;
          const h = node.offsetHeight || 56;
          node.closest<HTMLElement>("[dir=rtl]")?.style.setProperty("--header-h", `${h}px`);
        }}
      >
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
                {song ? song.title : "האקורדים של אביתר3"}
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
                debug={debugPagination}
                onDebugToggle={() => {
                  setDebugPagination((v) => {
                    const next = !v;
                    localStorage.setItem("debugPagination", next ? "1" : "0");
                    return next;
                  });
                }}
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
              <QuickSongInput onSubmit={handleSubmit} isLoading={isLoading} loadingMessage={loadingMessage} />
            </div>

            {song && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="shrink-0 h-9 w-9"
                title={isFullscreen ? "צא ממסך מלא" : "מסך מלא"}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Fixed page indicator - always visible */}
      {song && totalPages > 1 && (
        <div
          className="fixed bottom-4 left-4 z-50 bg-secondary/90 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 text-xs font-mono tabular-nums text-muted-foreground pointer-events-none"
          style={{ direction: 'ltr' }}
        >
          {currentPage + 1} / {totalPages}
        </div>
      )}

      {/* Main content */}
      <main className="min-h-screen pt-[var(--header-h,56px)]"> 
        {!song ? (
          <div className="min-h-[calc(100dvh-var(--header-h,56px))] flex flex-col items-center justify-center px-4 py-12">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
                <Guitar className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                האקורדים של אביתר3
              </h2>
              <p className="text-lg text-muted-foreground max-w-md mx-auto">
                שירים בגרסאות קלות ועוד
              </p>
            </div>
          </div>
        ) : (
          <div className="h-[calc(100dvh-var(--header-h,56px))] flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden relative">
              <div className="h-full container max-w-6xl mx-auto px-4 pt-2 pb-1 overflow-hidden">
                <SongDisplayPaged
                  lines={song.lines}
                  transposition={transposition}
                  fontSize={fontSize}
                  currentPage={currentPage}
                  onTotalPagesChange={setTotalPages}
                  debug={debugPagination}
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