import { Prisma } from '@prisma/client';
import type { payments_payment_type, refunds_reason } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError, type AuthUser } from '../types/api';
import { toISOStringOrNull } from '../utils/datetime';
import { toMoney } from './reservation.service';
import { createCharge, createRefund } from '../integrations/conekta';

/**
 * Payment domain service (BR-006, D-003, UR-002.9).
 *
 * Owns the three payment types (`anticipo`, `saldo`, `deposito_garantia`),
 * the flexible billing models (BR-006.6), the Conekta charge/refund flow and
 * the per-provider monthly tax report (BR-006.8).
 *
 * ### Commission (BR-006.3)
 *
 * The commission rate is frozen into `reservations.commission_amount` /
 * `commission_rate` at booking time (D-007 — price frozen at confirmation,
 * computed from the latest `commission_settings` row at that moment, see
 * `reservation.service.createReservation`). Payments therefore attribute
 * commission proportionally from the **frozen** reservation amounts, so a
 * settings change after booking never rewrites an existing price. The
 * latest `commission_settings` row continues to govern NEW reservations
 * (`latestCommissionRate()`).
 *
 * ### Currency (BR-006.5)
 *
 * MXN-only is enforced at the application layer (any non-MXN currency is
 * rejected here) AND at the database layer (`chk_payments_currency` CHECK
 * constraint on `payments.currency`). The Conekta client additionally
 * rejects non-MXN before any charge is attempted.
 *
 * ### Billing models (BR-006.6)
 *
 *   - `anticipo` (mandatory advance): the client pays an advance first,
 *     then the balance (`saldo`) before the event; `due_date = event_date`.
 *   - `completo` (full pre-event): a single `saldo` covering the whole
 *     price before the event; no advance is used.
 *   - `post_servicio` (post-service): the balance is charged after the
 *     service, so `saldo` is only accepted while the reservation is
 *     `en_curso` or `completada`.
 *
 * The model is request-time policy (the adopted schema has no
 * `billing_model` column); the payments table schedules it via `due_date`.
 */

export type BillingModel = 'anticipo' | 'completo' | 'post_servicio';

export interface RefundDetail {
  id: number;
  payment_id: number;
  reservation_id: number;
  amount: string;
  reason: refunds_reason;
  status: string;
  processed_at: string | null;
  created_at: string;
}

export interface PaymentDetail {
  id: number;
  reservation_id: number;
  payment_type: payments_payment_type;
  amount: string;
  currency: string;
  status: string;
  conekta_charge_id: string | null;
  due_date: string | null;
  charged_at: string | null;
  created_at: string;
  refunds: RefundDetail[];
  reservation: {
    id: number;
    status: string;
    total_price: string;
    commission_amount: string;
    commission_rate: string;
    event_date: string;
  };
}

type PaymentWithRefunds = Prisma.paymentsGetPayload<{
  include: { refunds: true; reservations: true };
}>;

async function toDetail(
  payment: PaymentWithRefunds,
): Promise<PaymentDetail> {
  const r = payment.reservations;
  return {
    id: payment.id,
    reservation_id: payment.reservation_id,
    payment_type: payment.payment_type,
    amount: toMoney(payment.amount) ?? '0.00',
    currency: payment.currency,
    status: payment.status,
    conekta_charge_id: payment.conekta_charge_id,
    due_date: toISOStringOrNull(payment.due_date),
    charged_at: toISOStringOrNull(payment.charged_at),
    created_at: payment.created_at.toISOString(),
    refunds: payment.refunds.map((rf) => ({
      id: rf.id,
      payment_id: rf.payment_id,
      reservation_id: rf.reservation_id,
      amount: toMoney(rf.amount) ?? '0.00',
      reason: rf.reason,
      status: rf.status,
      processed_at: toISOStringOrNull(rf.processed_at),
      created_at: rf.created_at.toISOString(),
    })),
    reservation: {
      id: r.id,
      status: r.status,
      total_price: toMoney(r.total_price) ?? '0.00',
      commission_amount: toMoney(r.commission_amount) ?? '0.00',
      commission_rate: toMoney(r.commission_rate) ?? '0.00',
      event_date: r.event_date.toISOString().slice(0, 10),
    },
  };
}

