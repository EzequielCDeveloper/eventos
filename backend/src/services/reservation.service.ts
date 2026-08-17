import { Prisma } from '@prisma/client';
import type {
  reservations_status,
  services_service_type,
  package_members_service_type,
  reservations,
} from '@prisma/client';
import { prisma } from '../config/database';
import { AppError, type AuthUser } from '../types/api';
import {
  parseISODate,
  parseISOTime,
  toDateString,
  toTimeString,
} from '../utils/datetime';
import { createContractForReservation } from './contract.service';

/**
 * Reservation domain service (BR-005, D-007, D-008).
 *
 * Owns the 13-state reservation lifecycle state machine, the transactional
 * slot-availability check (SELECT ... FOR UPDATE — D-007), the forced
 * salon concurrency of 1 (BR-005.3), the cancellation-policy snapshot
 * taken at creation (BR-005.5) and the frozen price breakdown
 * `total_price = base + extras + taxes + commission` (BR-005.6).
 *
 * `reservation_status_history` rows are produced by the canonical DB
 * trigger `trg_reservation_status_audit` on every status-change UPDATE
 * (BR-005.4 — "via trigger or application logic"); the initial `creado`
 * row is written explicitly at creation because the trigger is UPDATE-only.
 *
 * Alcohol flow (BR-005.8): when a reservation is created with
 * `alcohol_requested`, an `alcohol_permits` row is created with status
 * `lista_espera` and the state machine halts at `permiso_alcohol` until
 * the H-5 decision (`continuar_sin_alcohol`/`cancelar`) or an approved
 * permit unlocks `pago_anticipo`.
 */

export type ReservationStatus = reservations_status;

/** Transition map (authoritative: flujo_de_reserva.md, diagram D1). */
const TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  creado: ['invitaciones_pendientes', 'disponibilidad_verificada', 'pendiente_firma', 'cancelada'],
  invitaciones_pendientes: ['invitaciones_aceptadas', 'creado', 'cancelada'],
  invitaciones_aceptadas: ['disponibilidad_verificada', 'cancelada'],
  disponibilidad_verificada: ['disponible_para_reserva', 'invitaciones_aceptadas', 'cancelada'],
  disponible_para_reserva: ['pendiente_firma', 'pago_anticipo', 'cancelada'],
  pendiente_firma: ['contrato_confirmado', 'cancelada'],
  contrato_confirmado: ['permiso_alcohol', 'pago_anticipo', 'cancelada'],
  permiso_alcohol: ['pago_anticipo', 'cancelada'],
  pago_anticipo: ['confirmada', 'cancelada'],
  confirmada: ['en_curso', 'cancelada'],
  en_curso: ['completada', 'cancelada'],
  completada: [],
  cancelada: [],
};

/** VAT rate applied at booking (Ley IVA MX 2026 — 16%). */
export const TAX_RATE = new Prisma.Decimal('0.16');

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function toMoney(value: Prisma.Decimal | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const decimal = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  return decimal.toFixed(2);
}

export function nextTransitions(status: ReservationStatus): ReservationStatus[] {
  return TRANSITIONS[status];
}

export function isTerminal(status: ReservationStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

// ---- Availability (transactional) ------------------------------------------

interface LockedSlot {
  slot_id: number;
  service_id: number;
  capacity: number;
  slot_date: string;
  start_time: string;
  end_time: string;
}

/**
 * Lock one inventory slot row with `SELECT ... FOR UPDATE` (D-007) so two
 * concurrent bookings of the same slot serialize: the second transaction
 * blocks until the first commits, then its re-read sees the committed
 * reservation_items and fails with RESERVATION_SLOT_CONFLICT.
 */
async function lockSlot(tx: Prisma.TransactionClient, slotId: number): Promise<LockedSlot> {
  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, service_id, capacity,
           DATE_FORMAT(slot_date, '%Y-%m-%d') AS slot_date,
           DATE_FORMAT(start_time, '%H:%i:%s') AS start_time,
           DATE_FORMAT(end_time, '%H:%i:%s') AS end_time
    FROM inventory_slots
    WHERE id = ${slotId}
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) throw AppError.notFound('Inventory slot not found');
  return {
    slot_id: Number(row.id),
    service_id: Number(row.service_id),
    capacity: Number(row.capacity),
    slot_date: String(row.slot_date),
    start_time: String(row.start_time),
    end_time: String(row.end_time),
  };
}

