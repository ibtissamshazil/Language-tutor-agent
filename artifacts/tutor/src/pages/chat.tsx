import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useChat } from "@/hooks/use-chat";
import { ChatMessage } from "@/components/chat-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ChatPage() {
  const [, params] = useRoute("/chat/:id");
  const [, setLocation] = useLocation();
  const isNewChat = !params?.id;
  const conversationId = isNewChat ? undefined : parseInt(params!.id);

  const { messages, isStreaming, sendMessage, isLoading, error } = useChat(conversationId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    
    const content = input;
    setInput("");
    sendMessage(content, (newId) => {
      setLocation(`/chat/${newId}`, { replace: true });
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 scroll-smooth"
      >
        {messages.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Aap kaise hain?</h2>
            <p className="text-muted-foreground text-lg">
              Start a conversation in English. Your tutor will teach you Urdu naturally as you chat. Try saying "Hello" or "Teach me how to order tea".
            </p>
          </div>
        )}
        
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {error && (
          <div className="mx-auto max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 bg-background/80 backdrop-blur-sm border-t border-border shrink-0">
        <form 
          onSubmit={handleSubmit}
          className="relative max-w-4xl mx-auto flex items-end gap-2"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="min-h-[56px] w-full resize-none rounded-2xl pr-12 py-4 bg-card shadow-sm border-card-border focus-visible:ring-primary text-base"
            rows={1}
            disabled={isStreaming}
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!input.trim() || isStreaming}
            className="absolute right-2 bottom-2 h-10 w-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <SendHorizontal className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}