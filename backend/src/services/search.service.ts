import { Prisma } from '@prisma/client';
import type {
  services_location_type,
  services_service_type,
  services_status,
} from '@prisma/client';
import { prisma } from '../config/database';
import { buildPaginationMeta, parsePagination, type PaginationMeta } from '../types/api';
import { toDateString, toTimeString } from '../utils/datetime';
import { signedPhotoUrl } from './storage.service';

/**
 * Service search & read service (BR-001.6, BR-001.7, BR-004.9, D-002).
 *
 * Search is one parameterized SQL query: the 8+ filter dimensions
 * (service type, date, capacity, zone, budget, event type, pool, internet,
 * rating) map to WHERE clauses exactly as D-002 prescribes, with the
 * `v_slot_availability` view driving the date/availability dimension.
 * Prisma `$queryRaw` + `Prisma.sql` keep every value parameterized.
 *
 * Money values stay DECIMAL in the DB and are serialized as two-decimal
 * strings in responses (BR-004 DECIMAL(10,2) contract).
 */

export type SearchSort =
  | 'created:desc'
  | 'rating:desc'
  | 'price:asc'
  | 'price:desc'
  | 'name:asc';

export interface SearchFilters {
  serviceType?: services_service_type;
  /** UTC-midnight Date for the availability dimension (v_slot_availability). */
  date?: Date;
  capacity?: number;
  zone?: string;
  minPrice?: number;
  maxPrice?: number;
  eventTypeId?: number;
  eventTypeName?: string;
  pool?: boolean;
  internet?: boolean;
  minRating?: number;
  sort: SearchSort;
}

export interface ServiceSummary {
  id: number;
  title: string;
  description: string;
  service_type: services_service_type;
  status: services_status;
  location_type: services_location_type;
  location: unknown;
  coverage_area: unknown;
  max_capacity: number;
  price: string | null;
  main_photo_url: string | null;
  avg_rating: number | null;
  review_count: number;
  provider_name: string;
  provider_verified: boolean;
  created_at: string;
}

export interface SearchResult {
  items: ServiceSummary[];
  meta: PaginationMeta;
}

interface SearchRow {
  id: number | bigint;
  title: string;
  description: string;
  service_type: services_service_type;
  status: services_status;
  location_type: services_location_type;
  location: unknown;
  coverage_area: unknown;
  max_capacity: number | bigint;
  price: Prisma.Decimal | string | number | null;
  main_photo_url: string | null;
  avg_rating: Prisma.Decimal | string | number | null;
  review_count: bigint | number | null;
  provider_name: string;
  provider_verified: number | boolean;
  created_at: Date;
}

/** DECIMAL / string / number → fixed two-decimal money string (BR-004). */
function toMoney(value: Prisma.Decimal | string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Prisma.Decimal) return value.toFixed(2);
  if (typeof value === 'string') return Number(value).toFixed(2);
  return value.toFixed(2);
}

function toRow(row: SearchRow): ServiceSummary {
  return {
    // MariaDB returns UNSIGNED INT as BigInt in raw queries — normalize.
    id: Number(row.id),
    title: row.title,
    description: row.description,
    service_type: row.service_type,
    status: row.status,
    location_type: row.location_type,
    location: row.location,
    coverage_area: row.coverage_area,
    max_capacity: Number(row.max_capacity),
    price: toMoney(row.price),
    // Photos are stored as raw paths; re-sign a fresh long-lived URL on read
    // so marketplace cards never 403 (work-unit C TTL fix).
    main_photo_url: row.main_photo_url ? signedPhotoUrl(row.main_photo_url) : null,
    avg_rating:
      row.avg_rating === null || row.avg_rating === undefined
        ? null
        : Number(row.avg_rating),
    review_count: Number(row.review_count ?? 0),
    provider_name: row.provider_name,
    provider_verified: Boolean(row.provider_verified),
    created_at: row.created_at.toISOString(),
  };
}

/** Shared FROM/JOIN fragment — reused by the count and page queries. */
const fromJoins = Prisma.sql`
FROM services s
JOIN users u ON u.id = s.provider_id
LEFT JOIN (
    SELECT ri.service_id, AVG(rv.rating) AS avg_rating, COUNT(rv.id) AS review_count
    FROM reviews rv
    JOIN reservations r ON r.id = rv.reservation_id
    JOIN reservation_items ri ON ri.reservation_id = r.id
    GROUP BY ri.service_id
) rag ON rag.service_id = s.id
`;

