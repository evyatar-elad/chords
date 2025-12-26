import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export function AutoScrollControl() {
  const [isScrolling, setIsScrolling] = useState(false);
  const [speed, setSpeed] = useState(30); // pixels per second
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const scroll = useCallback((currentTime: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = currentTime;
    }

    const deltaTime = (currentTime - lastTimeRef.current) / 1000;
    lastTimeRef.current = currentTime;

    const scrollAmount = speed * deltaTime;
    window.scrollBy(0, scrollAmount);

    // Check if we've reached the bottom
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      setIsScrolling(false);
      return;
    }

    animationRef.current = requestAnimationFrame(scroll);
  }, [speed]);

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

  return (
    <div className="flex items-center gap-3">
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
      
      <div className="w-24">
        <Slider
          value={[speed]}
          onValueChange={([newSpeed]) => setSpeed(newSpeed)}
          min={10}
          max={100}
          step={5}
          className="cursor-pointer"
          aria-label="מהירות גלילה"
        />
      </div>
    </div>
  );
}
