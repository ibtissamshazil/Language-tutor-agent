import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useChat } from "@/hooks/use-chat";
import { ChatMessage } from "@/components/chat-message";
import { LanguageChangeHint } from "@/components/language-change-hint";
import { ChatErrorNotice } from "@/components/chat-error-notice";
import { ModelSelect, useModelList } from "@/components/model-select";
import { useModelPreference } from "@/hooks/use-model-preference";
import { AUTO_MODEL } from "@/lib/model-preference";
import { useGoalCelebration } from "@/hooks/use-goal-celebration";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal, Sparkles } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { getLanguage } from "@workspace/languages";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const [, params] = useRoute("/chat/:id");
  const [, setLocation] = useLocation();
  const isNewChat = !params?.id;
  const conversationId = isNewChat ? undefined : parseInt(params!.id);

  const { code: activeLanguageCode, level: activeLevel } = useLanguage();
  const { messages, isStreaming, sendMessage, isLoading, error, conversationLanguage, conversationLevel } =
    useChat(conversationId, activeLanguageCode, activeLevel);
  // Existing chats render in their own persisted language; a brand-new chat
  // uses the active global selection.
  const effectiveLanguage = getLanguage(
    isNewChat ? activeLanguageCode : conversationLanguage,
  );
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // The model can be swapped from the chat bar without leaving the
  // conversation: the next reply just comes from the new model, which is
  // handed a compacted recap of what has been taught so far.
  const [model, setModel] = useModelPreference();
  const modelList = useModelList(model);
  const [switchNote, setSwitchNote] = useState<string | null>(null);
  const chooseModel = (value: string) => {
    const previous = model;
    setModel(value);
    if (value === previous || messages.length === 0) return;
    const name =
      value === AUTO_MODEL
        ? "the best available model"
        : (modelList.models.find((m) => m.id === value)?.name ?? value);
    setSwitchNote(`This chat continues with ${name}.`);
  };
  useEffect(() => {
    if (!switchNote) return;
    const timer = setTimeout(() => setSwitchNote(null), 6000);
    return () => clearTimeout(timer);
  }, [switchNote]);
  // The note is about the chat it was shown in; opening another one drops it.
  useEffect(() => {
    setSwitchNote(null);
  }, [conversationId]);

  // Fire confetti + an auto-dismissing toast the moment today's goal is reached.
  useGoalCelebration(effectiveLanguage.code);

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
      {!isNewChat && conversationId !== undefined && conversationLanguage && (
        <LanguageChangeHint
          userMessageCount={messages.filter((m) => m.role === "user").length}
          currentLanguage={conversationLanguage}
          currentLevel={conversationLevel}
        />
      )}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 scroll-smooth"
      >
        {messages.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2
              className={cn("text-3xl font-bold tracking-tight text-foreground", effectiveLanguage.fontClass)}
              dir={effectiveLanguage.direction}
            >
              {effectiveLanguage.greeting}
            </h2>
            <p className="text-muted-foreground text-lg">
              Start a conversation in English. Your tutor will teach you {effectiveLanguage.name} naturally as you chat. Try saying "Hello" or "Teach me how to order food".
            </p>
          </div>
        )}
        
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} language={effectiveLanguage} />
        ))}

        {error && <ChatErrorNotice error={error} />}
      </div>

      <div className="p-4 sm:p-6 bg-background/80 backdrop-blur-sm border-t border-border shrink-0">
        {switchNote && (
          <p className="max-w-4xl mx-auto mb-2 px-1 text-xs text-muted-foreground">
            {switchNote}
          </p>
        )}
        <form
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto flex items-center gap-2 rounded-2xl border border-card-border bg-card px-2 py-1.5 shadow-sm transition-shadow focus-within:ring-1 focus-within:ring-primary"
        >
          <ModelSelect
            value={model}
            onChange={chooseModel}
            models={modelList.models}
            disabled={modelList.locked}
            isLoading={modelList.isLoading}
            compact
          />
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="min-h-[40px] max-h-40 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-base shadow-none focus-visible:ring-0"
            rows={1}
            disabled={isStreaming}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isStreaming}
            className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <SendHorizontal className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}