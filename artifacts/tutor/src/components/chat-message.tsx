import { OpenaiMessage } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { User, Sparkles } from "lucide-react";

export function ChatMessage({ message }: { message: OpenaiMessage }) {
  const isUser = message.role === "user";
  
  // Basic heuristic to detect Urdu characters and wrap them
  const renderContent = (text: string) => {
    // Regex for Arabic/Urdu unicode blocks. Consecutive Urdu words separated by
    // spaces are grouped into a single run so they render as one continuous
    // sentence (e.g. "میں انگلش بولتا ہوں") instead of one word per line.
    const urduRegex =
      /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF](?:[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF \t]*[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])?/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = urduRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
      }
      parts.push(
        <span 
          key={`urdu-${match.index}`} 
          className="font-urdu text-xl leading-loose inline-block my-1 text-primary mr-1"
          dir="rtl"
        >
          {match[0]}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }

    return parts;
  };

  return (
    <div className={cn(
      "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300", 
      isUser ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "flex max-w-[85%] sm:max-w-[75%] gap-3 sm:gap-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}>
        <Avatar className={cn(
          "h-8 w-8 shrink-0 mt-1 flex items-center justify-center border",
          isUser ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-secondary-foreground border-secondary"
        )}>
          {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </Avatar>
        
        <div className={cn(
          "rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed shadow-sm",
          isUser 
            ? "bg-primary text-primary-foreground rounded-tr-sm" 
            : "bg-card text-card-foreground border border-card-border rounded-tl-sm"
        )}>
          <div className={cn(
            "whitespace-pre-wrap break-words",
            !isUser && "[&>span.font-urdu]:block [&>span.font-urdu]:text-right [&>span.font-urdu]:w-full [&>span.font-urdu]:text-2xl [&>span.font-urdu]:mt-3 [&>span.font-urdu]:mb-1"
          )}>
            {message.content ? renderContent(message.content) : (
              <div className="flex gap-1 h-5 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}