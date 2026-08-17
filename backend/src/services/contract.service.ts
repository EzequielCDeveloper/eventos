import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError, type AuthUser } from '../types/api';
import { toISOStringOrNull } from '../utils/datetime';

/**
 * Contract service (BR-012.6, UR-002.8, flujo_de_reserva.md).
 *
 * Physical contracts are required for salon bookings: a `contracts` row is
 * created when the reservation enters `pendiente_firma`. Legal validity
 * requires bilateral confirmation in the app after the in-person signing
 * (Código de Comercio — both parties confirm the firma before the
 * reservation advances to payment). The first app confirmation moves the
 * contract to `pendiente_confirmacion`; once BOTH parties confirm, the
 * contract becomes `contrato_confirmado` and the reservation advances to
 * `contrato_confirmado` in the same transaction.
 *
 * The intermediate `firmando` stage (the physical signing day) has no API
 * endpoint — it is an offline, in-person step (documented deviation).
 *
 * CFDI/`invoices` generation is DEFERRED per user instruction — no fiscal
 * code, no CFDI logic (BR-012.7).
 */

export interface ContractDetail {
  id: number;
  reservation_id: number;
  status: string;
  signing_appointment_at: string | null;
  signing_location: string | null;
  client_confirmed_at: string | null;
  provider_confirmed_at: string | null;
  document_url: string | null;
  created_at: string;
  confirmed: boolean;
  reservation_status: string;
  service_title: string | null;
}

/** Create the contract row for a salon reservation (leader-only: salon booking). */
export async function createContractForReservation(
  tx: Prisma.TransactionClient,
  reservationId: number,
): Promise<{ id: number }> {
  const existing = await tx.contracts.findUnique({ where: { reservation_id: reservationId } });
  if (existing) return { id: existing.id };
  const contract = await tx.contracts.create({
    data: { reservation_id: reservationId, status: 'pendiente_firma' },
    select: { id: true },
  });
  return { id: contract.id };
}

async function toDetail(
  contract: Awaited<ReturnType<typeof prisma.contracts.findUnique>>,
): Promise<ContractDetail> {
  if (!contract) throw AppError.notFound('Contract not found');
  const reservation = await prisma.reservations.findUnique({
    where: { id: contract.reservation_id },
    include: {
      reservation_items: {
        take: 1,
        include: { services: { select: { title: true } } },
      },
    },
  });
  return {
    id: contract.id,
    reservation_id: contract.reservation_id,
    status: contract.status,
    signing_appointment_at: toISOStringOrNull(contract.signing_appointment_at),
    signing_location: contract.signing_location,
    client_confirmed_at: toISOStringOrNull(contract.client_confirmed_at),
    provider_confirmed_at: toISOStringOrNull(contract.provider_confirmed_at),
    document_url: contract.document_url,
    created_at: contract.created_at.toISOString(),
    confirmed:
      contract.status === 'contrato_confirmado' &&
      contract.client_confirmed_at !== null &&
      contract.provider_confirmed_at !== null,
    reservation_status: reservation?.status ?? 'unknown',
    service_title: reservation?.reservation_items[0]?.services.title ?? null,
  };
}

/**
 * GET /contracts/:id — contract detail for the client, a participating
 * provider, or an admin (UR-002.8).
 */
export async function getContract(contractId: number, actor: AuthUser): Promise<ContractDetail> {
  const contract = await prisma.contracts.findUnique({
    where: { id: contractId },
    include: {
      reservations: {
        include: {
          reservation_items: {
            select: { services: { select: { provider_id: true } } },
          },
        },
      },
    },
  });
  if (!contract) throw AppError.notFound('Contract not found');

  const reservation = contract.reservations;
  if (actor.role !== 'administrador') {
    const isClient = actor.id === reservation.client_id;
    const isProvider = reservation.reservation_items.some(
      (i) => i.services.provider_id === actor.id,
    );
    if (!isClient && !isProvider) {
      throw AppError.forbidden('This contract belongs to other users');
    }
  }

  const detail = await toDetail(contract);
  return detail;
}

