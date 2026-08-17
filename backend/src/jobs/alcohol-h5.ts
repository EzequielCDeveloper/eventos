import { prisma } from '../config/database';
import { dispatch } from '../services/notification.service';
import { reservationStartDate, alreadyNotified } from './queue';

/**
 * Alcohol permit H-5 worker (BR-005.8, D-011).
 *
 * Reservations that requested an alcohol permit PAUSE at the
 * `permiso_alcohol` state (enforced by the reservation state machine, S3)
 * until the client makes the H-5 decision
 * (`continuar_sin_alcohol` | `cancelar`). This worker is the H-5 prompt:
 * at most 5 hours before the event start it dispatches the critical
 * `permiso_alcohol_h5` notification (push + email, per notificaciones.md)
 * to the client, with the decision options in the payload.
 *
 * Rows already decided (`h5_decision` set) or already prompted (3h dedupe
 * window) are skipped. Runs DB-driven on a BullMQ tick and is exported
 * for direct invocation (smoke runs without Redis).
 */

export interface AlcoholH5RunResult {
  candidate_reservations: number;
  prompted: number;
  skipped: number;
}

export async function processAlcoholH5(options: { now?: Date } = {}): Promise<AlcoholH5RunResult> {
  const now = options.now ?? new Date();
  const candidates = await prisma.reservations.findMany({
    where: {
      status: 'permiso_alcohol',
      alcohol_permits: { is: { status: 'lista_espera' } },
    },
    take: 100,
    include: { alcohol_permits: true },
  });

  let prompted = 0;
  let skipped = 0;

  for (const reservation of candidates) {
    // A decision already recorded → nothing left to prompt.
    if (reservation.alcohol_permits?.h5_decision !== null && reservation.alcohol_permits?.h5_decision !== undefined) {
      skipped += 1;
      continue;
    }
    const start = reservationStartDate(reservation.event_date, reservation.start_time);
    const hoursLeft = (start.getTime() - now.getTime()) / 3600_000;
    // Not at H-5 yet, or the event has already started.
    if (hoursLeft > 5 || hoursLeft <= 0) {
      skipped += 1;
      continue;
    }
    if (await alreadyNotified(reservation.client_id, 'permiso_alcohol_h5', reservation.id, now)) {
      skipped += 1;
      continue;
    }

    await dispatch({
      userId: reservation.client_id,
      type: 'permiso_alcohol_h5',
      title: 'Permiso de alcohol — decisión requerida (H-5)',
      body: 'Tu reserva está pausada en permiso_alcohol. Decide continuar sin alcohol o cancelar antes del evento.',
      payload: {
        reservation_id: reservation.id,
        event_date: reservation.event_date.toISOString().slice(0, 10),
        start_time: reservation.start_time.toISOString().slice(11, 19),
        options: ['continuar_sin_alcohol', 'cancelar'],
      },
    });
    prompted += 1;
  }

  return {
    candidate_reservations: candidates.length,
    prompted,
    skipped,
  };
}