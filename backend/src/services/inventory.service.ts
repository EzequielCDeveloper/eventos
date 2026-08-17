import { Prisma } from '@prisma/client';
import type { availability_blocks_type } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../types/api';
import { parseISODate, parseISOTime, toTimeString } from '../utils/datetime';
import { listServiceSlots } from './search.service';
import { requireOwnedService } from './services.service';

/**
 * Inventory service (UR-002.5, BR-004, D-002).
 *
 * Slots, availability blocks and operating hours per service. Slot reads
 * go through the `v_slot_availability` view (shared with search); writes
 * are transactional-safe and owner-only. All date/time inputs are strings
 * (`YYYY-MM-DD`, `HH:MM[:SS]`) converted at the boundary.
 */

const P2002 = 'P2002';
const P2025 = 'P2025';

export { listServiceSlots };

// ---- Slots ------------------------------------------------------------------

export interface CreateSlotInput {
  slot_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
}

export interface UpdateSlotInput {
  start_time?: string;
  end_time?: string;
  capacity?: number;
}

function parseSlotTimes(start: string, end: string): { start: Date; end: Date } {
  const startTime = parseISOTime(start);
  const endTime = parseISOTime(end);
  if (!startTime || !endTime) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Times must use HH:MM or HH:MM:SS format',
    });
  }
  if (start >= end) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'start_time must be before end_time',
    });
  }
  return { start: startTime, end: endTime };
}

/** POST /services/:id/slots — create an inventory slot (owner-only). */
export async function createSlot(
  serviceId: number,
  providerId: number,
  input: CreateSlotInput,
): Promise<{ id: number }> {
  await requireOwnedService(serviceId, providerId);

  const slotDate = parseISODate(input.slot_date);
  if (!slotDate) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'slot_date must be a valid YYYY-MM-DD date',
    });
  }
  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'capacity must be a positive integer',
    });
  }
  const { start, end } = parseSlotTimes(input.start_time, input.end_time);

  try {
    const slot = await prisma.inventory_slots.create({
      data: {
        service_id: serviceId,
        slot_date: slotDate,
        start_time: start,
        end_time: end,
        capacity: input.capacity,
      },
      select: { id: true },
    });
    return { id: slot.id };
  } catch (error) {
    if ((error as { code?: string }).code === P2002) {
      throw AppError.conflict('A slot already exists for this service at that date/time');
    }
    throw error;
  }
}

/** PUT /services/:id/slots/:slotId — update slot time/capacity (owner-only). */
export async function updateSlot(
  serviceId: number,
  providerId: number,
  slotId: number,
  input: UpdateSlotInput,
): Promise<{ id: number }> {
  await requireOwnedService(serviceId, providerId);

  const existing = await prisma.inventory_slots.findUnique({
    where: { id: slotId },
    select: { id: true, service_id: true },
  });
  if (!existing || existing.service_id !== serviceId) {
    throw AppError.notFound('Slot not found');
  }

  const data: Prisma.inventory_slotsUpdateInput = {};
  if (input.start_time !== undefined || input.end_time !== undefined) {
    const current = await prisma.inventory_slots.findUnique({
      where: { id: slotId },
      select: { start_time: true, end_time: true },
    });
    const start = input.start_time ?? toTimeString(current!.start_time);
    const end = input.end_time ?? toTimeString(current!.end_time);
    const { start: startDate, end: endDate } = parseSlotTimes(start, end);
    data.start_time = startDate;
    data.end_time = endDate;
  }
  if (input.capacity !== undefined) {
    if (!Number.isInteger(input.capacity) || input.capacity < 1) {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'capacity must be a positive integer',
      });
    }
    data.capacity = input.capacity;
  }

  try {
    const slot = await prisma.inventory_slots.update({
      where: { id: slotId },
      data,
      select: { id: true },
    });
    return { id: slot.id };
  } catch (error) {
    if ((error as { code?: string }).code === P2002) {
      throw AppError.conflict('A slot already exists for this service at that date/time');
    }
    throw error;
  }
}

/** DELETE /services/:id/slots/:slotId — remove a slot (owner-only). */
export async function deleteSlot(
  serviceId: number,
  providerId: number,
  slotId: number,
): Promise<void> {
  await requireOwnedService(serviceId, providerId);
  try {
    await prisma.inventory_slots.delete({ where: { id: slotId } });
  } catch (error) {
    if ((error as { code?: string }).code === P2025) {
      throw AppError.notFound('Slot not found');
    }
    throw error;
  }
}

// ---- Availability blocks -------------------------------------------------------

export interface CreateBlockInput {
  start_datetime: string; // ISO 8601
  end_datetime: string; // ISO 8601
  type: availability_blocks_type;
}