/**
 * Count active reservations occupying a service at the given date/time
 * window — the same semantics as the `v_slot_availability` view
 * (`status NOT IN ('cancelada','completada')`), so marketplace search and
 * transactional booking never disagree.
 */
async function activeReservationCount(
  tx: Prisma.TransactionClient,
  serviceId: number,
  date: string,
  start: string,
  end: string,
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ active_count: bigint }>>`
    SELECT COUNT(*) AS active_count
    FROM reservation_items ri
    JOIN reservations r ON r.id = ri.reservation_id
    WHERE ri.service_id = ${serviceId}
      AND DATE_FORMAT(r.event_date, '%Y-%m-%d') = ${date}
      AND DATE_FORMAT(r.start_time, '%H:%i:%s') = ${start}
      AND DATE_FORMAT(r.end_time, '%H:%i:%s') = ${end}
      AND r.status NOT IN ('cancelada', 'completada')
  `;
  return Number(rows[0]?.active_count ?? 0);
}

/**
 * Assert a slot can host one more active reservation. Salon services are
 * forced to a capacity of 1 at the application level (BR-005.3).
 */
async function assertSlotAvailable(
  tx: Prisma.TransactionClient,
  slot: LockedSlot,
  serviceType: services_service_type,
): Promise<void> {
  const effectiveCapacity = serviceType === 'salon' ? 1 : slot.capacity;
  const active = await activeReservationCount(tx, slot.service_id, slot.slot_date, slot.start_time, slot.end_time);
  if (active >= effectiveCapacity) {
    throw AppError.reservationSlotConflict(
      `Slot ${slot.slot_id} is fully booked (${active}/${effectiveCapacity} active reservations)`,
      {
        slot_id: slot.slot_id,
        service_id: slot.service_id,
        date: slot.slot_date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        active_reservations: active,
        capacity: effectiveCapacity,
      },
    );
  }
}

// ---- Dynamic pricing (D-007: computed at booking time only) ------------------

interface PricingRuleRow {
  id: number;
  adjustment_type: string;
  adjustment_value: Prisma.Decimal;
  scope: Prisma.JsonValue;
}

/** JS weekday (0=Sun..6=Sat) → canonical 1=Mon..7=Sun (operating_hours). */
function canonicalWeekday(date: Date): number {
  const js = date.getUTCDay();
  return js === 0 ? 7 : js;
}

function turnOfHour(hour: number): string {
  if (hour < 12) return 'manana';
  if (hour < 18) return 'tarde';
  return 'noche';
}

function scopeMatches(scope: Prisma.JsonValue, eventDate: Date, startTime: string): boolean {
  if (scope === null || scope === undefined) return true;
  if (typeof scope !== 'object' || Array.isArray(scope)) return true;
  const s = scope as Record<string, unknown>;

  let matched = false;

  const ranges = s.date_ranges;
  if (ranges !== undefined) {
    matched = false;
    const list = Array.isArray(ranges) ? ranges : [ranges];
    for (const range of list) {
      if (typeof range === 'string') {
        if (range === toDateString(eventDate)) matched = true;
      } else if (typeof range === 'object' && range !== null) {
        const r = range as Record<string, unknown>;
        const start = typeof r.start === 'string' ? r.start : null;
        const end = typeof r.end === 'string' ? r.end : null;
        const day = toDateString(eventDate);
        if (start !== null && end !== null && day >= start && day <= end) matched = true;
      }
    }
    if (!matched) return false;
  }

  const weekdays = s.weekdays;
  if (weekdays !== undefined) {
    if (!Array.isArray(weekdays)) return false;
    const day = canonicalWeekday(eventDate);
    if (!weekdays.some((w) => Number(w) === day)) return false;
  }

  const blocks = s.blocks;
  if (blocks !== undefined) {
    if (!Array.isArray(blocks)) return false;
    const hour = Number(startTime.slice(0, 2));
    if (!blocks.some((b) => String(b) === turnOfHour(hour))) return false;
  }

  return true;
}

/**
 * Sum of percentage adjustments from matching dynamic pricing rules
 * (D-007). `adjustment_value` is a percentage point over the base price
 * (negative = discount), per database_schema.sql; scope is a JSON of
 * date ranges / weekdays / block turns. Rules apply to the whole service
 * unless they target a specific sound package.
 */
