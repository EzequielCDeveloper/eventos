/**
 * Domain model types for the FiestaExpert frontend (UR-001.5).
 *
 * Mirror of the backend Prisma schema (backend/prisma/schema.prisma) plus the
 * serialized payload shapes returned by the REST API (backend/src/services/*).
 * Money values (DECIMAL(10,2) in MariaDB) are serialized by the backend as
 * two-decimal strings — the frontend never parses money into floats.
 */

// ---------------------------------------------------------------------------
// Enums (native MariaDB ENUM columns)
// ---------------------------------------------------------------------------

export type UserRole = 'usuario' | 'prestador' | 'administrador';
export type UserSegment = 'particular' | 'empresa';
export type ServiceType = 'salon' | 'sonido' | 'servicio_persona';
export type ServicesStatus = 'borrador' | 'pendiente_verificacion' | 'publicado' | 'rechazado';
export type ServiceLocationType = 'fija' | 'area_servicio';
export type ServicesApprovalMode = 'manual' | 'inmediata';

export type ReservationStatus =
  | 'creado'
  | 'invitaciones_pendientes'
  | 'invitaciones_aceptadas'
  | 'disponibilidad_verificada'
  | 'disponible_para_reserva'
  | 'pendiente_firma'
  | 'contrato_confirmado'
  | 'permiso_alcohol'
  | 'pago_anticipo'
  | 'confirmada'
  | 'en_curso'
  | 'completada'
  | 'cancelada';

export type PaymentType = 'anticipo' | 'saldo' | 'deposito_garantia';
export type PaymentStatus = 'pendiente' | 'procesado' | 'fallido' | 'reembolsado' | 'retenido' | 'devuelto';
export type BillingModel = 'anticipo' | 'completo' | 'post_servicio';
export type RefundReason =
  | 'cancelacion_proveedor'
  | 'cancelacion_cliente'
  | 'deposito_devolucion'
  | 'politica_proveedor'
  | 'permiso_alcohol_no_confirmado';
export type RefundStatus = 'pendiente' | 'procesado';

export type ContractStatus = 'pendiente_firma' | 'firmando' | 'pendiente_confirmacion' | 'contrato_confirmado';

export type MessageType = 'texto' | 'nota_voz';
export type CallLogType = 'voz' | 'video';

export type NotificationType =
  | 'firma_contrato'
  | 'saldo_pendiente'
  | 'confirmacion_pago'
  | 'recordatorio_evento_h48'
  | 'recordatorio_evento_h2'
  | 'encuesta_satisfaccion'
  | 'invitacion_paquete'
  | 'aceptacion_invitacion'
  | 'rechazo_invitacion'
  | 'anticipo_recibido'
  | 'pago_completo_recibido'
  | 'cancelacion'
  | 'reembolso_procesado'
  | 'review_recibida'
  | 'nueva_agenda_disponible'
  | 'permiso_alcohol_h5';

export type NotificationChannel = 'push' | 'email' | 'in_app';
export type NotificationStatus = 'pendiente' | 'enviada' | 'leida';

export type ArcoRequestTipo = 'acceso' | 'rectificacion' | 'cancelacion' | 'oposicion';
export type ArcoRequestStatus = 'pendiente' | 'en_proceso' | 'completado' | 'rechazado';
export type ConsentType = 'aviso_privacidad' | 'terminos_condiciones' | 'cookies' | 'verificacion_identidad';

export type CancellationTiming = 'lejana' | 'cercana';
export type CancelledBy = 'cliente' | 'proveedor';

export type SlotsStatusIndicator = 'disponible' | 'parcial' | 'lleno';
export type AvailabilityBlockType = 'mantenimiento' | 'inoperacion' | 'evento_privado';

export type AdjustType = 'temporada' | 'demanda' | 'dia_semana' | 'bloque_turno';

// ---------------------------------------------------------------------------
// Entity types (from backend/prisma/schema.prisma)
// ---------------------------------------------------------------------------

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  role: UserRole;
  segment: UserSegment;
  verified: boolean;
  notification_prefs: Record<string, unknown> | null;
  privacy_consent_accepted_at: string | null;
  privacy_policy_version: string | null;
  created_at: string;
  updated_at: string;
}

/** SafeUser without credentials (backend auth.service toSafeUser). */
export interface SafeUser {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  role: UserRole;
  segment: UserSegment;
  verified: boolean;
}

export interface ServicePhoto {
  id: number;
  service_id: number;
  url: string;
  position: number;
  status: 'pendiente_moderacion' | 'aprobada' | 'rechazada';
  created_at: string;
}

export interface ServiceSlot {
  slot_id: number;
  service_id: number;
  slot_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  capacity: number;
  active_reservations: number;
  available_capacity: number;
  status_indicator: SlotsStatusIndicator;
}

export interface Reservations {
  id: number;
  client_id: number;
  package_id: number | null;
  status: ReservationStatus;
  event_date: string;
  start_time: string;
  end_time: string;
  block_hours: number;
  extra_hours: number;
  total_price: string;
  base_amount: string;
  extras_amount: string;
  taxes_amount: string;
  commission_amount: string;
  commission_rate: string;
  cancellation_policy_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
}

export interface Payments {
  id: number;
  reservation_id: number;
  payment_type: PaymentType;
  amount: string;
  currency: string;
  status: PaymentStatus;
  conekta_charge_id: string | null;
  due_date: string | null;
  charged_at: string | null;
  created_at: string;
}

export interface Contracts {
  id: number;
  reservation_id: number;
  status: ContractStatus;
  signing_appointment_at: string | null;
  signing_location: string | null;
  client_confirmed_at: string | null;
  provider_confirmed_at: string | null;
  document_url: string | null;
  created_at: string;
}

export interface Notifications {
  id: number;
  user_id: number;
  type: NotificationType;
  channel: NotificationChannel;
  is_critical: boolean;
  status: NotificationStatus;
  payload: Record<string, unknown> | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}