function money(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/** Latest commission rate from `commission_settings` (BR-006.3). */
export async function latestCommissionRate(): Promise<string> {
  const latest = await prisma.commission_settings.findFirst({
    orderBy: { changed_at: 'desc' },
  });
  return latest ? toMoney(latest.commission_rate) ?? '0.00' : '0.00';
}

// ---- Actor/state guards ----------------------------------------------------

function assertCanProcessPayments(reservationId: number, actor: AuthUser): Promise<void> {
  return assertReservationAccess(reservationId, actor, { payerOnly: true });
}

async function assertReservationAccess(
  reservationId: number,
  actor: AuthUser,
  opts: { payerOnly: boolean },
): Promise<void> {
  const reservation = await prisma.reservations.findUnique({
    where: { id: reservationId },
    include: {
      reservation_items: { include: { services: { select: { provider_id: true } } } },
    },
  });
  if (!reservation) throw AppError.notFound('Reservation not found');

  if (actor.role === 'administrador') return;
  if (opts.payerOnly) {
    // Only the paying client (or an admin) may initiate a charge.
    if (actor.id !== reservation.client_id) {
      throw AppError.forbidden('Only the reservation client can pay for it');
    }
    return;
  }
  // Participant read: client, any participating provider, or admin.
  if (actor.id === reservation.client_id) return;
  if (reservation.reservation_items.some((i) => i.services.provider_id === actor.id)) return;
  throw AppError.forbidden('This payment belongs to another reservation');
}

/** States in which a payment row may be created/paid per billing model. */
function assertPaymentAllowedInState(
  model: BillingModel,
  paymentType: payments_payment_type,
  reservationStatus: string,
): void {
  const failure = (expected: string[]) =>
    new AppError({
      statusCode: 409,
      code: 'STATE_TRANSITION_INVALID',
      message: `Payment of type '${paymentType}' is not allowed while the reservation is '${reservationStatus}'`,
      details: { expected_states: expected, billing_model: model },
    });

  if (paymentType === 'anticipo') {
    if (model === 'completo') {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: "Billing model 'completo' does not use advance payments",
        details: { billing_model: model },
      });
    }
    if (reservationStatus !== 'pago_anticipo') throw failure(['pago_anticipo']);
    return;
  }

  if (paymentType === 'saldo') {
    if (model === 'anticipo') {
      // Advance model: the balance is due after the advance is paid, while
      // the reservation is confirmed (pre-event) or already in progress.
      if (!['confirmada', 'en_curso', 'completada'].includes(reservationStatus)) {
        throw failure(['confirmada', 'en_curso', 'completada']);
      }
    } else if (model === 'completo') {
      // Full pre-event payment covering the whole price.
      if (!['pago_anticipo', 'confirmada', 'en_curso'].includes(reservationStatus)) {
        throw failure(['pago_anticipo', 'confirmada', 'en_curso']);
      }
    } else {
      // post_servicio: balance charged after the service.
      if (!['en_curso', 'completada'].includes(reservationStatus)) {
        throw failure(['en_curso', 'completada']);
      }
    }
    return;
  }

  // deposito_garantia: held once the booking is confirmed.
  if (paymentType === 'deposito_garantia') {
    if (!['confirmada', 'en_curso', 'completada'].includes(reservationStatus)) {
      throw failure(['confirmada', 'en_curso', 'completada']);
    }
  }
}

// ---- Process payment -------------------------------------------------------

export interface ProcessPaymentInput {
  reservationId: number;
  actor: AuthUser;
  paymentType: payments_payment_type;
  amount: number | string;
  currency?: string;
  billingModel?: BillingModel;
  description?: string;
}

/**
 * Process a payment via Conekta (BR-006.1–BR-006.6):
 * validate actor/state/currency/amount → create the payment row (pendiente)
 * → charge Conekta → store `conekta_charge_id` and move the payment to
 * `procesado` (or `fallido` + PAYMENT_FAILED on charge error).
 */
