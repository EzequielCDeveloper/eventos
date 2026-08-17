import { RtcRole, RtcTokenBuilder } from 'agora-access-token';
import { env } from '../config/env';

/**
 * Agora RTC integration (D-005, UR-009.2).
 *
 * Server-side Agora RTC token generation. The token is minted locally with
 * `agora-access-token` using the app credentials (`AGORA_APP_ID`,
 * `AGORA_APP_CERTIFICATE`) — NO network call and NO call is ever started
 * from the backend, so token generation never bills minutes.
 *
 * The frontend (agora-rtc-sdk-ng) fetches `GET /api/v1/agora/token?channel=…`
 * and joins the channel with the returned token.
 */

/** Voice/video call roles accepted by the token endpoint (RTC SDK roles). */
export type AgoraRtcRole = 'publisher' | 'subscriber';

/** Token lifetime in seconds (UR-009.2 / D-005 default 24h; 3600 used here). */
export const AGORA_TOKEN_TTL_SECONDS = 3600;

export interface AgoraTokenInput {
  /** Channel name (typically the conversation id, e.g. `conv-42`). */
  channel: string;
  /** Optional integer uid; 0 (default) lets the client SDK auto-assign one. */
  uid?: number;
  /** Token role; default `publisher` for voice/video calls. */
  role?: AgoraRtcRole;
}

export interface AgoraTokenResult {
  appId: string;
  token: string;
  channel: string;
  uid: number;
  /** Absolute expiry as unix seconds (UTC). */
  expiry: number;
  role: AgoraRtcRole;
}

const ROLE_MAP: Record<AgoraRtcRole, number> = {
  publisher: RtcRole.PUBLISHER,
  subscriber: RtcRole.SUBSCRIBER,
};

/**
 * Generate an RTC token for `channel`. `uid` 0 produces an unbound token so
 * the client SDK can allocate its own uid on join (per Agora docs).
 *
 * Expiry is `now + AGORA_TOKEN_TTL_SECONDS` (3600s per task 9.5).
 */
export function generateRtcToken(input: AgoraTokenInput): AgoraTokenResult {
  const channel = input.channel.trim();
  const uid = input.uid && input.uid > 0 ? input.uid : 0;
  const role = input.role ?? 'publisher';

  const nowSeconds = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = nowSeconds + AGORA_TOKEN_TTL_SECONDS;

  const token = RtcTokenBuilder.buildTokenWithUid(
    env.AGORA_APP_ID,
    env.AGORA_APP_CERTIFICATE,
    channel,
    uid,
    ROLE_MAP[role],
    privilegeExpiredTs,
  );

  return {
    appId: env.AGORA_APP_ID,
    token,
    channel,
    uid,
    expiry: privilegeExpiredTs,
    role,
  };
}