async function dynamicAdjustmentAmount(
  tx: Prisma.TransactionClient,
  serviceId: number,
  soundPackageId: number | null,
  eventDate: Date,
  startTime: string,
  base: Prisma.Decimal,
): Promise<Prisma.Decimal> {
  const rules = await tx.dynamic_pricing_rules.findMany({
    where: {
      service_id: serviceId,
      ...(soundPackageId !== null
        ? { OR: [{ sound_package_id: null }, { sound_package_id: soundPackageId }] }
        : { sound_package_id: null }),
    },
  });
  let adjustment = new Prisma.Decimal(0);
  for (const rule of rules as PricingRuleRow[]) {
    if (scopeMatches(rule.scope, eventDate, startTime)) {
      adjustment = adjustment.add(base.mul(rule.adjustment_value).div(100));
    }
  }
  return adjustment;
}

// ---- Price computation -------------------------------------------------------

interface ItemPricingInput {
  service: { id: number; service_type: services_service_type; provider_id: number };
  sound_package_id: number | null;
  person_count: number | null;
  hours: number;
  eventDate: Date;
  startTime: string;
}

/** Price of one reservation item using its service_type pricing model. */
async function computeItemPrice(
  tx: Prisma.TransactionClient,
  item: ItemPricingInput,
): Promise<Prisma.Decimal> {
  const { service, sound_package_id, person_count, hours } = item;

  let raw: Prisma.Decimal;
  switch (service.service_type) {
    case 'salon': {
      const pricing = await tx.salon_pricing.findUnique({ where: { service_id: service.id } });
      if (!pricing) {
        throw AppError.conflict('Salon service has no salon_pricing row — cannot price the booking');
      }
      const baseHours = pricing.base_block_hours;
      const extraHours = Math.max(hours - baseHours, 0);
      raw = pricing.base_block_price.add(pricing.extra_hour_price.mul(extraHours));
      break;
    }
    case 'sonido': {
      if (sound_package_id === null) {
        throw AppError.conflict('Sound service bookings require a sound_package_id');
      }
      const pkg = await tx.sound_packages.findUnique({ where: { id: sound_package_id } });
      if (!pkg || pkg.service_id !== service.id) {
        throw AppError.notFound('Sound package not found for this service');
      }
      const extraHours = Math.max(hours - pkg.base_hours, 0);
      raw = pkg.base_price.add(pkg.extra_hour_price.mul(extraHours));
      break;
    }
    case 'servicio_persona': {
      if (!person_count || person_count < 1) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Persona service bookings require person_count >= 1',
        });
      }
      const pricing = await tx.service_persona_pricing.findUnique({
        where: { service_id: service.id },
      });
      if (!pricing) {
        throw AppError.conflict('Persona service has no service_persona_pricing row');
      }
      raw = pricing.price_per_person_per_hour.mul(person_count).mul(hours);
      break;
    }
  }

  const adjustment = await dynamicAdjustmentAmount(
    tx,
    service.id,
    sound_package_id,
    item.eventDate,
    item.startTime,
    raw,
  );
  return raw.add(adjustment);
}

/** Latest commission rate from `commission_settings` (BR-006.3). */
async function currentCommissionRate(tx: Prisma.TransactionClient): Promise<Prisma.Decimal> {
  const latest = await tx.commission_settings.findFirst({ orderBy: { changed_at: 'desc' } });
  if (!latest) return new Prisma.Decimal(0);
  return latest.commission_rate;
}

interface ExtrasInput {
  extra_id: number;
  quantity: number;
}

/** Ensure a set of extras can be selected for a service (belongs to it). */
async function loadExtras(
  tx: Prisma.TransactionClient,
  serviceId: number,
  extras: ExtrasInput[],
): Promise<Array<{ id: number; name: string; price: Prisma.Decimal }>> {
  const ids = extras.map((e) => e.extra_id);
  const rows = await tx.service_extras.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return extras.map((e) => {
    const row = byId.get(e.extra_id);
    if (!row) throw AppError.notFound(`Service extra ${e.extra_id} not found`);
    if (row.service_id !== serviceId) {
      throw AppError.conflict(`Extra ${e.extra_id} does not belong to this service`);
    }
    if (!Number.isInteger(e.quantity) || e.quantity < 1) {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'extra quantity must be a positive integer',
      });
    }
    return { id: row.id, name: row.name, price: row.price };
  });
}

// ---- Cancellation policy snapshot (BR-005.5) ---------------------------------

