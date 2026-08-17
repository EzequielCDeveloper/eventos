-- =====================================================================
-- 000_init — Baseline migration for "Plataforma Eventos" (eventos_db)
-- =====================================================================
-- Generated from Prisma `migrate diff --from-empty --to-schema-datamodel`
-- against schema.prisma (itself introspected from the canonical
-- database_schema.sql via `prisma db pull` per D-001).
--
-- The canonical schema (database_schema.sql) remains the source of
-- truth. This migration reproduces it 1:1 so a pristine database can be
-- provisioned purely via `prisma migrate deploy`:
--   * 44 tables with native ENUMs, DECIMAL(10,2) MXN, JSON columns
--   * CHECK constraints (from the canonical file, not expressible in the
--     Prisma datamodel)
--   * base catalog seed (amenities, event types)
--   * views v_provider_ranking / v_slot_availability
--   * trigger trg_reservation_status_audit
--
-- Down: see down.sql in this directory (recovery aid only — Prisma
-- migrations are forward-only in production per D-010).
-- =====================================================================


-- CreateTable
CREATE TABLE `alcohol_permits` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `reservation_id` INTEGER UNSIGNED NOT NULL,
    `requested` BOOLEAN NOT NULL,
    `status` ENUM('lista_espera', 'confirmado', 'no_confirmado') NOT NULL DEFAULT 'lista_espera',
    `h5_decision` ENUM('continuar_sin_alcohol', 'cancelar') NULL,
    `consequences_notified_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_alcohol_permits_reservation`(`reservation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `amenities` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,

    UNIQUE INDEX `uk_amenities_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `arco_requests` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `tipo` ENUM('acceso', 'rectificacion', 'cancelacion', 'oposicion') NOT NULL,
    `status` ENUM('pendiente', 'en_proceso', 'completado', 'rechazado') NOT NULL DEFAULT 'pendiente',
    `requested_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deadline_at` DATE NULL,
    `resolved_at` TIMESTAMP(0) NULL,
    `response_notes` TEXT NULL,

    INDEX `idx_arco_requests_status`(`status`),
    INDEX `idx_arco_requests_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `actor_id` INTEGER UNSIGNED NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(100) NOT NULL,
    `entity_id` VARCHAR(64) NULL,
    `old_value` JSON NULL,
    `new_value` JSON NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_audit_logs_actor`(`actor_id`),
    INDEX `idx_audit_logs_entity`(`entity_type`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `availability_blocks` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER UNSIGNED NOT NULL,
    `start_datetime` DATETIME(0) NOT NULL,
    `end_datetime` DATETIME(0) NOT NULL,
    `type` ENUM('mantenimiento', 'inoperacion', 'evento_privado') NOT NULL,

    INDEX `idx_availability_blocks_service`(`service_id`, `start_datetime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `call_logs` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `conversation_id` INTEGER UNSIGNED NOT NULL,
    `type` ENUM('voz', 'video') NOT NULL,
    `status` ENUM('llamando', 'en_curso', 'finalizada') NOT NULL DEFAULT 'llamando',
    `started_at` TIMESTAMP(0) NULL,
    `ended_at` TIMESTAMP(0) NULL,
    `duration_seconds` INTEGER UNSIGNED NULL,

    INDEX `idx_call_logs_conversation`(`conversation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cancellation_policies` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `provider_id` INTEGER UNSIGNED NOT NULL,
    `retention_percent` INTEGER UNSIGNED NOT NULL DEFAULT 50,
    `penalty_free_window_days` INTEGER UNSIGNED NOT NULL DEFAULT 30,
    `deposit_refundable` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_cancellation_policies_provider`(`provider_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cancellations` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `reservation_id` INTEGER UNSIGNED NOT NULL,
    `cancelled_by` ENUM('cliente', 'proveedor') NOT NULL,
    `timing` ENUM('lejana', 'cercana') NULL,
    `retention_percent` DECIMAL(5, 2) NULL,
    `retention_accepted` BOOLEAN NULL,
    `reason` VARCHAR(500) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_cancellations_reservation`(`reservation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commission_settings` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `commission_rate` DECIMAL(5, 2) NOT NULL,
    `changed_by` INTEGER UNSIGNED NOT NULL,
    `changed_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_commission_settings_changed_by`(`changed_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consent_logs` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `consent_type` ENUM('aviso_privacidad', 'terminos_condiciones', 'cookies', 'verificacion_identidad') NOT NULL,
    `accepted` BOOLEAN NOT NULL,
    `privacy_policy_version` VARCHAR(50) NULL,
    `accepted_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_consent_logs_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_reports` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `reported_by` INTEGER UNSIGNED NOT NULL,
    `service_id` INTEGER UNSIGNED NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `status` ENUM('pendiente', 'resuelto') NOT NULL DEFAULT 'pendiente',
    `action` ENUM('aprobar', 'advertir', 'eliminar') NULL,
    `handled_by` INTEGER UNSIGNED NULL,
    `handled_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_content_reports_handled_by`(`handled_by`),
    INDEX `fk_content_reports_reported_by`(`reported_by`),
    INDEX `idx_content_reports_service`(`service_id`),
    INDEX `idx_content_reports_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contracts` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `reservation_id` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('pendiente_firma', 'firmando', 'pendiente_confirmacion', 'contrato_confirmado') NOT NULL DEFAULT 'pendiente_firma',
    `signing_appointment_at` DATETIME(0) NULL,
    `signing_location` VARCHAR(500) NULL,
    `client_confirmed_at` TIMESTAMP(0) NULL,
    `provider_confirmed_at` TIMESTAMP(0) NULL,
    `document_url` VARCHAR(500) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_contracts_reservation`(`reservation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER UNSIGNED NOT NULL,
    `provider_id` INTEGER UNSIGNED NOT NULL,
    `service_id` INTEGER UNSIGNED NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_conversations_provider`(`provider_id`),
    INDEX `fk_conversations_service`(`service_id`),
    UNIQUE INDEX `uk_conversations_thread`(`client_id`, `provider_id`, `service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dynamic_pricing_rules` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER UNSIGNED NOT NULL,
    `sound_package_id` INTEGER UNSIGNED NULL,
    `adjustment_type` ENUM('temporada', 'demanda', 'dia_semana', 'bloque_turno') NOT NULL,
    `adjustment_value` DECIMAL(10, 2) NOT NULL,
    `scope` JSON NOT NULL,

    INDEX `fk_dynamic_pricing_rules_sound_package`(`sound_package_id`),
    INDEX `idx_dynamic_pricing_rules_service`(`service_id`, `adjustment_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `favorites` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER UNSIGNED NOT NULL,
    `service_id` INTEGER UNSIGNED NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_favorites_service`(`service_id`),
    UNIQUE INDEX `uk_favorites`(`client_id`, `service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `identity_verifications` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `method` ENUM('ine_presencial', 'kyc') NOT NULL,
    `kyc_provider` ENUM('verificamex', 'truora', 'veriff') NULL,
    `result` ENUM('verificado', 'ine_vencido', 'ine_no_encontrado', 'datos_no_coinciden', 'error_api', 'pendiente') NOT NULL,
    `estatus_lista_nominal` ENUM('activo', 'vencido', 'no_encontrado') NULL,
    `motivo` ENUM('ine_vencido', 'ine_no_encontrado', 'datos_no_coinciden') NULL,
    `vigente` BOOLEAN NULL,
    `coincidencia_nombre` BOOLEAN NULL,
    `error_code` VARCHAR(32) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_identity_verifications_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_slots` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER UNSIGNED NOT NULL,
    `slot_date` DATE NOT NULL,
    `start_time` TIME(0) NOT NULL,
    `end_time` TIME(0) NOT NULL,
    `capacity` INTEGER UNSIGNED NOT NULL DEFAULT 1,

    INDEX `idx_inventory_slots_service_date`(`service_id`, `slot_date`),
    UNIQUE INDEX `uk_inventory_slots_slot`(`service_id`, `slot_date`, `start_time`, `end_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `payment_id` INTEGER UNSIGNED NOT NULL,
    `cfdi_uuid` VARCHAR(64) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `taxes` DECIMAL(10, 2) NOT NULL,
    `retention_isr` DECIMAL(10, 2) NULL,
    `retention_iva` DECIMAL(10, 2) NULL,
    `net_amount` DECIMAL(10, 2) NULL,
    `issued_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_invoices_payment`(`payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `conversation_id` INTEGER UNSIGNED NOT NULL,
    `sender_id` INTEGER UNSIGNED NOT NULL,
    `type` ENUM('texto', 'nota_voz') NOT NULL,
    `content` TEXT NULL,
    `audio_url` VARCHAR(500) NULL,
    `duration_seconds` INTEGER UNSIGNED NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `read_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `idx_messages_conversation`(`conversation_id`, `created_at`),
    INDEX `idx_messages_sender`(`sender_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `type` ENUM('firma_contrato', 'saldo_pendiente', 'confirmacion_pago', 'recordatorio_evento_h48', 'recordatorio_evento_h2', 'encuesta_satisfaccion', 'invitacion_paquete', 'aceptacion_invitacion', 'rechazo_invitacion', 'anticipo_recibido', 'pago_completo_recibido', 'cancelacion', 'reembolso_procesado', 'review_recibida', 'nueva_agenda_disponible', 'permiso_alcohol_h5') NOT NULL,
    `channel` ENUM('push', 'email', 'in_app') NOT NULL,
    `is_critical` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('pendiente', 'enviada', 'leida') NOT NULL DEFAULT 'pendiente',
    `payload` JSON NULL,
    `sent_at` TIMESTAMP(0) NULL,
    `read_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_notifications_status`(`status`),
    INDEX `idx_notifications_user_created`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operating_hours` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER UNSIGNED NOT NULL,
    `day_of_week` TINYINT UNSIGNED NOT NULL,
    `open_time` TIME(0) NOT NULL,
    `close_time` TIME(0) NOT NULL,
    `base_block_duration_hours` INTEGER UNSIGNED NOT NULL DEFAULT 4,
    `extra_hours_allowed` INTEGER UNSIGNED NOT NULL DEFAULT 0,

    UNIQUE INDEX `uk_operating_hours_day`(`service_id`, `day_of_week`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `package_members` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `package_id` INTEGER UNSIGNED NOT NULL,
    `provider_id` INTEGER UNSIGNED NOT NULL,
    `service_type` ENUM('sonido', 'servicio_persona') NOT NULL,
    `invitation_status` ENUM('pendiente', 'aceptada', 'rechazada') NOT NULL DEFAULT 'pendiente',
    `member_price` DECIMAL(10, 2) NULL,
    `responded_at` TIMESTAMP(0) NULL,

    INDEX `idx_package_members_provider`(`provider_id`),
    UNIQUE INDEX `uk_package_members`(`package_id`, `provider_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `packages` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `leader_provider_id` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('creado', 'invitaciones_pendientes', 'invitaciones_aceptadas', 'disponibilidad_verificada', 'disponible_para_reserva', 'reservado', 'completado') NOT NULL DEFAULT 'creado',
    `closed_price` DECIMAL(10, 2) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_packages_leader`(`leader_provider_id`),
    INDEX `idx_packages_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `reservation_id` INTEGER UNSIGNED NOT NULL,
    `payment_type` ENUM('anticipo', 'saldo', 'deposito_garantia') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'MXN',
    `status` ENUM('pendiente', 'procesado', 'fallido', 'reembolsado', 'retenido', 'devuelto') NOT NULL DEFAULT 'pendiente',
    `conekta_charge_id` VARCHAR(100) NULL,
    `due_date` DATETIME(0) NULL,
    `charged_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_payments_reservation`(`reservation_id`),
    INDEX `idx_payments_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_blocks` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `provider_id` INTEGER UNSIGNED NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `handled_by` INTEGER UNSIGNED NULL,
    `blocked_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `unblocked_at` TIMESTAMP(0) NULL,

    INDEX `fk_provider_blocks_handled_by`(`handled_by`),
    INDEX `idx_provider_blocks_provider`(`provider_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quick_replies` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `provider_id` INTEGER UNSIGNED NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `content` TEXT NOT NULL,

    INDEX `idx_quick_replies_provider`(`provider_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refunds` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `payment_id` INTEGER UNSIGNED NOT NULL,
    `reservation_id` INTEGER UNSIGNED NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `reason` ENUM('cancelacion_proveedor', 'cancelacion_cliente', 'deposito_devolucion', 'politica_proveedor', 'permiso_alcohol_no_confirmado') NOT NULL,
    `status` ENUM('pendiente', 'procesado') NOT NULL DEFAULT 'pendiente',
    `processed_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_refunds_payment`(`payment_id`),
    INDEX `idx_refunds_reservation`(`reservation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservation_extras` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `reservation_id` INTEGER UNSIGNED NOT NULL,
    `extra_id` INTEGER UNSIGNED NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `price_snapshot` DECIMAL(10, 2) NOT NULL,

    INDEX `fk_reservation_extras_extra`(`extra_id`),
    INDEX `idx_reservation_extras_reservation`(`reservation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservation_items` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `reservation_id` INTEGER UNSIGNED NOT NULL,
    `service_id` INTEGER UNSIGNED NOT NULL,
    `sound_package_id` INTEGER UNSIGNED NULL,
    `person_count` INTEGER UNSIGNED NULL,
    `hours` INTEGER UNSIGNED NULL,
    `unit_price_snapshot` DECIMAL(10, 2) NOT NULL,

    INDEX `fk_reservation_items_sound_package`(`sound_package_id`),
    INDEX `idx_reservation_items_reservation`(`reservation_id`),
    INDEX `idx_reservation_items_service`(`service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservation_status_history` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `reservation_id` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('creado', 'invitaciones_pendientes', 'invitaciones_aceptadas', 'disponibilidad_verificada', 'disponible_para_reserva', 'pendiente_firma', 'contrato_confirmado', 'permiso_alcohol', 'pago_anticipo', 'confirmada', 'en_curso', 'completada', 'cancelada') NOT NULL,
    `changed_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `changed_by` INTEGER UNSIGNED NULL,

    INDEX `fk_reservation_status_history_changed_by`(`changed_by`),
    INDEX `idx_reservation_status_history_reservation`(`reservation_id`, `changed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservations` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER UNSIGNED NOT NULL,
    `package_id` INTEGER UNSIGNED NULL,
    `status` ENUM('creado', 'invitaciones_pendientes', 'invitaciones_aceptadas', 'disponibilidad_verificada', 'disponible_para_reserva', 'pendiente_firma', 'contrato_confirmado', 'permiso_alcohol', 'pago_anticipo', 'confirmada', 'en_curso', 'completada', 'cancelada') NOT NULL DEFAULT 'creado',
    `event_date` DATE NOT NULL,
    `start_time` TIME(0) NOT NULL,
    `end_time` TIME(0) NOT NULL,
    `block_hours` INTEGER UNSIGNED NOT NULL,
    `extra_hours` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `total_price` DECIMAL(10, 2) NOT NULL,
    `base_amount` DECIMAL(10, 2) NOT NULL,
    `extras_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `taxes_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `commission_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `commission_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `cancellation_policy_snapshot` JSON NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `cancelled_at` TIMESTAMP(0) NULL,
    `completed_at` TIMESTAMP(0) NULL,

    INDEX `idx_reservations_client`(`client_id`),
    INDEX `idx_reservations_event_date`(`event_date`),
    INDEX `idx_reservations_package`(`package_id`),
    INDEX `idx_reservations_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `reservation_id` INTEGER UNSIGNED NOT NULL,
    `client_id` INTEGER UNSIGNED NOT NULL,
    `provider_id` INTEGER UNSIGNED NOT NULL,
    `rating` TINYINT UNSIGNED NOT NULL,
    `comment` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_reviews_reservation`(`reservation_id`),
    INDEX `fk_reviews_client`(`client_id`),
    INDEX `idx_reviews_provider_created`(`provider_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salon_pricing` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER UNSIGNED NOT NULL,
    `base_block_hours` INTEGER UNSIGNED NOT NULL,
    `base_block_price` DECIMAL(10, 2) NOT NULL,
    `extra_hour_price` DECIMAL(10, 2) NOT NULL,

    UNIQUE INDEX `uk_salon_pricing_service`(`service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scheduled_messages` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `trigger_type` ENUM('reserva_confirmada', 'evento', 'pago_pendiente', 'review') NOT NULL,
    `recipient` ENUM('cliente', 'ambos') NOT NULL,
    `send_at` DATETIME(0) NOT NULL,
    `status` ENUM('pendiente', 'enviado') NOT NULL DEFAULT 'pendiente',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_scheduled_messages_pending`(`trigger_type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_amenities` (
    `service_id` INTEGER UNSIGNED NOT NULL,
    `amenity_id` INTEGER UNSIGNED NOT NULL,

    INDEX `fk_service_amenities_amenity`(`amenity_id`),
    PRIMARY KEY (`service_id`, `amenity_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_event_types` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `uk_service_event_types_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_extras` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER UNSIGNED NOT NULL,
    `sound_package_id` INTEGER UNSIGNED NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `image_url` VARCHAR(500) NULL,

    INDEX `idx_service_extras_service`(`service_id`),
    INDEX `idx_service_extras_sound_package`(`sound_package_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_persona_pricing` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER UNSIGNED NOT NULL,
    `price_per_person_per_hour` DECIMAL(10, 2) NOT NULL,

    UNIQUE INDEX `uk_service_persona_pricing_service`(`service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_photos` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER UNSIGNED NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `position` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('pendiente_moderacion', 'aprobada', 'rechazada') NOT NULL DEFAULT 'pendiente_moderacion',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_service_photos_service`(`service_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_service_event_types` (
    `service_id` INTEGER UNSIGNED NOT NULL,
    `event_type_id` INTEGER UNSIGNED NOT NULL,

    INDEX `fk_service_service_event_types_event_type`(`event_type_id`),
    PRIMARY KEY (`service_id`, `event_type_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `provider_id` INTEGER UNSIGNED NOT NULL,
    `service_type` ENUM('salon', 'sonido', 'servicio_persona') NOT NULL,
    `status` ENUM('borrador', 'pendiente_verificacion', 'publicado', 'rechazado') NOT NULL DEFAULT 'borrador',
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `location_type` ENUM('fija', 'area_servicio') NOT NULL,
    `location` JSON NOT NULL,
    `coverage_area` JSON NULL,
    `max_capacity` INTEGER UNSIGNED NOT NULL,
    `approval_mode` ENUM('manual', 'inmediata') NOT NULL DEFAULT 'manual',
    `viaticos_per_km` DECIMAL(10, 2) NULL,
    `deposit_amount` DECIMAL(10, 2) NULL,
    `cancellation_policy_id` INTEGER UNSIGNED NOT NULL,
    `cofepris_responsibility_accepted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_services_cancellation_policy`(`cancellation_policy_id`),
    INDEX `idx_services_location_type`(`location_type`),
    INDEX `idx_services_max_capacity`(`max_capacity`),
    INDEX `idx_services_provider`(`provider_id`),
    INDEX `idx_services_service_type`(`service_type`),
    INDEX `idx_services_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sound_packages` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER UNSIGNED NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `base_price` DECIMAL(10, 2) NOT NULL,
    `base_hours` INTEGER UNSIGNED NOT NULL,
    `extra_hour_price` DECIMAL(10, 2) NOT NULL,

    INDEX `idx_sound_packages_service`(`service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `technical_disputes` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `reservation_id` INTEGER UNSIGNED NOT NULL,
    `reported_by` INTEGER UNSIGNED NOT NULL,
    `type` ENUM('tecnica') NOT NULL DEFAULT 'tecnica',
    `status` ENUM('abierta', 'resuelta') NOT NULL DEFAULT 'abierta',
    `resolution` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `resolved_at` TIMESTAMP(0) NULL,

    INDEX `fk_technical_disputes_reported_by`(`reported_by`),
    INDEX `idx_technical_disputes_reservation`(`reservation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `full_name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `avatar_url` VARCHAR(500) NULL,
    `role` ENUM('usuario', 'prestador', 'administrador') NOT NULL,
    `segment` ENUM('particular', 'empresa') NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `notification_prefs` JSON NULL,
    `privacy_consent_accepted_at` TIMESTAMP(0) NULL,
    `privacy_policy_version` VARCHAR(50) NULL,
    `deleted_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_users_email`(`email`),
    INDEX `idx_users_role`(`role`),
    INDEX `idx_users_segment`(`segment`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `alcohol_permits` ADD CONSTRAINT `fk_alcohol_permits_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `arco_requests` ADD CONSTRAINT `fk_arco_requests_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `fk_audit_logs_actor` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `availability_blocks` ADD CONSTRAINT `fk_availability_blocks_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `call_logs` ADD CONSTRAINT `fk_call_logs_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `cancellation_policies` ADD CONSTRAINT `fk_cancellation_policies_provider` FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `cancellations` ADD CONSTRAINT `fk_cancellations_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `commission_settings` ADD CONSTRAINT `fk_commission_settings_changed_by` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `consent_logs` ADD CONSTRAINT `fk_consent_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `content_reports` ADD CONSTRAINT `fk_content_reports_handled_by` FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `content_reports` ADD CONSTRAINT `fk_content_reports_reported_by` FOREIGN KEY (`reported_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `content_reports` ADD CONSTRAINT `fk_content_reports_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `contracts` ADD CONSTRAINT `fk_contracts_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `fk_conversations_client` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `fk_conversations_provider` FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `fk_conversations_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `dynamic_pricing_rules` ADD CONSTRAINT `fk_dynamic_pricing_rules_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `dynamic_pricing_rules` ADD CONSTRAINT `fk_dynamic_pricing_rules_sound_package` FOREIGN KEY (`sound_package_id`) REFERENCES `sound_packages`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `fk_favorites_client` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `fk_favorites_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `identity_verifications` ADD CONSTRAINT `fk_identity_verifications_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `inventory_slots` ADD CONSTRAINT `fk_inventory_slots_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `fk_invoices_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `operating_hours` ADD CONSTRAINT `fk_operating_hours_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `package_members` ADD CONSTRAINT `fk_package_members_package` FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `package_members` ADD CONSTRAINT `fk_package_members_provider` FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `packages` ADD CONSTRAINT `fk_packages_leader_provider` FOREIGN KEY (`leader_provider_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `fk_payments_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `provider_blocks` ADD CONSTRAINT `fk_provider_blocks_handled_by` FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `provider_blocks` ADD CONSTRAINT `fk_provider_blocks_provider` FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `quick_replies` ADD CONSTRAINT `fk_quick_replies_provider` FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `fk_refunds_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `fk_refunds_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservation_extras` ADD CONSTRAINT `fk_reservation_extras_extra` FOREIGN KEY (`extra_id`) REFERENCES `service_extras`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservation_extras` ADD CONSTRAINT `fk_reservation_extras_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservation_items` ADD CONSTRAINT `fk_reservation_items_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservation_items` ADD CONSTRAINT `fk_reservation_items_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservation_items` ADD CONSTRAINT `fk_reservation_items_sound_package` FOREIGN KEY (`sound_package_id`) REFERENCES `sound_packages`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservation_status_history` ADD CONSTRAINT `fk_reservation_status_history_changed_by` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservation_status_history` ADD CONSTRAINT `fk_reservation_status_history_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `fk_reservations_client` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `fk_reservations_package` FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `fk_reviews_client` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `fk_reviews_provider` FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `fk_reviews_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `salon_pricing` ADD CONSTRAINT `fk_salon_pricing_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `service_amenities` ADD CONSTRAINT `fk_service_amenities_amenity` FOREIGN KEY (`amenity_id`) REFERENCES `amenities`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `service_amenities` ADD CONSTRAINT `fk_service_amenities_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `service_extras` ADD CONSTRAINT `fk_service_extras_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `service_extras` ADD CONSTRAINT `fk_service_extras_sound_package` FOREIGN KEY (`sound_package_id`) REFERENCES `sound_packages`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `service_persona_pricing` ADD CONSTRAINT `fk_service_persona_pricing_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `service_photos` ADD CONSTRAINT `fk_service_photos_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `service_service_event_types` ADD CONSTRAINT `fk_service_service_event_types_event_type` FOREIGN KEY (`event_type_id`) REFERENCES `service_event_types`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `service_service_event_types` ADD CONSTRAINT `fk_service_service_event_types_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `services` ADD CONSTRAINT `fk_services_cancellation_policy` FOREIGN KEY (`cancellation_policy_id`) REFERENCES `cancellation_policies`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `services` ADD CONSTRAINT `fk_services_provider` FOREIGN KEY (`provider_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `sound_packages` ADD CONSTRAINT `fk_sound_packages_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `technical_disputes` ADD CONSTRAINT `fk_technical_disputes_reported_by` FOREIGN KEY (`reported_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `technical_disputes` ADD CONSTRAINT `fk_technical_disputes_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;


-- ---------------------------------------------------------------------
-- CHECK constraints (from canonical database_schema.sql)
-- ---------------------------------------------------------------------

ALTER TABLE `cancellation_policies`
    ADD CONSTRAINT `chk_cancellation_policies_retention` CHECK (retention_percent BETWEEN 0 AND 100),
    ADD CONSTRAINT `chk_cancellation_policies_window` CHECK (penalty_free_window_days BETWEEN 1 AND 90);

ALTER TABLE `inventory_slots`
    ADD CONSTRAINT `chk_inventory_slots_capacity` CHECK (capacity >= 1);

ALTER TABLE `availability_blocks`
    ADD CONSTRAINT `chk_availability_blocks_range` CHECK (start_datetime < end_datetime);

ALTER TABLE `operating_hours`
    ADD CONSTRAINT `chk_operating_hours_weekday` CHECK (day_of_week BETWEEN 1 AND 7),
    ADD CONSTRAINT `chk_operating_hours_range` CHECK (open_time < close_time);

ALTER TABLE `messages`
    ADD CONSTRAINT `chk_messages_voice_duration` CHECK (duration_seconds IS NULL OR duration_seconds <= 120);

ALTER TABLE `reviews`
    ADD CONSTRAINT `chk_reviews_rating` CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE `payments`
    ADD CONSTRAINT `chk_payments_currency` CHECK (currency = 'MXN');

-- ---------------------------------------------------------------------
-- Base catalog seed data (from canonical database_schema.sql, safe to re-run)
-- ---------------------------------------------------------------------

INSERT IGNORE INTO `amenities` (name, description) VALUES
    ('Wi-Fi',          'High-speed wireless internet'),
    ('Pista de baile', 'Dance floor'),
    ('Menu vegano',    'Vegan menu available'),
    ('Alberca',        'Swimming pool'),
    ('Internet',       'Internet access');

INSERT IGNORE INTO `service_event_types` (name) VALUES
    ('Boda'),
    ('Quinceanera'),
    ('Corporativo'),
    ('Infantil');

-- ---------------------------------------------------------------------
-- Views (from canonical database_schema.sql)
-- ---------------------------------------------------------------------

-- Provider ranking: response rate, acceptance rate and average rating.
-- NULL is used instead of 0 when there is no data ("Sin datos" with 0
-- reservations).
CREATE OR REPLACE VIEW `v_provider_ranking` AS
SELECT
    u.id                                                             AS provider_id,
    u.full_name                                                      AS provider_name,
    ROUND(100.0 * mr.provider_msgs / NULLIF(mr.client_msgs, 0), 2)   AS response_rate_pct,
    ROUND(100.0 * ra.accepted_count / NULLIF(ra.requested_count, 0), 2) AS acceptance_rate_pct,
    rv.avg_rating                                                    AS avg_rating,
    (mr.client_msgs IS NULL AND
     ra.requested_count IS NULL AND
     rv.avg_rating IS NULL)                                          AS no_data
FROM `users` u
LEFT JOIN (
    SELECT c.provider_id,
           SUM(CASE WHEN m.sender_id = c.provider_id THEN 1 ELSE 0 END) AS provider_msgs,
           SUM(CASE WHEN m.sender_id = c.client_id   THEN 1 ELSE 0 END) AS client_msgs
    FROM `conversations` c
    JOIN `messages` m ON m.conversation_id = c.id AND m.deleted_at IS NULL
    GROUP BY c.provider_id
) mr ON mr.provider_id = u.id
LEFT JOIN (
    SELECT s.provider_id,
           COUNT(*) AS requested_count,
           SUM(CASE WHEN r.status IN
               ('disponible_para_reserva','pendiente_firma','contrato_confirmado',
                'permiso_alcohol','pago_anticipo','confirmada','en_curso','completada')
               THEN 1 ELSE 0 END) AS accepted_count
    FROM `reservations` r
    JOIN `reservation_items` ri ON ri.reservation_id = r.id
    JOIN `services` s           ON s.id = ri.service_id
    WHERE r.status <> 'creado'
    GROUP BY s.provider_id
) ra ON ra.provider_id = u.id
LEFT JOIN (
    SELECT provider_id, AVG(rating) AS avg_rating
    FROM `reviews`
    GROUP BY provider_id
) rv ON rv.provider_id = u.id
WHERE u.role = 'prestador';

-- Slot availability: capacity vs active reservations (non-final states)
-- per service+slot. Indicator: disponible / parcial / lleno.
CREATE OR REPLACE VIEW `v_slot_availability` AS
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
FROM `inventory_slots` sl
JOIN `services` s ON s.id = sl.service_id
LEFT JOIN `reservation_items` ri ON ri.service_id = s.id
LEFT JOIN `reservations` r ON r.id = ri.reservation_id
    AND r.event_date = sl.slot_date
    AND r.start_time = sl.start_time
    AND r.end_time = sl.end_time
    AND r.status NOT IN ('cancelada','completada')
GROUP BY sl.id, s.id;

-- ---------------------------------------------------------------------
-- Trigger (from canonical database_schema.sql)
-- The ONLY DB-level trigger: audit every reservation status change.
-- NOTE: changed_by defaults to the client id; the app may overwrite it
-- before applying manual state changes.
-- ---------------------------------------------------------------------

CREATE TRIGGER `trg_reservation_status_audit`
AFTER UPDATE ON `reservations`
FOR EACH ROW
BEGIN
    IF NEW.status <> OLD.status THEN
        INSERT INTO `reservation_status_history` (reservation_id, status, changed_at, changed_by)
        VALUES (NEW.id, NEW.status, NEW.updated_at, NEW.client_id);
    END IF;
END
