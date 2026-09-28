import React, { useState, useEffect, useRef } from "react";
import { parseSSEStream } from "@/lib/sse";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreateOpenaiConversation, 
  getGetOpenaiConversationQueryKey,
  getListOpenaiConversationsQueryKey,
  getGetProgressTodayQueryKey,
  useGetOpenaiConversation,
  OpenaiMessage
} from "@workspace/api-client-react";

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

  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ content: trimmed })
      });

      if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream")) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      let streamError: string | null = null;
      let received = false;
      for await (const chunk of parseSSEStream(res)) {
        if (chunk.error) {
          streamError = chunk.error;
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
          break;
        }
      }

      if (streamError || !received) {
        throw new Error(streamError ?? "The tutor did not return a reply.");
      }

      // Awaited so the persisted messages are in the cache BEFORE the guard
      // above is lifted — otherwise the view briefly falls back to the
      // pre-send snapshot and the reply flickers out and back in.
      await queryClient.invalidateQueries({
        queryKey: getGetOpenaiConversationQueryKey(targetConversationId),
      });
      queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetProgressTodayQueryKey() });

    } catch (e) {
      const stillViewing = activeConversationIdRef.current === targetConversationId;
      if (stillViewing) {
        rollback();
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
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