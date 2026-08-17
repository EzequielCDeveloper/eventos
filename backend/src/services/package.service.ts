import { Prisma } from '@prisma/client';
import type { packages_status, package_members_service_type } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../types/api';
import { parseISODate, parseISOTime, toTimeString } from '../utils/datetime';

/**
 * Collaborative package service (BR-011, paquetes_colaborativos.md).
 *
 * Only salons create and lead packages (BR-011.1); every other provider is
 * an invited member that accepts/rejects (and sets its own price). The
 * package follows the 7-state lifecycle `creado → invitaciones_pendientes →
 * invitaciones_aceptadas → disponibilidad_verificada → disponible_para_reserva
 * → reservado → completado` (BR-011.2, diagram D8). Cross-slot availability
 * is verified atomically for every member before the package becomes
 * bookable (BR-011.3); rejection by a member returns the package to
 * `creado` so the leader can invite a replacement of the same service type
 * (BR-011.5). Price is auto-computed from the members' prices (BR-011.4);
 * taxes and the hidden platform fee are added at reservation time (D-007).
 *
 * Note: `package_members` only covers sonido/servicio_persona providers
 * (canonical enum) — the salon leader owns the package. The leader's own
 * slot availability is validated at reservation time against the locked
 * salon slot (see reservation.service assertSlotAvailable).
 */

export type PackageStatus = packages_status;

/** Transition map (authoritative: paquetes_colaborativos.md, diagram D8). */
const TRANSITIONS: Record<PackageStatus, PackageStatus[]> = {
  creado: ['invitaciones_pendientes'],
  invitaciones_pendientes: ['invitaciones_aceptadas', 'creado'],
  invitaciones_aceptadas: ['disponibilidad_verificada'],
  disponibilidad_verificada: ['disponible_para_reserva', 'invitaciones_aceptadas'],
  disponible_para_reserva: ['reservado'],
  reservado: ['completado'],
  completado: [],
};

const P2002 = 'P2002';
const P2025 = 'P2025';

export function toMoney(value: Prisma.Decimal | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const decimal = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  return decimal.toFixed(2);
}

interface MemberRow {
  id: number;
  provider_id: number;
  service_type: package_members_service_type;
  invitation_status: string;
  member_price: Prisma.Decimal | null;
  responded_at: Date | null;
  users: { full_name: string };
}

interface PackageWithMembers {
  id: number;
  leader_provider_id: number;
  status: packages_status;
  closed_price: Prisma.Decimal | null;
  created_at: Date;
  updated_at: Date;
  package_members: MemberRow[];
}

function mapMember(member: MemberRow) {
  return {
    id: member.id,
    provider_id: member.provider_id,
    provider_name: member.users.full_name,
    service_type: member.service_type,
    invitation_status: member.invitation_status,
    member_price: toMoney(member.member_price),
    responded_at: member.responded_at ? member.responded_at.toISOString() : null,
  };
}

export interface PackageMemberRow {
  id: number;
  provider_id: number;
  provider_name: string;
  service_type: package_members_service_type;
  invitation_status: string;
  member_price: string | null;
  responded_at: string | null;
}

export interface PackageDetail {
  id: number;
  leader_provider_id: number;
  status: PackageStatus;
  closed_price: string | null;
  next_transitions: PackageStatus[];
  created_at: string;
  updated_at: string;
  members: PackageMemberRow[];
}

function toDetail(pkg: PackageWithMembers): PackageDetail {
  return {
    id: pkg.id,
    leader_provider_id: pkg.leader_provider_id,
    status: pkg.status,
    closed_price: toMoney(pkg.closed_price),
    next_transitions: TRANSITIONS[pkg.status],
    created_at: pkg.created_at.toISOString(),
    updated_at: pkg.updated_at.toISOString(),
    members: pkg.package_members.map(mapMember),
  };
}

export interface PackageMemberInput {
  provider_id: number;
  service_type: package_members_service_type;
  member_price?: number;
}

/** Leader must own at least one published, non-deleted salon service (BR-011.1). */
async function assertSalonLeader(leaderId: number): Promise<void> {
  const salon = await prisma.services.findFirst({
    where: {
      provider_id: leaderId,
      service_type: 'salon',
      status: 'publicado',
      deleted_at: null,
    },
    select: { id: true },
  });
  if (!salon) {
    throw new AppError({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Only providers with a published salon service can create packages (BR-011.1)',
    });
  }
}

