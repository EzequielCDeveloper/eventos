import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as searchService from '../../services/search.service';
import * as servicesService from '../../services/services.service';
import { signedPhotoUrl } from '../../services/storage.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { parseISODate } from '../../utils/datetime';

/**
 * Services endpoints (UR-002.3–UR-002.5, BR-001.6–BR-001.7).
 *
 * Public reads: search, detail, slots availability, reviews — the
 * marketplace surface any client needs before booking.
 * Provider writes: POST/PUT/DELETE /services (role prestador, owner-only).
 */
export const servicesRouter: Router = Router();

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(1).max(500),
});

const salonPricingSchema = z.object({
  base_block_hours: z.number().int().min(1).max(24),
  base_block_price: z.number().nonnegative(),
  extra_hour_price: z.number().nonnegative(),
});

const soundPackageSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().min(1),
  base_price: z.number().nonnegative(),
  base_hours: z.number().int().min(1).max(24),
  extra_hour_price: z.number().nonnegative(),
});

const personaPricingSchema = z.object({
  price_per_person_per_hour: z.number().nonnegative(),
});

const createServiceSchema = z.object({
  service_type: z.enum(['salon', 'sonido', 'servicio_persona']),
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  location_type: z.enum(['fija', 'area_servicio']),
  location: locationSchema,
  coverage_area: z.unknown().optional(),
  max_capacity: z.number().int().positive(),
  approval_mode: z.enum(['manual', 'inmediata']).optional(),
  viaticos_per_km: z.number().nonnegative().optional(),
  deposit_amount: z.number().nonnegative().optional(),
  cofepris_responsibility_accepted: z.boolean().optional(),
  pricing: z.object({
    salon: salonPricingSchema.optional(),
    sound_packages: z.array(soundPackageSchema).min(1).optional(),
    persona: personaPricingSchema.optional(),
  }),
  photos: z
    .array(z.object({ url: z.string().url().max(500), position: z.number().int().nonnegative() }))
    .max(20)
    .optional(),
  amenity_ids: z.array(z.number().int().positive()).max(50).optional(),
  event_type_ids: z.array(z.number().int().positive()).max(20).optional(),
});

const updateServiceSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(10).optional(),
    location_type: z.enum(['fija', 'area_servicio']).optional(),
    location: locationSchema.optional(),
    coverage_area: z.unknown().optional(),
    max_capacity: z.number().int().positive().optional(),
    approval_mode: z.enum(['manual', 'inmediata']).optional(),
    viaticos_per_km: z.number().nonnegative().nullable().optional(),
    deposit_amount: z.number().nonnegative().nullable().optional(),
    cofepris_responsibility_accepted: z.boolean().optional(),
    status: z.enum(['borrador', 'pendiente_verificacion', 'publicado', 'rechazado']).optional(),
  })
  .strict();

const searchQuerySchema = z.object({
  service_type: z.enum(['salon', 'sonido', 'servicio_persona']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  capacity: z.coerce.number().int().positive().optional(),
  zone: z.string().min(1).max(200).optional(),
  min_price: z.coerce.number().nonnegative().optional(),
  max_price: z.coerce.number().nonnegative().optional(),
  event_type: z.coerce.number().int().positive().optional(),
  event_type_name: z.string().min(1).max(100).optional(),
  pool: z.enum(['true', 'false']).optional(),
  internet: z.enum(['true', 'false']).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  sort: z
    .enum(['created:desc', 'rating:desc', 'price:asc', 'price:desc', 'name:asc'])
    .default('created:desc'),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const slotsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const serviceParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const servicePhotoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  photoId: z.coerce.number().int().positive(),
});

const addPhotoSchema = z.object({
  url: z.string().url().max(500),
  position: z.number().int().nonnegative().optional(),
});

const reorderPhotosSchema = z
  .object({ positions: z.array(z.number().int().positive()).min(1) })
  .strict();

/**
 * GET /services — marketplace search (BR-001.6–BR-001.7, D-002).
 * Public: only published, non-deleted services are returned.
 */
servicesRouter.get(
  '/services',
  validate({ query: searchQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof searchQuerySchema>;
    const filters: searchService.SearchFilters = {
      serviceType: q.service_type,
      date: q.date ? (parseISODate(q.date) ?? undefined) : undefined,
      capacity: q.capacity,
      zone: q.zone,
      minPrice: q.min_price,
      maxPrice: q.max_price,
      eventTypeId: q.event_type,
      eventTypeName: q.event_type_name,
      pool: q.pool === 'true' ? true : undefined,
      internet: q.internet === 'true' ? true : undefined,
      minRating: q.rating,
      sort: q.sort,
    };
    const result = await searchService.searchServices(filters, req.query);
    res.json({ data: result.items, meta: result.meta });
  }),
);

/**
 * GET /services/me — the authenticated provider's own services, all statuses
 * incl. `borrador`, newest first (FR-011.7). Backend is the primary source
 * for the provider dashboard (the frontend persisted-ID registry becomes a
 * cache). Defined BEFORE `/services/:id` so the literal segment wins match.
 */
servicesRouter.get(
  '/services/me',
  requireAuth(),
  requireRole('prestador'),
  asyncHandler(async (req, res) => {
    const items = await servicesService.listProviderServices(req.user!.id);
    res.json({ data: items });
  }),
);

/** GET /services/:id — marketplace detail (public). */
servicesRouter.get(
  '/services/:id',
  validate({ params: serviceParamsSchema }),
  asyncHandler(async (req, res) => {
    const detail = await searchService.getServiceById(Number(req.params.id));
    if (!detail) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Service not found' } });
      return;
    }
    res.json({ data: detail });
  }),
);

