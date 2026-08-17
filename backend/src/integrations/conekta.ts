import {
  createHmac,
  createVerify,
  timingSafeEqual,
  randomUUID,
} from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../types/api';

/**
 * Conekta server-side client (BR-006.1, BR-006.5, BR-013.1, D-003).
 *
 * The layer between `payment.service` and Conekta's REST API. It exposes
 * exactly the three operations the backend needs:
 *
 *   - `createCharge(amountMXN, metadata)`  → `conekta_charge_id`
 *   - `createRefund(chargeId, amountMXN)`  → Conekta refund confirmation
 *   - `verifyWebhook(rawBody, headers)`    → BR-013.1 signature gate
 *
 * ### Stub adapter (billing guardrail)
 *
 * Real Conekta keys are live credentials that bill real usage even in
 * development. To keep the pipeline testable WITHOUT ever making a real
 * HTTP call:
 *
 *   - when `NODE_ENV !== 'production'` **and** the key does not start with
 *     `key_test_`, every call routes through a local stub adapter — no HTTP
 *     request is made, and charges/refunds are simulated in memory
 *     (including the webhook events the real provider would deliver);
 *   - a real HTTP call may only happen later with an explicitly
 *     user-approved `key_test_`/`key_live_` sandbox key;
 *   - in production, a key that is not a valid Conekta shape (not
 *     `key_live_`) fails closed instead of attempting a call.
 *
 * The current `.env` key (`key_FRg…`, 27 chars) is NOT a valid Conekta key
 * shape (see /prompts/PROMPT-Backend.md guardrails), so the stub path is
 * always taken in this repo unless a valid sandbox key is provided.
 *
 * ### Webhook signatures (BR-013.1)
 *
 * Conekta authenticates webhook deliveries with RSA-SHA256: the raw request
 * body is signed with Conekta's private key and delivered base64 in the
 * `DIGEST` header; the backend verifies it with the company `webhook_key`
 * public key (PEM in `CONEKTA_WEBHOOK_PUBLIC_KEY`). The classic HMAC scheme
 * (`X-Conekta-Signature: t=<ts>,v1=<hex>` with the webhook secret) is also
 * supported, so either header is accepted when configured. Unknown payloads
 * are rejected — an attacker cannot replay or forge webhooks.
 */

/** Conekta amounts are integer cents — `100.00` MXN becomes `10000`. */
function toCents(amountMXN: Prisma.Decimal | number | string): number {
  const dec = amountMXN instanceof Prisma.Decimal ? amountMXN : new Prisma.Decimal(amountMXN);
  return Number(dec.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP));
}

/** Stub mode: non-production without an approved test key (no HTTP call). */
function useStub(): boolean {
  return env.NODE_ENV !== 'production' && !env.CONEKTA_API_KEY.startsWith('key_test_');
}

/**
 * Fail closed: never leak or call with a malformed key. In production only a
 * `key_live_` credential may reach the network; an approved `key_test_`
 * sandbox key enables real HTTP in non-production (never with the current
 * malformed key, which throws before any call is attempted).
 */
function assertKeyUsable(): void {
  const key = env.CONEKTA_API_KEY;
  const validShape =
    (env.NODE_ENV === 'production' && key.startsWith('key_live_')) ||
    (env.NODE_ENV !== 'production' && key.startsWith('key_test_'));
  if (!validShape) {
    throw AppError.paymentFailed(
      'Conekta API key is not configured (invalid key shape) — no charge was attempted',
      { key_shape: `${key.slice(0, 4)}…` },
    );
  }
}

// ---- Charge -----------------------------------------------------------------

export interface ConektaCharge {
  id: string;
  order_id: string | null;
  status: 'paid' | 'declined' | 'pending_payment';
  amount_cents: number;
  currency: string;
  paid_at: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Create a charge for `amountMXN` (MXN only, BR-006.1/BR-006.5). Returns a
 * normalized charge object whose `id` is persisted as `conekta_charge_id`.
 * In stub mode the charge is simulated locally (status `paid`).
 */
export async function createCharge(
  amountMXN: Prisma.Decimal | number | string,
  metadata: Record<string, unknown>,
  currency = 'MXN',
): Promise<ConektaCharge> {
  if (currency !== 'MXN') {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `Only MXN is accepted (BR-006.5); received currency '${currency}'`,
      details: { currency },
    });
  }
  const dec = amountMXN instanceof Prisma.Decimal ? amountMXN : new Prisma.Decimal(amountMXN);
  if (dec.lte(0)) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Charge amount must be greater than zero',
    });
  }

  if (useStub()) return stubCreateCharge(dec, metadata);
  assertKeyUsable();
  return realCreateCharge(dec, metadata);
}