async function snapshotCancellationPolicy(
  tx: Prisma.TransactionClient,
  providerId: number,
): Promise<Prisma.JsonObject> {
  const policy = await tx.cancellation_policies.findUnique({ where: { provider_id: providerId } });
  if (!policy) {
    throw AppError.conflict('Provider has no cancellation policy — cannot create reservation');
  }
  return {
    policy_id: policy.id,
    provider_id: policy.provider_id,
    retention_percent: policy.retention_percent,
    penalty_free_window_days: policy.penalty_free_window_days,
    deposit_refundable: policy.deposit_refundable,
    snapshot_at: new Date().toISOString(),
  };
}

// ---- Creation ----------------------------------------------------------------

export interface CreateReservationInput {
  clientId: number;
  /** Simple booking: one inventory slot to book. */
  slotId?: number;
  /** Package booking: package + one slot per package member. */
  packageId?: number;
  slotIds?: number[];
  items?: Array<{ sound_package_id?: number; person_count?: number }>;
  extras?: ExtrasInput[];
  alcohol_requested?: boolean;
}

export interface ReservationDetail
  extends Omit<
    ReservationsRow,
    | 'event_date'
    | 'start_time'
    | 'end_time'
    | 'total_price'
    | 'base_amount'
    | 'extras_amount'
    | 'taxes_amount'
    | 'commission_amount'
    | 'commission_rate'
  > {
  id: number;
  event_date: string;
  start_time: string;
  end_time: string;
  total_price: string;
  base_amount: string;
  extras_amount: string;
  taxes_amount: string;
  commission_amount: string;
  commission_rate: string;
  next_transitions: ReservationStatus[];
  contract: { id: number; status: string } | null;
  items: Array<{
    id: number;
    service_id: number;
    service_type: services_service_type;
    service_title: string;
    unit_price_snapshot: string;
  }>;
}

type ReservationsRow = Omit<reservations, 'id'>;

async function toDetail(
  row: reservations,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<ReservationDetail> {
  const items = await client.reservation_items.findMany({
    where: { reservation_id: row.id },
    include: { services: { select: { id: true, title: true, service_type: true } } },
    orderBy: { id: 'asc' },
  });
  return {
    id: row.id,
    client_id: row.client_id,
    package_id: row.package_id,
    status: row.status,
    event_date: toDateString(row.event_date),
    start_time: toTimeString(row.start_time),
    end_time: toTimeString(row.end_time),
    block_hours: row.block_hours,
    extra_hours: row.extra_hours,
    total_price: toMoney(row.total_price) ?? '0.00',
    base_amount: toMoney(row.base_amount) ?? '0.00',
    extras_amount: toMoney(row.extras_amount) ?? '0.00',
    taxes_amount: toMoney(row.taxes_amount) ?? '0.00',
    commission_amount: toMoney(row.commission_amount) ?? '0.00',
    commission_rate: toMoney(row.commission_rate) ?? '0.00',
    cancellation_policy_snapshot: row.cancellation_policy_snapshot,
    created_at: row.created_at,
    updated_at: row.updated_at,
    cancelled_at: row.cancelled_at,
    completed_at: row.completed_at,
    next_transitions: nextTransitions(row.status),
    contract: await client.contracts
      .findUnique({ where: { reservation_id: row.id }, select: { id: true, status: true } })
      .then((c) => c ?? null),
    items: items.map((i) => ({
      id: i.id,
      service_id: i.service_id,
      service_type: i.services.service_type,
      service_title: i.services.title,
      unit_price_snapshot: toMoney(i.unit_price_snapshot) ?? '0.00',
    })),
  };
}

/** Duration in whole hours between two HH:MM(:SS) strings. */
function windowHours(start: string, end: string): number {
  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
  const endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));
  if (endMinutes <= startMinutes) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'end_time must be after start_time',
    });
  }
  return (endMinutes - startMinutes) / 60;
}

/**
 * Create a reservation atomically: lock the slot(s), validate availability,
 * price the items (D-007), snapshot the cancellation policy and write the
 * reservation + items + extras + initial history row in one transaction.
 * Concurrent bookings of the same slot: one succeeds, one gets
 * RESERVATION_SLOT_CONFLICT (BR-005.2).
 */
