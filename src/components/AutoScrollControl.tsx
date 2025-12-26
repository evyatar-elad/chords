import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AutoScrollControl() {
  const [isScrolling, setIsScrolling] = useState(false);
  const [speed, setSpeed] = useState(50); // Base speed, adjustable with +/-
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Map speed value to pixels per second (30-120 range for comfortable reading)
  const getPixelsPerSecond = useCallback((speedValue: number) => {
    return 30 + (speedValue / 100) * 90;
  }, []);

  const scroll = useCallback((currentTime: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = currentTime;
    }

    const deltaTime = (currentTime - lastTimeRef.current) / 1000;
    lastTimeRef.current = currentTime;

    const pixelsPerSecond = getPixelsPerSecond(speed);
    const scrollAmount = pixelsPerSecond * deltaTime;
    
    window.scrollBy({ top: scrollAmount, behavior: 'instant' });

    // Check if we've reached the bottom
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      setIsScrolling(false);
      return;
    }

    animationRef.current = requestAnimationFrame(scroll);
  }, [speed, getPixelsPerSecond]);

  useEffect(() => {
    if (isScrolling) {
      lastTimeRef.current = 0;
      animationRef.current = requestAnimationFrame(scroll);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isScrolling, scroll]);

  const toggleScroll = () => {
    setIsScrolling(!isScrolling);
  };

  const increaseSpeed = () => {
    setSpeed(prev => Math.min(100, prev + 15));
  };

  const decreaseSpeed = () => {
    setSpeed(prev => Math.max(0, prev - 15));
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleScroll}
        className={`h-8 w-8 ${
          isScrolling 
            ? "text-primary bg-primary/10 hover:bg-primary/20" 
            : "text-foreground/70 hover:text-foreground hover:bg-muted"
        }`}
        aria-label={isScrolling ? "עצור גלילה" : "הפעל גלילה"}
      >
        {isScrolling ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      
      {isScrolling && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={decreaseSpeed}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            aria-label="האט"
          >
            <Minus className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={increaseSpeed}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            aria-label="האץ"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  );
}