/** WHERE fragment built from the active filters (D-002). */
function whereSql(filters: SearchFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`s.deleted_at IS NULL`,
    // Marketplaces only surface published services; drafts stay private.
    Prisma.sql`s.status = 'publicado'`,
  ];

  if (filters.serviceType) {
    conditions.push(Prisma.sql`s.service_type = ${filters.serviceType}`);
  }
  if (filters.date) {
    conditions.push(Prisma.sql`
      EXISTS (
        SELECT 1 FROM v_slot_availability va
        WHERE va.service_id = s.id
          AND va.slot_date = ${filters.date}
          AND va.status_indicator <> 'lleno'
      )
    `);
  }
  if (filters.capacity !== undefined) {
    conditions.push(Prisma.sql`s.max_capacity >= ${filters.capacity}`);
  }
  if (filters.zone) {
    // Zone dimension: case-insensitive substring match on the address in
    // the `location` JSON (lat/lng/address per canonical schema). A future
    // geocoder can upgrade this to polygon/radius filtering without API
    // changes (documented MVP limitation).
    conditions.push(Prisma.sql`
      LOWER(JSON_UNQUOTE(JSON_EXTRACT(s.location, '$.address'))) LIKE ${`%${filters.zone}%`}
    `);
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const min = filters.minPrice ?? Number.MIN_SAFE_INTEGER;
    const max = filters.maxPrice ?? Number.MAX_SAFE_INTEGER;
    conditions.push(Prisma.sql`
      EXISTS (
        SELECT 1 FROM (
          SELECT service_id, base_block_price AS price FROM salon_pricing
          UNION ALL SELECT service_id, base_price FROM sound_packages
          UNION ALL SELECT service_id, price_per_person_per_hour FROM service_persona_pricing
        ) p
        WHERE p.service_id = s.id AND p.price BETWEEN ${min} AND ${max}
      )
    `);
  }
  if (filters.eventTypeId !== undefined || filters.eventTypeName) {
    conditions.push(Prisma.sql`
      EXISTS (
        SELECT 1 FROM service_service_event_types ev
        JOIN service_event_types et ON et.id = ev.event_type_id
        WHERE ev.service_id = s.id
          AND (${filters.eventTypeName ? Prisma.sql`et.name = ${filters.eventTypeName}` : Prisma.sql`FALSE`}
               OR ${filters.eventTypeId !== undefined ? Prisma.sql`ev.event_type_id = ${filters.eventTypeId}` : Prisma.sql`FALSE`})
      )
    `);
  }
  if (filters.pool) {
    conditions.push(Prisma.sql`
      EXISTS (
        SELECT 1 FROM service_amenities sa
        JOIN amenities a ON a.id = sa.amenity_id
        WHERE sa.service_id = s.id AND a.name = 'Alberca'
      )
    `);
  }
  if (filters.internet) {
    conditions.push(Prisma.sql`
      EXISTS (
        SELECT 1 FROM service_amenities sa
        JOIN amenities a ON a.id = sa.amenity_id
        WHERE sa.service_id = s.id AND a.name IN ('Internet', 'Wi-Fi')
      )
    `);
  }
  if (filters.minRating !== undefined) {
    conditions.push(Prisma.sql`rag.avg_rating >= ${filters.minRating}`);
  }

  return conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;
}

function orderBySql(filters: SearchFilters): Prisma.Sql {
  switch (filters.sort) {
    case 'rating:desc':
      return Prisma.sql`ORDER BY rag.avg_rating IS NULL, rag.avg_rating DESC, s.id DESC`;
    case 'price:asc':
      return Prisma.sql`ORDER BY price IS NULL, price ASC, s.id ASC`;
    case 'price:desc':
      return Prisma.sql`ORDER BY price IS NULL, price DESC, s.id DESC`;
    case 'name:asc':
      return Prisma.sql`ORDER BY s.title ASC, s.id ASC`;
    default:
      return Prisma.sql`ORDER BY s.created_at DESC, s.id DESC`;
  }
}

/**
 * Search published services with the full filter matrix (BR-001.6–BR-001.7).
 * Returns the page plus `meta { total, page, limit, pages }` (UR-001.1).
 */
