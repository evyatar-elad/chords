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
    const result: React.ReactNode[] = [];
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      // Check if this line contains chords
      const hasChords = line.includes('[');
      
      if (hasChords) {
        // This is a chord line - extract and display chords
        const chordElements: React.ReactNode[] = [];
        let lastIndex = 0;
        const chordRegex = /\[([^\]]+)\]/g;
        let match;
        
        while ((match = chordRegex.exec(line)) !== null) {
          // Add spacing before this chord
          if (match.index > lastIndex) {
            const spacing = line.slice(lastIndex, match.index);
            chordElements.push(
              <span key={`space-${lineIndex}-${lastIndex}`}>
                {spacing}
              </span>
            );
          }
          
          // Transpose and add the chord
          const originalChord = match[1];
          const transposedChord = transposeChord(originalChord, transposition);
          
          chordElements.push(
            <span key={`chord-${lineIndex}-${match.index}`} className="chord">
              {transposedChord}
            </span>
          );
          
          lastIndex = match.index + match[0].length;
        }
        
        // Add remaining content after last chord
        if (lastIndex < line.length) {
          chordElements.push(
            <span key={`end-${lineIndex}`}>
              {line.slice(lastIndex)}
            </span>
          );
        }
        
        result.push(
          <div key={`chordline-${lineIndex}`} className="chord-line min-h-[1.5em]">
            {chordElements.length > 0 ? chordElements : '\u00A0'}
          </div>
        );
      } else {
        // This is a lyrics line or section header
        const trimmedLine = line.trim();
        
        // Check if it's a section header (like "פתיחה:", "פזמון:", etc.)
        const isSectionHeader = /^[א-ת]+:$/.test(trimmedLine);
        
        result.push(
          <div 
            key={`lyrics-${lineIndex}`} 
            className={`min-h-[1.5em] ${isSectionHeader ? 'font-semibold text-muted-foreground mt-4' : ''}`}
          >
            {trimmedLine || '\u00A0'}
          </div>
        );
      }
    }
    
    return result;
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
