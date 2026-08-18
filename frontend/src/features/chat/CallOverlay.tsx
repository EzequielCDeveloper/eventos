import { useEffect, useRef, useState } from 'react';
import type {
  IAgoraRTCClient,
  ILocalAudioTrack,
  ILocalVideoTrack,
  IRemoteAudioTrack,
  IRemoteVideoTrack,
} from 'agora-rtc-sdk-ng';
import { fetchAgoraToken, startCall, updateCall } from './chatApi';
import {
  socketOn,
  SOCKET_EVENTS,
  socketCallAccepted,
  socketCallEnd,
  socketCallRing,
  type CallSignalEvent,
} from '@/lib/socket';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { AGORA_APP_ID } from '@/lib/constants';
import { clsx } from 'clsx';
import type { CallLogType } from '@/types/models';

/**
 * Voice/video call overlay (UR-009.2, D-005) — Agora RTC v4.
 *
 * The media flows through the Agora channel named after the conversation id
 * (channel = String(conversationId)); a token is minted per call via
 * GET /agora/token. Signaling (`call:ring/accepted/rejected/end`) is relayed
 * by the backend Socket.IO room so the peer can join the same channel.
 *
 * The CALLER owns the `call_logs` row (created on start, finalized on
 * hang-up with the computed duration); the callee only joins the channel and
 * relies on `call:end` relay — the caller finalizes even when the callee
 * hangs up first. `deposit`… voice calls (`mode: voz`) never request a
 * camera and fall back cleanly to audio only when hardware is unavailable.
 */

interface CallOverlayProps {
  conversationId: number;
  conversationTitle: string;
  otherName: string;
  mode: CallLogType;
  /** `caller` = the side that pressed the call button (owns the call log). */
  side: 'caller' | 'callee';
  onEnd: () => void;
}

type CallStatus = 'conectando' | 'llamando' | 'en_curso' | 'error';

