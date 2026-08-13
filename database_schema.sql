-- =====================================================================
-- database_schema.sql
-- =====================================================================
-- Marketplace "App Eventos" (Mexico) - MySQL 8.0+ / MariaDB 10.6+
-- Relational schema derived from the product requirements digest
-- (16 source documents in /home/anon/uni/docs).
--
-- Scope covered:
--   * Users (3 roles), segments, soft-delete (LFPDPPP/ARCO)
--   * Identity verification logs (metadata only - no INE data persisted)
--   * Services catalog (salon / sonido / servicio_persona) + pricing models
--   * Dynamic pricing, inventory slots, availability, operating hours
--   * Collaborative packages (salon leader + invited providers)
--   * Reservations (13 states), status audit, items, extras
--   * Payments (Conekta MXN), refunds, cancellations, cancellation policies
--   * Physical contracts (4 states), alcohol permits (documentation only)
--   * Messaging (conversations, messages, call logs, quick replies,
--     scheduled messages)
--   * Notifications (16 types, 3 channels), reviews, favorites
--   * Commission settings (history), invoices/CFDI, technical disputes,
--     content moderation, ARCO/consent, audit logs
--   * Ranking and slot-availability views + reservation status trigger
--
-- Conventions:
--   * InnoDB, utf8mb4 / utf8mb4_unicode_ci
--   * INT UNSIGNED AUTO_INCREMENT PRIMARY KEY for ids
--   * DECIMAL(10,2) for MXN amounts; native MySQL ENUM for closed sets
--   * JSON for free-form payloads
--   * Explicit FK names: fk_<table>_<column>
--   * ON DELETE RESTRICT unless stated otherwise (see per-table comments)
--
-- Execution: run the whole file in a single mysql client session
-- (DELIMITER is used only for the trigger at the end).
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- DATABASE
-- =====================================================================
CREATE DATABASE IF NOT EXISTS eventos_db
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE eventos_db;

-- =====================================================================
-- USERS & LEGAL / IDENTITY FOUNDATION
-- =====================================================================

-- Users of the platform. Only 3 roles (no support role, per product spec).
-- Soft-delete (deleted_at) supports ARCO cancellation / account revocation
-- (LFPDPPP) without destroying historical references.
CREATE TABLE users (
    id                          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name                   VARCHAR(255) NOT NULL COMMENT 'Full name - mandatory in client profile',
    email                       VARCHAR(255) NOT NULL,
    phone                       VARCHAR(20)  NOT NULL COMMENT 'Mexican phone number',
    avatar_url                  VARCHAR(500) NULL,
    role                        ENUM('usuario','prestador','administrador') NOT NULL COMMENT '3 roles exactly; no support role',
    segment                     ENUM('particular','empresa') NOT NULL COMMENT 'Client segment',
    password_hash               VARCHAR(255) NOT NULL COMMENT 'Auth assumed delegated to Firebase Auth; hash stored here',
    verified                    BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Identity-verified badge',
    notification_prefs          JSON NULL COMMENT 'push/email preferences',
    privacy_consent_accepted_at TIMESTAMP NULL COMMENT 'LFPDPPP: explicit acceptance of privacy notice',
    privacy_policy_version      VARCHAR(50) NULL COMMENT 'Version of privacy policy accepted',
    deleted_at                  TIMESTAMP NULL COMMENT 'Soft delete (ARCO / consent revocation)',
    created_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email),
    KEY idx_users_role (role),
    KEY idx_users_segment (segment)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Platform users: 3 roles. Soft delete for ARCO.';