export async function searchServices(
  filters: SearchFilters,
  query: unknown,
): Promise<SearchResult> {
  const pagination = parsePagination(query);

  const priceExpr = Prisma.sql`
    CASE s.service_type
      WHEN 'salon' THEN (SELECT sp.base_block_price FROM salon_pricing sp WHERE sp.service_id = s.id LIMIT 1)
      WHEN 'sonido' THEN (SELECT MIN(sdp.base_price) FROM sound_packages sdp WHERE sdp.service_id = s.id)
      WHEN 'servicio_persona' THEN (SELECT pp.price_per_person_per_hour FROM service_persona_pricing pp WHERE pp.service_id = s.id LIMIT 1)
    END
  `;

  const where = whereSql(filters);
  const orderBy = orderBySql(filters);

  const [rows, totalRow] = await Promise.all([
    prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      SELECT
        s.id, s.title, s.description, s.service_type, s.status, s.location_type,
        s.location, s.coverage_area, s.max_capacity,
        ${priceExpr} AS price,
        (
          SELECT pp.url FROM service_photos pp
          WHERE pp.service_id = s.id AND pp.status = 'aprobada'
          ORDER BY pp.position ASC LIMIT 1
        ) AS main_photo_url,
        rag.avg_rating, rag.review_count,
        u.full_name AS provider_name,
        u.verified AS provider_verified,
        s.created_at
      ${fromJoins}
      ${where}
      ${orderBy}
      LIMIT ${pagination.limit} OFFSET ${(pagination.page - 1) * pagination.limit}
    `),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS total
      ${fromJoins}
      ${where}
    `),
  ]);

  const total = Number(totalRow[0]?.total ?? 0);
  return {
    items: rows.map(toRow),
    meta: buildPaginationMeta(total, pagination),
  };
}

export interface ServiceDetail {
  id: number;
  title: string;
  description: string;
  service_type: services_service_type;
  status: services_status;
  location_type: services_location_type;
  location: unknown;
  coverage_area: unknown;
  max_capacity: number;
  approval_mode: string;
  viaticos_per_km: string | null;
  deposit_amount: string | null;
  created_at: string;
  updated_at: string;
  provider: {
    id: number;
    full_name: string;
    verified: boolean;
    avatar_url: string | null;
  };
  cancellation_policy: {
    retention_percent: number;
    penalty_free_window_days: number;
    deposit_refundable: boolean;
  };
  photos: Array<{ id: number; url: string; position: number; status: string }>;
  amenities: Array<{ id: number; name: string }>;
  event_types: Array<{ id: number; name: string }>;
  extras: Array<{
    id: number;
    name: string;
    description: string;
    price: string;
  }>;
  dynamic_rules: Array<{
    id: number;
    adjustment_type: string;
    adjustment_value: string;
    scope: unknown;
  }>;
  hours: Array<{
    day_of_week: number;
    open_time: string;
    close_time: string;
    base_block_duration_hours: number;
    extra_hours_allowed: number;
  }>;
  pricing: {
    salon: { base_block_hours: number; base_block_price: string; extra_hour_price: string } | null;
    sound_packages: Array<{
      id: number;
      name: string;
      base_price: string;
      base_hours: number;
      extra_hour_price: string;
    }>;
    persona: { price_per_person_per_hour: string } | null;
  };
  rating: { avg: number | null; count: number };
}

/**
 * Full service detail for the marketplace detail page (FR-005): photos,
 * amenities, event types, pricing, extras, dynamic rules, hours, provider
 * and aggregate rating. Returns null for unknown or soft-deleted services.
 */
