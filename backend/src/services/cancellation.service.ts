import {
  Prisma,
  type cancellations_cancelled_by,
  type payments_payment_type,
  type payments_status,
  type refunds_reason,
} from '@prisma/client';
import { prisma } from '../config/database';
import { AppError, type AuthUser } from '../types/api';
import { toMoney, transitionStatus } from './reservation.service';
import { createRefund } from '../integrations/conekta';

/**
 * Cancellation & refund service (BR-007, D-003).
 *
 * Business rules implemented here:
 *
 *   - **Client cancel** (BR-007.1): the advance (`anticipo`) is ALWAYS
 *     non-refundable. Balance (`saldo`) is refunded per the provider policy
 *     snapshot: fully on a far cancellation (`lejana`), and reduced by the
 *     provider's `retention_percent` on a near cancellation (`cercana`).
 *     The security deposit is refunded only when the snapshot's
 *     `deposit_refundable` flag is true.
 *   - **Retention acceptance** (BR-007.3): a near cancellation MUST carry
 *     `retention_accepted: true` before refunds are processed; the value is
 *     persisted on the `cancellations` row (reservation.service honors it).
 *   - **Provider cancel** (BR-007.2): FULL automatic refund of advance +
 *     deposit + additional payments.
 *   - **Refund order** (BR-007.4): payments are refunded in the order
 *     advance → deposit → other (anticipo, deposito_garantia, saldo).
 *   - **Five refund reasons** (BR-007.5): enforced via the `refunds_reason`
 *     enum — `cancelacion_proveedor`, `cancelacion_cliente`,
 *     `deposito_devolucion`, `politica_proveedor`,
 *     `permiso_alcohol_no_confirmado`.
 *   - Refunds go through the Conekta refund API (stub in dev) and every
 *     refunded payment moves to `reembolsado` (`devuelto` for deposits).
 */

export interface CancelReservationInput {
  reason?: string;
  /** Client acceptance of the retention policy on near-cancels (BR-007.3). */
  retention_accepted?: boolean;
  /** Explicit canceller side; only honored for admins, else derived. */
  cancelled_by?: cancellations_cancelled_by;
}

export interface CancellationResult {
  reservation_id: number;
  reservation_status: string;
  cancelled_by: cancellations_cancelled_by;
  timing: 'lejana' | 'cercana' | null;
  retention_percent: string | null;
  retention_accepted: boolean | null;
  refunds: Array<{
    payment_id: number;
    payment_type: payments_payment_type;
    amount: string;
    reason: refunds_reason;
    status: string;
  }>;
}

/** Payment types in Conekta refund order: advance → deposit → other. */
const REFUND_ORDER: Record<payments_payment_type, number> = {
  anticipo: 0,
  deposito_garantia: 1,
  saldo: 2,
};

interface RefundablePayment {
  id: number;
  payment_type: payments_payment_type;
  amount: Prisma.Decimal;
  conekta_charge_id: string | null;
  status: payments_status;
  alreadyRefunded: Prisma.Decimal;
}

function assertParticipant(
  clientId: number,
  providerIds: number[],
  actor: AuthUser,
): void {
  if (actor.role === 'administrador') return;
  if (actor.id === clientId) return;
  if (providerIds.includes(actor.id)) return;
  throw AppError.forbidden('This reservation belongs to another user');
}

function deriveCancelledBy(actor: AuthUser, explicit?: cancellations_cancelled_by): cancellations_cancelled_by {
  if (explicit !== undefined && actor.role === 'administrador') return explicit;
  return actor.role === 'usuario' ? 'cliente' : 'proveedor';
}

function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Cancel a reservation and process refunds per BR-007.
 *
 * The reservation is moved to `cancelada` through the canonical state
 * machine (transitionStatus — this keeps every state change audited by
 * `reservation_status_history` and records the `cancellations` row with the
 * retention data). Refund execution is idempotent-by-skip: payments already
 * fully refunded are skipped, so retrying a failed transition never
 * double-refunds.
 */
