import type { notifications_type, scheduled_messages_recipient, scheduled_messages_trigger_type } from '@prisma/client';
import { prisma } from '../config/database';
import { dispatch } from '../services/notification.service';

/**
 * Scheduled messages worker (BR-008.5, D-011).
 *
 * Processes the 4 automation trigger types from the `scheduled_messages`
 * table once `send_at` has passed:
 *
 *   reserva_confirmada → firma_contrato        (confirmación/contrato)
 *   evento             → recordatorio_evento_h48
 *   pago_pendiente     → saldo_pendiente
 *   review             → encuesta_satisfaccion
 *
 * `recipient` scopes the audience: `cliente` (role usuario) or `ambos`
 * (usuario + prestador) — see `menu/mensajeria.md` for the automation
 * catalog. Rows are marked `enviado` only after all dispatches complete.
 *
 * ### Schema limitation (documented)
 *
 * The adopted `scheduled_messages` table carries NO user/reservation
 * foreign key, only a recipient scope — so the worker dispatches to the
 * audience class defined by that scope. Per-reservation targeting is
 * impossible without a schema change; the event-reminders worker
 * (`event-reminders.ts`) DOES target concrete reservations, so the
 * reservation-backed automations (H-48/H-2, BR-009.6) are exact.
 *
 * Runs DB-driven on a BullMQ tick (jobs/queue.ts) and is also exported
 * for direct invocation (e.g. smoke runs without Redis).
 */

export const TRIGGER_TO_NOTIFICATION: Record<
  scheduled_messages_trigger_type,
  notifications_type
> = {
  reserva_confirmada: 'firma_contrato',
  evento: 'recordatorio_evento_h48',
  pago_pendiente: 'saldo_pendiente',
  review: 'encuesta_satisfaccion',
};

const TRIGGER_DEFAULTS: Record<scheduled_messages_trigger_type, { title: string; body: string }> = {
  reserva_confirmada: { title: 'Reserva confirmada', body: 'Tu reserva fue confirmada. Revisa los detalles del contrato.' },
  evento: { title: 'Tu evento se acerca', body: 'Recordatorio: tu evento está por comenzar. Revisa los detalles en la app.' },
  pago_pendiente: { title: 'Saldo pendiente', body: 'Tienes un saldo pendiente por liquidar antes de tu evento.' },
  review: { title: 'Cuéntanos tu experiencia', body: 'Tu evento terminó. Comparte una calificación con el proveedor.' },
};

function recipientRoles(recipient: scheduled_messages_recipient): { usuario: boolean; prestador: boolean } {
  if (recipient === 'ambos') return { usuario: true, prestador: true };
  return { usuario: true, prestador: false };
}

export interface ScheduledMessagesRunResult {
  due_rows: number;
  recipient_targets: number;
  notifications_created: number;
  rows_marked_sent: number;
}

/**
 * Process all due `scheduled_messages` rows (send_at <= now). Dispatch is
 * per recipient role scope; a failing dispatch is logged and the row is
 * still marked `enviado` only when no row remains unattempted-safe —
 * individual failures are counted and the row advances (the automation
 * already fired once; retries are out of scope for MVP).
 */
export async function processScheduledMessages(options: { now?: Date; limit?: number } = {}): Promise<ScheduledMessagesRunResult> {
  const now = options.now ?? new Date();
  const dueRows = await prisma.scheduled_messages.findMany({
    where: { status: 'pendiente', send_at: { lte: now } },
    orderBy: { send_at: 'asc' },
    take: options.limit ?? 100,
  });

  let recipientTargets = 0;
  let notificationsCreated = 0;

  for (const row of dueRows) {
    const roles = recipientRoles(row.recipient);
    const type = TRIGGER_TO_NOTIFICATION[row.trigger_type];
    const defaults = TRIGGER_DEFAULTS[row.trigger_type];

    const users = await prisma.users.findMany({
      where: {
        deleted_at: null,
        OR: [
          ...(roles.usuario ? [{ role: 'usuario' as const }] : []),
          ...(roles.prestador ? [{ role: 'prestador' as const }] : []),
        ],
      },
      select: { id: true },
      take: 1000,
    });

    for (const user of users) {
      recipientTargets += 1;
      try {
        const rows = await dispatch({
          userId: user.id,
          type,
          title: defaults.title,
          body: defaults.body,
          payload: {
            scheduled_message_id: row.id,
            trigger_type: row.trigger_type,
            send_at_planned: row.send_at.toISOString(),
          },
        });
        notificationsCreated += rows.length;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          JSON.stringify({
            level: 'warn',
            msg: 'scheduled_message_dispatch_failed',
            user_id: user.id,
            trigger_type: row.trigger_type,
            error: error instanceof Error ? error.message : 'unknown',
          }),
        );
      }
    }

    await prisma.scheduled_messages.update({
      where: { id: row.id },
      data: { status: 'enviado' },
    });
  }

  return {
    due_rows: dueRows.length,
    recipient_targets: recipientTargets,
    notifications_created: notificationsCreated,
    rows_marked_sent: dueRows.length,
  };
}