export async function processPayment(input: ProcessPaymentInput): Promise<PaymentDetail> {
  const { reservationId, actor, paymentType, billingModel = 'anticipo' } = input;
  const currency = input.currency ?? 'MXN';

  if (currency !== 'MXN') {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `Only MXN is accepted (BR-006.5); received '${currency}'`,
      details: { currency },
    });
  }

  const amount = money(input.amount);
  if (amount.lte(0)) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Payment amount must be greater than zero',
    });
  }

  await assertCanProcessPayments(reservationId, actor);

  const reservation = await prisma.reservations.findUnique({
    where: { id: reservationId },
    include: { payments: { include: { refunds: true } } },
  });
  if (!reservation) throw AppError.notFound('Reservation not found');
  if (reservation.status === 'cancelada') {
    throw AppError.conflict('Cannot pay a cancelled reservation');
  }

  assertPaymentAllowedInState(billingModel, paymentType, reservation.status);

  // Overpay guard: anticipo + saldo must never exceed the frozen total
  // (the deposito_garantia is a separate hold, not part of the price).
  if (paymentType !== 'deposito_garantia') {
    const paidTowardsPrice = reservation.payments
      .filter((p) => p.status !== 'fallido' && p.payment_type !== 'deposito_garantia')
      .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
    const afterThis = paidTowardsPrice.add(amount);
    if (afterThis.gt(reservation.total_price)) {
      throw AppError.conflict('Payment exceeds the outstanding reservation balance', {
        already_paid: toMoney(paidTowardsPrice),
        total_price: toMoney(reservation.total_price),
        requested: toMoney(amount),
      });
    }
  } else {
    // One active (non-refunded) security deposit per reservation.
    const existingDeposit = reservation.payments.find(
      (p) => p.payment_type === 'deposito_garantia' && p.status === 'retenido',
    );
    if (existingDeposit) {
      throw AppError.conflict('A security deposit is already held for this reservation', {
        payment_id: existingDeposit.id,
      });
    }
  }

  // Billing model drives the saldo due date (BR-006.6).
  const dueDate = computeDueDate(billingModel, paymentType, reservation.event_date);

  // 1) Reserve the payment row (pendiente), 2) charge, 3) persist the result.
  const payment = await prisma.payments.create({
    data: {
      reservation_id: reservationId,
      payment_type: paymentType,
      amount,
      currency,
      status: 'pendiente',
      ...(dueDate ? { due_date: dueDate } : {}),
    },
  });

  const metadata = {
    payment_id: payment.id,
    reservation_id: reservationId,
    payment_type: paymentType,
    description: input.description ?? `Pago ${paymentType} — reserva ${reservationId}`,
    customer_id: String(actor.id),
    customer_name: 'Cliente Plataforma Eventos',
  };

  let charge;
  try {
    charge = await createCharge(amount, metadata, currency);
  } catch (error) {
    await prisma.payments.update({
      where: { id: payment.id },
      data: { status: 'fallido' },
    });
    throw error;
  }

  const charged = await prisma.payments.update({
    where: { id: payment.id },
    data: {
      conekta_charge_id: charge.id,
      status: paymentType === 'deposito_garantia' ? 'retenido' : 'procesado',
      charged_at: new Date(),
    },
    include: { refunds: true, reservations: true },
  });

  return toDetail(charged);
}