export async function cancelReservation(
  reservationId: number,
  actor: AuthUser,
  input: CancelReservationInput = {},
): Promise<CancellationResult> {
  const reservation = await prisma.reservations.findUnique({
    where: { id: reservationId },
    include: {
      reservation_items: {
        include: { services: { select: { provider_id: true } } },
      },
      payments: { include: { refunds: true }, orderBy: { id: 'asc' } },
    },
  });
  if (!reservation) throw AppError.notFound('Reservation not found');
  if (reservation.status === 'cancelada') {
    throw AppError.conflict('Reservation is already cancelled');
  }
  if (reservation.status === 'completada') {
    throw AppError.conflict('A completed reservation cannot be cancelled');
  }

  const providerIds = [
    ...new Set(reservation.reservation_items.map((i) => i.services.provider_id)),
  ];
  assertParticipant(reservation.client_id, providerIds, actor);

  const cancelledBy = deriveCancelledBy(actor, input.cancelled_by);
  const snapshot = (reservation.cancellation_policy_snapshot ?? {}) as Record<string, unknown>;
  const freeDays = Number(snapshot.penalty_free_window_days ?? 0);
  const daysToEvent = Math.ceil(
    (reservation.event_date.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  const timing = daysToEvent >= freeDays ? 'lejana' : 'cercana';
  const retentionPercent = new Prisma.Decimal(
    snapshot.retention_percent !== undefined ? Number(snapshot.retention_percent) : 50,
  );
  const depositRefundable =
    snapshot.deposit_refundable !== undefined ? Boolean(snapshot.deposit_refundable) : true;

  // BR-007.3: near cancellation requires explicit retention acceptance.
  const retentionAccepted = input.retention_accepted === true;
  if (cancelledBy === 'cliente' && timing === 'cercana' && !retentionAccepted) {
    throw new AppError({
      statusCode: 409,
      code: 'CONFLICT',
      message:
        'This is a near cancellation (BR-007.3): the provider retention policy applies and must be accepted. Send `retention_accepted: true` to proceed.',
      details: {
        timing,
        retention_percent: toMoney(retentionPercent),
        policy_snapshot: snapshot,
      },
    });
  }

  // Build the refund plan in Conekta refund order (advance → deposit → other).
  const plan: Array<{ payment_id: number; amount: Prisma.Decimal; reason: refunds_reason }> = [];
  const refundable: RefundablePayment[] = reservation.payments
    .map((p) => ({
      id: p.id,
      payment_type: p.payment_type,
      amount: p.amount,
      conekta_charge_id: p.conekta_charge_id,
      status: p.status,
      alreadyRefunded: p.refunds
        .filter((rf) => rf.status === 'procesado')
        .reduce((sum, rf) => sum.add(rf.amount), new Prisma.Decimal(0)),
    }))
    .filter(
      (p) =>
        (p.status === 'procesado' || p.status === 'retenido') &&
        p.conekta_charge_id !== null &&
        p.conekta_charge_id !== undefined,
    )
    .sort((a, b) => REFUND_ORDER[a.payment_type] - REFUND_ORDER[b.payment_type]);

  for (const payment of refundable) {
    const left = payment.amount.sub(payment.alreadyRefunded);
    if (left.lte(0)) continue;

    let refundAmount = new Prisma.Decimal(0);
    let reason: refunds_reason;

    if (cancelledBy === 'proveedor') {
      // Provider cancel: FULL refund of advance + deposit + other (BR-007.2).
      refundAmount = left;
      reason = 'cancelacion_proveedor';
    } else if (payment.payment_type === 'anticipo') {
      // Client cancel: the advance is always non-refundable (BR-007.1).
      refundAmount = new Prisma.Decimal(0);
      reason = 'cancelacion_cliente';
    } else if (payment.payment_type === 'deposito_garantia') {
      if (depositRefundable) {
        refundAmount = left;
        reason = 'deposito_devolucion';
      } else {
        refundAmount = new Prisma.Decimal(0);
        reason = 'deposito_devolucion';
      }
    } else {
      // saldo: per provider policy, retention applies on near cancels.
      if (timing === 'cercana') {
        refundAmount = round2(left.mul(new Prisma.Decimal(100).sub(retentionPercent)).div(100));
        reason = 'politica_proveedor';
      } else {
        refundAmount = left;
        reason = 'cancelacion_cliente';
      }
    }

    if (refundAmount.gt(0)) {
      plan.push({ payment_id: payment.id, amount: refundAmount, reason });
    }
  }

  // Execute refunds via Conekta (stub in dev) + persist rows + update status.
  const refunds: CancellationResult['refunds'] = [];
  for (const entry of plan) {
    const payment = refundable.find((p) => p.id === entry.payment_id)!;
    // The Conekta refund call is the side effect (stub in dev); the DB row
    // below is our record of it.
    await createRefund(payment.conekta_charge_id!, entry.amount);

    const refundRow = await prisma.refunds.create({
      data: {
        payment_id: entry.payment_id,
        reservation_id: reservationId,
        amount: entry.amount,
        reason: entry.reason,
        status: 'procesado',
        processed_at: new Date(),
      },
    });

    const fullyRefunded = entry.amount
      .add(payment.alreadyRefunded)
      .equals(payment.amount);
    await prisma.payments.update({
      where: { id: entry.payment_id },
      data: fullyRefunded
        ? { status: payment.payment_type === 'deposito_garantia' ? 'devuelto' : 'reembolsado' }
        : { status: payment.status },
    });

    refunds.push({
      payment_id: entry.payment_id,
      payment_type: payment.payment_type,
      amount: toMoney(entry.amount) ?? '0.00',
      reason: entry.reason,
      status: refundRow.status,
    });
  }

  // Move the reservation to `cancelada` through the canonical state machine,
  // passing the retention acceptance so the `cancellations` row records it.
  const updated = await transitionStatus(reservationId, actor, {
    status: 'cancelada',
    cancel_reason: input.reason,
    retention_accepted: retentionAccepted,
  });

  return {
    reservation_id: reservationId,
    reservation_status: updated.status,
    cancelled_by: cancelledBy,
    timing,
    retention_percent: toMoney(retentionPercent),
    retention_accepted: timing === 'cercana' ? retentionAccepted : null,
    refunds,
  };
}

/**
 * GET the refund history for a reservation (participant-scoped).
 * Useful to admin/provider views; not part of UR-002.9 (documented extra).
 */
export async function listRefundsByReservation(
  reservationId: number,
  actor: AuthUser,
): Promise<
  Array<{
    id: number;
    payment_id: number;
    amount: string;
    reason: refunds_reason;
    status: string;
    processed_at: string | null;
  }>
> {
  const reservation = await prisma.reservations.findUnique({
    where: { id: reservationId },
    include: {
      reservation_items: {
        include: { services: { select: { provider_id: true } } },
      },
    },
  });
  if (!reservation) throw AppError.notFound('Reservation not found');
  assertParticipant(
    reservation.client_id,
    reservation.reservation_items.map((i) => i.services.provider_id),
    actor,
  );

  const rows = await prisma.refunds.findMany({
    where: { reservation_id: reservationId },
    orderBy: { id: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    payment_id: r.payment_id,
    amount: toMoney(r.amount) ?? '0.00',
    reason: r.reason,
    status: r.status,
    processed_at: r.processed_at ? r.processed_at.toISOString() : null,
  }));
}