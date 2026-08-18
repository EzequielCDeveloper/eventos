import { apiGet, apiPost, apiPut } from '@/lib/api';
import type { CallLogType } from '@/types/models';

/**
 * Chat call helpers (UR-009.2, D-005).
 *
 * Agora token lifetime is backend-controlled (3600s, agora.routes.ts); the
 * SDK is handed the token + appId and joins the channel named after the
 * conversation id. Call logs are created on start (`llamando`) and finalized
 * on hang-up (`finalizada` with duration) — BR-008.5.
 */

export interface AgoraTokenResult {
  appId: string;
  token: string;
  channel: string;
  uid: number;
  expiry: number;
  role: 'publisher' | 'subscriber';
}

export interface CallLogResult {
  id: number;
  conversation_id: number;
  type: CallLogType;
  status: 'llamando' | 'en_curso' | 'finalizada';
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
}

/** Mint an Agora RTC token for a conversation channel (GET /agora/token). */
export function fetchAgoraToken(
  conversationId: number,
  role: 'publisher' | 'subscriber' = 'publisher',
): Promise<AgoraTokenResult> {
  return apiGet<AgoraTokenResult>('/agora/token', {
    params: { channel: String(conversationId), role },
  });
}

/** Record a call start (POST /conversations/:id/calls). */
export function startCall(conversationId: number, type: CallLogType): Promise<CallLogResult> {
  return apiPost<CallLogResult>(`/conversations/${conversationId}/calls`, { type });
}

/** Finalize (or mark in-progress) a call log (PUT /conversations/:id/calls/:callId). */
export function updateCall(
  conversationId: number,
  callId: number,
  patch: {
    status: 'en_curso' | 'finalizada';
    duration_seconds?: number;
  },
): Promise<CallLogResult> {
  return apiPut<CallLogResult>(`/conversations/${conversationId}/calls/${callId}`, patch);
}