export interface AvailabilityBlockRow {
  id: number;
  start_datetime: string;
  end_datetime: string;
  type: availability_blocks_type;
}

/** GET /services/:id/blocks — availability blocks (public read). */
export async function listBlocks(serviceId: number): Promise<AvailabilityBlockRow[]> {
  const blocks = await prisma.availability_blocks.findMany({
    where: { service_id: serviceId },
    orderBy: { start_datetime: 'asc' },
  });
  return blocks.map((b) => ({
    id: b.id,
    start_datetime: b.start_datetime.toISOString(),
    end_datetime: b.end_datetime.toISOString(),
    type: b.type,
  }));
}

/** POST /services/:id/blocks — block a window (e.g. maintenance; owner-only). */
export async function createBlock(
  serviceId: number,
  providerId: number,
  input: CreateBlockInput,
): Promise<{ id: number }> {
  await requireOwnedService(serviceId, providerId);

  const start = new Date(input.start_datetime);
  const end = new Date(input.end_datetime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'start_datetime/end_datetime must be valid ISO 8601 datetimes',
    });
  }
  if (end <= start) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'end_datetime must be after start_datetime',
    });
  }

  const block = await prisma.availability_blocks.create({
    data: {
      service_id: serviceId,
      start_datetime: start,
      end_datetime: end,
      type: input.type,
    },
    select: { id: true },
  });
  return { id: block.id };
}

/** DELETE /services/:id/blocks/:blockId — remove a block (owner-only). */
export async function deleteBlock(
  serviceId: number,
  providerId: number,
  blockId: number,
): Promise<void> {
  await requireOwnedService(serviceId, providerId);
  try {
    await prisma.availability_blocks.delete({ where: { id: blockId } });
  } catch (error) {
    if ((error as { code?: string }).code === P2025) {
      throw AppError.notFound('Availability block not found');
    }
    throw error;
  }
}

// ---- Operating hours ------------------------------------------------------------

export interface OperatingHourInput {
  day_of_week: number; // 1=Monday .. 7=Sunday (canonical schema)
  open_time: string;
  close_time: string;
  base_block_duration_hours?: number;
  extra_hours_allowed?: number;
}

export interface OperatingHourRow {
  id: number;
  day_of_week: number;
  open_time: string;
  close_time: string;
  base_block_duration_hours: number;
  extra_hours_allowed: number;
}

/** GET /services/:id/hours — weekly operating hours (public read). */
export async function getHours(serviceId: number): Promise<OperatingHourRow[]> {
  const hours = await prisma.operating_hours.findMany({
    where: { service_id: serviceId },
    orderBy: { day_of_week: 'asc' },
  });
  return hours.map((h) => ({
    id: h.id,
    day_of_week: h.day_of_week,
    open_time: toTimeString(h.open_time),
    close_time: toTimeString(h.close_time),
    base_block_duration_hours: h.base_block_duration_hours,
    extra_hours_allowed: h.extra_hours_allowed,
  }));
}

/**
 * PUT /services/:id/hours — replace the weekly schedule atomically
 * (owner-only). The full week is replaced by the submitted array.
 */
export async function replaceHours(
  serviceId: number,
  providerId: number,
  hours: OperatingHourInput[],
): Promise<{ replaced: number }> {
  await requireOwnedService(serviceId, providerId);

  const seen = new Set<number>();
  const rows = hours.map((h) => {
    if (!Number.isInteger(h.day_of_week) || h.day_of_week < 1 || h.day_of_week > 7) {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'day_of_week must be an integer 1=Monday .. 7=Sunday',
      });
    }
    if (seen.has(h.day_of_week)) {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: `day_of_week ${h.day_of_week} is duplicated`,
      });
    }
    seen.add(h.day_of_week);

    const open = parseISOTime(h.open_time);
    const close = parseISOTime(h.close_time);
    if (!open || !close) {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'open_time/close_time must use HH:MM or HH:MM:SS format',
      });
    }
    if (h.open_time >= h.close_time) {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'open_time must be before close_time',
      });
    }
    return {
      day_of_week: h.day_of_week,
      start: open,
      end: close,
      base_block_duration_hours: h.base_block_duration_hours ?? 4,
      extra_hours_allowed: h.extra_hours_allowed ?? 0,
    };
  });

  return prisma.$transaction(async (tx) => {
    await tx.operating_hours.deleteMany({ where: { service_id: serviceId } });
    await tx.operating_hours.createMany({
      data: rows.map((r) => ({
        service_id: serviceId,
        day_of_week: r.day_of_week,
        open_time: r.start,
        close_time: r.end,
        base_block_duration_hours: r.base_block_duration_hours,
        extra_hours_allowed: r.extra_hours_allowed,
      })),
    });
    return { replaced: rows.length };
  });
}