/** Load a package with its members (optionally within a transaction). */
async function loadPackage(
  packageId: number,
  tx?: Prisma.TransactionClient,
): Promise<PackageWithMembers | null> {
  const client = tx ?? prisma;
  return client.packages.findUnique({
    where: { id: packageId },
    include: {
      package_members: {
        include: { users: { select: { full_name: true } } },
        orderBy: { id: 'asc' },
      },
    },
  });
}

function assertValidMemberInput(member: PackageMemberInput, leaderId: number): void {
  if (!Number.isInteger(member.provider_id) || member.provider_id <= 0) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'member.provider_id must be a positive integer',
    });
  }
  if (member.provider_id === leaderId) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'The leader cannot invite itself as a member',
    });
  }
  if (member.member_price !== undefined && member.member_price < 0) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'member_price cannot be negative',
    });
  }
}

/**
 * POST /packages — a salon creates a package and invites its first members
 * in one call. The package is born `invitaciones_pendientes`.
 */
export async function createPackage(
  leaderId: number,
  members: PackageMemberInput[],
): Promise<PackageDetail> {
  await assertSalonLeader(leaderId);

  if (!members.length) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'A package needs at least one invited member',
    });
  }
  const seen = new Set<string>();
  for (const member of members) {
    assertValidMemberInput(member, leaderId);
    const key = `${member.provider_id}:${member.service_type}`;
    if (seen.has(key)) {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Duplicate member (provider + service type)',
      });
    }
    seen.add(key);
  }

  const created = await prisma.$transaction(async (tx) => {
    const pkg = await tx.packages.create({
      data: {
        leader_provider_id: leaderId,
        status: 'invitaciones_pendientes',
        updated_at: new Date(),
      },
    });
    await Promise.all(
      members.map((m) =>
        tx.package_members.create({
          data: {
            package_id: pkg.id,
            provider_id: m.provider_id,
            service_type: m.service_type,
            invitation_status: 'pendiente',
            member_price:
              m.member_price !== undefined ? new Prisma.Decimal(m.member_price) : null,
          },
        }),
      ),
    );
    return pkg.id;
  });

  const pkg = await loadPackage(created);
  if (!pkg) throw AppError.notFound('Package not found');
  return toDetail(pkg);
}

/** Assert the actor is the package leader; returns the package detail. */
async function requireLeader(packageId: number, leaderId: number): Promise<PackageDetail> {
  const pkg = await loadPackage(packageId);
  if (!pkg) throw AppError.notFound('Package not found');
  if (pkg.leader_provider_id !== leaderId) {
    throw AppError.forbidden('Only the package leader can do this');
  }
  return toDetail(pkg);
}

/**
 * POST /packages/:id/invite — the leader invites a provider (BR-011.5:
 * supports replacing a rejected member with another of the same type).
 * Allowed while the package is `creado` or `invitaciones_pendientes`.
 */
export async function inviteMember(
  packageId: number,
  leaderId: number,
  member: PackageMemberInput,
): Promise<{ id: number; package_status: PackageStatus }> {
  const pkg = await requireLeader(packageId, leaderId);
  assertValidMemberInput(member, leaderId);

  if (!['creado', 'invitaciones_pendientes'].includes(pkg.status)) {
    throw AppError.stateTransitionInvalid(
      `Cannot invite members while the package is ${pkg.status}`,
      { package_status: pkg.status },
    );
  }
  if (pkg.status === 'creado') {
    await prisma.packages.update({
      where: { id: packageId },
      data: { status: 'invitaciones_pendientes', updated_at: new Date() },
    });
  }

  try {
    const row = await prisma.package_members.create({
      data: {
        package_id: packageId,
        provider_id: member.provider_id,
        service_type: member.service_type,
        invitation_status: 'pendiente',
        member_price:
          member.member_price !== undefined ? new Prisma.Decimal(member.member_price) : null,
      },
      select: { id: true },
    });
    return { id: row.id, package_status: 'invitaciones_pendientes' };
  } catch (error) {
    if ((error as { code?: string }).code === P2002) {
      throw AppError.conflict('This provider is already a member of the package');
    }
    throw error;
  }
}

/**
 * PUT /packages/:id/members/:memberId/respond — the invited provider
 * accepts (setting its own price) or rejects. On rejection the package
 * returns to `creado` (diagram D8) so the leader can invite a replacement.
 * When all members have accepted, the package moves to
 * `invitaciones_aceptadas`.
 */
