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

export function useChat(conversationId?: number) {
  const queryClient = useQueryClient();
  const createConversation = useCreateOpenaiConversation();
  
  const { data: conversationData, isLoading: isLoadingConversation } = useGetOpenaiConversation(
    conversationId as number,
    { query: { enabled: !!conversationId, queryKey: getGetOpenaiConversationQueryKey(conversationId as number) } }
  );

  const [messages, setMessages] = useState<OpenaiMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const activeConversationIdRef = useRef<number | undefined>(conversationId);

  useEffect(() => {
    activeConversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (conversationData?.messages) {
      setMessages(conversationData.messages);
    } else if (!conversationId) {
      setMessages([]);
    }
  }, [conversationData, conversationId]);

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
        const newConv = await createConversation.mutateAsync({ data: { title } });
        targetConversationId = newConv.id;
        activeConversationIdRef.current = newConv.id;
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        if (onNewConversation) {
          onNewConversation(newConv.id);
        }
      }

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
          setMessages(prev => prev.map(m =>
            m.id === tempAssistantId ? { ...m, content: m.content + chunk.content } : m
          ));
        }
        if (chunk.done) {
          break;
        }
      }

      if (streamError || !received) {
        throw new Error(streamError ?? "The tutor did not return a reply.");
      }

      queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(targetConversationId) });
      queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetProgressTodayQueryKey() });

    } catch (e) {
      rollback();
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      if (targetConversationId) {
        // Reconcile with whatever the server actually persisted.
        queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(targetConversationId) });
      }
    } finally {
      setIsStreaming(false);
    }
  };

  return {
    messages,
    isLoading: isLoadingConversation,
    isStreaming,
    error,
    sendMessage
  };
}