export async function createReservation(input: CreateReservationInput): Promise<ReservationDetail> {
  const { clientId } = input;
  const hasSimple = input.slotId !== undefined;
  const hasPackage = input.packageId !== undefined;
  if (hasSimple === hasPackage) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Provide exactly one of `slot_id` (simple booking) or `package_id` (package booking)',
    });
  }

  return prisma.$transaction(async (tx) => {
    let slotRows: LockedSlot[] = [];
    let packageId: number | null = null;
    let packageMembers: Array<{ provider_id: number; service_type: package_members_service_type; member_price: Prisma.Decimal | null }> = [];
    let packageLeaderId: number | null = null;
    let extraItemConfigs: NonNullable<CreateReservationInput['items']> = [];

    if (input.slotId !== undefined) {
      const slot = await lockSlot(tx, input.slotId);
      slotRows = [slot];
      extraItemConfigs = input.items ?? [];
    } else if (input.packageId !== undefined && input.slotIds !== undefined) {
      const pkg = await tx.packages.findUnique({
        where: { id: input.packageId },
        include: { package_members: { orderBy: { id: 'asc' } } },
      });
      if (!pkg) throw AppError.notFound('Package not found');
      if (pkg.status !== 'disponible_para_reserva') {
        throw AppError.conflict('Package is not available for booking', {
          package_status: pkg.status,
        });
      }
      // One slot per member PLUS one slot for the leader's salon service.
      if (input.slotIds.length !== pkg.package_members.length + 1) {
        throw AppError.conflict(
          `Package members: ${pkg.package_members.length} + 1 leader salon slot — provide exactly ${pkg.package_members.length + 1} slot_ids`,
        );
      }
      // Lock in ascending id order to keep concurrent package bookings deadlock-free.
      const ordered = [...input.slotIds].sort((a, b) => a - b);
      slotRows = [];
      for (const slotId of ordered) {
        slotRows.push(await lockSlot(tx, slotId));
      }
      packageId = pkg.id;
      packageLeaderId = pkg.leader_provider_id;
      packageMembers = pkg.package_members.map((m) => ({
        provider_id: m.provider_id,
        service_type: m.service_type,
        member_price: m.member_price,
      }));
      extraItemConfigs = input.items ?? [];
    } else {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: '`package_id` bookings require `slot_ids` (one per member plus the leader salon slot)',
      });
    }

    // Load the services behind the locked slots.
    const serviceIds = [...new Set(slotRows.map((s) => s.service_id))];
    const services = await tx.services.findMany({
      where: { id: { in: serviceIds }, deleted_at: null },
      select: { id: true, provider_id: true, service_type: true, title: true },
    });
    const serviceById = new Map(services.map((s) => [s.id, s]));
    for (const slot of slotRows) {
      const service = serviceById.get(slot.service_id);
      if (!service) {
        throw AppError.notFound(`Service for slot ${slot.slot_id} not found (deleted?)`);
      }
      await assertSlotAvailable(tx, slot, service.service_type);
    }

    // Validate the package layout: exactly one leader salon slot + one slot
    // per member whose service provider/type matches the member.
    if (packageId !== null && packageLeaderId !== null) {
      const leaderSlots = slotRows.filter(
        (s) => serviceById.get(s.service_id)?.provider_id === packageLeaderId,
      );
      if (leaderSlots.length !== 1) {
        throw AppError.conflict(
          'Package bookings need exactly one slot belonging to the leader salon service',
        );
      }
      const memberTypeByProvider = new Map(packageMembers.map((m) => [m.provider_id, m.service_type]));
      const memberSlots = slotRows.filter(
        (s) => serviceById.get(s.service_id)?.provider_id !== packageLeaderId,
      );
      if (memberSlots.length !== packageMembers.length) {
        throw AppError.conflict('Each package member needs exactly one slot');
      }
      for (const slot of memberSlots) {
        const service = serviceById.get(slot.service_id)!;
        const expectedType = memberTypeByProvider.get(service.provider_id);
        if (!expectedType || expectedType !== service.service_type) {
          throw AppError.conflict(
            `Slot ${slot.slot_id} does not match a package member of this provider/type`,
            { service_id: service.id, service_type: service.service_type, expected_type: expectedType },
          );
        }
      }
    }

    const firstService = serviceById.get(slotRows[0].service_id)!;
    // Package extras belong to the leader's salon service; simple bookings
    // attach extras to the single booked service.
    const extraHostServiceId =
      packageId !== null
        ? slotRows.find((s) => serviceById.get(s.service_id)?.provider_id === packageLeaderId)
            ?.service_id ?? firstService.id
        : firstService.id;
    const eventDate = parseISODate(slotRows[0].slot_date);
    if (!eventDate) throw new AppError({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'slot date is invalid' });
    if (slotRows.some((s) => s.slot_date !== slotRows[0].slot_date)) {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'All package slots must share the same date and time window',
      });
    }
    if (slotRows.some((s) => s.start_time !== slotRows[0].start_time || s.end_time !== slotRows[0].end_time)) {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'All package slots must share the same time window',
      });
    }
    const startTime = slotRows[0].start_time;
    const hours = windowHours(startTime, slotRows[0].end_time);

    // Price each item against the locked slot of its service.
    let baseAmount = new Prisma.Decimal(0);
    const itemRows: Array<{
      service_id: number;
      sound_package_id: number | null;
      person_count: number | null;
      hours: number;
      unit_price: Prisma.Decimal;
    }> = [];
    // Package members' agreed prices (BR-011.4), by provider id.
    const memberPriceByProvider = new Map(
      packageMembers
        .filter((m) => m.member_price !== null)
        .map((m) => [m.provider_id, m.member_price as Prisma.Decimal]),
    );

    for (let i = 0; i < slotRows.length; i += 1) {
      const slot = slotRows[i];
      const service = serviceById.get(slot.service_id)!;
      const config = extraItemConfigs[i] ?? {};
      const soundPackageId = config.sound_package_id ?? null;
      const personCount = config.person_count ?? null;

      const agreedPrice = packageId !== null ? memberPriceByProvider.get(service.provider_id) : undefined;
      const unitPrice =
        agreedPrice !== undefined
          ? agreedPrice
          : await computeItemPrice(tx, {
              service: { id: service.id, service_type: service.service_type, provider_id: service.provider_id },
              sound_package_id: soundPackageId,
              person_count: personCount,
              hours,
              eventDate,
              startTime,
            });
      baseAmount = baseAmount.add(unitPrice);
      itemRows.push({
        service_id: service.id,
        sound_package_id: soundPackageId,
        person_count: personCount,
        hours,
        unit_price: unitPrice,
      });
    }

    const extras = input.extras?.length
      ? await loadExtras(tx, extraHostServiceId, input.extras)
      : [];
    let extrasAmount = new Prisma.Decimal(0);
    for (const extra of extras) {
      const quantity = input.extras!.find((e) => e.extra_id === extra.id)!.quantity;
      extrasAmount = extrasAmount.add(extra.price.mul(quantity));
    }

    const commissionRate = await currentCommissionRate(tx);
    const commissionAmount = baseAmount.add(extrasAmount).mul(commissionRate).div(100);
    const taxesAmount = baseAmount.add(extrasAmount).add(commissionAmount).mul(TAX_RATE);
    const totalPrice = baseAmount.add(extrasAmount).add(taxesAmount).add(commissionAmount);

    const snapshot = await snapshotCancellationPolicy(tx, firstService.provider_id);

    const created = await tx.reservations.create({
      data: {
        client_id: clientId,
        package_id: packageId,
        status: 'creado',
        event_date: eventDate,
        start_time: parseISOTime(startTime) ?? new Date('1970-01-01T00:00:00Z'),
        end_time: parseISOTime(slotRows[0].end_time) ?? new Date('1970-01-01T00:00:00Z'),
        block_hours: Math.ceil(hours),
        extra_hours: 0,
        total_price: totalPrice,
        base_amount: baseAmount,
        extras_amount: extrasAmount,
        taxes_amount: taxesAmount,
        commission_amount: commissionAmount,
        commission_rate: commissionRate,
        cancellation_policy_snapshot: snapshot,
        updated_at: new Date(),
      },
    });

    await tx.reservation_items.createMany({
      data: itemRows.map((item) => ({
        reservation_id: created.id,
        service_id: item.service_id,
        sound_package_id: item.sound_package_id,
        person_count: item.person_count,
        hours: item.hours,
        unit_price_snapshot: item.unit_price,
      })),
    });

    if (extras.length) {
      await tx.reservation_extras.createMany({
        data: extras.map((extra) => ({
          reservation_id: created.id,
          extra_id: extra.id,
          quantity: input.extras!.find((e) => e.extra_id === extra.id)!.quantity,
          price_snapshot: extra.price,
        })),
      });
    }

    if (input.alcohol_requested) {
      await tx.alcohol_permits.create({
        data: {
          reservation_id: created.id,
          requested: true,
          status: 'lista_espera',
          consequences_notified_at: new Date(),
        },
      });
    }

    // Initial history row (the DB trigger is UPDATE-only, BR-005.4).
    await tx.reservation_status_history.create({
      data: {
        reservation_id: created.id,
        status: 'creado',
        changed_at: new Date(),
        changed_by: clientId,
      },
    });

    return toDetail(created, tx);
  });
}

