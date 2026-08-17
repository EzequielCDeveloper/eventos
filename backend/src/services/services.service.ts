import { Prisma } from '@prisma/client';
import type { services_location_type, services_service_type } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError, buildPaginationMeta } from '../types/api';
import type { PaginationParams } from '../types/api';

/**
 * Services domain service (BR-001, BR-002.5, BR-004, D-008).
 *
 * Owns service create/update/soft-delete, provider ownership enforcement,
 * reviews listing and the auto-creation of the provider's cancellation
 * policy (required FK on every service, one policy per provider).
 *
 * Provider verification is enforced at publish time: a service cannot move
 * to `publicado` while the provider is unverified (BR-002.5, BR-010.1).
 */

export interface SalonPricingInput {
  base_block_hours: number;
  base_block_price: number;
  extra_hour_price: number;
}

export interface SoundPackageInput {
  name: string;
  description: string;
  base_price: number;
  base_hours: number;
  extra_hour_price: number;
}

export interface PersonaPricingInput {
  price_per_person_per_hour: number;
}

export interface ServicePricingInput {
  salon?: SalonPricingInput;
  sound_packages?: SoundPackageInput[];
  persona?: PersonaPricingInput;
}

export interface CreateServiceInput {
  providerId: number;
  service_type: services_service_type;
  title: string;
  description: string;
  location_type: services_location_type;
  location: { lat: number; lng: number; address: string };
  coverage_area?: unknown;
  max_capacity: number;
  approval_mode?: 'manual' | 'inmediata';
  viaticos_per_km?: number;
  deposit_amount?: number;
  cofepris_responsibility_accepted?: boolean;
  pricing: ServicePricingInput;
  photos?: Array<{ url: string; position: number }>;
  amenity_ids?: number[];
  event_type_ids?: number[];
}

export interface UpdateServiceInput {
  title?: string;
  description?: string;
  location_type?: services_location_type;
  location?: { lat: number; lng: number; address: string };
  coverage_area?: unknown;
  max_capacity?: number;
  approval_mode?: 'manual' | 'inmediata';
  viaticos_per_km?: number | null;
  deposit_amount?: number | null;
  cofepris_responsibility_accepted?: boolean;
  status?: 'borrador' | 'pendiente_verificacion' | 'publicado' | 'rechazado';
}

/**
 * Load a service and assert the acting user owns it (provider-only child
 * routes). 404 for unknown/soft-deleted services, 403 for other users.
 */
export async function requireOwnedService(
  serviceId: number,
  userId: number,
): Promise<{ id: number; service_type: services_service_type }> {
  const service = await prisma.services.findUnique({
    where: { id: serviceId },
    select: { id: true, service_type: true, provider_id: true, deleted_at: true },
  });
  if (!service || service.deleted_at) {
    throw AppError.notFound('Service not found');
  }
  if (service.provider_id !== userId) {
    throw AppError.forbidden('This service belongs to another provider');
  }
  return { id: service.id, service_type: service.service_type };
}

/** Ensure the provider has a cancellation policy (one per provider, FK-required). */
async function ensureCancellationPolicy(
  tx: Prisma.TransactionClient,
  providerId: number,
): Promise<{ id: number }> {
  return tx.cancellation_policies.upsert({
    where: { provider_id: providerId },
    update: {},
    create: { provider_id: providerId }, // defaults: 50% retention, 30d window, deposit refundable
  });
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

async function applyPricing(
  tx: Prisma.TransactionClient,
  service: { id: number; service_type: services_service_type },
  pricing: ServicePricingInput,
): Promise<void> {
  switch (service.service_type) {
    case 'salon': {
      if (!pricing.salon) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Salon services require `pricing.salon` at creation',
        });
      }
      await tx.salon_pricing.create({
        data: {
          service_id: service.id,
          base_block_hours: pricing.salon.base_block_hours,
          base_block_price: decimal(pricing.salon.base_block_price),
          extra_hour_price: decimal(pricing.salon.extra_hour_price),
        },
      });
      break;
    }
    case 'sonido': {
      if (!pricing.sound_packages?.length) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Sound services require at least one `pricing.sound_packages` entry',
        });
      }
      await tx.sound_packages.createMany({
        data: pricing.sound_packages.map((p) => ({
          service_id: service.id,
          name: p.name,
          description: p.description,
          base_price: decimal(p.base_price),
          base_hours: p.base_hours,
          extra_hour_price: decimal(p.extra_hour_price),
        })),
      });
      break;
    }
    case 'servicio_persona': {
      if (!pricing.persona) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Persona services require `pricing.persona` at creation',
        });
      }
      await tx.service_persona_pricing.create({
        data: {
          service_id: service.id,
          price_per_person_per_hour: decimal(pricing.persona.price_per_person_per_hour),
        },
      });
      break;
    }
  }
}

