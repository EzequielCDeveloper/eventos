import type {
  notifications_channel,
  notifications_status,
  notifications_type,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../types/api';
import { toISOStringOrNull } from '../utils/datetime';
import { sendPush } from '../integrations/fcm';
import { sendEmail } from '../integrations/resend';
import { buildPaginationMeta, parsePagination } from '../types/api';

/**
 * Notification service (BR-009, D-003, UR-009.3).
 *
 * Dispatches the 16 notification types across the three channels
 * (`push`, `email`, `in_app`) following the channel map from
 * `notificaciones.md`. Critical notifications (contract, payment,
 * cancellation, alcohol H-5) are required to use ≥2 channels (BR-009.2)
 * and are flagged `is_critical` on every row.
 *
 * Every dispatched row tracks the status lifecycle
 * `pendiente → enviada → leida` (BR-009.3):
 *   - `in_app` rows are always delivered (the DB row IS the inbox);
 *   - `push`/`email` rows are sent through the provider integration (stub
 *     adapter outside production — see integrations/fcm.ts, resend.ts) and
 *     flip to `enviada` with `sent_at` on success; failures stay
 *     `pendiente` for a later retry without blocking the caller.
 *
 * Push tokens are read from `users.notification_prefs` (JSON convention
 * `{ "push_tokens": string[] }` — the adopted schema has no device-token
 * table). Tokens are never logged, only their count.
 */

/** Channel map per notification type (source: notificaciones.md table). */
export const NOTIFICATION_CHANNELS: Record<
  notifications_type,
  readonly notifications_channel[]
> = {
  firma_contrato: ['push', 'email'],
  saldo_pendiente: ['push'],
  confirmacion_pago: ['push', 'in_app'],
  recordatorio_evento_h48: ['push', 'email'],
  recordatorio_evento_h2: ['push'],
  encuesta_satisfaccion: ['push', 'email'],
  invitacion_paquete: ['in_app', 'push'],
  aceptacion_invitacion: ['in_app'],
  rechazo_invitacion: ['in_app'],
  anticipo_recibido: ['push', 'in_app'],
  pago_completo_recibido: ['push', 'email', 'in_app'],
  cancelacion: ['push', 'email', 'in_app'],
  reembolso_procesado: ['push', 'email'],
  review_recibida: ['in_app', 'push'],
  nueva_agenda_disponible: ['in_app'],
  permiso_alcohol_h5: ['push', 'email'],
};

/** Types classified critical: MUST use ≥2 channels (BR-009.2). */
export const CRITICAL_TYPES: ReadonlySet<notifications_type> = new Set<notifications_type>([
  'firma_contrato',
  'confirmacion_pago',
  'pago_completo_recibido',
  'cancelacion',
  'permiso_alcohol_h5',
]);

export interface NotificationPayload {
  id: number;
  type: notifications_type;
  channel: notifications_channel;
  is_critical: boolean;
  status: notifications_status;
  payload: Record<string, unknown> | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface DispatchInput {
  userId: number;
  type: notifications_type;
  payload?: Record<string, unknown> | null;
  title?: string;
  body?: string;
}

function toPayload(
  row: {
    id: number;
    type: notifications_type;
    channel: notifications_channel;
    is_critical: boolean;
    status: notifications_status;
    payload: unknown;
    sent_at: Date | null;
    read_at: Date | null;
    created_at: Date;
  },
): NotificationPayload {
  return {
    id: row.id,
    type: row.type,
    channel: row.channel,
    is_critical: row.is_critical,
    status: row.status,
    payload: (row.payload ?? null) as Record<string, unknown> | null,
    sent_at: toISOStringOrNull(row.sent_at),
    read_at: toISOStringOrNull(row.read_at),
    created_at: row.created_at.toISOString(),
  };
}

/** Read push tokens from `users.notification_prefs` (JSON convention). */
function pushTokens(prefs: unknown): string[] {
  if (!prefs || typeof prefs !== 'object') return [];
  const tokens = (prefs as Record<string, unknown>).push_tokens;
  if (!Array.isArray(tokens)) return [];
  return tokens.filter((token): token is string => typeof token === 'string' && token.length > 0);
}

/**
 * Dispatch a notification across the type's configured channels (BR-009.1).
 * Returns one row per channel. Critical types are forced to ≥2 channels:
 * the catalog already satisfies this; a misconfigured catalog entry would
 * be padded with `in_app` so the guarantee (BR-009.2) holds by construction.
 */
export async function dispatch(input: DispatchInput): Promise<NotificationPayload[]> {
  const user = await prisma.users.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, notification_prefs: true, deleted_at: true },
  });
  if (!user || user.deleted_at) {
    throw AppError.notFound('User not found');
  }

  let channels = [...NOTIFICATION_CHANNELS[input.type]];
  if (CRITICAL_TYPES.has(input.type) && channels.length < 2) {
    // Keep the BR-009.2 invariant true even if the catalog is misconfigured.
    channels = ['in_app', ...channels];
  }

  const payloadJson = input.payload ?? null;
  const results: NotificationPayload[] = [];

  for (const channel of channels) {
    const row = await prisma.notifications.create({
      data: {
        user_id: user.id,
        type: input.type,
        channel,
        is_critical: CRITICAL_TYPES.has(input.type),
        status: 'pendiente',
        payload: payloadJson === null ? Prisma.JsonNull : (payloadJson as Prisma.InputJsonValue),
      },
    });

    let sent = channel === 'in_app'; // the inbox row IS the delivery
    if (channel === 'push') {
      const tokens = pushTokens(user.notification_prefs);
      if (tokens.length === 0) {
        // No device registered yet — keep the row pendiente for retry.
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            level: 'warn',
            msg: 'notification_push_skipped_no_tokens',
            user_id: user.id,
            type: input.type,
          }),
        );
      } else {
        try {
          await sendPush(tokens, input.title ?? defaultTitle(input.type, 'Push'), input.body ?? '', {
            type: input.type,
            notification_id: row.id,
          });
          sent = true;
        } catch (error) {
          // Delivery failure: keep the row pendiente for a later retry.
          // eslint-disable-next-line no-console
          console.warn(
            JSON.stringify({
              level: 'warn',
              msg: 'notification_push_failed',
              user_id: user.id,
              type: input.type,
              error: error instanceof Error ? error.message : 'unknown',
            }),
          );
        }
      }
    }
    if (channel === 'email') {
      try {
        await sendEmail(
          user.email,
          input.title ?? defaultTitle(input.type, 'Email'),
          input.body ? `<p>${escapedHtml(input.body)}</p>` : '',
          input.body,
        );
        sent = true;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          JSON.stringify({
            level: 'warn',
            msg: 'notification_email_failed',
            user_id: user.id,
            type: input.type,
            error: error instanceof Error ? error.message : 'unknown',
          }),
        );
      }
    }

    const persisted = sent
      ? await prisma.notifications.update({
          where: { id: row.id },
          data: { status: 'enviada', sent_at: new Date() },
        })
      : row;
    results.push(toPayload(persisted));
  }

  return results;
}

function escapedHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[ch] ?? ch;
  });
}

/** Default human title for a notification: `Type · Channel`. */
function defaultTitle(type: notifications_type, channelLabel: string): string {
  const human = type.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return `${human} · ${channelLabel}`;
}

/**
 * Offline-delivery fallback (D-006): send a raw push notification WITHOUT
 * creating an inbox row. The adopted notifications enum has no
 * "new message" type, so message pushes do not belong in the 16-type
 * catalog; the socket message handler uses this for offline recipients.
 */
export async function sendPushFallback(
  userId: number,
  input: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { id: true, notification_prefs: true, deleted_at: true },
  });
  if (!user || user.deleted_at) return;
  const tokens = pushTokens(user.notification_prefs);
  if (tokens.length === 0) return;
  try {
    await sendPush(tokens, input.title, input.body, input.data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'warn',
        msg: 'message_push_fallback_failed',
        user_id: user.id,
        error: error instanceof Error ? error.message : 'unknown',
      }),
    );
  }
}

// ---- Inbox (BR-009.3, UR-002.11) -------------------------------------------

/**
 * List the user's notification inbox with optional `status` filter
 * (GET /notifications?status=pendiente|enviada|leida).
 */
export async function listNotifications(
  userId: number,
  options: { status?: notifications_status; page?: number; limit?: number } = {},
): Promise<{ items: NotificationPayload[]; meta: ReturnType<typeof buildPaginationMeta> }> {
  const pagination = parsePagination({ page: options.page, limit: options.limit });
  const where = {
    user_id: userId,
    ...(options.status ? { status: options.status } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.notifications.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
    prisma.notifications.count({ where }),
  ]);
  return {
    items: rows.map(toPayload),
    meta: buildPaginationMeta(total, pagination),
  };
}

/** Mark one of the user's notifications as read (PUT /notifications/:id/read). */
export async function markNotificationRead(
  notificationId: number,
  userId: number,
): Promise<NotificationPayload> {
  const updated = await prisma.notifications.updateMany({
    where: { id: notificationId, user_id: userId },
    data: { status: 'leida', read_at: new Date() },
  });
  if (updated.count === 0) {
    throw AppError.notFound('Notification not found');
  }
  const row = await prisma.notifications.findUniqueOrThrow({ where: { id: notificationId } });
  return toPayload(row);
}

/**
 * Count unread notifications for badge display (FR-008). Registered before
 * the `PUT /:id/read` route in the router so `unread` is not captured as an id.
 */
export async function countUnread(userId: number): Promise<number> {
  return prisma.notifications.count({ where: { user_id: userId, status: { in: ['pendiente', 'enviada'] } } });
}