/** GET /services/:id/slots — availability via v_slot_availability (public). */
servicesRouter.get(
  '/services/:id/slots',
  validate({ params: serviceParamsSchema, query: slotsQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof slotsQuerySchema>;
    const slots = await searchService.listServiceSlots(Number(req.params.id), {
      from: q.from ? (parseISODate(q.from) ?? undefined) : undefined,
      to: q.to ? (parseISODate(q.to) ?? undefined) : undefined,
    });
    res.json({ data: slots });
  }),
);

/** GET /services/:id/reviews — reviews for a service (public). */
servicesRouter.get(
  '/services/:id/reviews',
  validate({ params: serviceParamsSchema }),
  asyncHandler(async (req, res) => {
    const result = await servicesService.listServiceReviews(Number(req.params.id), {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    res.json({ data: result.items, meta: result.meta });
  }),
);

/** POST /services — provider creates a service aggregate (draft). */
servicesRouter.post(
  '/services',
  requireAuth(),
  requireRole('prestador'),
  validate({ body: createServiceSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createServiceSchema>;
    const created = await servicesService.createService({
      providerId: req.user!.id,
      service_type: body.service_type,
      title: body.title,
      description: body.description,
      location_type: body.location_type,
      location: body.location,
      coverage_area: body.coverage_area,
      max_capacity: body.max_capacity,
      approval_mode: body.approval_mode,
      viaticos_per_km: body.viaticos_per_km,
      deposit_amount: body.deposit_amount,
      cofepris_responsibility_accepted: body.cofepris_responsibility_accepted,
      pricing: body.pricing,
      photos: body.photos,
      amenity_ids: body.amenity_ids,
      event_type_ids: body.event_type_ids,
    });
    res.status(201).json({ data: created });
  }),
);

/** PUT /services/:id — provider updates its own service (publish gate). */
servicesRouter.put(
  '/services/:id',
  requireAuth(),
  requireRole('prestador'),
  validate({ params: serviceParamsSchema, body: updateServiceSchema }),
  asyncHandler(async (req, res) => {
    const updated = await servicesService.updateService(Number(req.params.id), req.user!.id, req.body);
    res.json({ data: updated });
  }),
);

/** DELETE /services/:id — provider soft-deletes its own service. */
servicesRouter.delete(
  '/services/:id',
  requireAuth(),
  requireRole('prestador'),
  validate({ params: serviceParamsSchema }),
  asyncHandler(async (req, res) => {
    await servicesService.deleteService(Number(req.params.id), req.user!.id);
    res.json({ data: { deleted: true } });
  }),
);

// ---- Service photos (FR-011.7) ----------------------------------------------

/**
 * GET /services/:id/photos — ALL photos of the provider's own service (any
 * moderation status), ordered by position. The marketplace detail only shows
 * approved photos; the owner needs the full set to manage the gallery.
 * Placed here (before the POST/PUT/DELETE photo routes) with the literal
 * match winning over nothing conflicting.
 */
servicesRouter.get(
  '/services/:id/photos',
  requireAuth(),
  requireRole('prestador'),
  validate({ params: serviceParamsSchema }),
  asyncHandler(async (req, res) => {
    const photos = await servicesService.listServicePhotos(
      Number(req.params.id),
      req.user!.id,
    );
    res.json({ data: photos });
  }),
);

/** POST /services/:id/photos — provider adds a photo to its own service (pendiente_moderacion). */
servicesRouter.post(
  '/services/:id/photos',
  requireAuth(),
  requireRole('prestador'),
  validate({ params: serviceParamsSchema, body: addPhotoSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof addPhotoSchema>;
    const photo = await servicesService.addServicePhoto(
      Number(req.params.id),
      req.user!.id,
      body,
    );
    res.status(201).json({
      data: {
        id: photo.id,
        // The row stores the raw path; return a fresh long-lived URL (work-unit C).
        url: signedPhotoUrl(photo.url),
        position: photo.position,
        status: photo.status,
        created_at: photo.created_at.toISOString(),
      },
    });
  }),
);

/** PUT /services/:id/photos/reorder — reorder the service's photos (array order = position). */
servicesRouter.put(
  '/services/:id/photos/reorder',
  requireAuth(),
  requireRole('prestador'),
  validate({ params: serviceParamsSchema, body: reorderPhotosSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof reorderPhotosSchema>;
    const updated = await servicesService.reorderServicePhotos(
      Number(req.params.id),
      req.user!.id,
      body.positions,
    );
    res.json({ data: updated });
  }),
);

/** DELETE /services/:id/photos/:photoId — provider removes a photo from its own service (hard delete). */
servicesRouter.delete(
  '/services/:id/photos/:photoId',
  requireAuth(),
  requireRole('prestador'),
  validate({ params: servicePhotoParamsSchema }),
  asyncHandler(async (req, res) => {
    await servicesService.deleteServicePhoto(
      Number(req.params.id),
      Number(req.params.photoId),
      req.user!.id,
    );
    res.json({ data: { deleted: true } });
  }),
);