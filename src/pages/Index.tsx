import { useState, useEffect, useCallback } from "react";
import { Guitar, ChevronLeft, ChevronRight, Maximize, Minimize, ChevronUp, ChevronDown } from "lucide-react";
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
  const [fontSize, setFontSize] = useState(14); // Smaller initial size for mobile columns
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [headerManuallyHidden, setHeaderManuallyHidden] = useState(false);
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

  // Toggle header visibility manually
  const toggleHeaderVisibility = () => {
    setHeaderManuallyHidden(!headerManuallyHidden);
    if (!headerManuallyHidden) {
      setHeaderVisible(false);
    } else {
      setHeaderVisible(true);
    }
  };

  // Exit fullscreen when focusing on search (for keyboard access)
  const handleSearchFocus = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error("Error exiting fullscreen:", err);
      }
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

  // Auto-fullscreen removed - user preference

  // Auto-hide header on scroll (only if not manually controlled)
  useEffect(() => {
    if (!song || headerManuallyHidden) return;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target || target.scrollTop === undefined) return;

      const currentScrollY = target.scrollTop;

      if (currentScrollY <= 10) {
        setHeaderVisible(true);
      } else if (currentScrollY > lastScrollY) {
        setHeaderVisible(false);
      } else if (lastScrollY - currentScrollY > 5) {
        setHeaderVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll, { passive: true });
      return () => mainElement.removeEventListener('scroll', handleScroll);
    }
  }, [song, lastScrollY, headerManuallyHidden]);

  // Swipe gestures for page navigation (mobile only)
  useEffect(() => {
    if (!song || window.innerWidth >= 900) return;

    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };

    const handleSwipe = () => {
      const swipeThreshold = 50;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
          // Swiped left (next page in RTL)
          goToPrevPage();
        } else {
          // Swiped right (previous page in RTL)
          goToNextPage();
        }
      }
    };

    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.addEventListener('touchstart', handleTouchStart, { passive: true });
      mainElement.addEventListener('touchend', handleTouchEnd, { passive: true });
      return () => {
        mainElement.removeEventListener('touchstart', handleTouchStart);
        mainElement.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [song, goToNextPage, goToPrevPage]);

  return (
    <div className="min-h-screen bg-gradient-dark" dir="rtl">
      {/* Header with auto-hide */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 glass transition-transform duration-300 ${
          headerVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
        ref={(node) => {
          if (!node) return;
          const h = headerVisible ? (node.offsetHeight || 56) : 0;
          node.closest<HTMLElement>("[dir=rtl]")?.style.setProperty("--header-h", `${h}px`);
        }}
      >
        <div className="container max-w-6xl mx-auto px-3 py-2 landscape:px-1 landscape:py-1">
          {/* Mobile Layout - portrait OR landscape mobile (height < 701px) */}
          <div className="block portrait:block desktop:hidden">
            {/* Portrait - 3 rows */}
            <div className="portrait:block landscape:hidden">
              {/* Row 1: Back/Logo + Title */}
              <div className="flex items-center gap-2 mb-1.5">
                {song ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    className="text-muted-foreground hover:text-foreground shrink-0 h-8 px-2"
                  >
                    חזור
                  </Button>
                ) : (
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 shrink-0">
                    <Guitar className="w-4 h-4 text-primary" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h1 className="text-base font-bold text-foreground truncate">
                    {song ? song.title : "האקורדים של אביתר"}
                  </h1>
                  {song && (
                    <p className="text-xs text-muted-foreground truncate">
                      {song.artist}
                    </p>
                  )}
                </div>
              </div>

              {/* Row 2: Search + Hide/Show + Fullscreen */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="flex-1 min-w-0">
                  <QuickSongInput onSubmit={handleSubmit} isLoading={isLoading} loadingMessage={loadingMessage} onFocus={handleSearchFocus} />
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleHeaderVisibility}
                  className="shrink-0 h-8 w-8"
                  title={headerVisible ? "הסתר תפריט" : "הצג תפריט"}
                >
                  <ChevronRight className={`h-4 w-4 transition-transform ${headerVisible ? 'rotate-[-90deg]' : 'rotate-90'}`} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="shrink-0 h-8 w-8"
                  title={isFullscreen ? "צא ממסך מלא" : "מסך מלא"}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </div>

              {/* Row 3: Controls (only when song loaded) */}
              {song && (
                <div className="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTransposition(transposition + 1)}
                    className="shrink-0 h-7 w-7"
                    title="העלה טון"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>

                  <span className="text-xs font-mono tabular-nums text-foreground px-1.5 min-w-[2rem] text-center">
                    {transposition > 0 ? `+${transposition}` : transposition}
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTransposition(transposition - 1)}
                    className="shrink-0 h-7 w-7"
                    title="הורד טון"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>

                  <div className="w-px h-5 bg-border mx-1" />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFontSize(fontSize + 1)}
                    className="shrink-0 h-7 px-2"
                    title="הגדל טקסט"
                  >
                    <span className="text-xs font-bold">A+</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFontSize(fontSize - 1)}
                    className="shrink-0 h-7 px-2"
                    title="הקטן טקסט"
                  >
                    <span className="text-xs">A-</span>
                  </Button>

                  <div className="w-px h-5 bg-border mx-1" />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetToOriginal}
                    disabled={transposition === originalTransposition}
                    className="shrink-0 h-7 px-2 text-xs"
                    title={transposition === originalTransposition ? "כבר בגרסה קלה" : "אפס לסולם המקורי"}
                  >
                    גרסה קלה
                  </Button>
                </div>
              )}
            </div>

            {/* Landscape - organized row (mobile only: height < 701px) */}
            <div className="hidden landscape-mobile:flex items-center gap-1">
              {/* Right side (RTL start): Back + Controls OR empty when no song */}
              <div className="flex items-center gap-1">
                {song && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleBack}
                      className="shrink-0 h-6 w-6"
                      title="חזור"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setTransposition(transposition + 1)}
                      className="shrink-0 h-6 w-6"
                      title="העלה טון"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>

                    <span className="text-xs font-mono tabular-nums text-foreground px-1 min-w-[1.5rem] text-center">
                      {transposition > 0 ? `+${transposition}` : transposition}
                    </span>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setTransposition(transposition - 1)}
                      className="shrink-0 h-6 w-6"
                      title="הורד טון"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFontSize(fontSize + 1)}
                      className="shrink-0 h-6 w-6"
                      title="הגדל טקסט"
                    >
                      <span className="text-xs font-bold">A+</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFontSize(fontSize - 1)}
                      className="shrink-0 h-6 w-6"
                      title="הקטן טקסט"
                    >
                      <span className="text-xs">A-</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetToOriginal}
                      disabled={transposition === originalTransposition}
                      className="shrink-0 h-6 px-1.5 text-[10px]"
                      title={transposition === originalTransposition ? "כבר בגרסה קלה" : "אפס לסולם המקורי"}
                    >
                      גרסה קלה
                    </Button>
                  </>
                )}
              </div>

              {/* Center: Song name and artist */}
              {song && (
                <div className="flex-1 min-w-0 text-center px-2">
                  <div className="text-xs font-bold text-foreground truncate">
                    {song.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {song.artist}
                  </div>
                </div>
              )}

              {/* Left side (RTL end): Search + Hide/Show + Fullscreen */}
              <div className="flex items-center gap-1">
                <div className="min-w-0 w-[200px]">
                  <QuickSongInput onSubmit={handleSubmit} isLoading={isLoading} loadingMessage={loadingMessage} onFocus={handleSearchFocus} />
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleHeaderVisibility}
                  className="shrink-0 h-6 w-6"
                  title={headerVisible ? "הסתר תפריט" : "הצג תפריט"}
                >
                  <ChevronRight className={`h-3 w-3 transition-transform ${headerVisible ? 'rotate-[-90deg]' : 'rotate-90'}`} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="shrink-0 h-6 w-6"
                  title={isFullscreen ? "צא ממסך מלא" : "מסך מלא"}
                >
                  {isFullscreen ? <Minimize className="h-3 w-3" /> : <Maximize className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Desktop Layout - show only on landscape with height >= 701px */}
          <div className="hidden desktop:flex items-center gap-3">
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

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="shrink-0 h-9 w-9"
              title={isFullscreen ? "צא ממסך מלא" : "מסך מלא"}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Fixed navigation at bottom-left - mobile only */}
      {song && totalPages > 1 && (
        <div className="short-screen:block tall-screen:hidden fixed bottom-4 left-4 z-[9999] pointer-events-auto">
          <div className="flex items-center gap-1 bg-secondary/95 backdrop-blur-sm border border-border rounded-full px-2 py-1.5 shadow-lg pointer-events-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPrevPage}
              disabled={currentPage === 0}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono tabular-nums text-foreground px-2 min-w-[3rem] text-center">
              {currentPage + 1}/{totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextPage}
              disabled={currentPage >= totalPages - 1}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Fixed header toggle at top-left - only when header is hidden */}
      {!headerVisible && (
        <div className="short-screen:block tall-screen:hidden fixed top-4 left-4 z-[9999]">
          <button
            onClick={toggleHeaderVisibility}
            className="bg-secondary/95 backdrop-blur-sm border border-border rounded-full p-2.5 shadow-lg active:scale-95 transition-all"
            aria-label="הצג תפריט"
          >
            <ChevronRight className="h-5 w-5 text-foreground rotate-90" />
          </button>
        </div>
      )}

      {/* Fixed page indicator - desktop only */}
      {song && totalPages > 1 && (
        <div
          className="hidden md:block fixed bottom-4 left-4 z-50 bg-secondary/90 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 text-xs font-mono tabular-nums text-muted-foreground pointer-events-none"
          style={{ direction: 'ltr' }}
        >
          {currentPage + 1} / {totalPages}
        </div>
      )}

      {/* Main content */}
      <main className="min-h-screen transition-[padding-top] duration-300" style={{ paddingTop: `var(--header-h, 56px)` }}> 
        {!song ? (
          <div className="min-h-[calc(100dvh-var(--header-h,56px))] flex flex-col items-center justify-center px-4 py-12">
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
          <div className="h-[calc(100dvh-var(--header-h,56px))] flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden relative">
              <div className="h-full container max-w-6xl mx-auto px-4 pt-4 pb-20 md:pb-1 landscape:px-0.5 landscape:pt-2 landscape:pb-1 overflow-hidden">
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