import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../types/api';

/**
 * Firebase Cloud Messaging client (BR-013.4, BR-009.4, D-003).
 *
 * Sends web/mobile push notifications via the FCM HTTP v1 API
 * (`POST https://fcm.googleapis.com/v1/projects/{project}/messages:send`)
 * using an OAuth2 access token minted from the service account
 * (`FCM_SERVICE_ACCOUNT`, a JSON blob) via a self-signed RS256 JWT — no
 * `firebase-admin` dependency required.
 *
 * ### Stub adapter (billing guardrail)
 *
 * Push delivery is a billable/real external call. To keep the pipeline
 * testable WITHOUT ever sending a real notification:
 *
 *   - when `NODE_ENV !== 'production'`, every call routes through a local
 *     stub adapter (no HTTP request, delivery simulated, `stub: true`);
 *   - in production, a service-account blob that does not carry a usable
 *     `private_key` + `project_id` (e.g. the truncated fragment present in
 *     the repo `.env`) fails closed — no partial or silent delivery.
 *
 * Push tokens are read from `users.notification_prefs` (JSON convention
 * `{ "push_tokens": string[] }`) — the adopted schema has no device token
 * table. Tokens are never logged.
 */

export interface PushResult {
  messageId: string;
  tokenCount: number;
  delivered: boolean;
  stub: boolean;
}

interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/** Parse + validate the service-account blob; null when unusable. */
function resolveServiceAccount(): ServiceAccount | null {
  try {
    const raw = JSON.parse(env.FCM_SERVICE_ACCOUNT) as Record<string, unknown>;
    const projectId = String(raw.project_id ?? '');
    const clientEmail = String(raw.client_email ?? '');
    const privateKey = String(raw.private_key ?? '');
    const usable =
      projectId.length > 0 &&
      !projectId.toLowerCase().includes('placeholder') &&
      privateKey.startsWith('-----BEGIN') &&
      privateKey.includes('PRIVATE KEY-----');
    if (!usable) return null;
    return { projectId, clientEmail, privateKey };
  } catch {
    return null;
  }
}

/** Stub mode: non-production, or production with unusable credentials. */
export function useFcmStub(): boolean {
  return env.NODE_ENV !== 'production' || resolveServiceAccount() === null;
}

/**
 * Send a push notification to `tokens`. In stub mode, delivery is
 * simulated locally (one synthetic message id) and nothing reaches FCM.
 */
export async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<PushResult> {
  const cleanTokens = tokens.filter((token) => typeof token === 'string' && token.length > 0);
  if (cleanTokens.length === 0) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'No push tokens to send to',
    });
  }
  if (useFcmStub()) return stubPush(cleanTokens);
  const account = resolveServiceAccount();
  if (!account) {
    // Fail closed: never attempt a delivery with unusable credentials.
    throw new AppError({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'FCM_SERVICE_ACCOUNT is not usable — refusing to send push',
    });
  }
  return realSendPush(cleanTokens, title, body, data, account);
}

/** In-memory delivery. `stub: true`, never touches the network. */
function stubPush(tokens: string[]): PushResult {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'fcm_push_stub',
      token_count: tokens.length,
      message_id: `stub_fcm_${randomUUID()}`,
    }),
  );
  return {
    messageId: `stub_fcm_${randomUUID()}`,
    tokenCount: tokens.length,
    delivered: true,
    stub: true,
  };
}

/** Mint a short-lived OAuth2 access token from the service account (RS256). */
function oauthAccessToken(account: ServiceAccount, ttlSeconds = 3600): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: account.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + ttlSeconds,
    },
    account.privateKey,
    { algorithm: 'RS256' },
  );
}

async function realSendPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> | undefined,
  account: ServiceAccount,
): Promise<PushResult> {
  const accessToken = oauthAccessToken(account);
  const registrations = await Promise.all(
    tokens.map(async (token) => {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
            },
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        throw new AppError({
          statusCode: 502,
          code: 'INTERNAL_ERROR',
          message: 'FCM delivery failed',
          details: { fcm_error: payload },
          expose: false,
        });
      }
      return String(payload.name ?? '');
    }),
  );
  return {
    messageId: registrations[0] ?? '',
    tokenCount: registrations.length,
    delivered: registrations.length > 0,
    stub: false,
  };
}