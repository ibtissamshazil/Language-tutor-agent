import React, { useState, useEffect, useRef } from "react";
import { parseSSEStream } from "@/lib/sse";
import { getPreferredModel } from "@/lib/model-preference";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreateOpenaiConversation, 
  getGetOpenaiConversationQueryKey,
  getListOpenaiConversationsQueryKey,
  getGetProgressTodayQueryKey,
  useGetOpenaiConversation,
  OpenaiMessage
} from "@workspace/api-client-react";

/**
 * A send that failed, described well enough for the UI to offer a way out.
 *
 * `code` mirrors the server's error taxonomy (rate_limited, daily_limit,
 * model_unavailable, ...) so the chat view can show the right next step
 * without re-parsing the sentence.
 */
export interface ChatError {
  message: string;
  code?: string;
  retryAfterSeconds?: number;
  suggestModelChange?: boolean;
  retryable?: boolean;
}

/** Carries a ChatError through the try/catch without losing its fields. */
class ChatFailure extends Error {
  readonly detail: ChatError;
  constructor(detail: ChatError) {
    super(detail.message);
    this.detail = detail;
  }
}

export function useChat(
  conversationId?: number,
  newConversationLanguage?: string,
  newConversationLevel?: string,
) {
  const queryClient = useQueryClient();
  const createConversation = useCreateOpenaiConversation();
  
  const { data: conversationData, isLoading: isLoadingConversation } = useGetOpenaiConversation(
    conversationId as number,
    { query: { enabled: !!conversationId, queryKey: getGetOpenaiConversationQueryKey(conversationId as number) } }
  );

  const [messages, setMessages] = useState<OpenaiMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const activeConversationIdRef = useRef<number | undefined>(conversationId);
  // The conversation a reply is streaming into, or undefined when idle. A ref
  // (not state) because the sync effect below has to see it within the same
  // commit that a send starts, not on the next render.
  const streamingConversationIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    activeConversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    // Never let a server snapshot overwrite the conversation being streamed
    // into. Sending the first message of a brand-new chat mounts this query for
    // the first time, and its response can land mid-stream — wiping the
    // optimistic user message and the typing placeholder, so the screen sits
    // empty until the whole reply arrives at once.
    //
    // The guard is scoped to the streaming conversation: navigating to a
    // different chat (or to a new one) while a reply is still arriving must
    // still load that chat, or the previous conversation's messages would
    // linger under it. `isStreaming` is in the deps so the sync runs again the
    // moment streaming ends, even if the refetched data is unchanged.
    const isViewingTheStream =
      streamingConversationIdRef.current !== undefined &&
      streamingConversationIdRef.current === activeConversationIdRef.current;
    if (isViewingTheStream) return;

    if (conversationData?.messages) {
      setMessages(conversationData.messages);
    } else if (!conversationId) {
      setMessages([]);
    }
  }, [conversationData, conversationId, isStreaming]);

  const [error, setError] = useState<ChatError | null>(null);

  // A failure belongs to the conversation it happened in. Leaving the card up
  // after the student navigates elsewhere — especially to a brand-new chat —
  // makes it look like the new chat is already broken.
  useEffect(() => {
    setError(null);
  }, [conversationId]);

  const sendMessage = async (content: string, onNewConversation?: (id: number) => void) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    let targetConversationId = activeConversationIdRef.current;
    setError(null);

    // Optimistically add user message
    const tempUserId = Date.now();
    const tempAssistantId = tempUserId + 1;
    const userMsg: OpenaiMessage = {
      id: tempUserId,
      conversationId: targetConversationId || 0,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);

    // Removes the optimistic user + assistant placeholders so state can
    // reconcile with the server (or be retried) after a failure.
    const rollback = () => {
      setMessages(prev => prev.filter(m => m.id !== tempUserId && m.id !== tempAssistantId));
    };

    try {
      if (!targetConversationId) {
        // Create conversation first
        const title = trimmed.slice(0, 30) + (trimmed.length > 30 ? "..." : "");
        const newConv = await createConversation.mutateAsync({
          data: { title, language: newConversationLanguage, level: newConversationLevel },
        });
        targetConversationId = newConv.id;
        activeConversationIdRef.current = newConv.id;
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        if (onNewConversation) {
          onNewConversation(newConv.id);
        }
      }

      streamingConversationIdRef.current = targetConversationId;
      setIsStreaming(true);

      // Add empty assistant message
      setMessages(prev => [
        ...prev,
        { id: tempAssistantId, conversationId: targetConversationId!, role: "assistant", content: "", createdAt: new Date().toISOString() }
      ]);

      const res = await fetch(`${import.meta.env.BASE_URL}api/openai/conversations/${targetConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, model: getPreferredModel() })
      });

      if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream")) {
        // The request never became a stream: a validation rejection, a missing
        // conversation, or the server being down. Prefer the server's own
        // message over the status code when it sent one.
        const body = await res.json().catch(() => null);
        throw new ChatFailure({
          message:
            typeof body?.error === "string"
              ? body.error
              : res.status >= 500
                ? "The tutor's server isn't responding. Try again in a moment."
                : `The message couldn't be sent (error ${res.status}).`,
          code: "request_failed",
          retryable: res.status >= 500,
        });
      }

      let streamError: ChatError | null = null;
      let truncatedNotice: ChatError | null = null;
      let received = false;
      // The server closes every successful reply with a `done` frame. Without
      // it the connection dropped part-way, and the text on screen may not be
      // the whole reply — or the whole of what was saved.
      let completed = false;
      for await (const chunk of parseSSEStream(res)) {
        if (chunk.error) {
          streamError = {
            message: chunk.error,
            code: chunk.errorCode,
            retryAfterSeconds: chunk.retryAfterSeconds,
            suggestModelChange: Boolean(chunk.suggestModelChange),
            retryable: Boolean(chunk.retryable),
          };
          break;
        }
        if (chunk.content) {
          received = true;
          // Only paint into the view if this conversation is still the one on
          // screen. The reply keeps streaming to the server-side record either
          // way; the user just sees it when they come back to this chat.
          if (activeConversationIdRef.current === targetConversationId) {
            setMessages(prev => prev.map(m =>
              m.id === tempAssistantId ? { ...m, content: m.content + chunk.content } : m
            ));
          }
        }
        if (chunk.done) {
          completed = true;
          // The reply arrived and is saved, but the model stopped at its token
          // limit or the provider let go early. Shown as a note under the
          // reply rather than an error: the text on screen is real and worth
          // keeping, the student just needs to know there may be more.
          if (chunk.truncated) {
            truncatedNotice = {
              message:
                "The tutor ran out of room before finishing this reply. Send \"continue\" to hear the rest.",
              code: "truncated",
              retryable: true,
            };
          }
          break;
        }
      }

      if (streamError) throw new ChatFailure(streamError);
      if (!received) {
        throw new ChatFailure({
          message:
            "The tutor didn't return anything. Send your message again, or pick a different model in Settings.",
          code: "empty_reply",
          suggestModelChange: true,
          retryable: true,
        });
      }
      if (!completed) {
        // Text arrived but the stream never finished cleanly. Whatever the
        // server managed to save is authoritative, so reconcile with it
        // instead of keeping the optimistic bubbles, and say it was cut off.
        throw new ChatFailure({
          message:
            "The connection dropped before the reply finished. Anything already saved is in the conversation — send your message again to get the rest.",
          code: "interrupted",
          retryable: true,
        });
      }

      // Awaited so the persisted messages are in the cache BEFORE the guard
      // above is lifted — otherwise the view briefly falls back to the
      // pre-send snapshot and the reply flickers out and back in.
      await queryClient.invalidateQueries({
        queryKey: getGetOpenaiConversationQueryKey(targetConversationId),
      });
      queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetProgressTodayQueryKey() });

      if (truncatedNotice && activeConversationIdRef.current === targetConversationId) {
        setError(truncatedNotice);
      }

    } catch (e) {
      const stillViewing = activeConversationIdRef.current === targetConversationId;
      if (stillViewing) {
        rollback();
        setError(
          e instanceof ChatFailure
            ? e.detail
            : {
                message:
                  e instanceof Error && e.message
                    ? e.message
                    : "Something went wrong. Please try again.",
                retryable: true,
              },
        );
      }
      if (targetConversationId) {
        // Reconcile with whatever the server actually persisted — the user
        // message is usually saved even when the reply fails.
        await queryClient
          .invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(targetConversationId) })
          .catch(() => undefined);
      }
    } finally {
      streamingConversationIdRef.current = undefined;
      setIsStreaming(false);
    }
  };

  return {
    messages,
    isLoading: isLoadingConversation,
    isStreaming,
    error,
    sendMessage,
    // The conversation's persisted language once loaded; undefined for a brand
    // new chat (the caller falls back to the active global language).
    conversationLanguage: conversationData?.language,
    // The conversation's persisted expertise level; undefined for a brand new
    // chat. Used so switching language carries the same level into the new chat.
    conversationLevel: conversationData?.level,
  };
}