export async function respondToInvitation(
  packageId: number,
  memberId: number,
  providerId: number,
  input: { accept: boolean; member_price?: number },
): Promise<{ package_id: number; package_status: PackageStatus; invitation_status: string }> {
  const member = await prisma.package_members.findUnique({
    where: { id: memberId },
    include: { packages: true },
  });
  if (!member || member.package_id !== packageId) {
    throw AppError.notFound('Package member not found');
  }
  if (member.provider_id !== providerId) {
    throw AppError.forbidden('This invitation belongs to another provider');
  }
  const pkg = member.packages;
  if (pkg.status !== 'invitaciones_pendientes') {
    throw AppError.stateTransitionInvalid(
      `Cannot respond while the package is ${pkg.status}`,
      { package_status: pkg.status, invitation_status: member.invitation_status },
    );
  }
  if (member.invitation_status !== 'pendiente') {
    throw AppError.conflict(`Invitation already ${member.invitation_status}`);
  }
  if (input.member_price !== undefined && input.member_price < 0) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'member_price cannot be negative',
    });
  }

  return prisma.$transaction(async (tx) => {
    await tx.package_members.update({
      where: { id: memberId },
      data: {
        invitation_status: input.accept ? 'aceptada' : 'rechazada',
        member_price:
          input.accept && input.member_price !== undefined
            ? new Prisma.Decimal(input.member_price)
            : undefined,
        responded_at: new Date(),
      },
    });

    if (!input.accept) {
      await tx.packages.update({
        where: { id: packageId },
        data: { status: 'creado', updated_at: new Date() },
      });
      return {
        package_id: packageId,
        package_status: 'creado' as PackageStatus,
        invitation_status: 'rechazada',
      };
    }

    const pending = await tx.package_members.count({
      where: { package_id: packageId, invitation_status: 'pendiente' },
    });
    let status: PackageStatus = pkg.status;
    if (pending === 0) {
      status = 'invitaciones_aceptadas';
      await tx.packages.update({
        where: { id: packageId },
        data: { status, updated_at: new Date() },
      });
    }
    return { package_id: packageId, package_status: status, invitation_status: 'aceptada' };
  });
}

// ---- Cross-slot availability (BR-011.3) --------------------------------------

export interface MemberServiceEntry {
  service_id: number;
  title: string;
  slot_id: number | null;
  available: boolean;
}

export interface MembersAvailability {
  member_id: number;
  provider_id: number;
  service_type: package_members_service_type;
  available: boolean;
  services: MemberServiceEntry[];
}

export interface AvailabilityReport {
  package_id: number;
  date: string;
  start_time: string;
  end_time: string;
  overall: 'disponible' | 'no_disponible';
  members: MembersAvailability[];
}

function assertTimeWindow(date: string, start: string, end: string): void {
  if (!parseISODate(date) || !parseISOTime(start) || !parseISOTime(end)) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'date must be YYYY-MM-DD and start_time/end_time must be HH:MM[:SS]',
    });
  }
  if (start >= end) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'start_time must be before end_time',
    });
  }
}

/** Normalize `HH:MM` to `HH:MM:SS` (moment-agnostic zero-padded compare). */
function normTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

