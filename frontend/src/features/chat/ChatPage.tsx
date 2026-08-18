import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { apiGet, apiPut, uploadFile } from '@/lib/api';
import {
  getSocket,
  socketJoinConversation,
  socketLeaveConversation,
  socketSendText,
  socketSendVoice,
  socketMarkRead,
  socketTyping,
  socketOn,
  SOCKET_EVENTS,
  type ReadReceiptEvent,
  type TypingEvent,
} from '@/lib/socket';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { StateView, Spinner } from '@/components/common/StateView';
import { useToast } from '@/components/ui/Toast';
import { timeAgo, formatDuration } from '@/lib/formatters';
import { clsx } from 'clsx';
import type { ConversationSummary, MessagePayload } from '@/types/api';

/**
 * Chat (FR-009.1–FR-009.6): conversation list + thread with real-time
 * Socket.IO delivery, typing presence, read receipts, and voice notes
 * (≤120s, recorded + uploaded + played back). Mirrors backend socket
 * handlers and message.routes exactly.
 */
export default function ChatPage() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const initialConv = (location.state as { conversationId?: number } | null)?.conversationId;
  const [activeId, setActiveId] = useState<number | null>(initialConv ?? null);

  // Connect the socket when authenticated.
  useEffect(() => {
    if (!user) return undefined;
    const socket = getSocket();
    socket.connect();

    // Subscribe to inbound events once.
    const offs = [
      socketOn<{ conversationIds: number[] }>(SOCKET_EVENTS.CONVERSATIONS_JOINED, () => {
        void queryClient.invalidateQueries({ queryKey: conversationsKeys.all });
      }),
      socketOn<MessagePayload>(SOCKET_EVENTS.MESSAGE_NEW, (message) => {
        // Append to the active thread cache; refresh list (unread/last).
        if (activeIdRef.current === message.conversation_id) {
          queryClient.setQueryData<MessagePayload[]>(messagesKey(activeIdRef.current), (current) =>
            mergeMessages(current ?? [], message),
          );
        }
        void queryClient.invalidateQueries({ queryKey: conversationsKeys.all });
      }),
      socketOn<ReadReceiptEvent>(SOCKET_EVENTS.MESSAGE_READ, (event) => {
        if (event.conversationId === activeIdRef.current) {
          queryClient.setQueryData<MessagePayload[]>(messagesKey(event.conversationId), (current) =>
            (current ?? []).map((m) =>
              m.sender_id !== event.readerId && m.read_at === null
                ? { ...m, read_at: event.read_at }
                : m,
            ),
          );
        }
      }),
      socketOn<TypingEvent>(SOCKET_EVENTS.TYPING, (event) => {
        if (event.conversationId === activeIdRef.current && event.userId !== user.id) {
          setTypingUser(event.isTyping ? event.userId : null);
        }
      }),
    ];
    return () => {
      offs.forEach((off) => off());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep activeId readable inside socket callbacks.
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const [typingUser, setTypingUser] = useState<number | null>(null);

  return (
    <div>
      <div className="mb-lg">
        <h1 className="mb-xs font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Chat
        </h1>
        <p className="text-on-surface-variant">Conversaciones con tus proveedores.</p>
      </div>

      <div className="grid grid-cols-1 gap-lg md:grid-cols-3">
        {/** Conversation list */}
        <div
          className={clsx(
            'flex flex-col overflow-hidden rounded-xl border border-surface-container-high bg-surface-container-lowest shadow-sm',
            activeId ? 'hidden md:flex md:col-span-1' : 'md:col-span-1',
          )}
        >
          <ConversationList activeId={activeId} onSelect={setActiveId} />
        </div>

        {/** Thread */}
        <div
          className={clsx(
            'flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-surface-container-high bg-surface-container-lowest shadow-sm md:col-span-2',
            activeId ? 'flex' : 'hidden md:flex',
          )}
        >
          {activeId ? (
            <Thread
              conversationId={activeId}
              currentUser={user}
              typingUser={typingUser}
              onBack={() => setActiveId(null)}
            />
          ) : (
            <ThreadEmpty />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
const conversationsKeys = { all: ['conversations'] as const };
const messagesKey = (id: number) => ['conversations', 'messages', id] as const;

function mergeMessages(current: MessagePayload[], incoming: MessagePayload): MessagePayload[] {
  if (current.some((m) => m.id === incoming.id)) return current;
  return [...current, incoming].sort((a, b) => a.id - b.id);
}

function useConversations() {
  return useQuery({
    queryKey: conversationsKeys.all,
    queryFn: () => apiGet<ConversationSummary[]>('/conversations'),
  });
}

function useMessages(conversationId: number) {
  return useQuery({
    queryKey: messagesKey(conversationId),
    queryFn: () => apiGet<MessagePayload[]>(`/conversations/${conversationId}/messages`),
    enabled: Boolean(conversationId),
  });
}

// ---------------------------------------------------------------------------
// Conversation list
// ---------------------------------------------------------------------------
function ConversationList({
  activeId,
  onSelect,
}: {
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  const { data: items = [], isLoading, isError, refetch } = useConversations();

  if (isLoading) {
    return <div className="p-lg text-center"><Spinner /></div>;
  }
  if (isError) {
    return (
      <StateView
        state="error"
        title="No se pudieron cargar las conversaciones"
        action={<Button variant="outline" onClick={() => refetch()}>Reintentar</Button>}
      />
    );
  }
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {items.length === 0 ? (
        <StateView
          state="empty"
          icon="chat_bubble_outline"
          title="Sin conversaciones"
          copy="Inicia contacto desde un detalle de servicio."
        />
      ) : (
        items.map((c) => {
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={clsx(
                'flex w-full items-start gap-md border-b border-outline-variant/50 px-lg py-md text-left transition-colors',
                active ? 'bg-surface-container-low' : 'hover:bg-surface-container-low',
              )}
            >
              <Avatar name={c.other_participant.full_name} src={c.other_participant.avatar_url} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-label-md text-label-md font-semibold text-on-surface">
                  {c.other_participant.full_name}
                </span>
                <span className="block truncate font-body-md text-body-md text-on-surface-variant">
                  {c.last_message?.type === 'nota_voz'
                    ? '🎙 Nota de voz'
                    : c.last_message?.content ?? 'Nuevo hilo'}
                </span>
                <span className="block font-label-sm text-label-sm text-on-surface-variant">
                  {c.last_message ? timeAgo(c.last_message.created_at) : ''}
                </span>
              </span>
              {c.unread_count > 0 ? (
                <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-error px-1.5 font-label-sm text-[10px] text-on-error">
                  {c.unread_count}
                </span>
              ) : null}
            </button>
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread
// ---------------------------------------------------------------------------
function Thread({
  conversationId,
  currentUser,
  typingUser,
  onBack,
}: {
  conversationId: number;
  currentUser: { id: number } | null;
  typingUser: number | null;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const { data: conversation } = useQuery({
    queryKey: conversationsKeys.all,
    queryFn: () => apiGet<ConversationSummary[]>('/conversations'),
    select: (list) => list.find((c) => c.id === conversationId),
  });
  const { data: messages = [], isLoading } = useMessages(conversationId);

  const [draft, setDraft] = useState('');
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Join the room while the thread is open; mark read on open / window focus.
  useEffect(() => {
    socketJoinConversation(conversationId);
    void socketMarkRead(conversationId);
    void apiPut(`/conversations/${conversationId}/read`).catch(() => undefined);
    const onFocus = () => {
      void socketMarkRead(conversationId);
      void apiPut(`/conversations/${conversationId}/read`).catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => {
      socketLeaveConversation(conversationId);
      window.removeEventListener('focus', onFocus);
    };
  }, [conversationId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Voice recording
  const voice = useVoiceRecorder();
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function notifyTyping() {
    socketTyping(conversationId, true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socketTyping(conversationId, false), 1500);
  }

  function sendText() {
    const text = draft.trim();
    if (!text) return;
    socketSendText(conversationId, text);
    setDraft('');
    socketTyping(conversationId, false);
  }

  async function finishVoiceRecording() {
    const recording = await voice.stop();
    if (!recording || recording.seconds < 1) return;
    try {
      const file = new File([recording.blob], `nota-voz-${Date.now()}.webm`, {
        type: recording.blob.type || 'audio/webm',
      });
      const { url } = await uploadFile(file, 'conversations', conversationId);
      socketSendVoice(conversationId, url, Math.min(recording.seconds, 120));
    } catch {
      toast('No se pudo subir la nota de voz.', undefined, 'error');
    }
  }

  function togglePlay(message: MessagePayload) {
    if (!message.audio_url) return;
    if (playingId === message.id && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    const audio = new Audio(message.audio_url);
    audioRef.current?.pause();
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    setPlayingId(message.id);
    void audio.play();
  }

  if (isLoading) {
    return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;
  }

  const isTypingSomeone = typingUser !== null && typingUser !== currentUser?.id;

  return (
    <>
      {/* Thread header */}
      <div className="flex items-center gap-sm border-b border-outline-variant px-lg py-md">
        <button onClick={onBack} className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low md:hidden" aria-label="Volver a conversaciones">
          <Icon name="arrow_back" size={20} />
        </button>
        <Avatar name={conversation?.other_participant.full_name ?? '…'} src={conversation?.other_participant.avatar_url} size={36} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-label-md text-label-md font-semibold text-on-surface">
            {conversation?.other_participant.full_name ?? 'Conversación'}
          </h3>
          <p className="truncate font-label-sm text-label-sm text-on-surface-variant">
            {isTypingSomeone ? 'escribiendo…' : 'Conversación con proveedor'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-lg">
        {messages.map((m, index) => {
          const mine = m.sender_id === currentUser?.id;
          const showDate =
            index === 0 || messages[index - 1].created_at.slice(0, 10) !== m.created_at.slice(0, 10);
          const isRead = m.read_at !== null && !mine;
          return (
            <div key={m.id}>
              {showDate ? (
                <div className="my-4 text-center font-label-sm text-label-sm text-on-surface-variant">
                  {timeAgo(m.created_at.split('T')[0])}
                </div>
              ) : null}
              <div className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={clsx(
                    'max-w-[75%] rounded-xl px-md py-sm font-body-md text-body-md',
                    mine ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface',
                  )}
                >
                  {m.type === 'nota_voz' ? (
                    <button onClick={() => togglePlay(m)} className="flex items-center gap-2">
                      <Icon name={playingId === m.id ? 'stop_circle' : 'play_circle_filled'} size={22} />
                      <span>{formatDuration(m.duration_seconds ?? 0)}</span>
                      <span className="text-xs opacity-80">Nota de voz</span>
                    </button>
                  ) : (
                    <span>{m.content}</span>
                  )}
                  <span className={clsx('mt-xs block text-right font-label-sm text-[10px] opacity-70')}>
                    {mine ? (isRead ? 'Leído ✓✓' : 'Enviado ✓') : timeAgo(m.created_at)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice recorder strip */}
      {voice.recording ? (
        <div className="mx-lg mb-2 flex items-center gap-sm rounded-lg bg-error-container px-md py-sm font-label-md text-on-error-container">
          <Icon name="mic" size={18} />
          <span>{voice.secondsDisplay}</span>
          <span className="flex-1 text-xs">Grabando nota de voz…</span>
          <button onClick={() => void finishVoiceRecording()} className="flex h-8 w-8 items-center justify-center rounded-full bg-error text-on-error" aria-label="Detener grabación">
            <Icon name="stop" size={18} />
          </button>
        </div>
      ) : null}

      {/* Composer */}
      <div className="flex gap-sm border-t border-outline-variant px-lg py-md">
        <button
          onClick={() => void voice.start()}
          disabled={voice.recording}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant transition-colors hover:border-error hover:text-error disabled:opacity-50"
          aria-label="Grabar nota de voz"
        >
          <Icon name="mic" size={22} />
        </button>
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            notifyTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              sendText();
            }
          }}
          placeholder="Escribe un mensaje..."
          className="flex-1 rounded-lg border border-outline-variant bg-surface-container px-md py-sm font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button onClick={sendText} size="icon" aria-label="Enviar mensaje" className="!rounded-lg">
          <Icon name="send" size={20} />
        </Button>
      </div>
    </>
  );
}

function ThreadEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-sm text-center text-on-surface-variant">
      <Icon name="chat_bubble_outline" size={40} />
      <p className="font-label-md text-label-md">Selecciona una conversación para comenzar.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voice recorder (FR-009.3, UR-009.4): ≤120s MediaRecorder
// ---------------------------------------------------------------------------
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      secondsRef.current = 0;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        // Hard cap 120s (UR-009.4 / BR-008.2).
        if (secondsRef.current >= 120) {
          void stop();
        }
      }, 1000);
    } catch {
      // mic permission denied
      setRecording(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(async (): Promise<{ blob: Blob; seconds: number } | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    if (timerRef.current) clearInterval(timerRef.current);
    const duration = secondsRef.current;
    setRecording(false);
    setSeconds(0);
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        recorder.stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        chunksRef.current = [];
        resolve({ blob, seconds: duration });
      };
      recorder.stop();
    });
  }, []);

  return {
    recording,
    seconds,
    secondsDisplay: formatDuration(seconds),
    start,
    stop,
  };
}
