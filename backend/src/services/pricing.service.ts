import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../types/api';
import { requireOwnedService } from './services.service';

/**
 * Pricing service (UR-002.4, BR-004, D-007).
 *
 * Pricing is polymorphic by service_type (D-001 canonical schema):
 *   - salon            → single `salon_pricing` row (block + extra hour)
 *   - sonido           → one or more `sound_packages` rows
 *   - servicio_persona → single `service_persona_pricing` row
 *
 * Extras and dynamic pricing rules live alongside. Every write route
 * first asserts provider ownership of the parent service. All MXN amounts
 * are DECIMAL(10,2) — serialized as two-decimal strings.
 */

const P2002 = 'P2002';
const P2025 = 'P2025';

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function toMoney(value: Prisma.Decimal | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.toFixed(2);
}

/** GET /services/:id/pricing — the pricing rows of the service's type. */
export async function getServicePricing(serviceId: number) {
  const service = await prisma.services.findUnique({
    where: { id: serviceId },
    select: { service_type: true, salon_pricing: true, sound_packages: true, service_persona_pricing: true },
  });
  if (!service) throw AppError.notFound('Service not found');

  switch (service.service_type) {
    case 'salon':
      return {
        service_type: 'salon' as const,
        salon: service.salon_pricing
          ? {
              base_block_hours: service.salon_pricing.base_block_hours,
              base_block_price: toMoney(service.salon_pricing.base_block_price),
              extra_hour_price: toMoney(service.salon_pricing.extra_hour_price),
            }
          : null,
      };
    case 'sonido':
      return {
        service_type: 'sonido' as const,
        sound_packages: service.sound_packages.map((p) => ({
          id: p.id,
          name: p.name,
          base_price: toMoney(p.base_price),
          base_hours: p.base_hours,
          extra_hour_price: toMoney(p.extra_hour_price),
        })),
      };
    case 'servicio_persona':
      return {
        service_type: 'servicio_persona' as const,
        persona: service.service_persona_pricing
          ? {
              price_per_person_per_hour: toMoney(
                service.service_persona_pricing.price_per_person_per_hour,
              ),
            }
          : null,
      };
  }
}

export interface CreatePricingInput {
  salon?: { base_block_hours: number; base_block_price: number; extra_hour_price: number };
  sound_package?: { name: string; description: string; base_price: number; base_hours: number; extra_hour_price: number };
  persona?: { price_per_person_per_hour: number };
}

/**
 * POST /services/:id/pricing — create the pricing row of the service's
 * type. Salon/persona are unique per service: a second create is 409.
 */
export async function createServicePricing(
  serviceId: number,
  providerId: number,
  input: CreatePricingInput,
): Promise<{ created: boolean }> {
  const service = await requireOwnedService(serviceId, providerId);

  try {
    switch (service.service_type) {
      case 'salon': {
        if (!input.salon) throw invalidPricing('salon');
        await prisma.salon_pricing.create({
          data: {
            service_id: service.id,
            base_block_hours: input.salon.base_block_hours,
            base_block_price: money(input.salon.base_block_price),
            extra_hour_price: money(input.salon.extra_hour_price),
          },
        });
        break;
      }
      case 'sonido': {
        if (!input.sound_package) throw invalidPricing('sound_package');
        await prisma.sound_packages.create({
          data: {
            service_id: service.id,
            name: input.sound_package.name,
            description: input.sound_package.description,
            base_price: money(input.sound_package.base_price),
            base_hours: input.sound_package.base_hours,
            extra_hour_price: money(input.sound_package.extra_hour_price),
          },
        });
        break;
      }
      case 'servicio_persona': {
        if (!input.persona) throw invalidPricing('persona');
        await prisma.service_persona_pricing.create({
          data: {
            service_id: service.id,
            price_per_person_per_hour: money(input.persona.price_per_person_per_hour),
          },
        });
        break;
      }
    }
  } catch (error) {
    if ((error as { code?: string }).code === P2002) {
      throw AppError.conflict('Pricing already exists for this service — use PUT to update it');
    }
    throw error;
  }
  return { created: true };
}