// ---- State transitions -------------------------------------------------------

export interface StatusChangeInput {
  status: ReservationStatus;
  /** Required to leave `permiso_alcohol` (BR-005.8). */
  alcohol_resolution?: 'continuar_sin_alcohol' | 'cancelar';
  /** Marks the municipal permit as approved. */
  alcohol_status?: 'confirmado' | 'no_confirmado';
  cancel_reason?: string;
  /**
   * Client confirmation of the provider retention policy on a near-cancel
   * (BR-007.3). Recorded on the `cancellations` row; near-cancellations
   * without `retention_accepted: true` are rejected by the cancellation
   * service before reaching the state machine.
   */
  retention_accepted?: boolean;
}

/**
 * Advance (or regress where the machine allows) a reservation to `status`.
 *
 * Guards enforced:
 *   - transition must exist in the state machine (409 STATE_TRANSITION_INVALID)
 *   - `permiso_alcohol` requires an alcohol permit request
 *   - leaving `permiso_alcohol` requires the H-5 decision (BR-005.8)
 *   - `contrato_confirmado` for salon bookings requires the bilateral
 *     contract confirmation (via GET/PUT /contracts/:id/confirm)
 *
 * The `reservation_status_history` row for the new state is written by the
 * canonical `trg_reservation_status_audit` trigger.
 *
 * Accepts an optional transaction client so the contract flow can advance
 * the reservation inside its own transaction (atomic contract+reservation).
 */
