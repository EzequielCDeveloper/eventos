import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { prisma } from '../../config/database';
import { AppError } from '../../types/api';
import { toISOStringOrNull } from '../../utils/datetime';
import { dispatch } from '../../services/notification.service';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Review endpoints (UR-002.12, FR-012.3) mounted under `/api/v1`.
 *
 *   POST /reviews            — rate a completed reservation (client only)
 *   GET  /services/:id/reviews — public listing (implemented in S2 on the
 *                              services router — see services.routes.ts)
 *
 * A review is only accepted when the reservation is COMPLETED, the event
 * date has passed, and the full price has been paid (FR-012.3). One review
 * per reservation (uk_reviews_reservation). On publish the provider is
 * notified immediately (`review_recibida`, in_app + push, BR-009).
 */
export const reviewsRouter: Router = Router();

const createReviewSchema = z
  .object({
    reservation_id: z.number().int().positive(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().min(1).max(2000).optional(),
  })
  .strict();

reviewsRouter.post(
  '/reviews',
  requireAuth(),
  validate({ body: createReviewSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createReviewSchema>;

    const reservation = await prisma.reservations.findUnique({
      where: { id: body.reservation_id },
      include: {
        reservation_items: { include: { services: { select: { provider_id: true } } } },
      },
    });
    if (!reservation) throw AppError.notFound('Reservation not found');
    if (reservation.client_id !== req.user!.id) {
      throw AppError.forbidden('Only the client of the reservation may review it');
    }

    // FR-012.3 gate: the review is post-event and post-payment only.
    const eventEnd = new Date(
      `${reservation.event_date.toISOString().slice(0, 10)}T${reservation.start_time.toISOString().slice(11, 19)}Z`,
    );
    if (reservation.status !== 'completada') {
      throw new AppError({
        statusCode: 422,
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Reviews are only allowed once the reservation is completed',
      });
    }
    if (eventEnd.getTime() >= Date.now()) {
      throw new AppError({
        statusCode: 422,
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Reviews are only allowed after the event date has passed (FR-012.3)',
      });
    }
    const paid = await prisma.payments.aggregate({
      where: { reservation_id: reservation.id, status: 'procesado' },
      _sum: { amount: true },
    });
    const paidAmount = paid._sum.amount;
    if (!paidAmount || Number(paidAmount) < Number(reservation.total_price)) {
      throw new AppError({
        statusCode: 422,
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Reviews are only allowed when the full payment is completed (FR-012.3)',
      });
    }

    const providerId = reservation.reservation_items[0]?.services.provider_id;
    if (!providerId) {
      throw new AppError({
        statusCode: 422,
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Reservation has no provider to review',
      });
    }

    let review;
    try {
      review = await prisma.reviews.create({
        data: {
          reservation_id: reservation.id,
          client_id: req.user!.id,
          provider_id: providerId,
          rating: body.rating,
          comment: body.comment ?? null,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw AppError.conflict('This reservation has already been reviewed');
      }
      throw error;
    }

    // BR-009: notify the provider immediately (review_recibida, in_app+push).
    await dispatch({
      userId: providerId,
      type: 'review_recibida',
      title: 'Review recibida',
      body: `Nueva calificación: ${body.rating}/5`,
      payload: { review_id: review.id, reservation_id: reservation.id, rating: body.rating },
    });

    res.status(201).json({
      data: {
        id: review.id,
        reservation_id: review.reservation_id,
        client_id: review.client_id,
        provider_id: review.provider_id,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at.toISOString(),
      },
    });
  }),
);

/** GET /reviews/:id — single review detail (documented extra, cheap). */
reviewsRouter.get(
  '/reviews/:id',
  requireAuth(),
  validate({ params: z.object({ id: z.coerce.number().int().positive() }) }),
  asyncHandler(async (req, res) => {
    const review = await prisma.reviews.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        users_reviews_client_idTousers: { select: { id: true, full_name: true, avatar_url: true } },
      },
    });
    if (!review) throw AppError.notFound('Review not found');
    res.json({
      data: {
        id: review.id,
        reservation_id: review.reservation_id,
        client_id: review.client_id,
        provider_id: review.provider_id,
        rating: review.rating,
        comment: review.comment,
        client: review.users_reviews_client_idTousers,
        created_at: toISOStringOrNull(review.created_at),
      },
    });
  }),
);