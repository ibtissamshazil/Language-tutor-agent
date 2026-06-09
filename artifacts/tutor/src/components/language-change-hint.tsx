import { useState } from "react";
import {
  useUpdateOpenaiConversation,
  getGetOpenaiConversationQueryKey,
  getListOpenaiConversationsQueryKey,
  getGetProgressTodayQueryKey,
} from "@workspace/api-client-react";
import { getLanguage } from "@workspace/languages";
import { useQueryClient } from "@tanstack/react-query";
import { LanguageSelect } from "@/components/language-select";
import { Button } from "@/components/ui/button";
import { X, Languages } from "lucide-react";

// A dismissible nudge shown a couple of turns into a conversation, letting the
// student switch the language this conversation is taught in (via PATCH). Once
// dismissed it stays hidden for the life of the component.
export function LanguageChangeHint({
  conversationId,
  userMessageCount,
  currentLanguage,
}: {
  conversationId: number;
  userMessageCount: number;
  currentLanguage: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const queryClient = useQueryClient();
  const updateConversation = useUpdateOpenaiConversation();

  // Only surface the hint after the student has sent a couple of messages.
  if (dismissed || userMessageCount < 2) return null;

  const handleChange = (code: string) => {
    if (code === currentLanguage) return;
    updateConversation.mutate(
      { id: conversationId, data: { language: code } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetOpenaiConversationQueryKey(conversationId),
          });
          queryClient.invalidateQueries({
            queryKey: getListOpenaiConversationsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetProgressTodayQueryKey(),
          });
          setDismissed(true);
        },
      },
    );
  };

  return (
    <div className="shrink-0 border-b border-border bg-accent/40 px-4 sm:px-6 lg:px-8 py-2.5">
      <div className="max-w-4xl mx-auto flex items-center gap-3">
        <Languages className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm text-foreground flex-1">
          Learning {getLanguage(currentLanguage).name} in this chat. Want to switch?
        </span>
        <LanguageSelect
          value={currentLanguage}
          onChange={handleChange}
          aria-label="Change this conversation's language"
          className="h-8 w-44 text-sm"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
