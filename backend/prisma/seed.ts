import 'dotenv/config';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/database';

/**
 * Database seed (BR-004.8).
 *
 * Seeds the base catalog and bootstrap records required for the platform
 * to work:
 *   - default amenities (Wi-Fi, dance floor, vegan menu, pool, internet)
 *   - default event types (Boda, Quinceanera, Corporativo, Infantil)
 *   - initial commission rate (latest commission_settings row is the
 *     current rate; requires an admin actor)
 *   - a development admin account (placeholder credentials, development
 *     only — never use in production)
 *
 * Idempotent by design: existing rows are skipped (upsert semantics), so
 * it can be re-run safely. Run with `npm run prisma:seed` (tsx
 * prisma/seed.ts).
 */

const DEV_ADMIN_EMAIL = 'admin@eventos.local';
const DEV_ADMIN_PASSWORD = 'admin-dev-placeholder';

async function seedAmenities(): Promise<void> {
  const amenities = [
    ['Wi-Fi', 'High-speed wireless internet'],
    ['Pista de baile', 'Dance floor'],
    ['Menu vegano', 'Vegan menu available'],
    ['Alberca', 'Swimming pool'],
    ['Internet', 'Internet access'],
  ] as const;

  for (const [name, description] of amenities) {
    await prisma.amenities.upsert({
      where: { name },
      update: {},
      create: { name, description },
    });
  }
  console.log(`[seed] amenities: ${amenities.length} ensured`);
}

async function seedEventTypes(): Promise<void> {
  const types = ['Boda', 'Quinceanera', 'Corporativo', 'Infantil'] as const;
  for (const name of types) {
    await prisma.service_event_types.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`[seed] event types: ${types.length} ensured`);
}

async function seedDevAdminAndCommission(): Promise<void> {
  // Bootstrap admin actor required by commission_settings.changed_by FK.
  // DEVELOPMENT ONLY: placeholder credentials must be rotated in staging/prod.
  const passwordHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, 10);
  const admin = await prisma.users.upsert({
    where: { email: DEV_ADMIN_EMAIL },
    update: {},
    create: {
      full_name: 'Admin Plataforma (dev)',
      email: DEV_ADMIN_EMAIL,
      phone: '0000000000',
      role: 'administrador',
      segment: 'empresa',
      password_hash: passwordHash,
      verified: true,
    },
  });

  // Initial commission rate (10.00% — BR-006.2). Only insert when no
  // commission_settings row exists yet (history table).
  const existing = await prisma.commission_settings.findFirst({ orderBy: { id: 'asc' } });
  if (!existing) {
    await prisma.commission_settings.create({
      data: { commission_rate: new Prisma.Decimal(10.0), changed_by: admin.id },
    });
    console.log('[seed] initial commission rate: 10.00%');
  } else {
    console.log('[seed] commission_settings already present, skipping');
  }
}

async function main(): Promise<void> {
  await seedAmenities();
  await seedEventTypes();
  await seedDevAdminAndCommission();
  console.log('[seed] done');
}

main()
  .catch((error) => {
    console.error('[seed] failed', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());