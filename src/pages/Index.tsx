import { useState, useRef } from "react";
import { Guitar, ArrowRight } from "lucide-react";
import { SongInput } from "@/components/SongInput";
import { SongDisplay } from "@/components/SongDisplay";
import { FloatingToolbar } from "@/components/FloatingToolbar";
import { Button } from "@/components/ui/button";
import { scrapeSong, SongData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [song, setSong] = useState<SongData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [transposition, setTransposition] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleSubmit = async (url: string) => {
    setIsLoading(true);
    setSong(null);
    setTransposition(0);

    try {
      const response = await scrapeSong(url);

      if (response.success && response.data) {
        setSong(response.data);
        // Apply initial transposition from the ton parameter if exists
        if (response.data.transposition !== 0) {
          setTransposition(response.data.transposition);
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
  };

  return (
    <div className="min-h-screen bg-gradient-dark">
      {!song ? (
        // Landing / Input View
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
              <Guitar className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Tab4U Viewer
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              צפה באקורדים ומילים בעיצוב נקי ומודרני,
              <br />
              עם כלי טרנספוזיציה בזמן אמת
            </p>
          </div>

          <SongInput onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
      ) : (
        // Song View
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-40 glass">
            <div className="container max-w-4xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowRight className="h-4 w-4 ml-2" />
                  חזור
                </Button>
                
                <div className="text-center flex-1">
                  <h1 className="text-xl font-bold text-foreground truncate">
                    {song.title}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {song.artist}
                  </p>
                </div>
                
                <div className="w-[72px]" /> {/* Spacer for balance */}
              </div>
            </div>
          </header>

          {/* Song Content */}
          <main 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto pb-24"
          >
            <div className="container max-w-4xl mx-auto px-4 py-6">
              <SongDisplay
                content={song.content}
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
            scrollContainerRef={scrollContainerRef}
          />
        </div>
      )}
    </div>
  );
};

export default Index;
