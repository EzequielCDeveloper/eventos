import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { AppError } from '../types/api';

/**
 * Resend email client (BR-013.5, BR-009.5, D-003).
 *
 * Sends transactional emails via the Resend API
 * (`POST https://api.resend.com/emails`) authenticated with an API key
 * (`RESEND_API_KEY`, prefix `re_`).
 *
 * ### Stub adapter (billing guardrail)
 *
 * Email delivery bills real usage even in development. To keep the
 * pipeline testable WITHOUT ever sending a real email:
 *
 *   - when `NODE_ENV !== 'production'`, every call routes through a local
 *     stub adapter (delivery simulated, `stub: true`) — this also covers
 *     the `.env` `re_dev_placeholder` key and any real pre-production key;
 *   - in production, a key that is not a valid Resend shape (not `re_`)
 *     fails closed instead of attempting a call.
 */

export interface EmailResult {
  id: string;
  to: string;
  delivered: boolean;
  stub: boolean;
}

/** Stub mode: non-production, or production with an invalid key shape. */
export function useResendStub(): boolean {
  return env.NODE_ENV !== 'production' || !env.RESEND_API_KEY.startsWith('re_');
}

/**
 * Send an email to `to` with `subject` and HTML body. In stub mode the
 * send is simulated locally and the recipient/subject are logged (the
 * recipient address is the user's own email, not a secret).
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<EmailResult> {
  if (!to || !to.includes('@')) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'A valid recipient email is required to send an email',
    });
  }

  if (useResendStub()) return stubEmail(to, subject);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM ?? 'Plataforma Eventos <no-reply@eventos.app>',
      to: [to],
      subject,
      html,
      ...(text ? { text } : {}),
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new AppError({
      statusCode: 502,
      code: 'INTERNAL_ERROR',
      message: 'Resend email delivery failed',
      details: { resend_error: payload },
      expose: false,
    });
  }
  return {
    id: String(payload.id ?? ''),
    to,
    delivered: true,
    stub: false,
  };
}

/** In-memory delivery. `stub: true`, never touches the network. */
function stubEmail(to: string, subject: string): EmailResult {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'resend_email_stub',
      to,
      subject,
      email_id: `stub_em_${randomUUID()}`,
    }),
  );
  return { id: `stub_em_${randomUUID()}`, to, delivered: true, stub: true };
}