/** PUT /services/:id/pricing — update (or create) the pricing row (upsert). */
export async function updateServicePricing(
  serviceId: number,
  providerId: number,
  input: CreatePricingInput,
): Promise<{ updated: boolean }> {
  const service = await requireOwnedService(serviceId, providerId);

  switch (service.service_type) {
    case 'salon': {
      const salon = input.salon;
      if (!salon) throw invalidPricing('salon');
      await upsertUnique(
        () =>
          prisma.salon_pricing.upsert({
            where: { service_id: service.id },
            update: {
              base_block_hours: salon.base_block_hours,
              base_block_price: money(salon.base_block_price),
              extra_hour_price: money(salon.extra_hour_price),
            },
            create: {
              service_id: service.id,
              base_block_hours: salon.base_block_hours,
              base_block_price: money(salon.base_block_price),
              extra_hour_price: money(salon.extra_hour_price),
            },
          }),
        'salon',
      );
      break;
    }
    case 'servicio_persona': {
      const persona = input.persona;
      if (!persona) throw invalidPricing('persona');
      await upsertUnique(
        () =>
          prisma.service_persona_pricing.upsert({
            where: { service_id: service.id },
            update: {
              price_per_person_per_hour: money(persona.price_per_person_per_hour),
            },
            create: {
              service_id: service.id,
              price_per_person_per_hour: money(persona.price_per_person_per_hour),
            },
          }),
        'persona',
      );
      break;
    }
    case 'sonido': {
      // Sound services add packages via POST /pricing; editing a specific
      // package row is deferred (S3 booking work) to keep this slice's
      // pricing surface focused.
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message:
          'Sound packages are created per package via POST /services/:id/pricing; there is no bulk replace in this version',
      });
    }
  }
  return { updated: true };
}

async function upsertUnique(op: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await op();
  } catch (error) {
    if ((error as { code?: string }).code === P2025) {
      throw AppError.notFound(`${label} pricing does not exist for this service`);
    }
    throw error;
  }
}

function invalidPricing(kind: string): AppError {
  return new AppError({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: `This service type requires a \`${kind}\` pricing payload`,
  });
}

export interface CreateExtraInput {
  name: string;
  description: string;
  price: number;
  sound_package_id?: number;
}

/** GET /services/:id/extras — all extras of the service. */
export async function listExtras(serviceId: number) {
  const extras = await prisma.service_extras.findMany({
    where: { service_id: serviceId },
    orderBy: { id: 'asc' },
  });
  return extras.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    price: toMoney(e.price),
    image_url: e.image_url,
  }));
}

/** POST /services/:id/extras — create an extra (owner-only). */
export async function createExtra(
  serviceId: number,
  providerId: number,
  input: CreateExtraInput,
): Promise<{ id: number }> {
  await requireOwnedService(serviceId, providerId);
  const extra = await prisma.service_extras.create({
    data: {
      service_id: serviceId,
      name: input.name,
      description: input.description,
      price: money(input.price),
      sound_package_id: input.sound_package_id,
    },
    select: { id: true },
  });
  return { id: extra.id };
}

/** DELETE /services/:id/extras/:extraId — remove an extra (owner-only). */
export async function deleteExtra(
  serviceId: number,
  providerId: number,
  extraId: number,
): Promise<void> {
  await requireOwnedService(serviceId, providerId);
  try {
    await prisma.service_extras.delete({ where: { id: extraId } });
  } catch (error) {
    if ((error as { code?: string }).code === P2025) {
      throw AppError.notFound('Extra not found');
    }
    throw error;
  }
}

export interface CreateRuleInput {
  adjustment_type: 'temporada' | 'demanda' | 'dia_semana' | 'bloque_turno';
  adjustment_value: number;
  scope: unknown;
  sound_package_id?: number;
}

/** GET /services/:id/dynamic-rules — dynamic pricing rules (D-007 read-only at booking). */
export async function listDynamicRules(serviceId: number) {
  const rules = await prisma.dynamic_pricing_rules.findMany({
    where: { service_id: serviceId },
    orderBy: { id: 'asc' },
  });
  return rules.map((r) => ({
    id: r.id,
    adjustment_type: r.adjustment_type,
    adjustment_value: toMoney(r.adjustment_value),
    scope: r.scope,
    sound_package_id: r.sound_package_id,
  }));
}

/** POST /services/:id/dynamic-rules — create a pricing rule (owner-only). */
export async function createDynamicRule(
  serviceId: number,
  providerId: number,
  input: CreateRuleInput,
): Promise<{ id: number }> {
  await requireOwnedService(serviceId, providerId);
  const rule = await prisma.dynamic_pricing_rules.create({
    data: {
      service_id: serviceId,
      adjustment_type: input.adjustment_type,
      adjustment_value: money(input.adjustment_value),
      scope: input.scope as Prisma.InputJsonValue,
      sound_package_id: input.sound_package_id,
    },
    select: { id: true },
  });
  return { id: rule.id };
}

/** DELETE /services/:id/dynamic-rules/:ruleId — remove a rule (owner-only). */
export async function deleteDynamicRule(
  serviceId: number,
  providerId: number,
  ruleId: number,
): Promise<void> {
  await requireOwnedService(serviceId, providerId);
  try {
    await prisma.dynamic_pricing_rules.delete({ where: { id: ruleId } });
  } catch (error) {
    if ((error as { code?: string }).code === P2025) {
      throw AppError.notFound('Dynamic pricing rule not found');
    }
    throw error;
  }
}