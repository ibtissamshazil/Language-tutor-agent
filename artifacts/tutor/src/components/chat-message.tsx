import { OpenaiMessage } from "@workspace/api-client-react";
import { parseTaughtTerms, type LanguageDef } from "@workspace/languages";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { User, Sparkles } from "lucide-react";

export function ChatMessage({
  message,
  language,
}: {
  message: OpenaiMessage;
  language: LanguageDef;
}) {
  const isUser = message.role === "user";

  // Render the assistant's reply, turning each [[native|translit|english]]
  // taught-term markup block into a styled vocabulary chip in the target
  // language's font and direction. Everything outside the markup is plain text.
  const renderContent = (text: string) => {
    const terms = parseTaughtTerms(text);
    if (terms.length === 0) return text;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    terms.forEach((term, i) => {
      if (term.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>{text.slice(lastIndex, term.index)}</span>,
        );
      }

      parts.push(
        <span
          key={`term-${i}`}
          className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 align-baseline mx-0.5 rounded-md bg-primary/10 px-2 py-0.5"
        >
          <span
            className={cn("text-lg leading-snug text-primary", language.fontClass)}
            dir={language.direction}
          >
            {term.native}
          </span>
          {term.transliteration && (
            <span className="text-sm italic text-foreground/70">
              {term.transliteration}
            </span>
          )}
          {term.english && (
            <span className="text-sm text-muted-foreground">— {term.english}</span>
          )}
        </span>,
      );

      lastIndex = term.index + term.raw.length;
    });

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
          <div className="whitespace-pre-wrap break-words">
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