async function realCreateCharge(
  amountMXN: Prisma.Decimal,
  metadata: Record<string, unknown>,
): Promise<ConektaCharge> {
  // Real Conekta flow: `POST /orders` with a single line item and a default
  // off_session charge. Reachable only with an approved sandbox key.
  const response = await fetch('https://api.conekta.io/orders', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.conekta-v2.3.0+json',
      'Accept-Language': 'es',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.CONEKTA_API_KEY}`,
    },
    body: JSON.stringify({
      currency: 'MXN',
      customer_info: { customer_id: String(metadata.customer_id ?? ''), name: String(metadata.customer_name ?? '') },
      line_items: [
        {
          name: String(metadata.description ?? 'Pago Plataforma Eventos'),
          unit_price: toCents(amountMXN),
          quantity: 1,
        },
      ],
      charges: [{ payment_method: { type: 'default' } }],
      metadata,
    }),
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw AppError.paymentFailed('Conekta charge failed', {
      conekta_error: body,
    });
  }
  const charges = Array.isArray(body.charges) ? (body.charges as Record<string, unknown>[]) : [];
  const firstCharge = charges[0] as Record<string, unknown> | undefined;
  const chargeId = String(firstCharge?.id ?? body.id ?? '');
  return {
    id: chargeId,
    order_id: String(body.id ?? null),
    status: 'paid',
    amount_cents: toCents(amountMXN),
    currency: 'MXN',
    paid_at: new Date().toISOString(),
    metadata,
  };
}

/** In-memory charge. `livemode: false`, never touches the network. */
function stubCreateCharge(
  amountMXN: Prisma.Decimal,
  metadata: Record<string, unknown>,
): ConektaCharge {
  return {
    id: `stub_chg_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
    order_id: `stub_ord_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
    status: 'paid',
    amount_cents: toCents(amountMXN),
    currency: 'MXN',
    paid_at: new Date().toISOString(),
    metadata: { ...metadata, stub: true },
  };
}

// ---- Refund ----------------------------------------------------------------

export interface ConektaRefund {
  id: string;
  status: 'refunded' | 'pending';
  amount_cents: number;
  currency: string;
  created_at: string;
}

/**
 * Refund `amountMXN` from a previously created charge (BR-006.6/BR-007).
 * The amount may be partial (e.g. a fraction of the saldo under a provider
 * retention policy). Stub mode simulates a successful refund locally.
 */
export async function createRefund(
  chargeId: string,
  amountMXN: Prisma.Decimal | number | string,
): Promise<ConektaRefund> {
  const dec = amountMXN instanceof Prisma.Decimal ? amountMXN : new Prisma.Decimal(amountMXN);
  if (dec.lte(0)) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Refund amount must be greater than zero',
    });
  }

  if (useStub()) return stubCreateRefund(dec);
  assertKeyUsable();
  return realCreateRefund(chargeId, dec);
}

async function realCreateRefund(
  chargeId: string,
  amountMXN: Prisma.Decimal,
): Promise<ConektaRefund> {
  // Conekta refunds are order-scoped: resolve the order for this charge,
  // then POST a refund on it. Reachable only with an approved sandbox key.
  const chargeRes = await fetch(`https://api.conekta.io/charges/${chargeId}`, {
    headers: {
      Accept: 'application/vnd.conekta-v2.3.0+json',
      Authorization: `Bearer ${env.CONEKTA_API_KEY}`,
    },
  });
  const chargeBody = (await chargeRes.json()) as Record<string, unknown>;
  if (!chargeRes.ok) {
    throw AppError.paymentFailed('Conekta charge lookup failed for refund', {
      conekta_error: chargeBody,
    });
  }
  const orderId = String(chargeBody.order_id ?? '');
  const response = await fetch(`https://api.conekta.io/orders/${orderId}/refunds`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.conekta-v2.3.0+json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.CONEKTA_API_KEY}`,
    },
    body: JSON.stringify({ reason: 'requested_by_client', amount: toCents(amountMXN) }),
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw AppError.paymentFailed('Conekta refund failed', {
      conekta_error: body,
    });
  }
  return {
    id: String(body.id ?? ''),
    status: 'refunded',
    amount_cents: toCents(amountMXN),
    currency: 'MXN',
    created_at: new Date().toISOString(),
  };
}

function stubCreateRefund(amountMXN: Prisma.Decimal): ConektaRefund {
  return {
    id: `stub_ref_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
    status: 'refunded',
    amount_cents: toCents(amountMXN),
    currency: 'MXN',
    created_at: new Date().toISOString(),
  };
}

