/**
 * Shared API contract types (UR-001.1, BR-001.4, BR-003.3).
 *
 * Exact mirror of backend/src/types/api.ts plus the serialized response
 * payloads returned by the REST API (backend/src/services/*).
 */
import type {
  CancelledBy,
  ContractStatus,
  MessageType,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PaymentStatus,
  PaymentType,
  RefundReason,
  RefundStatus,
  ReservationStatus,
  ServiceType,
  ServicesStatus,
  SlotsStatusIndicator,
  UserRole,
  UserSegment,
} from './models';

// ---------------------------------------------------------------------------
// Envelope (backend/src/types/api.ts)
// ---------------------------------------------------------------------------

/** Machine-readable error codes exposed by the backend (BR-003.3). */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'RESERVATION_SLOT_CONFLICT'
  | 'PROVIDER_NOT_VERIFIED'
  | 'PAYMENT_FAILED'
  | 'STATE_TRANSITION_INVALID'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ErrorResponse {
  error: ErrorBody;
}

/** Success envelope: `{ data, meta?, errors? }` (BR-001.4, UR-001.1). */
export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
  errors?: ErrorBody[];
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ---------------------------------------------------------------------------
// Auth (backend auth.service / auth.routes)
// ---------------------------------------------------------------------------

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: {
    id: number;
    full_name: string;
    email: string;
    phone: string;
    avatar_url: string | null;
    role: UserRole;
    segment: UserSegment;
    verified: boolean;
  };
  tokens: AuthTokens;
}

export interface MeResponse {
  user: {
    id: number;
    full_name: string;
    email: string;
    phone: string;
    avatar_url: string | null;
    role: UserRole;
    segment: UserSegment;
    verified: boolean;
    notification_prefs?: Record<string, unknown> | null;
    privacy_consent_accepted_at?: string | null;
    privacy_policy_version?: string | null;
  };
}

// ---------------------------------------------------------------------------
// Search & services (backend search.service / services.routes)
// ---------------------------------------------------------------------------

export type SearchSort =
  | 'created:desc'
  | 'rating:desc'
  | 'price:asc'
  | 'price:desc'
  | 'name:asc';

/** Query parameter shape of GET /services (backend searchQuerySchema). */
export interface ServiceQueryParams {
  service_type?: ServiceType;
  date?: string; // YYYY-MM-DD
  capacity?: number;
  zone?: string;
  min_price?: number;
  max_price?: number;
  event_type?: number;
  event_type_name?: string;
  pool?: 'true' | 'false';
  internet?: 'true' | 'false';
  rating?: number;
  sort?: SearchSort;
  page?: number;
  limit?: number;
}

export interface ServiceSummary {
  id: number;
  title: string;
  description: string;
  service_type: ServiceType;
  status: ServicesStatus;
  location_type: 'fija' | 'area_servicio';
  location: { lat?: number; lng?: number; address?: string } | unknown;
  coverage_area: unknown;
  max_capacity: number;
  price: string | null;
  main_photo_url: string | null;
  avg_rating: number | null;
  review_count: number;
  provider_name: string;
  provider_verified: boolean;
  created_at: string;
}

export interface ServiceDetail {
  id: number;
  title: string;
  description: string;
  service_type: ServiceType;
  status: ServicesStatus;
  location_type: 'fija' | 'area_servicio';
  location: unknown;
  coverage_area: unknown;
  max_capacity: number;
  approval_mode: string;
  viaticos_per_km: string | null;
  deposit_amount: string | null;
  created_at: string;
  updated_at: string;
  provider: {
    id: number;
    full_name: string;
    verified: boolean;
    avatar_url: string | null;
  };
  cancellation_policy: {
    retention_percent: number;
    penalty_free_window_days: number;
    deposit_refundable: boolean;
  };
  photos: Array<{ id: number; url: string; position: number; status: string }>;
  amenities: Array<{ id: number; name: string }>;
  event_types: Array<{ id: number; name: string }>;
  extras: Array<{ id: number; name: string; description: string; price: string }>;
  dynamic_rules: Array<{
    id: number;
    adjustment_type: string;
    adjustment_value: string;
    scope: unknown;
  }>;
  hours: Array<{
    day_of_week: number;
    open_time: string;
    close_time: string;
    base_block_duration_hours: number;
    extra_hours_allowed: number;
  }>;
  pricing: {
    salon: {
      base_block_hours: number;
      base_block_price: string;
      extra_hour_price: string;
    } | null;
    sound_packages: Array<{
      id: number;
      name: string;
      base_price: string;
      base_hours: number;
      extra_hour_price: string;
    }>;
    persona: { price_per_person_per_hour: string } | null;
  };
  rating: { avg: number | null; count: number };
}