export async function transitionStatus(
  reservationId: number,
  actor: AuthUser,
  change: StatusChangeInput,
  tx?: Prisma.TransactionClient,
): Promise<ReservationDetail> {
  const run = async (client: Prisma.TransactionClient): Promise<ReservationDetail> => {
    const reservation = await client.reservations.findUnique({
      where: { id: reservationId },
      include: {
        reservation_items: { include: { services: { select: { provider_id: true, service_type: true } } } },
        alcohol_permits: true,
        contracts: true,
      },
    });
    if (!reservation) throw AppError.notFound('Reservation not found');

    assertParticipantRow(reservation.client_id, reservation.reservation_items, actor);

    const current = reservation.status;
    const target = change.status;
    if (!TRANSITIONS[current].includes(target)) {
      throw AppError.stateTransitionInvalid(
        `Cannot move reservation from ${current} to ${target}`,
        { current, target, allowed: TRANSITIONS[current] },
      );
    }

    if (target === 'permiso_alcohol') {
      if (!reservation.alcohol_permits?.requested) {
        throw new AppError({
          statusCode: 409,
          code: 'STATE_TRANSITION_INVALID',
          message:
            'Cannot enter permiso_alcohol: no alcohol permit was requested at booking (BR-005.8)',
        });
      }
    }

    if (current === 'permiso_alcohol' && target === 'pago_anticipo') {
      if (reservation.alcohol_permits?.status === 'confirmado') {
        // Permit approved — continue.
      } else if (change.alcohol_resolution === 'continuar_sin_alcohol') {
        await client.alcohol_permits.update({
          where: { reservation_id: reservation.id },
          data: { status: 'no_confirmado', h5_decision: 'continuar_sin_alcohol' },
        });
      } else {
        throw new AppError({
          statusCode: 409,
          code: 'STATE_TRANSITION_INVALID',
          message:
            'Reservation is paused at permiso_alcohol (BR-005.8): provide `alcohol_resolution: "continuar_sin_alcohol"` or confirm the permit to continue',
        });
      }
    }

    if (current === 'permiso_alcohol' && target === 'cancelada') {
      await client.alcohol_permits.update({
        where: { reservation_id: reservation.id },
        data: { status: 'no_confirmado', h5_decision: 'cancelar' },
      });
    }

    if (target === 'pendiente_firma') {
      const hasSalon = reservation.reservation_items.some(
        (i) => i.services.service_type === 'salon',
      );
      if (hasSalon && !reservation.contracts) {
        await createContractForReservation(client, reservation.id);
      }
    }

    if (target === 'contrato_confirmado') {
      const hasSalon = reservation.reservation_items.some(
        (i) => i.services.service_type === 'salon',
      );
      if (hasSalon) {
        const contract = reservation.contracts;
        if (!contract || !contract.client_confirmed_at || !contract.provider_confirmed_at) {
          throw new AppError({
            statusCode: 409,
            code: 'STATE_TRANSITION_INVALID',
            message:
              'Salon reservations require bilateral contract confirmation (BR-012.6): confirm both parties via PUT /contracts/:id/confirm',
          });
        }
      }
    }

    const data: Prisma.reservationsUpdateInput = {
      status: target,
      updated_at: new Date(),
    };
    if (target === 'cancelada') {
      data.cancelled_at = new Date();
    }
    if (target === 'completada') {
      data.completed_at = new Date();
    }

    const updated = await client.reservations.update({ where: { id: reservation.id }, data });

    if (target === 'cancelada') {
      await recordCancellation(
        client,
        updated,
        actor,
        change.cancel_reason,
        change.retention_accepted,
      );
    }

    return toDetail(updated, client);
  };

  if (tx) return run(tx);
  return prisma.$transaction(run);
}