function computeDueDate(
  model: BillingModel,
  paymentType: payments_payment_type,
  eventDate: Date,
): Date | null {
  if (paymentType === 'saldo') {
    if (model === 'post_servicio') {
      const nextDay = new Date(eventDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      return nextDay;
    }
    return eventDate;
  }
  return null;
}

// ---- Reads ----------------------------------------------------------------

/**
 * GET /payments/:id — participant-scoped read (UR-002.9): client,
 * participating provider, or admin.
 */
export async function getPayment(paymentId: number, actor: AuthUser): Promise<PaymentDetail> {
  const payment = await prisma.payments.findUnique({
    where: { id: paymentId },
    include: { refunds: true, reservations: true },
  });
  if (!payment) throw AppError.notFound('Payment not found');
  await assertReservationAccess(payment.reservation_id, actor, { payerOnly: false });
  return toDetail(payment);
}

/** List payments of one reservation (internal; used by routes/tests). */
export async function listPaymentsByReservation(
  reservationId: number,
  actor: AuthUser,
): Promise<PaymentDetail[]> {
  await assertReservationAccess(reservationId, actor, { payerOnly: false });
  const rows = await prisma.payments.findMany({
    where: { reservation_id: reservationId },
    include: { refunds: true, reservations: true },
    orderBy: { id: 'asc' },
  });
  const details: PaymentDetail[] = [];
  for (const row of rows) details.push(await toDetail(row));
  return details;
}

// ---- Refund ---------------------------------------------------------------

export interface RefundPaymentInput {
  paymentId: number;
  actor: AuthUser;
  /** Optional partial amount; defaults to full refundable balance. */
  amount?: number | string;
  reason: refunds_reason;
}

/**
 * Refund (part of) a processed payment via Conekta (BR-006.6, BR-007).
 * Persists a `refunds` row; a full refund moves the payment to
 * `reembolsado` (`devuelto` for a security deposit). Partial refunds keep
 * the payment `procesado`/`retenido`.
 */
export async function refundPayment(input: RefundPaymentInput): Promise<PaymentDetail> {
  const { paymentId, actor, reason } = input;
  const payment = await prisma.payments.findUnique({
    where: { id: paymentId },
    include: { refunds: true, reservations: true },
  });
  if (!payment) throw AppError.notFound('Payment not found');
  await assertReservationAccess(payment.reservation_id, actor, { payerOnly: false });

  if (!['procesado', 'retenido'].includes(payment.status)) {
    throw AppError.conflict(`Payment is not refundable in status '${payment.status}'`);
  }
  if (!payment.conekta_charge_id) {
    throw AppError.conflict('Payment has no Conekta charge to refund');
  }

  const refundedSoFar = payment.refunds
    .filter((rf) => rf.status === 'procesado')
    .reduce((sum, rf) => sum.add(rf.amount), new Prisma.Decimal(0));
  const refundable = payment.amount.sub(refundedSoFar);
  if (refundable.lte(0)) {
    throw AppError.conflict('Payment is already fully refunded');
  }

  const requested = input.amount !== undefined ? money(input.amount) : refundable;
  if (requested.lte(0) || requested.gt(refundable)) {
    throw AppError.conflict('Refund amount exceeds the refundable balance', {
      refundable: toMoney(refundable),
      requested: toMoney(requested),
    });
  }

  await createRefund(payment.conekta_charge_id, requested);

  await prisma.refunds.create({
    data: {
      payment_id: payment.id,
      reservation_id: payment.reservation_id,
      amount: requested,
      reason,
      status: 'procesado',
      processed_at: new Date(),
    },
  });

  const fullyRefunded = refundable.equals(requested);
  const updated = await prisma.payments.update({
    where: { id: payment.id },
    data: fullyRefunded
      ? { status: payment.payment_type === 'deposito_garantia' ? 'devuelto' : 'reembolsado' }
      : {},
    include: { refunds: true, reservations: true },
  });

  return toDetail(updated);
}

// ---- Monthly tax report (BR-006.8) ----------------------------------------

export interface ProviderMonthlyReport {
  provider_id: number;
  year: number;
  month: number;
  transactions: number;
  gross: string;
  taxes: string;
  commission: string;
  net: string;
}

/**
 * Per-provider monthly report: transactions, gross, taxes, commission and
 * net (BR-006.8). Commission/taxes are attributed proportionally from the
 * reservation's frozen amounts, matching how the price was built at booking
 * (D-007). CFDI generation stays DEFERRED (user decision); the report is
 * the accounting view.
 */
export async function providerMonthlyReport(
  providerId: number,
  year: number,
  month: number,
): Promise<ProviderMonthlyReport> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const payments = await prisma.payments.findMany({
    where: {
      status: { in: ['procesado', 'reembolsado', 'retenido', 'devuelto'] },
      charged_at: { gte: start, lt: end },
      reservations: {
        reservation_items: { some: { services: { provider_id: providerId } } },
      },
    },
    include: { reservations: true },
  });

  let gross = new Prisma.Decimal(0);
  let taxes = new Prisma.Decimal(0);
  let commission = new Prisma.Decimal(0);

  for (const p of payments) {
    const r = p.reservations;
    const total = r.total_price;
    if (total.lte(0)) continue;
    const share = p.amount.div(total);
    gross = gross.add(p.amount);
    taxes = taxes.add(r.taxes_amount.mul(share));
    commission = commission.add(r.commission_amount.mul(share));
  }

  const net = gross.sub(commission);

  return {
    provider_id: providerId,
    year,
    month,
    transactions: payments.length,
    gross: toMoney(gross) ?? '0.00',
    taxes: toMoney(taxes) ?? '0.00',
    commission: toMoney(commission) ?? '0.00',
    net: toMoney(net) ?? '0.00',
  };
}