export interface SlotAvailabilityRow {
  slot_id: number;
  service_id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  active_reservations: number;
  available_capacity: number;
  status_indicator: SlotsStatusIndicator;
}

export interface ReviewPayload {
  id: number;
  reservation_id: number;
  client_id: number;
  provider_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Reservations (backend reservation.service / reservations.routes)
// ---------------------------------------------------------------------------

export interface ReservationDetail {
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
  next_transitions: ReservationStatus[];
  contract: { id: number; status: string } | null;
  items: Array<{
    id: number;
    service_id: number;
    service_type: ServiceType;
    service_title: string;
    unit_price_snapshot: string;
  }>;
}

export interface TimelineEntry {
  id: number;
  status: ReservationStatus;
  changed_at: string;
  changed_by: number | null;
}

export interface CreateReservationBody {
  slot_id?: number;
  package_id?: number;
  slot_ids?: number[];
  items?: Array<{ sound_package_id?: number; person_count?: number }>;
  extras?: Array<{ extra_id: number; quantity: number }>;
  alcohol_requested?: boolean;
}

export interface TransferReservationStatusBody {
  status: ReservationStatus;
  alcohol_resolution?: 'continuar_sin_alcohol' | 'cancelar';
  alcohol_status?: 'confirmado' | 'no_confirmado';
  cancel_reason?: string;
  retention_accepted?: boolean;
}

// ---------------------------------------------------------------------------
// Payments (backend payment.service / payments.routes)
// ---------------------------------------------------------------------------

export interface PaymentDetail {
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
  refunds: Array<{
    id: number;
    payment_id: number;
    reservation_id: number;
    amount: string;
    reason: RefundReason;
    status: RefundStatus;
    processed_at: string | null;
    created_at: string;
  }>;
  reservation: {
    id: number;
    status: string;
    total_price: string;
    commission_amount: string;
    commission_rate: string;
    event_date: string;
  };
}

export interface CreatePaymentBody {
  reservation_id: number;
  payment_type: PaymentType;
  amount: number;
  currency?: string;
  billing_model?: BillingModel;
  description?: string;
}

export type BillingModel = 'anticipo' | 'completo' | 'post_servicio';

// ---------------------------------------------------------------------------
// Contracts (backend contract.service / contracts.routes)
// ---------------------------------------------------------------------------

export interface ContractDetail {
  id: number;
  reservation_id: number;
  status: ContractStatus;
  signing_appointment_at: string | null;
  signing_location: string | null;
  client_confirmed_at: string | null;
  provider_confirmed_at: string | null;
  document_url: string | null;
  created_at: string;
  confirmed: boolean;
  reservation_status: string;
  service_title: string | null;
}

// ---------------------------------------------------------------------------
// Messaging (backend message.service / messages.routes)
// ---------------------------------------------------------------------------

export interface MessagePayload {
  id: number;
  conversation_id: number;
  sender_id: number;
  type: MessageType;
  content: string | null;
  audio_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  read_at: string | null;
  sender: { id: number; full_name: string; avatar_url: string | null; role: string };
}

export interface ConversationSummary {
  id: number;
  client_id: number;
  provider_id: number;
  service_id: number | null;
  other_participant: { id: number; full_name: string; avatar_url: string | null; role: string };
  last_message: MessagePayload | null;
  unread_count: number;
  created_at: string;
}

export interface QuickReply {
  id: number;
  provider_id: number;
  name: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Notifications (backend notification.service / notifications.routes)
// ---------------------------------------------------------------------------

export interface NotificationPayload {
  id: number;
  type: NotificationType;
  channel: NotificationChannel;
  is_critical: boolean;
  status: NotificationStatus;
  payload: Record<string, unknown> | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface UnreadCountResponse {
  unread: number;
}

// ---------------------------------------------------------------------------
// Favorites (backend favorites.routes)
// ---------------------------------------------------------------------------

export interface FavoriteItem {
  id: number;
  service_id: number;
  created_at: string;
  service: {
    id: number;
    title: string;
    service_type: ServiceType;
    status: ServicesStatus;
    max_capacity: number;
    location: unknown;
    provider: { id: number; full_name: string; verified: boolean };
    photo: { id: number; url: string; position: number } | null;
  };
}

// ---------------------------------------------------------------------------
// Cancellation (backend cancellation.service / reservations.routes)
// ---------------------------------------------------------------------------

export interface CancelReservationBody {
  reason?: string;
  retention_accepted?: boolean;
  cancelled_by?: CancelledBy;
}