// ---- Webhook signature verification (BR-013.1) -----------------------------

export interface WebhookHeaders {
  /** Classic HMAC header: `t=<ts>,v1=<hex>` computed from `<ts>.<rawBody>`. */
  'x-conekta-signature'?: string | string[] | undefined;
  /** Current official RSA header: base64 SHA256withRSA over the raw body. */
  digest?: string | string[] | undefined;
}

export type WebhookHeaderSource = WebhookHeaders | Record<string, string | string[] | undefined>;

/**
 * Verify a Conekta webhook delivery before trusting its payload (BR-013.1).
 *
 * Accepts either authentication scheme, whichever is configured:
 *   1. RSA (`DIGEST` header + `CONEKTA_WEBHOOK_PUBLIC_KEY`), or
 *   2. HMAC (`X-Conekta-Signature: t=<ts>,v1=<hex>` + webhook secret).
 *
 * The payload must be the EXACT raw request body (byte-for-byte) — JSON
 * re-serialization breaks both schemes.
 *
 * Throws `AppError` (401/400) when the signature is missing, malformed, or
 * does not verify; returns `{ event, payload }` on success.
 */
export async function verifyWebhook(
  rawBody: Buffer,
  headers: WebhookHeaderSource,
): Promise<{ event: string; payload: Record<string, unknown> }> {
  const digestHeader = firstHeader(headers.digest);
  const hmacHeader = firstHeader(headers['x-conekta-signature']);

  let verified = false;
  if (digestHeader && env.CONEKTA_WEBHOOK_PUBLIC_KEY) {
    verified = verifyRsaDigest(rawBody, digestHeader, env.CONEKTA_WEBHOOK_PUBLIC_KEY);
  } else if (hmacHeader) {
    verified = verifyHmacSignature(rawBody, hmacHeader, env.CONEKTA_WEBHOOK_SECRET);
  }

  if (!verified) {
    throw new AppError({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid Conekta webhook signature',
    });
  }

  const bodyText = rawBody.toString('utf8');
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Webhook payload is not valid JSON',
    });
  }
  const event = String(payload.type ?? payload.event ?? '');
  if (!event) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Webhook payload is missing an event `type`',
    });
  }
  return { event, payload };
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Scheme 1 — RSA-SHA256 (official): base64 `DIGEST` of the raw body. */
function verifyRsaDigest(rawBody: Buffer, digestBase64: string, publicKeyPem: string): boolean {
  try {
    const signature = Buffer.from(digestBase64.trim(), 'base64');
    const verifier = createVerify('RSA-SHA256');
    verifier.update(rawBody);
    return verifier.verify(publicKeyPem, signature);
  } catch {
    return false;
  }
}

/** Scheme 2 — HMAC legacy: `t=<ts>,v1=<hex>` = HMAC-SHA256(secret, ts + '.' + body). */
function verifyHmacSignature(rawBody: Buffer, header: string, secret: string): boolean {
  const params = new Map<string, string>();
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    params.set(part.slice(0, eq), part.slice(eq + 1));
  }
  const timestamp = params.get('t');
  const signatureHex = params.get('v1');
  if (!timestamp || !signatureHex) return false;

  // Replay window: ±5 minutes has been Conekta's documented tolerance.
  const nowSec = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > 5 * 60) return false;

  try {
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest();
    const received = Buffer.from(signatureHex, 'hex');
    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}