import { useState } from "react";
import { Guitar } from "lucide-react";
import { SongInput } from "@/components/SongInput";
import { SongDisplay } from "@/components/SongDisplay";
import { FloatingToolbar } from "@/components/FloatingToolbar";
import { QuickSongInput } from "@/components/QuickSongInput";
import { Button } from "@/components/ui/button";
import { scrapeSong, SongData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [song, setSong] = useState<SongData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [transposition, setTransposition] = useState(0);
  const [originalTransposition, setOriginalTransposition] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const { toast } = useToast();

  const handleSubmit = async (url: string) => {
    setIsLoading(true);
    setSong(null);
    setTransposition(0);
    setOriginalTransposition(0);

    try {
      const response = await scrapeSong(url);

      if (response.success && response.data) {
        setSong(response.data);
        // Apply initial transposition from the ton parameter if exists
        if (response.data.transposition !== 0) {
          setTransposition(response.data.transposition);
          setOriginalTransposition(response.data.transposition);
          toast({
            title: "גרסה קלה",
            description: `הטרנספוזיציה הותאמה אוטומטית ל-${response.data.transposition > 0 ? '+' : ''}${response.data.transposition}`,
          });
        }
      } else {
        toast({
          title: "שגיאה",
          description: response.error || "לא הצלחתי לטעון את השיר",
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
    }
  };

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
      {!song ? (
        // Landing / Input View
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
              <Guitar className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              האקורדים של אביתר
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              שירים בגרסאות קלות ועוד
            </p>
          </div>

          <SongInput onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
      ) : (
        // Song View
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-40 glass">
            <div className="container max-w-4xl mx-auto px-4 py-3">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  חזור
                </Button>
                
                <div className="flex-1 text-center min-w-0">
                  <h1 className="text-lg font-bold text-foreground truncate">
                    {song.title}
                  </h1>
                  <p className="text-sm text-muted-foreground truncate">
                    {song.artist}
                  </p>
                </div>

                <div className="shrink-0">
                  <QuickSongInput onSubmit={handleSubmit} isLoading={isLoading} />
                </div>
              </div>
            </div>
          </header>

          {/* Song Content */}
          <main className="flex-1 pb-32">
            <div className="container max-w-4xl mx-auto px-4 py-6">
              <SongDisplay
                lines={song.lines}
                transposition={transposition}
                fontSize={fontSize}
              />
            </div>
          </main>

          {/* Floating Toolbar */}
          <FloatingToolbar
            transposition={transposition}
            onTranspositionChange={setTransposition}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            originalTransposition={originalTransposition}
            onResetToOriginal={handleResetToOriginal}
          />
        </div>
      )}
    </div>
  );
};

export default Index;