/**
 * PUT /contracts/:id/confirm — one party confirms the in-person firma
 * (UR-002.8, BR-012.6). When both parties have confirmed, the contract is
 * `contrato_confirmado` and the reservation advances
 * `pendiente_firma → contrato_confirmado` atomically.
 */
export async function confirmContract(
  contractId: number,
  actor: AuthUser,
  party: 'cliente' | 'proveedor',
): Promise<{
  id: number;
  status: string;
  client_confirmed_at: string | null;
  provider_confirmed_at: string | null;
  reservation_status: string;
  confirmed: boolean;
}> {
  const contract = await prisma.contracts.findUnique({
    where: { id: contractId },
    include: {
      reservations: {
        include: {
          reservation_items: {
            select: { services: { select: { provider_id: true } } },
          },
        },
      },
    },
  });
  if (!contract) throw AppError.notFound('Contract not found');

  const reservation = contract.reservations;
  const isClient = actor.id === reservation.client_id;
  const isProvider = reservation.reservation_items.some(
    (i) => i.services.provider_id === actor.id,
  );
  if (actor.role !== 'administrador') {
    if (party === 'cliente' && !isClient) {
      throw AppError.forbidden('Only the reservation client can confirm on the client side');
    }
    if (party === 'proveedor' && !isProvider) {
      throw AppError.forbidden('Only a participating provider can confirm on the provider side');
    }
  }
  if (contract.status === 'contrato_confirmado') {
    throw AppError.conflict('Contract is already confirmed');
  }
  if (party === 'cliente' && contract.client_confirmed_at) {
    throw AppError.conflict('Client confirmation was already recorded');
  }
  if (party === 'proveedor' && contract.provider_confirmed_at) {
    throw AppError.conflict('Provider confirmation was already recorded');
  }

  await prisma.$transaction(async (tx) => {
    const data: Prisma.contractsUpdateInput = {
      status: 'pendiente_confirmacion',
      ...(party === 'cliente'
        ? { client_confirmed_at: new Date() }
        : { provider_confirmed_at: new Date() }),
    };
    const updated = await tx.contracts.update({ where: { id: contractId }, data });

    const bothConfirmed =
      (party === 'cliente' && updated.provider_confirmed_at !== null) ||
      (party === 'proveedor' && updated.client_confirmed_at !== null);

    if (bothConfirmed) {
      await tx.contracts.update({
        where: { id: contractId },
        data: { status: 'contrato_confirmado' },
      });
      // Advance the reservation in the SAME transaction (bilateral gate
      // satisfied: both confirmations are now recorded).
      await transitionStatusRecord(reservation.id, { status: 'contrato_confirmado' }, tx);
    }
  });

  const updatedContract = await prisma.contracts.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      status: true,
      client_confirmed_at: true,
      provider_confirmed_at: true,
    },
  });
  if (!updatedContract) throw AppError.notFound('Contract not found');
  const reservationNow = await prisma.reservations.findUnique({
    where: { id: reservation.id },
    select: { status: true },
  });

  const confirmed =
    updatedContract.status === 'contrato_confirmado' &&
    updatedContract.client_confirmed_at !== null &&
    updatedContract.provider_confirmed_at !== null;

  return {
    id: updatedContract.id,
    status: updatedContract.status,
    client_confirmed_at: toISOStringOrNull(updatedContract.client_confirmed_at),
    provider_confirmed_at: toISOStringOrNull(updatedContract.provider_confirmed_at),
    reservation_status: reservationNow?.status ?? 'unknown',
    confirmed,
  };
}

/** Status write used by the contract flow (trigger writes history). */
async function transitionStatusRecord(
  reservationId: number,
  change: { status: string },
  tx: Prisma.TransactionClient,
): Promise<void> {
  const reservation = await tx.reservations.findUnique({ where: { id: reservationId } });
  if (!reservation) throw AppError.notFound('Reservation not found');
  if (reservation.status !== 'pendiente_firma') {
    throw AppError.stateTransitionInvalid(
      `Cannot mark contract confirmed: reservation is ${reservation.status}`,
      { reservation_status: reservation.status },
    );
  }
  await tx.reservations.update({
    where: { id: reservationId },
    data: { status: change.status as 'contrato_confirmado', updated_at: new Date() },
  });
}