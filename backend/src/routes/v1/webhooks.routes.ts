import { Router } from 'express';
import { prisma } from '../../config/database';
import { verifyWebhook } from '../../integrations/conekta';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Conekta webhook endpoint (BR-013.1) mounted under `/api/v1/webhooks/conekta`.
 *
 * The route is PUBLIC — no JWT requirement — because Conekta does not
 * authenticate with our tokens. Trust comes from the signature gate
 * (`verifyWebhook`): RSA `DIGEST` header against the configured webhook
 * public key, or HMAC `X-Conekta-Signature` with the webhook secret.
 * Requests with a missing/invalid signature are rejected with 401 before
 * any state is touched.
 *
 * Handled events:
 *   - `charge.paid`     → payment `procesado` + `charged_at`
 *   - `charge.failed`   → payment `fallido`
 *   - `charge.declined` → payment `fallido` (Conekta declines alias)
 *   - other events      → acknowledged (200) but ignored
 *
 * Conekta retries non-2xx responses, so unknown events are acknowledged
 * with 200 instead of erroring (see Retries de notificación docs).
 */
export const webhooksRouter: Router = Router();

webhooksRouter.post(
  '/conekta',
  asyncHandler(async (req, res) => {
    // Raw body captured by the global express.json verify hook (app.ts).
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const { event, payload } = await verifyWebhook(rawBody, req.headers);

const data = (payload.data ?? {}) as Record<string, unknown>;
  const charge = (data.object ?? {}) as Record<string, unknown>;
  const chargeId = typeof charge.id === 'string' ? charge.id : null;

    if (event === 'charge.paid') {
      await markPayment(chargeId, 'procesado', new Date());
    } else if (event === 'charge.failed' || event === 'charge.declined') {
      await markPayment(chargeId, 'fallido', null);
    }
    // All other events (charge.created, charge.refunded, order.*, ...) are
    // acknowledged without state changes — refund status is driven by the
    // refund API response, not the async event.

    res.json({ data: { received: true, event } });
  }),
);

/** Flip a payment to `status` when its `conekta_charge_id` matches. */
async function markPayment(
  chargeId: string | null,
  status: 'procesado' | 'fallido',
  chargedAt: Date | null,
): Promise<void> {
  if (!chargeId) return; // malformed charge object — nothing to update
  const payment = await prisma.payments.findFirst({
    where: { conekta_charge_id: chargeId },
  });
  if (!payment) return; // unknown charge — acknowledged but ignored
  if (payment.status === 'reembolsado' || payment.status === 'devuelto') {
    return; // never regress a refunded payment
  }
  // A security deposit stays `retenido` on charge.paid; only a refund (or a
  // failed charge) changes it.
  if (
    payment.payment_type === 'deposito_garantia' &&
    payment.status === 'retenido' &&
    status === 'procesado'
  ) {
    return;
  }
  await prisma.payments.update({
    where: { id: payment.id },
    data:
      status === 'procesado'
        ? { status, charged_at: chargedAt ?? payment.charged_at ?? new Date() }
        : { status },
  });
}