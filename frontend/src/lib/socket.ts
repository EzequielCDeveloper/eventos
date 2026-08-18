import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { API_BASE_URL } from './constants';
import type { MessagePayload } from '@/types/api';

/**
 * Socket.IO client (FR-009.2, D-006, D-014).
 *
 * - Singleton: `getSocket()` lazily creates and connects, reuses the
 *   connection, and re-authenticates with the current JWT on every
 *   (re)connection attempt (`socket.auth` is re-read by socket.io).
 * - Auto-reconnect with exponential backoff (D-014: 1s → max 30s) and a
 *   cap of attempts; a "connection lost" state is surfaced via uiStore so
 *   layouts can show a banner.
 * - Room management mirrors the backend `conv:{id}` rooms; the server also
 *   auto-joins the user's conversations on connect and replies with
 *   `conversations:joined` (D-006).
 * - Event names/payloads match backend/src/socket/handlers.ts exactly.
 */

export const SOCKET_EVENTS = {
  // client → server
  JOIN_CONVERSATION: 'join-conversation',
  LEAVE_CONVERSATION: 'leave-conversation',
  MESSAGE: 'message',
  MESSAGE_READ: 'message:read',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  CALL_RING: 'call:ring',
  CALL_ACCEPTED: 'call:accepted',
  CALL_REJECTED: 'call:rejected',
  CALL_END: 'call:end',
  // server → client
  CONVERSATIONS_JOINED: 'conversations:joined',
  CONVERSATION_JOINED: 'conversation:joined',
  CONVERSATION_LEFT: 'conversation:left',
  MESSAGE_NEW: 'message:new',
  MESSAGE_SENT: 'message:sent',
  TYPING: 'typing',
  CALL_RING_EVENT: 'call:ring',
  CALL_ACCEPTED_EVENT: 'call:accepted',
  CALL_REJECTED_EVENT: 'call:rejected',
  CALL_END_EVENT: 'call:end',
  ERROR: 'error',
} as const;

export interface ConversationsJoinedEvent {
  conversationIds: number[];
}
export interface ConversationJoinedEvent {
  conversationId: number;
}
export interface ReadReceiptEvent {
  conversationId: number;
  readerId: number;
  read_at: string;
  updated: number;
}
export interface TypingEvent {
  conversationId: number;
  userId: number;
  isTyping: boolean;
}

/** Voice/video call signaling (UR-009.2) — relayed to the conv room by the
 *  backend; the media itself flows through Agora (D-005). */
export interface CallSignalEvent {
  conversationId: number;
  type: 'voz' | 'video';
  callerId: number;
  callId?: number | null;
}
export interface SocketErrorEvent {
  message: string;
  error?: string;
}

function socketOrigin(): string {
  if (API_BASE_URL) {
    try {
      return new URL(API_BASE_URL).origin;
    } catch {
      /* fall through to same-origin */
    }
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}

let socket: Socket | null = null;

/** Lazily create + connect the singleton; reuses the existing connection. */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(socketOrigin(), {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10, // D-014
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30_000,
    timeout: 10_000,
    transports: ['websocket', 'polling'],
    auth: (cb) => cb({ token: getAccessToken() }),
  });

  socket.on('connect_error', (err) => {
    // Keep uiStore truthful: a failed handshake (invalid token) is also an
    // offline state; the app-level banner uses socketConnected.
    useUiStore.getState().setSocketConnected(false);
    if (err.message) {
      // eslint-disable-next-line no-console
      console.warn('[socket] connect_error', err.message);
    }
  });

  const onConnect = () => {
    // Re-auth on every (re)connect attempt (D-014 token rotation).
    if (socket) {
      socket.auth = { token: getAccessToken() };
    }
    useUiStore.getState().setSocketConnected(true);
  };
  socket.on('connect', onConnect);
  socket.on('disconnect', (reason) => {
    useUiStore.getState().setSocketConnected(false);
    if (reason === 'io server disconnect') {
      socket?.connect(); // server-initiated → client tries to reconnect
    }
  });

  return socket;
}

/** Disconnect (used on logout / app teardown). */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    useUiStore.getState().setSocketConnected(false);
  }
}

// --- Typed client actions (mirror backend handlers.ts) ----------------------

export function socketJoinConversation(conversationId: number): void {
  getSocket().emit(SOCKET_EVENTS.JOIN_CONVERSATION, { conversationId });
}

export function socketLeaveConversation(conversationId: number): void {
  getSocket().emit(SOCKET_EVENTS.LEAVE_CONVERSATION, { conversationId });
}

export function socketSendText(conversationId: number, content: string): void {
  getSocket().emit(SOCKET_EVENTS.MESSAGE, { conversationId, type: 'texto', content });
}

export function socketSendVoice(
  conversationId: number,
  audioUrl: string,
  durationSeconds: number,
): void {
  getSocket().emit(SOCKET_EVENTS.MESSAGE, {
    conversationId,
    type: 'nota_voz',
    audioUrl,
    durationSeconds,
  });
}

export function socketMarkRead(conversationId: number): void {
  getSocket().emit(SOCKET_EVENTS.MESSAGE_READ, { conversationId });
}

export function socketTyping(conversationId: number, typing: boolean): void {
  getSocket().emit(typing ? SOCKET_EVENTS.TYPING_START : SOCKET_EVENTS.TYPING_STOP, {
    conversationId,
  });
}

// --- Voice/video call signaling (UR-009.2, D-005) ---------------------------

/** Tell the peer a call is ringing (broadcast by the backend to conv:{id}). */
export function socketCallRing(conversationId: number, type: 'voz' | 'video', callId?: number): void {
  getSocket().emit(SOCKET_EVENTS.CALL_RING, {
    conversationId,
    type,
    ...(callId !== undefined ? { callId } : {}),
  });
}

export function socketCallAccepted(conversationId: number): void {
  getSocket().emit(SOCKET_EVENTS.CALL_ACCEPTED, { conversationId });
}

export function socketCallRejected(conversationId: number): void {
  getSocket().emit(SOCKET_EVENTS.CALL_REJECTED, { conversationId });
}

export function socketCallEnd(conversationId: number): void {
  getSocket().emit(SOCKET_EVENTS.CALL_END, { conversationId });
}

/** Subscribe to an inbound event; returns an unsubscribe function. */
export function socketOn<T>(event: string, handler: (payload: T) => void): () => void {
  const s = getSocket();
  s.on(event, handler as (...args: unknown[]) => void);
  return () => {
    s.off(event, handler as (...args: unknown[]) => void);
  };
}

export type { Socket };

/** Keep MessagePayload importable for consumer typing. */
export type { MessagePayload };
