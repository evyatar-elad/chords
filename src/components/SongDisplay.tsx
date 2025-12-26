import { useMemo } from "react";
import { transposeChord } from "@/lib/transposition";

interface SongDisplayProps {
  content: string;
  transposition: number;
  fontSize: number;
}

export function SongDisplay({ content, transposition, fontSize }: SongDisplayProps) {
  // Process the content to render chords with proper styling
  const processedContent = useMemo(() => {
    const lines = content.split('\n');
    
    return lines.map((line, lineIndex) => {
      const elements: React.ReactNode[] = [];
      let lastIndex = 0;
      
      // Find all chords in [CHORD] format
      const chordRegex = /\[([^\]]+)\]/g;
      let match;
      
      while ((match = chordRegex.exec(line)) !== null) {
        // Add text before this chord
        if (match.index > lastIndex) {
          elements.push(
            <span key={`text-${lineIndex}-${lastIndex}`}>
              {line.slice(lastIndex, match.index)}
            </span>
          );
        }
        
        // Transpose and add the chord
        const originalChord = match[1];
        const transposedChord = transposeChord(originalChord, transposition);
        
        elements.push(
          <span key={`chord-${lineIndex}-${match.index}`} className="chord">
            {transposedChord}
          </span>
        );
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text
      if (lastIndex < line.length) {
        elements.push(
          <span key={`text-${lineIndex}-${lastIndex}`}>
            {line.slice(lastIndex)}
          </span>
        );
      }
      
      // Return the line with all elements
      return (
        <div key={`line-${lineIndex}`} className="min-h-[1.8em]">
          {elements.length > 0 ? elements : '\u00A0'}
        </div>
      );
    });
  }, [content, transposition]);

  return (
    <div 
      className="lyrics-text"
      style={{ fontSize: `${fontSize}px` }}
    >
      {processedContent}
    </div>
  );
}
