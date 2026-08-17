import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { prisma } from '../../config/database';
import { AppError } from '../../types/api';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Favorites endpoints (UR-002.13, FR-012.1) mounted under `/api/v1`.
 *
 *   POST   /favorites      — add a service to the user's favorites
 *   DELETE /favorites/:id  — remove a favorite (owner only)
 *   GET    /favorites      — the user's favorite list (documented extra;
 *                            FR-012.1 requires sync with the client)
 *
 * Duplicate (client_id, service_id) pairs are rejected with 409
 * (enforced by `uk_favorites`).
 */
export const favoritesRouter: Router = Router();

favoritesRouter.use(requireAuth());

const favoriteParamsSchema = z.object({ id: z.coerce.number().int().positive() });

const createFavoriteSchema = z
  .object({ service_id: z.number().int().positive() })
  .strict();

/** POST /favorites — add a service to favorites (UR-002.13). */
favoritesRouter.post(
  '/favorites',
  validate({ body: createFavoriteSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createFavoriteSchema>;
    const service = await prisma.services.findUnique({
      where: { id: body.service_id },
      select: { id: true, deleted_at: true, status: true },
    });
    if (!service || service.deleted_at) {
      throw AppError.notFound('Service not found');
    }
    try {
      const favorite = await prisma.favorites.create({
        data: { client_id: req.user!.id, service_id: body.service_id },
      });
      res.status(201).json({
        data: {
          id: favorite.id,
          service_id: favorite.service_id,
          created_at: favorite.created_at.toISOString(),
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw AppError.conflict('Service is already in your favorites');
      }
      throw error;
    }
  }),
);

/** GET /favorites — the user's favorite list with service previews
 *  (documented extra, FR-012.1). */
favoritesRouter.get(
  '/favorites',
  asyncHandler(async (req, res) => {
    const rows = await prisma.favorites.findMany({
      where: { client_id: req.user!.id },
      orderBy: { created_at: 'desc' },
      include: {
        services: {
          include: {
            users: { select: { id: true, full_name: true, verified: true } },
            service_photos: { where: { status: 'aprobada' }, take: 1, orderBy: { position: 'asc' } },
          },
        },
      },
    });
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        service_id: row.service_id,
        created_at: row.created_at.toISOString(),
        service: {
          id: row.services.id,
          title: row.services.title,
          service_type: row.services.service_type,
          status: row.services.status,
          max_capacity: row.services.max_capacity,
          location: row.services.location,
          provider: row.services.users,
          photo: row.services.service_photos[0] ?? null,
        },
      })),
    });
  }),
);

/** DELETE /favorites/:id — remove a favorite (owner only, UR-002.13). */
favoritesRouter.delete(
  '/favorites/:id',
  validate({ params: favoriteParamsSchema }),
  asyncHandler(async (req, res) => {
    const favorite = await prisma.favorites.findFirst({
      where: { id: Number(req.params.id), client_id: req.user!.id },
    });
    if (!favorite) throw AppError.notFound('Favorite not found');
    await prisma.favorites.delete({ where: { id: favorite.id } });
    res.status(204).send();
  }),
);