/**
 * Create a service aggregate atomically: service row + pricing for its
 * service_type + optional photos/amenities/event types. New services are
 * born as `borrador` — publish (and its verification gate) goes through
 * PUT /services/:id.
 */
export async function createService(input: CreateServiceInput): Promise<{ id: number }> {
  return prisma.$transaction(async (tx) => {
    const policy = await ensureCancellationPolicy(tx, input.providerId);
    const service = await tx.services.create({
      data: {
        provider_id: input.providerId,
        service_type: input.service_type,
        title: input.title,
        description: input.description,
        location_type: input.location_type,
        location: input.location,
        coverage_area: input.coverage_area ?? Prisma.JsonNull,
        max_capacity: input.max_capacity,
        approval_mode: input.approval_mode ?? 'manual',
        viaticos_per_km:
          input.viaticos_per_km !== undefined ? decimal(input.viaticos_per_km) : null,
        deposit_amount:
          input.deposit_amount !== undefined ? decimal(input.deposit_amount) : null,
        cofepris_responsibility_accepted: input.cofepris_responsibility_accepted ?? false,
        cancellation_policy_id: policy.id,
      },
    });

    await applyPricing(tx, service, input.pricing);

    if (input.photos?.length) {
      await tx.service_photos.createMany({
        data: input.photos.map((photo) => ({
          service_id: service.id,
          url: photo.url,
          position: photo.position,
        })),
      });
    }
    if (input.amenity_ids?.length) {
      await tx.service_amenities.createMany({
        data: input.amenity_ids.map((amenityId) => ({
          service_id: service.id,
          amenity_id: amenityId,
        })),
      });
    }
    if (input.event_type_ids?.length) {
      await tx.service_service_event_types.createMany({
        data: input.event_type_ids.map((eventTypeId) => ({
          service_id: service.id,
          event_type_id: eventTypeId,
        })),
      });
    }

    return { id: service.id };
  });
}

/**
 * Update a service (owner-only, partial/PATCH semantics). Publishing
 * enforces BR-002.5: an unverified provider receives 422
 * PROVIDER_NOT_VERIFIED. `service_type` is immutable — it defines the
 * pricing model of the service.
 */
export async function updateService(
  serviceId: number,
  providerId: number,
  patch: UpdateServiceInput,
): Promise<{ id: number }> {
  await requireOwnedService(serviceId, providerId);

  if (patch.status === 'publicado') {
    const provider = await prisma.users.findUnique({
      where: { id: providerId },
      select: { verified: true },
    });
    if (!provider?.verified) {
      throw AppError.providerNotVerified(
        'Provider must complete identity verification before publishing services (BR-002.5, BR-010.1)',
      );
    }
  }

  const data: Prisma.servicesUpdateInput = {
    updated_at: new Date(),
  };
  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    switch (field) {
      case 'title':
      case 'description':
      case 'location_type':
      case 'location':
      case 'coverage_area':
      case 'max_capacity':
      case 'approval_mode':
      case 'cofepris_responsibility_accepted':
      case 'status':
        data[field as keyof Prisma.servicesUpdateInput] = value as never;
        break;
      case 'viaticos_per_km':
        data.viaticos_per_km = value === null ? null : decimal(value as number);
        break;
      case 'deposit_amount':
        data.deposit_amount = value === null ? null : decimal(value as number);
        break;
    }
  }

  const updated = await prisma.services.update({
    where: { id: serviceId },
    data,
    select: { id: true },
  });
  return { id: updated.id };
}

/** Soft delete a service (BR-004 soft delete on services). Owner-only. */
export async function deleteService(serviceId: number, providerId: number): Promise<void> {
  await requireOwnedService(serviceId, providerId);
  await prisma.services.update({
    where: { id: serviceId },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
}

export interface ServiceReview {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  client: { id: number; full_name: string; avatar_url: string | null };
}

/**
 * Reviews for a service (GET /services/:id/reviews, UR-002.12): a review
 * belongs to a reservation whose items include the service, which also
 * covers package bookings.
 */
export async function listServiceReviews(
  serviceId: number,
  pagination: PaginationParams,
): Promise<{ items: ServiceReview[]; meta: ReturnType<typeof buildPaginationMeta> }> {
  const where = {
    reservations: {
      reservation_items: { some: { service_id: serviceId } },
    },
  };

  const [items, total] = await Promise.all([
    prisma.reviews.findMany({
      where,
      include: {
        users_reviews_client_idTousers: {
          select: { id: true, full_name: true, avatar_url: true },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
    prisma.reviews.count({ where }),
  ]);

  return {
    items: items.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at.toISOString(),
      client: {
        id: review.users_reviews_client_idTousers.id,
        full_name: review.users_reviews_client_idTousers.full_name,
        avatar_url: review.users_reviews_client_idTousers.avatar_url,
      },
    })),
    meta: buildPaginationMeta(total, pagination),
  };
}