-- LFPDPPP: explicit, auditable consent records (privacy notice, T&C,
-- cookies, identity verification). Consent must be recorded before
-- proceeding with any data treatment.
CREATE TABLE consent_logs (
    id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id                INT UNSIGNED NOT NULL,
    consent_type           ENUM('aviso_privacidad','terminos_condiciones','cookies','verificacion_identidad') NOT NULL,
    accepted               BOOLEAN NOT NULL COMMENT 'true = accepted, false = rejected/revoked',
    privacy_policy_version VARCHAR(50) NULL COMMENT 'Version of the policy/T&C shown at acceptance time',
    accepted_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_consent_logs_user (user_id),
    CONSTRAINT fk_consent_logs_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='LFPDPPP consent audit. E-commerce law requires T&C acceptance before each transaction.';

-- ARCO requests (Acceso / Rectificacion / Cancelacion / Oposicion).
-- Legal term to answer: 20 business days (enforced by application workflow).
CREATE TABLE arco_requests (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       INT UNSIGNED NOT NULL,
    tipo          ENUM('acceso','rectificacion','cancelacion','oposicion') NOT NULL,
    status        ENUM('pendiente','en_proceso','completado','rechazado') NOT NULL DEFAULT 'pendiente' COMMENT 'Closed set inferred from ARCO workflow',
    requested_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Request filing date',
    deadline_at   DATE NULL COMMENT 'Deadline: +20 business days (application computes)',
    resolved_at   TIMESTAMP NULL,
    response_notes TEXT NULL,
    PRIMARY KEY (id),
    KEY idx_arco_requests_user (user_id),
    KEY idx_arco_requests_status (status),
    CONSTRAINT fk_arco_requests_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='LFPDPPP ARCO requests. Cancellation requests map to users.deleted_at soft delete.';

-- Identity verification audit log.
-- LFPDPPP: only METADATA is persisted (user, result, timestamp, method,
-- lista-nominal status). INE data (name, CURP, OCR) is NEVER stored.
CREATE TABLE identity_verifications (
    id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id               INT UNSIGNED NOT NULL,
    method                ENUM('ine_presencial','kyc') NOT NULL COMMENT 'Presential INE signing or remote KYC',
    kyc_provider          ENUM('verificamex','truora','veriff') NULL COMMENT 'KYC provider (Verificamex is default); recorded for usage metrics',
    result                ENUM('verificado','ine_vencido','ine_no_encontrado','datos_no_coinciden','error_api','pendiente') NOT NULL,
    estatus_lista_nominal ENUM('activo','vencido','no_encontrado') NULL COMMENT 'Lista Nominal (Verificamex) result',
    motivo                ENUM('ine_vencido','ine_no_encontrado','datos_no_coinciden') NULL COMMENT 'Failure reason',
    vigente               BOOLEAN NULL COMMENT 'INE vigente flag',
    coincidencia_nombre   BOOLEAN NULL COMMENT 'Name match flag',
    error_code            VARCHAR(32) NULL COMMENT 'Monitoring code: timeout>10s / 5xx / 4xx / rate_limit (no invalid payload data stored)',
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_identity_verifications_user (user_id),
    CONSTRAINT fk_identity_verifications_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Identity verification AUDIT LOG (metadata only - LFPDPPP). Verification is MANDATORY for providers (blocks publication) and voluntary for clients (badge).';

-- Admin management of providers: block/unblock history (admin function #2).
CREATE TABLE provider_blocks (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider_id   INT UNSIGNED NOT NULL,
    reason        VARCHAR(500) NOT NULL COMMENT 'Block reason (also used to log complaints review)',
    handled_by    INT UNSIGNED NULL COMMENT 'Admin who blocked/unblocked',
    blocked_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unblocked_at  TIMESTAMP NULL COMMENT 'NULL while blocked; set when provider is unblocked',
    PRIMARY KEY (id),
    KEY idx_provider_blocks_provider (provider_id),
    CONSTRAINT fk_provider_blocks_provider FOREIGN KEY (provider_id)
        REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_provider_blocks_handled_by FOREIGN KEY (handled_by)
        REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Admin block/unblock history for providers. Latest unblocked_at IS NULL row = currently blocked.';

-- =====================================================================
-- CANCELLATION POLICIES
-- =====================================================================
-- Created BEFORE services because services.cancellation_policy_id
-- references it (FK ordering requirement).
-- NOTE: the UI offers discrete presets (24h/48h/72h/7d window and
-- 0/25/50/100% retention) but the model stores continuous values, so
-- every preset is representable.
CREATE TABLE cancellation_policies (
    id                        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider_id               INT UNSIGNED NOT NULL,
    retention_percent         INT UNSIGNED NOT NULL DEFAULT 50 COMMENT 'Retention % on near cancellation (0-100), default 50',
    penalty_free_window_days  INT UNSIGNED NOT NULL DEFAULT 30 COMMENT 'Penalty-free window in days (1-90), default 30',
    deposit_refundable        BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether deposit is refundable on client near cancellation',
    created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_cancellation_policies_provider (provider_id),
    CONSTRAINT fk_cancellation_policies_provider FOREIGN KEY (provider_id)
        REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_cancellation_policies_retention CHECK (retention_percent BETWEEN 0 AND 100),
    CONSTRAINT chk_cancellation_policies_window CHECK (penalty_free_window_days BETWEEN 1 AND 90)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Provider-configured cancellation policy. UI presets (24h/48h/72h/7d and 0/25/50/100%) map onto these continuous values. Policy is shown to the client BEFORE confirming the reservation.';

-- =====================================================================
-- SERVICES CATALOG
-- =====================================================================

-- Service listings (3 types). Provider identity verification is required
-- before a service can be published (application-enforced).
-- rating_avg / rating_count are DERIVABLE from reviews and intentionally
-- omitted (computed in v_provider_ranking); avoids denormalization drift.
CREATE TABLE services (
    id                                INT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider_id                       INT UNSIGNED NOT NULL,
    service_type                      ENUM('salon','sonido','servicio_persona') NOT NULL,
    status                            ENUM('borrador','pendiente_verificacion','publicado','rechazado') NOT NULL DEFAULT 'borrador' COMMENT 'borrador = photos under moderation; pendiente_verificacion = awaiting admin approval',
    title                             VARCHAR(200) NOT NULL,
    description                       TEXT NOT NULL,
    location_type                     ENUM('fija','area_servicio') NOT NULL COMMENT 'fija for salons; area_servicio for mobile providers',
    location                          JSON NOT NULL COMMENT 'lat/lng/address',
    coverage_area                     JSON NULL COMMENT 'Polygon or radius for area_servicio providers',
    max_capacity                      INT UNSIGNED NOT NULL COMMENT 'Persons for salons; simultaneous events for others',
    approval_mode                     ENUM('manual','inmediata') NOT NULL DEFAULT 'manual' COMMENT 'Reservation approval: manual vs immediate. Editable post-setup; applies to future requests only',
    viaticos_per_km                   DECIMAL(10,2) NULL COMMENT 'Optional per-KM fee (no zone validation in MVP)',
    deposit_amount                    DECIMAL(10,2) NULL COMMENT 'Security deposit (salons only), collected with the advance',
    cancellation_policy_id            INT UNSIGNED NOT NULL COMMENT 'Provider policy snapshot source for reservations',
    cofepris_responsibility_accepted  BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'COFEPRIS: provider accepts sanitary responsibility when publishing catering',
    deleted_at                        TIMESTAMP NULL COMMENT 'Soft delete (ARCO / moderation takedown)',
    created_at                        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_services_provider (provider_id),
    KEY idx_services_service_type (service_type),
    KEY idx_services_status (status),
    KEY idx_services_max_capacity (max_capacity),
    KEY idx_services_location_type (location_type),
    CONSTRAINT fk_services_provider FOREIGN KEY (provider_id)
        REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_services_cancellation_policy FOREIGN KEY (cancellation_policy_id)
        REFERENCES cancellation_policies (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Service listing. Minimum 5 high-res photos required to publish (application-enforced). Identity verification required before publishing (application-enforced).';

-- Service photos. Minimum 5 per service is an APPLICATION rule:
-- fewer than 5 blocks publication ("Minimo 5 fotos requeridas").
-- Photos under review keep the service in "borrador".
CREATE TABLE service_photos (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    service_id INT UNSIGNED NOT NULL,
    url        VARCHAR(500) NOT NULL,
    position   INT UNSIGNED NOT NULL COMMENT 'Display order',
    status     ENUM('pendiente_moderacion','aprobada','rechazada') NOT NULL DEFAULT 'pendiente_moderacion',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_service_photos_service (service_id, position),
    CONSTRAINT fk_service_photos_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Service photos with moderation. Rule NOT ENFORCED here: each published service must have at least 5 approved photos (application validation).';

-- Open amenities catalog (Wi-Fi, dance floor, vegan menu, pool, internet...).
CREATE TABLE amenities (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_amenities_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Open amenities catalog. Pool ("Alberca") and Internet are used as boolean search toggles.';

-- N:M bridge (amenities). Purely dependent junction table -> CASCADE.
CREATE TABLE service_amenities (
    service_id INT UNSIGNED NOT NULL,
    amenity_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (service_id, amenity_id),
    CONSTRAINT fk_service_amenities_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE CASCADE,
    CONSTRAINT fk_service_amenities_amenity FOREIGN KEY (amenity_id)
        REFERENCES amenities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Service <-> amenity junction (CASCADE).';

-- Open event-type catalog (Boda, quinceanera, corporativo, infantil, "etc.").
CREATE TABLE service_event_types (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uk_service_event_types_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Open catalog of event types used as a search filter (list is open-ended - maintained by the team).';

-- N:M bridge (event types). Purely dependent junction table -> CASCADE.
CREATE TABLE service_service_event_types (
    service_id    INT UNSIGNED NOT NULL,
    event_type_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (service_id, event_type_id),
    CONSTRAINT fk_service_service_event_types_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE CASCADE,
    CONSTRAINT fk_service_service_event_types_event_type FOREIGN KEY (event_type_id)
        REFERENCES service_event_types (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Service <-> event type junction (CASCADE).';

-- =====================================================================
-- PRICING MODELS (3 types) + EXTRAS + DYNAMIC PRICING
-- =====================================================================

-- Salon pricing (1:1 with salon services): base block + extra hour.
CREATE TABLE salon_pricing (
    id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
    service_id        INT UNSIGNED NOT NULL,
    base_block_hours  INT UNSIGNED NOT NULL COMMENT 'e.g. 4 hours',
    base_block_price  DECIMAL(10,2) NOT NULL COMMENT 'MXN - e.g. 8000.00',
    extra_hour_price  DECIMAL(10,2) NOT NULL COMMENT 'MXN - e.g. 2500.00',
    PRIMARY KEY (id),
    UNIQUE KEY uk_salon_pricing_service (service_id),
    CONSTRAINT fk_salon_pricing_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Salon pricing: base block of hours + extra hour price (1:1).';

-- Sound equipment packages (1:N per sound service). Each package has its
-- own price, hours and dynamic adjustments.
CREATE TABLE sound_packages (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    service_id       INT UNSIGNED NOT NULL,
    name             VARCHAR(150) NOT NULL COMMENT 'e.g. Basico, Premium',
    description      TEXT NOT NULL COMMENT 'Equipment + staff included',
    base_price       DECIMAL(10,2) NOT NULL COMMENT 'MXN package base price',
    base_hours       INT UNSIGNED NOT NULL COMMENT 'Hours included in base price',
    extra_hour_price DECIMAL(10,2) NOT NULL COMMENT 'MXN per extra hour',
    PRIMARY KEY (id),
    KEY idx_sound_packages_service (service_id),
    CONSTRAINT fk_sound_packages_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Sound equipment packages (1:N). Pricing and commission are computed PER PACKAGE.';

-- Service-persona pricing (1:1): price per person per hour.
CREATE TABLE service_persona_pricing (
    id                        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    service_id                INT UNSIGNED NOT NULL,
    price_per_person_per_hour DECIMAL(10,2) NOT NULL COMMENT 'MXN - e.g. 250.00 bartender/person/hour',
    PRIMARY KEY (id),
    UNIQUE KEY uk_service_persona_pricing_service (service_id),
    CONSTRAINT fk_service_persona_pricing_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Service-persona pricing (1:1): e.g. 250 MXN/person/hour x 3 people x 6h = 4500 MXN.';

-- Upsell extras. Optional sound_package link (documentation ambiguity:
-- whether a sound extra belongs to the service or to a specific package
-- is resolved as nullable, per gaps 4.7).
CREATE TABLE service_extras (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    service_id       INT UNSIGNED NOT NULL,
    sound_package_id INT UNSIGNED NULL COMMENT 'NULL = service-level extra; set for package-specific extras (sound)',
    name             VARCHAR(150) NOT NULL,
    description      TEXT NOT NULL,
    price            DECIMAL(10,2) NOT NULL COMMENT 'MXN',
    image_url        VARCHAR(500) NULL COMMENT 'Optional for salon/service-persona; MANDATORY for sound (app-enforced - otherwise extra stays in draft)',
    PRIMARY KEY (id),
    KEY idx_service_extras_service (service_id),
    KEY idx_service_extras_sound_package (sound_package_id),
    CONSTRAINT fk_service_extras_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT,
    CONSTRAINT fk_service_extras_sound_package FOREIGN KEY (sound_package_id)
        REFERENCES sound_packages (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Upsell extras added to the reservation total. Required fields per type (name/description/price always; image MANDATORY for sound) are application-enforced.';

-- Dynamic pricing rules (MVP feature): season / demand / weekday / block.
CREATE TABLE dynamic_pricing_rules (
    id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
    service_id        INT UNSIGNED NOT NULL,
    sound_package_id  INT UNSIGNED NULL COMMENT 'NULL = applies to the whole service; set = package-specific adjustment',
    adjustment_type   ENUM('temporada','demanda','dia_semana','bloque_turno') NOT NULL,
    adjustment_value  DECIMAL(10,2) NOT NULL COMMENT 'Percentage or fixed amount over the base price (negative = discount)',
    scope             JSON NOT NULL COMMENT 'Date ranges, weekdays, blocks/shifts',
    PRIMARY KEY (id),
    KEY idx_dynamic_pricing_rules_service (service_id, adjustment_type),
    CONSTRAINT fk_dynamic_pricing_rules_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT,
    CONSTRAINT fk_dynamic_pricing_rules_sound_package FOREIGN KEY (sound_package_id)
        REFERENCES sound_packages (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dynamic pricing over the base price (block, package or per-person). Current price is shown to the client before confirming; commission is computed on the CURRENT (adjusted) price.';

-- =====================================================================
-- INVENTORY / CALENDAR
-- =====================================================================

-- Inventory slots (date + start/end time + capacity).
-- Salon concurrency is FORCED to 1 (system restriction) - the app blocks
-- capacity > 1 for salons; here it is documented and the transactional
-- validation of available capacity happens at reservation time.
CREATE TABLE inventory_slots (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    service_id INT UNSIGNED NOT NULL,
    slot_date  DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time   TIME NOT NULL,
    capacity   INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Max simultaneous events in this slot. Salon forced to 1; sound default 2; persona default 1 (app defaults)',
    PRIMARY KEY (id),
    UNIQUE KEY uk_inventory_slots_slot (service_id, slot_date, start_time, end_time),
    KEY idx_inventory_slots_service_date (service_id, slot_date),
    CONSTRAINT fk_inventory_slots_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT,
    CONSTRAINT chk_inventory_slots_capacity CHECK (capacity >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Slot inventory. Rule NOT ENFORCED here: salons are forced to capacity 1 and the app validates the slot occupancy TRANSACTIONALLY when reserving (count of active reservations vs capacity).';

-- Availability blocks (maintenance / out-of-operation / private event).
CREATE TABLE availability_blocks (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    service_id     INT UNSIGNED NOT NULL,
    start_datetime DATETIME NOT NULL,
    end_datetime   DATETIME NOT NULL,
    type           ENUM('mantenimiento','inoperacion','evento_privado') NOT NULL,
    PRIMARY KEY (id),
    KEY idx_availability_blocks_service (service_id, start_datetime),
    CONSTRAINT fk_availability_blocks_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT,
    CONSTRAINT chk_availability_blocks_range CHECK (start_datetime < end_datetime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Agenda blocking events. Providers inside a blocked range do not appear in search results for that date.';

-- Operating hours (rentable windows): weekday, open/close, base block
-- duration, extra hours allowed.
CREATE TABLE operating_hours (
    id                        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    service_id                INT UNSIGNED NOT NULL,
    day_of_week               TINYINT UNSIGNED NOT NULL COMMENT '1=Monday .. 7=Sunday',
    open_time                 TIME NOT NULL,
    close_time                TIME NOT NULL,
    base_block_duration_hours INT UNSIGNED NOT NULL DEFAULT 4 COMMENT 'Base block duration (4h / 6h / 8h)',
    extra_hours_allowed       INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Max extra hours available for that day',
    PRIMARY KEY (id),
    UNIQUE KEY uk_operating_hours_day (service_id, day_of_week),
    CONSTRAINT fk_operating_hours_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT,
    CONSTRAINT chk_operating_hours_weekday CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT chk_operating_hours_range CHECK (open_time < close_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Rentable operating hours per weekday. Visible to clients in search and service detail.';

-- =====================================================================
-- COLLABORATIVE PACKAGES
-- =====================================================================

-- Collaborative packages. Only salons can create/lead them. Closed price
-- is NULL until the package is fully composed (sum of member prices +
-- extras + taxes + hidden app fee).
CREATE TABLE packages (
    id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
    leader_provider_id INT UNSIGNED NOT NULL COMMENT 'Salon leader (only salons create packages)',
    status             ENUM('creado','invitaciones_pendientes','invitaciones_aceptadas','disponibilidad_verificada','disponible_para_reserva','reservado','completado') NOT NULL DEFAULT 'creado' COMMENT '7 exact states (D8). NOTA: "pendiente_disponibilidad" is a doc inconsistency and intentionally omitted',
    closed_price       DECIMAL(10,2) NULL COMMENT 'MXN - NULL until composition completes (members + extras + taxes + hidden app fee)',
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_packages_leader (leader_provider_id),
    KEY idx_packages_status (status),
    CONSTRAINT fk_packages_leader_provider FOREIGN KEY (leader_provider_id)
        REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Collaborative package led by a salon. Closed price computed as member prices + extras + taxes + hidden platform fee.';

-- Package members (invited providers: sound / service-persona).
-- The salon leader is NOT a member.
CREATE TABLE package_members (
    id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
    package_id        INT UNSIGNED NOT NULL,
    provider_id       INT UNSIGNED NOT NULL,
    service_type      ENUM('sonido','servicio_persona') NOT NULL COMMENT 'Salon leader is not a member; only these types are invited',
    invitation_status ENUM('pendiente','aceptada','rechazada') NOT NULL DEFAULT 'pendiente' COMMENT '3 exact invitation states',
    member_price      DECIMAL(10,2) NULL COMMENT 'MXN - adjustable by the invited provider upon acceptance',
    responded_at      TIMESTAMP NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_package_members (package_id, provider_id),
    KEY idx_package_members_provider (provider_id),
    CONSTRAINT fk_package_members_package FOREIGN KEY (package_id)
        REFERENCES packages (id) ON DELETE RESTRICT,
    CONSTRAINT fk_package_members_provider FOREIGN KEY (provider_id)
        REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Package invitations. Rule NOT ENFORCED here: one member per service type (implicit spec) and package stays "invitaciones_pendientes" until ALL members accept. If a member rejects, the leader may invite another provider of the same type.';

-- =====================================================================
-- RESERVATIONS
-- =====================================================================

-- Reservations: 13 exact states. Simple and package reservations share
-- the same state infrastructure. Price snapshot frozen at confirmation
-- time (dynamic-pricing adjustments apply to the CURRENT price only).
CREATE TABLE reservations (
    id                        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    client_id                 INT UNSIGNED NOT NULL,
    package_id                INT UNSIGNED NULL COMMENT 'NULL = simple reservation without a package',
    status                    ENUM('creado','invitaciones_pendientes','invitaciones_aceptadas','disponibilidad_verificada','disponible_para_reserva','pendiente_firma','contrato_confirmado','permiso_alcohol','pago_anticipo','confirmada','en_curso','completada','cancelada') NOT NULL DEFAULT 'creado' COMMENT '13 exact states (D1)',
    event_date                DATE NOT NULL,
    start_time                TIME NOT NULL,
    end_time                  TIME NOT NULL,
    block_hours               INT UNSIGNED NOT NULL COMMENT 'Base block hours',
    extra_hours               INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Extra hours added at booking or during the event',
    total_price               DECIMAL(10,2) NOT NULL COMMENT 'MXN snapshot of the CURRENT price (frozen at confirmation)',
    base_amount               DECIMAL(10,2) NOT NULL COMMENT 'MXN base amount before extras/taxes',
    extras_amount             DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'MXN extras subtotal',
    taxes_amount              DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'MXN taxes (IVA/other)',
    commission_amount         DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'MXN platform commission (summed into the price the client sees)',
    commission_rate           DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Percent snapshot of the commission applied',
    cancellation_policy_snapshot JSON NULL COMMENT 'Visible and accepted by client BEFORE confirming (Ley de Proteccion al Consumidor)',
    created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    cancelled_at              TIMESTAMP NULL,
    completed_at              TIMESTAMP NULL,
    PRIMARY KEY (id),
    KEY idx_reservations_client (client_id),
    KEY idx_reservations_package (package_id),
    KEY idx_reservations_event_date (event_date),
    KEY idx_reservations_status (status),
    CONSTRAINT fk_reservations_client FOREIGN KEY (client_id)
        REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_reservations_package FOREIGN KEY (package_id)
        REFERENCES packages (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reservations (13 states). Rule NOT ENFORCED here: transactional slot-capacity validation at booking time (count of active reservations in the same service+slot vs capacity). Confirmation requires advance payment (state "confirmada").';

-- Reservation status transition audit. Populated by trigger
-- trg_reservation_status_audit on status changes (each state triggers a
-- notification in the app).
CREATE TABLE reservation_status_history (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id INT UNSIGNED NOT NULL,
    status         ENUM('creado','invitaciones_pendientes','invitaciones_aceptadas','disponibilidad_verificada','disponible_para_reserva','pendiente_firma','contrato_confirmado','permiso_alcohol','pago_anticipo','confirmada','en_curso','completada','cancelada') NOT NULL,
    changed_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by     INT UNSIGNED NULL COMMENT 'Actor who changed the state (client/system by default)',
    PRIMARY KEY (id),
    KEY idx_reservation_status_history_reservation (reservation_id, changed_at),
    CONSTRAINT fk_reservation_status_history_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservations (id) ON DELETE CASCADE,
    CONSTRAINT fk_reservation_status_history_changed_by FOREIGN KEY (changed_by)
        REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reservation state-change audit (junction-like, CASCADE from reservation).';

-- Reservation line items: one row per involved service (packages and
-- service-persona reservations produce multiple items). Price snapshot
-- frozen at confirmation.
CREATE TABLE reservation_items (
    id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id      INT UNSIGNED NOT NULL,
    service_id          INT UNSIGNED NOT NULL,
    sound_package_id    INT UNSIGNED NULL COMMENT 'Set for sound items that use a specific package',
    person_count        INT UNSIGNED NULL COMMENT 'Service-persona: number of people',
    hours               INT UNSIGNED NULL COMMENT 'Service-persona: hours',
    unit_price_snapshot DECIMAL(10,2) NOT NULL COMMENT 'MXN unit price frozen at confirmation',
    PRIMARY KEY (id),
    KEY idx_reservation_items_reservation (reservation_id),
    KEY idx_reservation_items_service (service_id),
    CONSTRAINT fk_reservation_items_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservations (id) ON DELETE CASCADE,
    CONSTRAINT fk_reservation_items_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT,
    CONSTRAINT fk_reservation_items_sound_package FOREIGN KEY (sound_package_id)
        REFERENCES sound_packages (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reservation service line items (CASCADE from reservation; price snapshots frozen).';

-- Reservation extras (quantity + frozen price).
CREATE TABLE reservation_extras (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id INT UNSIGNED NOT NULL,
    extra_id       INT UNSIGNED NOT NULL,
    quantity       INT UNSIGNED NOT NULL DEFAULT 1,
    price_snapshot DECIMAL(10,2) NOT NULL COMMENT 'MXN unit price frozen at confirmation',
    PRIMARY KEY (id),
    KEY idx_reservation_extras_reservation (reservation_id),
    CONSTRAINT fk_reservation_extras_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservations (id) ON DELETE CASCADE,
    CONSTRAINT fk_reservation_extras_extra FOREIGN KEY (extra_id)
        REFERENCES service_extras (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reservation extras (CASCADE from reservation; frozen price snapshot).';

-- =====================================================================
-- PAYMENTS, REFUNDS, CANCELLATIONS
-- =====================================================================

-- Payments (Conekta, MXN only). 3 payment types. Deposit is collected
-- together with the advance but is separable for accounting.
CREATE TABLE payments (
    id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id    INT UNSIGNED NOT NULL,
    payment_type      ENUM('anticipo','saldo','deposito_garantia') NOT NULL COMMENT '3 exact types: advance / balance / security deposit',
    amount            DECIMAL(10,2) NOT NULL COMMENT 'MXN',
    currency          CHAR(3) NOT NULL DEFAULT 'MXN' COMMENT 'Only MXN accepted in MVP (no other currencies)',
    status            ENUM('pendiente','procesado','fallido','reembolsado','retenido','devuelto') NOT NULL DEFAULT 'pendiente' COMMENT 'retenido = deposit held; devuelto = deposit returned',
    conekta_charge_id VARCHAR(100) NULL COMMENT 'Conekta charge/tokenization reference',
    due_date          DATETIME NULL COMMENT 'Balance due before the event per provider policy',
    charged_at        TIMESTAMP NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_payments_reservation (reservation_id),
    KEY idx_payments_status (status),
    CONSTRAINT fk_payments_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservations (id) ON DELETE RESTRICT,
    CONSTRAINT chk_payments_currency CHECK (currency = 'MXN')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Conekta payments (MXN). 3 collection modes: mandatory advance, full pre-event, post-service (platform does NOT hold post-service payments). On cancellation, application order: advance (non-refundable) -> deposit (per policy) -> other payments (refundable).';

-- Refunds. Provider-cancellation => FULL refund of everything paid;
-- client cancellation => advance non-refundable, deposit per policy,
-- other payments refundable.
CREATE TABLE refunds (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    payment_id     INT UNSIGNED NOT NULL,
    reservation_id INT UNSIGNED NOT NULL,
    amount         DECIMAL(10,2) NOT NULL COMMENT 'MXN',
    reason         ENUM('cancelacion_proveedor','cancelacion_cliente','deposito_devolucion','politica_proveedor','permiso_alcohol_no_confirmado') NOT NULL COMMENT '5 exact reasons',
    status         ENUM('pendiente','procesado') NOT NULL DEFAULT 'pendiente',
    processed_at   TIMESTAMP NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_refunds_payment (payment_id),
    KEY idx_refunds_reservation (reservation_id),
    CONSTRAINT fk_refunds_payment FOREIGN KEY (payment_id)
        REFERENCES payments (id) ON DELETE RESTRICT,
    CONSTRAINT fk_refunds_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservations (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Refunds. Provider cancellation is processed automatically with FULL total refund and client notification.';

-- Cancellations. retention_accepted records the EXPLICIT acceptance of
-- the retention policy required BEFORE processing a near cancellation.
CREATE TABLE cancellations (
    id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id     INT UNSIGNED NOT NULL,
    cancelled_by       ENUM('cliente','proveedor') NOT NULL,
    timing             ENUM('lejana','cercana') NULL COMMENT 'Client only: lejana > window; cercana <= window',
    retention_percent  DECIMAL(5,2) NULL COMMENT 'Retention % actually applied',
    retention_accepted BOOLEAN NULL COMMENT 'Explicit acceptance of the retention policy before processing (required for near cancellations)',
    reason             VARCHAR(500) NULL,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_cancellations_reservation (reservation_id),
    CONSTRAINT fk_cancellations_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservations (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cancellation record. 5 scenarios: far (advance kept, deposit refundable), near (deposit per policy), near policy 100% (all kept), provider cancellation (full refund), no-alcohol-permit choice (per policy). Rule NOT ENFORCED here: explicit retention acceptance must be captured before processing a near cancellation.';

-- =====================================================================
-- CONTRACTS & ALCOHOL PERMITS
-- =====================================================================

-- Physical presential contract (required for salon reservations): 4 states,
-- signing appointment, double confirmation, digital preservation.
CREATE TABLE contracts (
    id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id          INT UNSIGNED NOT NULL,
    status                  ENUM('pendiente_firma','firmando','pendiente_confirmacion','contrato_confirmado') NOT NULL DEFAULT 'pendiente_firma' COMMENT '4 exact states; reservation stays PENDING until both parts confirm',
    signing_appointment_at  DATETIME NULL COMMENT 'Signing appointment (date + place)',
    signing_location        VARCHAR(500) NULL,
    client_confirmed_at     TIMESTAMP NULL COMMENT 'If only one part confirms, reservation stays "pendiente_confirmacion" and the other gets a reminder',
    provider_confirmed_at   TIMESTAMP NULL,
    document_url            VARCHAR(500) NULL COMMENT 'Digital photo/scan of the signed contract (digital preservation - Codigo de Comercio)',
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_contracts_reservation (reservation_id),
    CONSTRAINT fk_contracts_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservations (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Physical presential contract (1:1 with salon reservations): appointment -> presential signature -> double in-app confirmation -> advance payment. Contract kept digitally (NOM-151 / Codigo de Comercio).';

-- Alcohol permits (1:1 optional). The platform only DOCUMENTS the
-- requirement; it does NOT manage permits. Age (18+) is documented, not
-- verified by the platform.
CREATE TABLE alcohol_permits (
    id                       INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id           INT UNSIGNED NOT NULL,
    requested                BOOLEAN NOT NULL COMMENT 'Client requests alcohol for the event',
    status                   ENUM('lista_espera','confirmado','no_confirmado') NOT NULL DEFAULT 'lista_espera',
    h5_decision              ENUM('continuar_sin_alcohol','cancelar') NULL COMMENT 'User decision at H-5 (no automatic cancellation - user choice)',
    consequences_notified_at TIMESTAMP NULL COMMENT 'Consequences are ALWAYS notified',
    created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_alcohol_permits_reservation (reservation_id),
    CONSTRAINT fk_alcohol_permits_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservations (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Alcohol permit documentation (1:1 optional). Platform does NOT manage permits - only documents the requirement (SLRC Sonora reference). Not auto-cancelled at H-5: user chooses continue-without-alcohol or cancel (applies provider policy).';

-- =====================================================================
-- MESSAGING
-- =====================================================================

-- Conversations between a client and a provider (optionally tied to a
-- service). The UNIQUE index prevents duplicate chat threads.
-- NOTE (MySQL semantics): rows where service_id IS NULL are not deduped
-- by the UNIQUE key; the app creates one thread per client+provider+service
-- and a generic thread when service_id is NULL.
CREATE TABLE conversations (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    client_id   INT UNSIGNED NOT NULL,
    provider_id INT UNSIGNED NOT NULL,
    service_id  INT UNSIGNED NULL COMMENT 'Optional: thread scoped to a service',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_conversations_thread (client_id, provider_id, service_id),
    CONSTRAINT fk_conversations_client FOREIGN KEY (client_id)
        REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_conversations_provider FOREIGN KEY (provider_id)
        REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_conversations_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Chat thread client <-> provider. Chat is available from first contact until after the event.';

-- Messages: full persistence (history kept after the event, searchable).
-- Voice notes: max 120s, auto-cut at 2:00, no transcription in MVP.
CREATE TABLE messages (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    conversation_id  INT UNSIGNED NOT NULL,
    sender_id        INT UNSIGNED NOT NULL,
    type             ENUM('texto','nota_voz') NOT NULL,
    content          TEXT NULL COMMENT 'NULL for voice notes',
    audio_url        VARCHAR(500) NULL,
    duration_seconds INT UNSIGNED NULL COMMENT 'Voice note length; CHECK <= 120 (auto-cut at 2:00)',
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at          TIMESTAMP NULL,
    deleted_at       TIMESTAMP NULL COMMENT 'Soft delete - "delete recent only" rule is app-enforced',
    PRIMARY KEY (id),
    KEY idx_messages_conversation (conversation_id, created_at),
    KEY idx_messages_sender (sender_id),
    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id)
        REFERENCES conversations (id) ON DELETE RESTRICT,
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id)
        REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_messages_voice_duration CHECK (duration_seconds IS NULL OR duration_seconds <= 120)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Messages persist fully (history/searchable). Voice notes limited to 120s (CHECK). RESTRICT on delete: history must be preserved.';

-- Call logs (voice/video): date, duration, type. Calls are NEVER recorded.
CREATE TABLE call_logs (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    conversation_id  INT UNSIGNED NOT NULL,
    type             ENUM('voz','video') NOT NULL,
    status           ENUM('llamando','en_curso','finalizada') NOT NULL DEFAULT 'llamando',
    started_at       TIMESTAMP NULL,
    ended_at         TIMESTAMP NULL,
    duration_seconds INT UNSIGNED NULL,
    PRIMARY KEY (id),
    KEY idx_call_logs_conversation (conversation_id),
    CONSTRAINT fk_call_logs_conversation FOREIGN KEY (conversation_id)
        REFERENCES conversations (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Call logs: date, duration, type. Calls are NOT recorded by default (privacy).';

-- Provider quick replies (editable/deletable).
CREATE TABLE quick_replies (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider_id INT UNSIGNED NOT NULL,
    name        VARCHAR(100) NOT NULL COMMENT 'e.g. "Confirmo disponibilidad"',
    content     TEXT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_quick_replies_provider (provider_id),
    CONSTRAINT fk_quick_replies_provider FOREIGN KEY (provider_id)
        REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Provider quick replies (editable / deletable).';

-- Automated scheduled messages (4 exact automation types).
CREATE TABLE scheduled_messages (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    trigger_type ENUM('reserva_confirmada','evento','pago_pendiente','review') NOT NULL COMMENT '4 exact triggers',
    recipient    ENUM('cliente','ambos') NOT NULL,
    send_at      DATETIME NOT NULL COMMENT 'Absolute scheduled time (offsets computed by app: H-48, H-2, +24h, before payment deadline)',
    status       ENUM('pendiente','enviado') NOT NULL DEFAULT 'pendiente',
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_scheduled_messages_pending (trigger_type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Scheduled messages: booking confirmation (+24h), event reminder (H-48/H-2 to both), review request (+24h), payment reminder (before deadline).';

-- =====================================================================
-- NOTIFICATIONS, REVIEWS, FAVORITES
-- =====================================================================

-- Notifications: 16 types, 3 channels. Critical notifications (contract,
-- payment, cancellation) MUST use at least 2 channels (app-enforced).
CREATE TABLE notifications (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED NOT NULL,
    type        ENUM('firma_contrato','saldo_pendiente','confirmacion_pago','recordatorio_evento_h48','recordatorio_evento_h2','encuesta_satisfaccion','invitacion_paquete','aceptacion_invitacion','rechazo_invitacion','anticipo_recibido','pago_completo_recibido','cancelacion','reembolso_procesado','review_recibida','nueva_agenda_disponible','permiso_alcohol_h5') NOT NULL COMMENT '16 exact types',
    channel     ENUM('push','email','in_app') NOT NULL COMMENT '3 exact channels',
    is_critical BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Contract/payment/cancellation are critical and MUST use >=2 channels',
    status      ENUM('pendiente','enviada','leida') NOT NULL DEFAULT 'pendiente',
    payload     JSON NULL COMMENT 'Amount, date, link, etc.',
    sent_at     TIMESTAMP NULL,
    read_at     TIMESTAMP NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notifications_user_created (user_id, created_at),
    KEY idx_notifications_status (status),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Notifications (16 types / 3 channels). Critical types require >=2 channels (push+email or push+in_app) - application rule. In-app ones have pending-actions history.';

-- Reviews: 1 per reservation (UNIQUE), 1-5 stars.
-- ENABLING RULE (not DB-enforced): review only if full payment completed
-- AND event date has passed.
CREATE TABLE reviews (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id INT UNSIGNED NOT NULL,
    client_id      INT UNSIGNED NOT NULL,
    provider_id    INT UNSIGNED NOT NULL COMMENT 'Denormalized for ranking performance',
    rating         TINYINT UNSIGNED NOT NULL COMMENT '1-5 stars',
    comment        TEXT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_reviews_reservation (reservation_id),
    KEY idx_reviews_provider_created (provider_id, created_at),
    CONSTRAINT fk_reviews_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservations (id) ON DELETE RESTRICT,
    CONSTRAINT fk_reviews_client FOREIGN KEY (client_id)
        REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_reviews_provider FOREIGN KEY (provider_id)
        REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Post-payment reviews (1 per reservation). Rule NOT ENFORCED here: review enabled only when payment is complete AND event_date < now. Rating 1-5 (CHECK).';

-- Client favorites (persist across app restarts; ordered by date added).
CREATE TABLE favorites (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    client_id  INT UNSIGNED NOT NULL,
    service_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_favorites (client_id, service_id),
    CONSTRAINT fk_favorites_client FOREIGN KEY (client_id)
        REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_favorites_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Client favorites (persisted, most recent first).';

-- =====================================================================
-- COMMISSION, INVOICES/CFDI, DISPUTES, MODERATION, AUDIT
-- =====================================================================

-- Global commission rate history (admin function #5). Commission is
-- summed into the visible client price (client sees rent + taxes, no
-- commission breakdown; provider sees the final price with commission).
CREATE TABLE commission_settings (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    commission_rate DECIMAL(5,2) NOT NULL COMMENT 'Percent (e.g. 10.00 = 10%)',
    changed_by      INT UNSIGNED NOT NULL COMMENT 'Admin who changed the rate',
    changed_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_commission_settings_changed_by (changed_by),
    CONSTRAINT fk_commission_settings_changed_by FOREIGN KEY (changed_by)
        REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Commission rate history (latest row = current rate). Commission computed over the CURRENT (adjusted) price.';

-- Invoices / CFDI: one fiscal receipt per processed payment. Retention
-- ISR (art. 113-E LISR) and IVA per current legislation.
CREATE TABLE invoices (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    payment_id    INT UNSIGNED NOT NULL,
    cfdi_uuid     VARCHAR(64) NULL COMMENT 'SAT CFDI UUID',
    amount        DECIMAL(10,2) NOT NULL COMMENT 'MXN gross amount',
    taxes         DECIMAL(10,2) NOT NULL COMMENT 'MXN IVA/other',
    retention_isr DECIMAL(10,2) NULL COMMENT 'ISR retention (art. 113-E LISR)',
    retention_iva DECIMAL(10,2) NULL,
    net_amount    DECIMAL(10,2) NULL COMMENT 'Net to receive',
    issued_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_invoices_payment (payment_id),
    CONSTRAINT fk_invoices_payment FOREIGN KEY (payment_id)
        REFERENCES payments (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='CFDI per processed payment (automatic generation - SAT). Monthly provider report: transactions, gross, taxes, platform commission, net.';

-- Technical disputes only (system errors, failed payments). Commercial
-- disputes are NOT mediated by the platform.
CREATE TABLE technical_disputes (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id INT UNSIGNED NOT NULL,
    reported_by    INT UNSIGNED NOT NULL,
    type           ENUM('tecnica') NOT NULL DEFAULT 'tecnica' COMMENT 'Only technical disputes (admin resolves); commercial disputes stay outside the app',
    status         ENUM('abierta','resuelta') NOT NULL DEFAULT 'abierta',
    resolution     TEXT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at    TIMESTAMP NULL,
    PRIMARY KEY (id),
    KEY idx_technical_disputes_reservation (reservation_id),
    CONSTRAINT fk_technical_disputes_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservations (id) ON DELETE RESTRICT,
    CONSTRAINT fk_technical_disputes_reported_by FOREIGN KEY (reported_by)
        REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Technical disputes (admin function #4). Commercial disputes are NOT mediated.';

-- Content moderation reports (admin function #1): approve / warn / remove.
CREATE TABLE content_reports (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reported_by INT UNSIGNED NOT NULL COMMENT 'User who reported the content',
    service_id  INT UNSIGNED NOT NULL,
    reason      VARCHAR(500) NOT NULL,
    status      ENUM('pendiente','resuelto') NOT NULL DEFAULT 'pendiente' COMMENT 'Closed set inferred from moderation workflow',
    action      ENUM('aprobar','advertir','eliminar') NULL COMMENT 'Moderation decision',
    handled_by  INT UNSIGNED NULL COMMENT 'Admin who handled it',
    handled_at  TIMESTAMP NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_content_reports_service (service_id),
    KEY idx_content_reports_status (status),
    CONSTRAINT fk_content_reports_reported_by FOREIGN KEY (reported_by)
        REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_content_reports_service FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT,
    CONSTRAINT fk_content_reports_handled_by FOREIGN KEY (handled_by)
        REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Content moderation reports. Admin approves / warns / removes reported content.';

-- General audit log: admin actions (commission, moderation, blocks),
-- verification monitoring, sensitive mutations.
CREATE TABLE audit_logs (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id    INT UNSIGNED NULL COMMENT 'User performing the action (NULL = system)',
    action      VARCHAR(100) NOT NULL COMMENT 'Action name, e.g. commission.updated',
    entity_type VARCHAR(100) NOT NULL,
    entity_id   VARCHAR(64) NULL COMMENT 'VARCHAR to support heterogeneous entity ids (single value or composite)',
    old_value   JSON NULL,
    new_value   JSON NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_audit_logs_entity (entity_type, entity_id),
    KEY idx_audit_logs_actor (actor_id),
    CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id)
        REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Audit trail for admin/system actions (commission changes, moderation, blocks) and NOM-151 record preservation.';

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- BASE CATALOG SEED DATA (optional, safe to re-run)
-- =====================================================================
INSERT IGNORE INTO amenities (name, description) VALUES
    ('Wi-Fi',          'High-speed wireless internet'),
    ('Pista de baile', 'Dance floor'),
    ('Menu vegano',    'Vegan menu available'),
    ('Alberca',        'Swimming pool'),
    ('Internet',       'Internet access');

INSERT IGNORE INTO service_event_types (name) VALUES
    ('Boda'),
    ('Quinceanera'),
    ('Corporativo'),
    ('Infantil');

-- =====================================================================
-- VIEWS
-- =====================================================================

-- Provider ranking: response rate, acceptance rate and average rating.
-- NULL is used instead of 0 when there is no data ("Sin datos" with 0
-- reservations). Interpretation notes:
--   * response_rate = provider messages sent / client messages received
--     in the provider's conversations (proxy for "responded").
--   * acceptance_rate = reservations whose status reached an accepted
--     state / reservations requested (status <> 'creado').
CREATE OR REPLACE VIEW v_provider_ranking AS
SELECT
    u.id                                                             AS provider_id,
    u.full_name                                                      AS provider_name,
    ROUND(100.0 * mr.provider_msgs / NULLIF(mr.client_msgs, 0), 2)   AS response_rate_pct,
    ROUND(100.0 * ra.accepted_count / NULLIF(ra.requested_count, 0), 2) AS acceptance_rate_pct,
    rv.avg_rating                                                    AS avg_rating,
    (mr.client_msgs IS NULL AND
     ra.requested_count IS NULL AND
     rv.avg_rating IS NULL)                                          AS no_data
FROM users u
LEFT JOIN (
    SELECT c.provider_id,
           SUM(CASE WHEN m.sender_id = c.provider_id THEN 1 ELSE 0 END) AS provider_msgs,
           SUM(CASE WHEN m.sender_id = c.client_id   THEN 1 ELSE 0 END) AS client_msgs
    FROM conversations c
    JOIN messages m ON m.conversation_id = c.id AND m.deleted_at IS NULL
    GROUP BY c.provider_id
) mr ON mr.provider_id = u.id
LEFT JOIN (
    SELECT s.provider_id,
           COUNT(*) AS requested_count,
           SUM(CASE WHEN r.status IN
               ('disponible_para_reserva','pendiente_firma','contrato_confirmado',
                'permiso_alcohol','pago_anticipo','confirmada','en_curso','completada')
               THEN 1 ELSE 0 END) AS accepted_count
    FROM reservations r
    JOIN reservation_items ri ON ri.reservation_id = r.id
    JOIN services s           ON s.id = ri.service_id
    WHERE r.status <> 'creado'
    GROUP BY s.provider_id
) ra ON ra.provider_id = u.id
LEFT JOIN (
    SELECT provider_id, AVG(rating) AS avg_rating
    FROM reviews
    GROUP BY provider_id
) rv ON rv.provider_id = u.id
WHERE u.role = 'prestador';

-- Slot availability: capacity vs active reservations (non-final states)
-- per service+slot. Indicator:
--   disponible = no active reservations
--   parcial    = 0 < active < capacity  (threshold is an app decision;
--               here "parcial" simply means partially used)
--   lleno      = active >= capacity
-- Active = any non-final state (NOT cancelada/completada). The app decides
-- which intermediate states actually consume slot capacity.
CREATE OR REPLACE VIEW v_slot_availability AS
SELECT
    sl.id                        AS slot_id,
    s.id                         AS service_id,
    s.service_type               AS service_type,
    s.title                      AS service_title,
    sl.slot_date                 AS slot_date,
    sl.start_time                AS start_time,
    sl.end_time                  AS end_time,
    sl.capacity                  AS capacity,
    COUNT(ri.id)                 AS active_reservations,
    (sl.capacity - COUNT(ri.id)) AS available_capacity,
    CASE
        WHEN COUNT(ri.id) >= sl.capacity THEN 'lleno'
        WHEN COUNT(ri.id) > 0            THEN 'parcial'
        ELSE 'disponible'
    END                          AS status_indicator
FROM inventory_slots sl
JOIN services s ON s.id = sl.service_id
LEFT JOIN reservation_items ri ON ri.service_id = s.id
LEFT JOIN reservations r ON r.id = ri.reservation_id
    AND r.event_date = sl.slot_date
    AND r.start_time = sl.start_time
    AND r.end_time = sl.end_time
    AND r.status NOT IN ('cancelada','completada')
GROUP BY sl.id, s.id;

-- =====================================================================
-- TRIGGERS
-- =====================================================================
-- The ONLY DB-level trigger required by the digest: audit every
-- reservation status change. All other validation is application-level.
-- NOTE: reservation_status_history.changed_by is set to the client id as
-- a safe default; the app may overwrite it with the actual actor before
-- applying manual state changes.
DELIMITER $$

CREATE TRIGGER trg_reservation_status_audit
AFTER UPDATE ON reservations
FOR EACH ROW
BEGIN
    IF NEW.status <> OLD.status THEN
        INSERT INTO reservation_status_history (reservation_id, status, changed_at, changed_by)
        VALUES (NEW.id, NEW.status, NEW.updated_at, NEW.client_id);
    END IF;
END$$

DELIMITER ;

-- =====================================================================
-- END OF SCHEMA
-- =====================================================================
