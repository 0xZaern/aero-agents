'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsIncoming, WsOutgoing } from './types';
import { useChatStore } from './stores/chatStore';
import { useAuthStore } from './stores/authStore';
import { useToastStore } from './stores/toastStore';

// Derive WebSocket base URL. Prefer NEXT_PUBLIC_API_URL (e.g. http://localhost:8000),
// converted to ws/wss. Falls back to deriving from window.location at runtime
// (works when the backend is reverse-proxied on the same origin).
function getWsBase(): string {
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (api) return api.replace(/^http/, 'ws');
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}
const WS_BASE = getWsBase();

const MAX_RECONNECT_ATTEMPTS = 5;
// Delay in ms for each attempt index (0-based): 1s, 2s, 4s, 8s, 15s (capped)
function getReconnectDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 15000);
}

interface UseWebSocketReturn {
  sendMessage: (payload: WsOutgoing) => void;
  stopStreaming: () => void;
  isConnected: boolean;
}

export function useWebSocket(conversationId: string | null): UseWebSocketReturn {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const convIdRef = useRef(conversationId);
  convIdRef.current = conversationId;

  // Flag so the onclose handler knows this was an intentional user-initiated stop
  const intentionalStop = useRef(false);

  // Reconnect bookkeeping
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set to true while a reconnect is in-flight so the onclose of the OLD socket
  // does not schedule another reconnect on top of the one already scheduled.
  const isReconnecting = useRef(false);

  // Connect whenever conversationId changes
  useEffect(() => {
    if (!conversationId) {
      // Close any existing connection
      if (ws.current) {
        ws.current.onclose = null; // prevent reconnect
        ws.current.close();
        ws.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Close previous connection if any, and cancel any pending reconnect timer
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    isReconnecting.current = false;

    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close();
      ws.current = null;
    }

    // -----------------------------------------------------------------------
    // connect() creates a new WebSocket and wires up all handlers.
    // It is called once on mount and again on each reconnect attempt.
    // -----------------------------------------------------------------------
    function connect(): void {
      // Guard: do not connect if the effect has already been cleaned up
      // (conversationId changed or component unmounted). convIdRef still holds
      // the correct value for the current effect run because the closure captures
      // the local `conversationId` variable from this effect invocation.
      if (convIdRef.current !== conversationId) return;

      console.log('[WS] Connecting to', conversationId);
      const authToken = useAuthStore.getState().token;
      const wsUrl = authToken
        ? `${WS_BASE}/ws/chat/${conversationId}?token=${encodeURIComponent(authToken)}`
        : `${WS_BASE}/ws/chat/${conversationId}`;

      const socket = new WebSocket(wsUrl);
      ws.current = socket;

      socket.onopen = () => {
        console.log('[WS] Connected to', conversationId);
        // Successful connection - reset reconnect state
        reconnectAttemptRef.current = 0;
        isReconnecting.current = false;
        setIsConnected(true);

        // Flush any pending message
        const pending = useChatStore.getState().pendingMessage;
        if (pending) {
          console.log('[WS] Sending pending message:', pending.content.slice(0, 30));
          socket.send(JSON.stringify({
            content: pending.content,
            model_id: pending.modelId,
            attachment_ids: pending.attachmentIds ?? [],
          }));
          useChatStore.getState().clearPendingMessage();
        }
      };

      socket.onclose = (e) => {
        if (intentionalStop.current) {
          // User clicked Stop - suppress noisy log, just mark disconnected
          intentionalStop.current = false;
          setIsConnected(false);
          return;
        }

        console.log('[WS] Closed:', e.code, e.reason);
        // Unintentional drop mid-stream - reset streaming state so the UI
        // doesn't show bouncing dots indefinitely.
        useChatStore.getState().setStreaming(false);
        useChatStore.getState().clearStreamingMessage();
        setIsConnected(false);

        // Do not reconnect if another reconnect is already scheduled, if the
        // conversationId has changed, or if the component has unmounted.
        if (isReconnecting.current) return;
        if (convIdRef.current !== conversationId) return;

        // Attempt reconnect with exponential backoff
        if (reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
          const attempt = reconnectAttemptRef.current;
          const delay = getReconnectDelay(attempt);
          reconnectAttemptRef.current += 1;
          isReconnecting.current = true;
          console.log(
            `[WS] Reconnecting (attempt ${reconnectAttemptRef.current}/${MAX_RECONNECT_ATTEMPTS}) in ${delay / 1000}s...`
          );
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            isReconnecting.current = false;
            // Final guard: bail out if conversationId changed while we were waiting
            if (convIdRef.current !== conversationId) return;
            connect();
          }, delay);
        } else {
          console.log('[WS] Max reconnect attempts reached, giving up');
          useToastStore.getState().addToast('Connection lost. Please refresh the page.', 'error');
        }
      };

      socket.onerror = (e) => {
        console.error('[WS] Error:', e);
        // Reset streaming state so the UI recovers without a page reload.
        // The browser will fire onclose right after onerror, which handles reconnect.
        useChatStore.getState().setStreaming(false);
        useChatStore.getState().clearStreamingMessage();
        setIsConnected(false);
      };

      socket.onmessage = (event: MessageEvent) => {
        let data: WsIncoming;
        try {
          data = JSON.parse(event.data as string) as WsIncoming;
        } catch {
          console.error('[WS] Failed to parse:', event.data);
          return;
        }

        if (data.type === 'token') {
          useChatStore.getState().appendToken(data.content);
          useChatStore.getState().setStreaming(true);
          useChatStore.getState().setLastError(null);
        } else if (data.type === 'message_complete') {
          useChatStore.getState().finalizeStreamingMessage(data.message);
          useChatStore.getState().setCrewProgress(null);
          useChatStore.getState().clearCrewCompletedAgents();
          // Update credits if the backend sends them back with the completed message
          const fullPayload = data as unknown as { credits?: number | null };
          if (typeof fullPayload.credits === 'number') {
            useAuthStore.getState().updateCredits(fullPayload.credits);
          }
        } else if (data.type === 'crew_agent_start') {
          const d = data as unknown as { agentName: string; step: number; totalSteps: number };
          console.log('[CREW] agent_start:', d.agentName, d.step, '/', d.totalSteps);
          useChatStore.getState().setCrewProgress({ agentName: d.agentName, step: d.step, totalSteps: d.totalSteps });
          useChatStore.getState().clearToolEvents();
          // Reset streaming message so the progress box shows (not hidden by stale tokens)
          useChatStore.getState().clearStreamingMessage();
        } else if (data.type === 'crew_agent_complete') {
          const d = data as unknown as { agentName: string };
          console.log('[CREW] agent_complete:', d.agentName);
          useChatStore.getState().addCrewCompletedAgent(d.agentName);
        } else if (data.type === 'error') {
          useChatStore.getState().setStreaming(false);
          useChatStore.getState().clearStreamingMessage();
          useChatStore.getState().setLastError(data.content || 'Generation failed.');
          // Show toast for insufficient credits
          const content = data.content ?? '';
          if (
            content.toLowerCase().includes('insufficient credits') ||
            content.toLowerCase().includes('not enough credits')
          ) {
            useToastStore.getState().addToast('Insufficient credits', 'error');
          }
        } else if (data.type === 'title_updated') {
          if (convIdRef.current) {
            useChatStore.getState().updateConversation(convIdRef.current, { title: data.title });
          }
        } else if (data.type === 'tool_use' || data.type === 'tool_result') {
          useChatStore.getState().addToolEvent({
            type: data.type,
            tool: data.tool,
            content: data.content,
            timestamp: new Date().toISOString(),
          });
        }
      };
    }

    connect();

    return () => {
      console.log('[WS] Cleanup for', conversationId);
      // Cancel any pending reconnect so we don't reconnect after unmount or
      // after the conversationId has changed.
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectAttemptRef.current = 0;
      isReconnecting.current = false;

      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
        ws.current = null;
      }
      setIsConnected(false);
    };
  }, [conversationId]);

  const sendMessage = useCallback(
    (payload: WsOutgoing) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        console.log('[WS] Sending:', payload.content?.slice(0, 30));
        ws.current.send(JSON.stringify(payload));
      } else {
        console.warn('[WS] Not connected, cannot send. readyState:', ws.current?.readyState);
      }
    },
    []
  );

  // Close the active WebSocket without treating it as an error
  const stopStreaming = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      intentionalStop.current = true;
      ws.current.close();
    }
  }, []);

  return { sendMessage, stopStreaming, isConnected };
}