/** Persist a `cancellations` row when the reservation is cancelled. */
async function recordCancellation(
  tx: Prisma.TransactionClient,
  reservation: reservations,
  actor: AuthUser,
  reason?: string,
  retentionAccepted?: boolean,
): Promise<void> {
  const cancelledBy = actor.role === 'usuario' ? 'cliente' : 'proveedor';
  const snapshot = (reservation.cancellation_policy_snapshot ?? {}) as Record<string, unknown>;
  const freeDays = Number(snapshot.penalty_free_window_days ?? 0);
  const daysToEvent = Math.ceil(
    (reservation.event_date.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  const timing = daysToEvent >= freeDays ? 'lejana' : 'cercana';
  await tx.cancellations.create({
    data: {
      reservation_id: reservation.id,
      cancelled_by: cancelledBy,
      timing,
      retention_percent:
        snapshot.retention_percent !== undefined
          ? money(Number(snapshot.retention_percent))
          : null,
      // BR-007.3: near-cancellations record whether the client accepted the
      // retention policy; `retention_accepted: true` is enforced by the
      // cancellation service before this write (default false when omitted).
      retention_accepted: timing === 'cercana' ? retentionAccepted === true : null,
      reason: reason ?? null,
    },
  });
}

// ---- Reads ----------------------------------------------------------------

/** Assert the actor is the client, a participating provider, or an admin. */
function assertParticipantRow(
  clientId: number,
  items: Array<{ services: { provider_id: number } }>,
  actor: AuthUser,
): void {
  if (actor.role === 'administrador') return;
  if (actor.id === clientId) return;
  if (items.some((i) => i.services.provider_id === actor.id)) return;
  throw AppError.forbidden('This reservation belongs to another user');
}

export interface ReservationListFilters {
  status?: ReservationStatus;
  event_date?: string;
}

/**
 * GET /reservations — actor-scoped list (UR-002.7):
 * client sees own, provider sees reservations on their services, admin sees all.
 */
export async function listReservations(
  actor: AuthUser,
  filters: ReservationListFilters,
  pagination: { page: number; limit: number },
): Promise<{ items: ReservationDetail[]; meta: { total: number; page: number; limit: number; pages: number } }> {
  const where: Prisma.reservationsWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.event_date) {
    const date = parseISODate(filters.event_date);
    if (!date) {
      throw new AppError({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'event_date must be YYYY-MM-DD' });
    }
    where.event_date = date;
  }

  if (actor.role === 'usuario') {
    where.client_id = actor.id;
  } else if (actor.role === 'prestador') {
    where.reservation_items = { some: { services: { provider_id: actor.id } } };
  }

  const [rows, total] = await Promise.all([
    prisma.reservations.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
    prisma.reservations.count({ where }),
  ]);

  const items: ReservationDetail[] = [];
  for (const row of rows) {
    items.push(await toDetail(row));
  }

  return {
    items,
    meta: {
      total,
      page: pagination.page,
      limit: pagination.limit,
      pages: total === 0 ? 0 : Math.ceil(total / pagination.limit),
    },
  };
}

export interface TimelineEntry {
  id: number;
  status: ReservationStatus;
  changed_at: string;
  changed_by: number | null;
}

/** GET /reservations/:id/timeline — full audit trail (UR-002.7, BR-005.4). */
export async function getReservationTimeline(
  reservationId: number,
  actor: AuthUser,
): Promise<TimelineEntry[]> {
  const reservation = await prisma.reservations.findUnique({
    where: { id: reservationId },
    include: { reservation_items: { include: { services: { select: { provider_id: true } } } } },
  });
  if (!reservation) throw AppError.notFound('Reservation not found');
  assertParticipantRow(reservation.client_id, reservation.reservation_items, actor);

  const rows = await prisma.reservation_status_history.findMany({
    where: { reservation_id: reservationId },
    orderBy: { changed_at: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    changed_at: r.changed_at.toISOString(),
    changed_by: r.changed_by,
  }));
}