export async function getServiceById(id: number): Promise<ServiceDetail | null> {
  const service = await prisma.services.findUnique({
    where: { id },
    include: {
      salon_pricing: true,
      sound_packages: true,
      service_persona_pricing: true,
      service_extras: true,
      dynamic_pricing_rules: true,
      operating_hours: true,
      service_photos: { where: { status: 'aprobada' }, orderBy: { position: 'asc' } },
      service_amenities: { include: { amenities: true } },
      service_service_event_types: { include: { service_event_types: true } },
      users: { select: { id: true, full_name: true, verified: true, avatar_url: true } },
      cancellation_policies: true,
    },
  });
  if (!service || service.deleted_at) return null;

  const aggRows = await prisma.$queryRaw<Array<{ avg_rating: Prisma.Decimal | null; review_count: bigint }>>(Prisma.sql`
    SELECT AVG(rv.rating) AS avg_rating, COUNT(rv.id) AS review_count
    FROM reviews rv
    JOIN reservations r ON r.id = rv.reservation_id
    JOIN reservation_items ri ON ri.reservation_id = r.id
    WHERE ri.service_id = ${id}
    GROUP BY ri.service_id
  `);
  const agg = aggRows[0];

  return {
    id: service.id,
    title: service.title,
    description: service.description,
    service_type: service.service_type,
    status: service.status,
    location_type: service.location_type,
    location: service.location,
    coverage_area: service.coverage_area,
    max_capacity: service.max_capacity,
    approval_mode: service.approval_mode,
    viaticos_per_km: toMoney(service.viaticos_per_km),
    deposit_amount: toMoney(service.deposit_amount),
    created_at: service.created_at.toISOString(),
    updated_at: service.updated_at.toISOString(),
    provider: {
      id: service.users.id,
      full_name: service.users.full_name,
      verified: service.users.verified,
      avatar_url: service.users.avatar_url,
    },
    cancellation_policy: {
      retention_percent: service.cancellation_policies.retention_percent,
      penalty_free_window_days: service.cancellation_policies.penalty_free_window_days,
      deposit_refundable: service.cancellation_policies.deposit_refundable,
    },
    photos: service.service_photos.map((p) => ({
      id: p.id,
      // Re-sign the stored raw path (work-unit C TTL fix).
      url: signedPhotoUrl(p.url),
      position: p.position,
      status: p.status,
    })),
    amenities: service.service_amenities.map((sa) => ({
      id: sa.amenities.id,
      name: sa.amenities.name,
    })),
    event_types: service.service_service_event_types.map((ev) => ({
      id: ev.service_event_types.id,
      name: ev.service_event_types.name,
    })),
    extras: service.service_extras.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      price: toMoney(e.price) ?? '0.00',
    })),
    dynamic_rules: service.dynamic_pricing_rules.map((r) => ({
      id: r.id,
      adjustment_type: r.adjustment_type,
      adjustment_value: toMoney(r.adjustment_value) ?? '0.00',
      scope: r.scope,
    })),
    hours: service.operating_hours.map((h) => ({
      day_of_week: h.day_of_week,
      open_time: toTimeString(h.open_time),
      close_time: toTimeString(h.close_time),
      base_block_duration_hours: h.base_block_duration_hours,
      extra_hours_allowed: h.extra_hours_allowed,
    })),
    pricing: {
      salon: service.salon_pricing
        ? {
            base_block_hours: service.salon_pricing.base_block_hours,
            base_block_price: toMoney(service.salon_pricing.base_block_price) ?? '0.00',
            extra_hour_price: toMoney(service.salon_pricing.extra_hour_price) ?? '0.00',
          }
        : null,
      sound_packages: service.sound_packages.map((p) => ({
        id: p.id,
        name: p.name,
        base_price: toMoney(p.base_price) ?? '0.00',
        base_hours: p.base_hours,
        extra_hour_price: toMoney(p.extra_hour_price) ?? '0.00',
      })),
      persona: service.service_persona_pricing
        ? {
            price_per_person_per_hour:
              toMoney(service.service_persona_pricing.price_per_person_per_hour) ?? '0.00',
          }
        : null,
    },
    rating: {
      avg: agg?.avg_rating === null || agg?.avg_rating === undefined ? null : Number(agg.avg_rating),
      count: Number(agg?.review_count ?? 0),
    },
  };
}

/** Slot availability rows from the `v_slot_availability` view (BR-004.9, D-002). */
export interface SlotAvailabilityRow {
  slot_id: number;
  service_id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  active_reservations: number;
  available_capacity: number;
  status_indicator: 'disponible' | 'parcial' | 'lleno';
}

interface AvailabilityRow {
  slot_id: number | bigint;
  service_id: number | bigint;
  slot_date: Date;
  start_time: Date;
  end_time: Date;
  capacity: number | bigint;
  active_reservations: bigint | number;
  available_capacity: bigint | number;
  status_indicator: 'disponible' | 'parcial' | 'lleno';
}

/**
 * Availability for a service's slots (GET /services/:id/slots). Optional
 * `from`/`to` clip the date range. Read-only view of capacity vs active
 * reservations — the transactionally-safe write path lands in S3.
 */
export async function listServiceSlots(
  serviceId: number,
  range: { from?: Date; to?: Date },
): Promise<SlotAvailabilityRow[]> {
  const conditions: Prisma.Sql[] = [Prisma.sql`service_id = ${serviceId}`];
  if (range.from) {
    conditions.push(Prisma.sql`slot_date >= ${range.from}`);
  }
  if (range.to) {
    conditions.push(Prisma.sql`slot_date <= ${range.to}`);
  }
  const where = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

  const rows = await prisma.$queryRaw<AvailabilityRow[]>(Prisma.sql`
    SELECT slot_id, service_id, slot_date, start_time, end_time, capacity,
           active_reservations, available_capacity, status_indicator
    FROM v_slot_availability
    ${where}
    ORDER BY slot_date ASC, start_time ASC
  `);

  return rows.map((row) => ({
    slot_id: Number(row.slot_id),
    service_id: Number(row.service_id),
    slot_date: toDateString(row.slot_date),
    start_time: toTimeString(row.start_time),
    end_time: toTimeString(row.end_time),
    capacity: Number(row.capacity),
    active_reservations: Number(row.active_reservations),
    available_capacity: Number(row.available_capacity),
    status_indicator: row.status_indicator,
  }));
}