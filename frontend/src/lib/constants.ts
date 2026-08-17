/**
 * App-wide constants + runtime config (D-009).
 * Env vars are read at build time via `import.meta.env.VITE_*` — never
 * hardcode secrets here (matching backend/.env.example naming).
 */
import type { NotificationType, ReservationStatus, ServiceType } from '@/types/models';

export const APP_NAME = 'FiestaExpert';

/** REST base. Empty → Vite dev proxy (same origin). */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL || '';

/** Conekta publishable key for client-side card tokenization (optional in dev). */
export const CONEKTA_PUBLIC_KEY: string = import.meta.env.VITE_CONEKTA_PUBLIC_KEY || '';

/** Agora RTC app id (voice/video, D-005). Empty → call buttons disabled. */
export const AGORA_APP_ID: string = import.meta.env.VITE_AGORA_APP_ID || '';

/** IVA rate applied to the client-visible price breakdown (FR-006.3). */
export const IVA_RATE = 0.16;

/** Voice note hard cap (BR-008.2 / UR-009.4). */
export const MAX_VOICE_NOTE_SECONDS = 120;

/** Signature-based gallery size requirement (FR-005.1: ≥5 photos). */
export const MIN_GALLERY_PHOTOS = 5;

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  salon: 'Salón',
  sonido: 'Sonido',
  servicio_persona: 'Servicio',
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  creado: 'Creada',
  invitaciones_pendientes: 'Invitaciones pendientes',
  invitaciones_aceptadas: 'Invitaciones aceptadas',
  disponibilidad_verificada: 'Disponibilidad verificada',
  disponible_para_reserva: 'Disponible para reserva',
  pendiente_firma: 'Pendiente de firma',
  contrato_confirmado: 'Contrato confirmado',
  permiso_alcohol: 'Permiso de alcohol',
  pago_anticipo: 'Pago de anticipo',
  confirmada: 'Confirmada',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

/** Reservation statuses considered "active" on the rentals screen. */
export const RENTAL_ACTIVE_STATUSES: ReservationStatus[] = [
  'confirmada',
  'permiso_alcohol',
  'pago_anticipo',
  'contrato_confirmado',
];

/** Tabs of the client rentals screen → canonical reservation statuses. */
export const RENTAL_TABS: Array<{ id: string; label: string; statuses: ReservationStatus[] }> = [
  { id: 'activas', label: 'Activas', statuses: RENTAL_ACTIVE_STATUSES },
  { id: 'en-curso', label: 'En curso', statuses: ['en_curso'] },
  { id: 'completadas', label: 'Completadas', statuses: ['completada'] },
  { id: 'canceladas', label: 'Canceladas', statuses: ['cancelada'] },
];

/** Notifications critical to the user contract (FR-008.2). */
export const CRITICAL_NOTIFICATION_TYPES: NotificationType[] = [
  'firma_contrato',
  'confirmacion_pago',
  'pago_completo_recibido',
  'cancelacion',
  'permiso_alcohol_h5',
];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  firma_contrato: 'Firma de contrato',
  saldo_pendiente: 'Saldo pendiente',
  confirmacion_pago: 'Confirmación de pago',
  recordatorio_evento_h48: 'Recordatorio (48 h)',
  recordatorio_evento_h2: 'Recordatorio (2 h)',
  encuesta_satisfaccion: 'Encuesta de satisfacción',
  invitacion_paquete: 'Invitación a paquete',
  aceptacion_invitacion: 'Invitación aceptada',
  rechazo_invitacion: 'Invitación rechazada',
  anticipo_recibido: 'Anticipo recibido',
  pago_completo_recibido: 'Pago completo recibido',
  cancelacion: 'Cancelación',
  reembolso_procesado: 'Reembolso procesado',
  review_recibida: 'Review recibida',
  nueva_agenda_disponible: 'Nueva agenda disponible',
  permiso_alcohol_h5: 'Permiso de alcohol (H-5)',
};