/** Active reservations on a service at a given window (view semantics). */
export async function activeCountForService(
  serviceId: number,
  date: string,
  start: string,
  end: string,
): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ active_count: bigint }>>`
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
 * Check every member's published services for a matching slot with
 * available capacity on the requested window. Read-only: never mutates
 * package state (used by GET /packages/:id/availability).
 */
export async function checkPackageAvailability(
  packageId: number,
  window: { date: string; start_time: string; end_time: string },
): Promise<AvailabilityReport> {
  assertTimeWindow(window.date, window.start_time, window.end_time);

  const pkg = await prisma.packages.findUnique({
    where: { id: packageId },
    include: { package_members: { orderBy: { id: 'asc' } } },
  });
  if (!pkg) throw AppError.notFound('Package not found');

  const slotDate = parseISODate(window.date) ?? new Date();
  // Normalize window times to HH:MM:SS for DB/JS comparisons.
  const windowNorm = {
    date: window.date,
    start_time: normTime(window.start_time),
    end_time: normTime(window.end_time),
  };

  const members: MembersAvailability[] = [];
  for (const member of pkg.package_members) {
    const services = await prisma.services.findMany({
      where: {
        provider_id: member.provider_id,
        service_type: member.service_type,
        status: 'publicado',
        deleted_at: null,
      },
      select: { id: true, title: true },
      orderBy: { id: 'asc' },
    });

    const entries: MemberServiceEntry[] = [];
    for (const service of services) {
      // TIME-column filters via Prisma Date params are unreliable on
      // MariaDB (type-coercion mismatch) — fetch by date, compare times
      // in JS using the same UTC-pinned helper used at slot creation.
      const thatDay = await prisma.inventory_slots.findMany({
        where: { service_id: service.id, slot_date: slotDate },
        select: { id: true, capacity: true, start_time: true, end_time: true },
      });
      const slot = thatDay.find(
        (s) =>
          toTimeString(s.start_time) === windowNorm.start_time &&
          toTimeString(s.end_time) === windowNorm.end_time,
      );
      if (!slot) {
        entries.push({ service_id: service.id, title: service.title, slot_id: null, available: false });
        continue;
      }
      const active = await activeCountForService(
        service.id,
        windowNorm.date,
        windowNorm.start_time,
        windowNorm.end_time,
      );
      entries.push({
        service_id: service.id,
        title: service.title,
        slot_id: slot.id,
        available: active < slot.capacity,
      });
    }

    members.push({
      member_id: member.id,
      provider_id: member.provider_id,
      service_type: member.service_type,
      available: entries.some((e) => e.available),
      services: entries,
    });
  }

  const overall = members.every((m) => m.available) ? 'disponible' : 'no_disponible';
  return {
    package_id: pkg.id,
    date: windowNorm.date,
    start_time: windowNorm.start_time,
    end_time: windowNorm.end_time,
    overall,
    members,
  };
}

/**
 * POST /packages/:id/availability — run the atomic cross-slot verification
 * and advance the state machine (BR-011.3): all members available →
 * `disponible_para_reserva` (with the auto-computed closed price);
 * any member unavailable → back to `invitaciones_aceptadas`.
 */
export async function verifyAndAdvanceAvailability(
  packageId: number,
  leaderId: number,
  window: { date: string; start_time: string; end_time: string },
): Promise<{ package_id: number; package_status: PackageStatus; report: AvailabilityReport }> {
  await requireLeader(packageId, leaderId);

  const pkg = await prisma.packages.findUnique({
    where: { id: packageId },
    include: { package_members: true },
  });
  if (!pkg) throw AppError.notFound('Package not found');

  const allowedFrom: PackageStatus[] =
    pkg.status === 'disponibilidad_verificada'
      ? ['disponibilidad_verificada']
      : TRANSITIONS[pkg.status].includes('disponibilidad_verificada')
        ? [pkg.status]
        : [];
  if (!allowedFrom.length) {
    throw AppError.stateTransitionInvalid(
      `Cannot verify availability while the package is ${pkg.status}`,
      { package_status: pkg.status },
    );
  }

  const report = await checkPackageAvailability(packageId, window);

  return prisma.$transaction(async (tx) => {
    if (report.overall === 'disponible') {
      const members = await tx.package_members.findMany({ where: { package_id: packageId } });
      const closedPrice = members.reduce(
        (sum, m) => sum.add(m.member_price ?? new Prisma.Decimal(0)),
        new Prisma.Decimal(0),
      );
      await tx.packages.update({
        where: { id: packageId },
        data: {
          status: 'disponible_para_reserva',
          closed_price: closedPrice,
          updated_at: new Date(),
        },
      });
      return {
        package_id: packageId,
        package_status: 'disponible_para_reserva' as PackageStatus,
        report,
      };
    }
    await tx.packages.update({
      where: { id: packageId },
      data: { status: 'invitaciones_aceptadas', updated_at: new Date() },
    });
    return {
      package_id: packageId,
      package_status: 'invitaciones_aceptadas' as PackageStatus,
      report,
    };
  });
}

/** GET /packages/:id — package detail with members (leader/member view). */
export async function getPackage(packageId: number, actorId: number): Promise<PackageDetail> {
  const pkg = await loadPackage(packageId);
  if (!pkg) throw AppError.notFound('Package not found');
  if (
    pkg.leader_provider_id !== actorId &&
    !pkg.package_members.some((m) => m.provider_id === actorId)
  ) {
    throw AppError.forbidden('This package belongs to other providers');
  }
  return toDetail(pkg);
}

/** Mark a package as completed once its reservation is completed. */
export async function completePackage(packageId: number): Promise<void> {
  try {
    await prisma.packages.update({
      where: { id: packageId, status: 'reservado' },
      data: { status: 'completado', updated_at: new Date() },
    });
  } catch (error) {
    if ((error as { code?: string }).code === P2025) {
      throw AppError.conflict('Package is not in reservado state');
    }
    throw error;
  }
}