function fmtDuration(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CallOverlay({
  conversationId,
  conversationTitle,
  otherName,
  mode,
  side,
  onEnd,
}: CallOverlayProps) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const tracksRef = useRef<{
    audio: ILocalAudioTrack | null;
    video: ILocalVideoTrack | null;
  }>({ audio: null, video: null });
  const remoteTracksRef = useRef<{ audio: IRemoteAudioTrack | null; video: IRemoteVideoTrack | null }>({
    audio: null,
    video: null,
  });
  const callIdRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const hangingRef = useRef(false);
  const localVideoId = useRef(`call-local-video-${Math.random().toString(36).slice(2)}`);

  const [status, setStatus] = useState<CallStatus>('conectando');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [camUnavailable, setCamUnavailable] = useState(mode === 'voz');

  async function finalizeLocalCall() {
    const callId = callIdRef.current;
    if (side !== 'caller' || callId === null) return;
    try {
      const started = startedAtRef.current ?? Date.now();
      const duration = Math.max(1, Math.round((Date.now() - started) / 1000));
      await updateCall(conversationId, callId, {
        status: 'finalizada',
        duration_seconds: duration,
      });
    } catch {
      /* best-effort persistence of the call log */
    }
  }

  useEffect(() => {
    if (!AGORA_APP_ID) {
      setStatus('error');
      return undefined;
    }
    let cancelled = false;
    let enCursoTimer: number | undefined;

    async function join() {
      // Load the SDK lazily — only when a call is actually started (keeps the
      // chat bundle small; this chunk loads on first call).
      const Sdk = (await import('agora-rtc-sdk-ng')).default;
      const client = Sdk.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;
      try {
        const { appId, token, channel } = await fetchAgoraToken(conversationId);

        // Audio-only path (voice call) or camera track (video); camera
        // failures degrade to audio-only gracefully. Tracks are stored on
        // the ref immediately so cleanup can always release them.
        const audio = await Sdk.createMicrophoneAudioTrack();
        tracksRef.current = { audio, video: null };
        let video: ILocalVideoTrack | null = null;
        if (mode === 'video') {
          try {
            video = await Sdk.createCameraVideoTrack();
            tracksRef.current.video = video;
            setCamUnavailable(false);
          } catch {
            setCamUnavailable(true);
          }
        }
        if (cancelled) return;

        await client.join(appId, channel, token, 0);
        if (cancelled) return;
        await client.publish(video ? [audio, video] : [audio]);
        if (cancelled) return;
        if (video) {
          const el = document.getElementById(localVideoId.current);
          if (el) void video.play(localVideoId.current);
          setCamOn(true);
        }

        startedAtRef.current = Date.now();
        setStatus('llamando');

        // Persist the call log + ring the peer (caller owns the log).
        if (side === 'caller') {
          try {
            const log = await startCall(conversationId, mode);
            callIdRef.current = log.id;
          } catch {
            /* non-fatal: the call still connects */
          }
          socketCallRing(conversationId, mode, callIdRef.current ?? undefined);
        } else {
          socketCallAccepted(conversationId);
        }

        // Mark in-progress once the peer is on the channel (or after 3s).
        client.on('user-joined', () => {
          setStatus('en_curso');
        });
        client.on('user-left', () => {
          setStatus('llamando');
        });
        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === 'video' && user.videoTrack) {
            remoteTracksRef.current.video = user.videoTrack;
            setRemoteUid(Number(user.uid));
            const el = document.getElementById(`call-remote-video-${user.uid}`);
            if (el) void user.videoTrack.play(`call-remote-video-${user.uid}`);
          } else if (mediaType === 'audio' && user.audioTrack) {
            remoteTracksRef.current.audio = user.audioTrack;
            void user.audioTrack.play();
          }
        });

        enCursoTimer = window.setTimeout(() => setStatus('en_curso'), 3000);
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    void join();
    const timer = window.setInterval(() => {
      if (startedAtRef.current) {
        setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);

    // Remote hung-up → the caller finalizes, both close.
    const offEnd = socketOn<CallSignalEvent>(SOCKET_EVENTS.CALL_END_EVENT, (ev) => {
      if (ev.conversationId !== conversationId) return;
      void finalizeLocalCall().then(() => {
        if (cancelled) return;
        onEnd();
      });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(enCursoTimer);
      window.clearInterval(timer);
      offEnd();
      const { audio, video } = tracksRef.current;
      video?.stop();
      video?.close();
      audio?.stop();
      audio?.close();
      remoteTracksRef.current.video?.stop();
      remoteTracksRef.current.audio?.stop();
      void clientRef.current?.leave().catch(() => undefined);
      clientRef.current = null;
      tracksRef.current = { audio: null, video: null };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function hangUp() {
    if (hangingRef.current) return;
    hangingRef.current = true;
    await finalizeLocalCall();
    socketCallEnd(conversationId);
    onEnd();
  }

  async function toggleMic() {
    const track = tracksRef.current.audio;
    if (!track) return;
    const next = !micOn;
    try {
      await track.setEnabled(next);
      setMicOn(next);
    } catch {
      /* ignore device errors mid-call */
    }
  }

  async function toggleCam() {
    const track = tracksRef.current.video;
    if (!track) return;
    const next = !camOn;
    try {
      await track.setEnabled(next);
      setCamOn(next);
    } catch {
      /* ignore */
    }
  }

  const isInbound = side === 'callee';
  const subtitle =
    status === 'conectando'
      ? 'Conectando…'
      : status === 'llamando'
        ? isInbound
          ? 'Entrando a la llamada…'
          : 'Llamando…'
        : status === 'en_curso'
          ? `En curso · ${fmtDuration(elapsed)}`
          : 'No se pudo iniciar la llamada';

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={`Llamada ${mode === 'voz' ? 'de voz' : 'de video'}`}>
      {/* Remote video fills the backdrop for video calls */}
      {mode === 'video' && remoteUid !== null ? (
        <div id={`call-remote-video-${remoteUid}`} className="absolute inset-0 bg-black" />
      ) : null}

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-md px-lg text-center text-white">
        <Avatar name={otherName} size={96} className="!text-4xl ring-4 ring-white/20" />
        <div>
          <h2 className="font-headline-md text-headline-md">{conversationTitle || otherName}</h2>
          <p className="font-label-md text-label-md text-white/70">{subtitle}</p>
        </div>

        {/* Local video preview (video calls): bottom-right picture-in-picture */}
        {mode === 'video' && (
          <div
            id={localVideoId.current}
            className={clsx(
              'pointer-events-none absolute bottom-6 right-6 h-40 w-28 overflow-hidden rounded-xl border border-white/30 bg-black shadow-lg',
              !camOn && 'opacity-0',
            )}
          />
        )}

        <div className="mt-md flex items-center justify-center gap-md">
          {/* Mute / unmute */}
          <button
            type="button"
            onClick={() => void toggleMic()}
            aria-label={micOn ? 'Silenciar micrófono' : 'Activar micrófono'}
            className={clsx(
              'flex h-12 w-12 items-center justify-center rounded-full transition-transform hover:scale-105',
              micOn ? 'bg-white/15 text-white' : 'bg-white text-error',
            )}
          >
            <Icon name={micOn ? 'mic' : 'mic_off'} size={24} />
          </button>

          {/* Camera toggle (video calls with a working camera) */}
          {mode === 'video' && !camUnavailable ? (
            <button
              type="button"
              onClick={() => void toggleCam()}
              aria-label={camOn ? 'Apagar cámara' : 'Encender cámara'}
              className={clsx(
                'flex h-12 w-12 items-center justify-center rounded-full transition-transform hover:scale-105',
                camOn ? 'bg-white/15 text-white' : 'bg-white text-on-surface',
              )}
            >
              <Icon name={camOn ? 'videocam' : 'videocam_off'} size={24} />
            </button>
          ) : null}

          {/* Hang up */}
          <button
            type="button"
            onClick={() => void hangUp()}
            aria-label="Terminar llamada"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-error text-on-error transition-transform hover:scale-105"
          >
            <Icon name="call_end" size={28} />
          </button>
        </div>

        {status === 'error' ? (
          <p className="rounded-lg bg-error-container/20 px-md py-sm font-label-sm text-label-sm text-white/90">
            No se pudo conectar la llamada. Verifica que {AGORA_APP_ID ? 'el token de Agora sea válido' : 'la variable VITE_AGORA_APP_ID esté configurada'}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
