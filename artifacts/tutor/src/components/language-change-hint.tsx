import { useState } from "react";
import {
  useCreateOpenaiConversation,
  getListOpenaiConversationsQueryKey,
} from "@workspace/api-client-react";
import { getLanguage } from "@workspace/languages";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LanguageSelect } from "@/components/language-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Languages } from "lucide-react";

// Persisted flag: once the learner ticks "don't show again" and dismisses, the
// hint stays hidden across sessions.
const HIDE_STORAGE_KEY = "tutor.hideLanguageHint";

function isHiddenForever(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(HIDE_STORAGE_KEY) === "true";
}

// A dismissible nudge shown a couple of turns into a conversation. Switching the
// language here does NOT change this chat — it starts a brand-new conversation in
// the chosen language (carrying over the current level) and navigates to it, so
// this chat keeps its original language.
export function LanguageChangeHint({
  userMessageCount,
  currentLanguage,
  currentLevel,
}: {
  userMessageCount: number;
  currentLanguage: string;
  currentLevel?: string;
}) {
  const [dismissed, setDismissed] = useState(isHiddenForever);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const queryClient = useQueryClient();
  const createConversation = useCreateOpenaiConversation();
  const [, setLocation] = useLocation();

  // Only surface the hint after the student has sent a couple of messages.
  if (dismissed || userMessageCount < 2) return null;

  const handleChange = (code: string) => {
    if (code === currentLanguage || createConversation.isPending) return;
    const { name } = getLanguage(code);
    createConversation.mutate(
      {
        data: {
          title: `New ${name} chat`,
          language: code,
          level: currentLevel,
        },
      },
      {
        onSuccess: (conversation) => {
          queryClient.invalidateQueries({
            queryKey: getListOpenaiConversationsQueryKey(),
          });
          setDismissed(true);
          setLocation(`/chat/${conversation.id}`);
        },
      },
    );
  };

  const handleDismiss = () => {
    if (dontShowAgain && typeof window !== "undefined") {
      window.localStorage.setItem(HIDE_STORAGE_KEY, "true");
    }
    setDismissed(true);
  };

  return (
    <div className="shrink-0 border-b border-border bg-accent/40 px-4 sm:px-6 lg:px-8 py-2.5">
      <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-2">
        <Languages className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm text-foreground flex-1 min-w-[12rem]">
          Learning {getLanguage(currentLanguage).name} in this chat. Switch to start a new chat?
        </span>
        <LanguageSelect
          value={currentLanguage}
          onChange={handleChange}
          aria-label="Start a new chat in another language"
          className="h-8 w-44 text-sm"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-full sm:w-auto sm:basis-full sm:justify-end">
          <Checkbox
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            aria-label="Don't show this again"
          />
          Don't show this again
        </label>
      </div>
    </div>
  );
}
