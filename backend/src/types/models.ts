import type {
  Prisma,
  users_role,
  users_segment,
  reservations_status,
  services_status,
  services_service_type,
  payments_status,
  payments_payment_type,
  notifications_type,
  notifications_channel,
  notifications_status,
  messages_type,
  packages_status,
  contracts_status,
  refunds_reason,
} from '@prisma/client';

/**
 * Domain model types for all 44 entities (UR-001.5).
 *
 * Prisma generates these types from schema.prisma, which itself was
 * introspected from the canonical `database_schema.sql` (D-001). This
 * file re-exports every model payload type under a PascalCase alias plus
 * the closed-set enums, so services never need to touch the raw
 * `Prisma.*` names. Kept in sync automatically by `prisma generate`.
 */
export type Alcohol_permits = Prisma.alcohol_permitsGetPayload<object>;
export type Amenities = Prisma.amenitiesGetPayload<object>;
export type Arco_requests = Prisma.arco_requestsGetPayload<object>;
export type Audit_logs = Prisma.audit_logsGetPayload<object>;
export type Availability_blocks = Prisma.availability_blocksGetPayload<object>;
export type Call_logs = Prisma.call_logsGetPayload<object>;
export type Cancellation_policies = Prisma.cancellation_policiesGetPayload<object>;
export type Cancellations = Prisma.cancellationsGetPayload<object>;
export type Commission_settings = Prisma.commission_settingsGetPayload<object>;
export type Consent_logs = Prisma.consent_logsGetPayload<object>;
export type Content_reports = Prisma.content_reportsGetPayload<object>;
export type Contracts = Prisma.contractsGetPayload<object>;
export type Conversations = Prisma.conversationsGetPayload<object>;
export type Dynamic_pricing_rules = Prisma.dynamic_pricing_rulesGetPayload<object>;
export type Favorites = Prisma.favoritesGetPayload<object>;
export type Identity_verifications = Prisma.identity_verificationsGetPayload<object>;
export type Inventory_slots = Prisma.inventory_slotsGetPayload<object>;
export type Invoices = Prisma.invoicesGetPayload<object>;
export type Messages = Prisma.messagesGetPayload<object>;
export type Notifications = Prisma.notificationsGetPayload<object>;
export type Operating_hours = Prisma.operating_hoursGetPayload<object>;
export type Package_members = Prisma.package_membersGetPayload<object>;
export type Packages = Prisma.packagesGetPayload<object>;
export type Payments = Prisma.paymentsGetPayload<object>;
export type Provider_blocks = Prisma.provider_blocksGetPayload<object>;
export type Quick_replies = Prisma.quick_repliesGetPayload<object>;
export type Refunds = Prisma.refundsGetPayload<object>;
export type Reservation_extras = Prisma.reservation_extrasGetPayload<object>;
export type Reservation_items = Prisma.reservation_itemsGetPayload<object>;
export type Reservation_status_history = Prisma.reservation_status_historyGetPayload<object>;
export type Reservations = Prisma.reservationsGetPayload<object>;
export type Reviews = Prisma.reviewsGetPayload<object>;
export type Salon_pricing = Prisma.salon_pricingGetPayload<object>;
export type Scheduled_messages = Prisma.scheduled_messagesGetPayload<object>;
export type Service_amenities = Prisma.service_amenitiesGetPayload<object>;
export type Service_event_types = Prisma.service_event_typesGetPayload<object>;
export type Service_extras = Prisma.service_extrasGetPayload<object>;
export type Service_persona_pricing = Prisma.service_persona_pricingGetPayload<object>;
export type Service_photos = Prisma.service_photosGetPayload<object>;
export type Service_service_event_types = Prisma.service_service_event_typesGetPayload<object>;
export type Services = Prisma.servicesGetPayload<object>;
export type Sound_packages = Prisma.sound_packagesGetPayload<object>;
export type Technical_disputes = Prisma.technical_disputesGetPayload<object>;
export type Users = Prisma.usersGetPayload<object>;

// Closed-set enums (native MariaDB ENUM columns, D-001 / BR-004).
export type UsersRole = users_role;
export type UsersSegment = users_segment;
export type ReservationStatus = reservations_status;
export type ServicesStatus = services_status;
export type ServiceType = services_service_type;
export type PaymentStatus = payments_status;
export type PaymentType = payments_payment_type;
export type NotificationType = notifications_type;
export type NotificationChannel = notifications_channel;
export type NotificationStatus = notifications_status;
export type MessageType = messages_type;
export type PackageStatus = packages_status;
export type ContractStatus = contracts_status;
export type RefundReason = refunds_reason;

export type {
  Prisma,
};