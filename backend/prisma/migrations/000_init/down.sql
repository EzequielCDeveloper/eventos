-- =====================================================================
-- 000_init — Rollback (DROP) script
-- =====================================================================
-- RECOVERY AID ONLY. Prisma applies migrations forward-only in
-- production (D-010); this file documents the exact inverse of
-- migration.sql for manual rollback in development/staging.
-- Order: drop DB-backed views and the trigger first (they reference
-- tables), then tables via the Prisma-generated drop sequence.
-- =====================================================================

DROP VIEW IF EXISTS `v_provider_ranking`;
DROP VIEW IF EXISTS `v_slot_availability`;
DROP TRIGGER IF EXISTS `trg_reservation_status_audit`;


-- DropForeignKey
ALTER TABLE `alcohol_permits` DROP FOREIGN KEY `fk_alcohol_permits_reservation`;

-- DropForeignKey
ALTER TABLE `arco_requests` DROP FOREIGN KEY `fk_arco_requests_user`;

-- DropForeignKey
ALTER TABLE `audit_logs` DROP FOREIGN KEY `fk_audit_logs_actor`;

-- DropForeignKey
ALTER TABLE `availability_blocks` DROP FOREIGN KEY `fk_availability_blocks_service`;

-- DropForeignKey
ALTER TABLE `call_logs` DROP FOREIGN KEY `fk_call_logs_conversation`;

-- DropForeignKey
ALTER TABLE `cancellation_policies` DROP FOREIGN KEY `fk_cancellation_policies_provider`;

-- DropForeignKey
ALTER TABLE `cancellations` DROP FOREIGN KEY `fk_cancellations_reservation`;

-- DropForeignKey
ALTER TABLE `commission_settings` DROP FOREIGN KEY `fk_commission_settings_changed_by`;

-- DropForeignKey
ALTER TABLE `consent_logs` DROP FOREIGN KEY `fk_consent_logs_user`;

-- DropForeignKey
ALTER TABLE `content_reports` DROP FOREIGN KEY `fk_content_reports_handled_by`;

-- DropForeignKey
ALTER TABLE `content_reports` DROP FOREIGN KEY `fk_content_reports_reported_by`;

-- DropForeignKey
ALTER TABLE `content_reports` DROP FOREIGN KEY `fk_content_reports_service`;

-- DropForeignKey
ALTER TABLE `contracts` DROP FOREIGN KEY `fk_contracts_reservation`;

-- DropForeignKey
ALTER TABLE `conversations` DROP FOREIGN KEY `fk_conversations_client`;

-- DropForeignKey
ALTER TABLE `conversations` DROP FOREIGN KEY `fk_conversations_provider`;

-- DropForeignKey
ALTER TABLE `conversations` DROP FOREIGN KEY `fk_conversations_service`;

-- DropForeignKey
ALTER TABLE `dynamic_pricing_rules` DROP FOREIGN KEY `fk_dynamic_pricing_rules_service`;

-- DropForeignKey
ALTER TABLE `dynamic_pricing_rules` DROP FOREIGN KEY `fk_dynamic_pricing_rules_sound_package`;

-- DropForeignKey
ALTER TABLE `favorites` DROP FOREIGN KEY `fk_favorites_client`;

-- DropForeignKey
ALTER TABLE `favorites` DROP FOREIGN KEY `fk_favorites_service`;

-- DropForeignKey
ALTER TABLE `identity_verifications` DROP FOREIGN KEY `fk_identity_verifications_user`;

-- DropForeignKey
ALTER TABLE `inventory_slots` DROP FOREIGN KEY `fk_inventory_slots_service`;

-- DropForeignKey
ALTER TABLE `invoices` DROP FOREIGN KEY `fk_invoices_payment`;

-- DropForeignKey
ALTER TABLE `messages` DROP FOREIGN KEY `fk_messages_conversation`;

-- DropForeignKey
ALTER TABLE `messages` DROP FOREIGN KEY `fk_messages_sender`;

-- DropForeignKey
ALTER TABLE `notifications` DROP FOREIGN KEY `fk_notifications_user`;

-- DropForeignKey
ALTER TABLE `operating_hours` DROP FOREIGN KEY `fk_operating_hours_service`;

-- DropForeignKey
ALTER TABLE `package_members` DROP FOREIGN KEY `fk_package_members_package`;

-- DropForeignKey
ALTER TABLE `package_members` DROP FOREIGN KEY `fk_package_members_provider`;

-- DropForeignKey
ALTER TABLE `packages` DROP FOREIGN KEY `fk_packages_leader_provider`;

-- DropForeignKey
ALTER TABLE `payments` DROP FOREIGN KEY `fk_payments_reservation`;

-- DropForeignKey
ALTER TABLE `provider_blocks` DROP FOREIGN KEY `fk_provider_blocks_handled_by`;

-- DropForeignKey
ALTER TABLE `provider_blocks` DROP FOREIGN KEY `fk_provider_blocks_provider`;

-- DropForeignKey
ALTER TABLE `quick_replies` DROP FOREIGN KEY `fk_quick_replies_provider`;

-- DropForeignKey
ALTER TABLE `refunds` DROP FOREIGN KEY `fk_refunds_payment`;

-- DropForeignKey
ALTER TABLE `refunds` DROP FOREIGN KEY `fk_refunds_reservation`;

-- DropForeignKey
ALTER TABLE `reservation_extras` DROP FOREIGN KEY `fk_reservation_extras_extra`;

-- DropForeignKey
ALTER TABLE `reservation_extras` DROP FOREIGN KEY `fk_reservation_extras_reservation`;

-- DropForeignKey
ALTER TABLE `reservation_items` DROP FOREIGN KEY `fk_reservation_items_reservation`;

-- DropForeignKey
ALTER TABLE `reservation_items` DROP FOREIGN KEY `fk_reservation_items_service`;

-- DropForeignKey
ALTER TABLE `reservation_items` DROP FOREIGN KEY `fk_reservation_items_sound_package`;

-- DropForeignKey
ALTER TABLE `reservation_status_history` DROP FOREIGN KEY `fk_reservation_status_history_changed_by`;

-- DropForeignKey
ALTER TABLE `reservation_status_history` DROP FOREIGN KEY `fk_reservation_status_history_reservation`;

-- DropForeignKey
ALTER TABLE `reservations` DROP FOREIGN KEY `fk_reservations_client`;

-- DropForeignKey
ALTER TABLE `reservations` DROP FOREIGN KEY `fk_reservations_package`;

-- DropForeignKey
ALTER TABLE `reviews` DROP FOREIGN KEY `fk_reviews_client`;

-- DropForeignKey
ALTER TABLE `reviews` DROP FOREIGN KEY `fk_reviews_provider`;

-- DropForeignKey
ALTER TABLE `reviews` DROP FOREIGN KEY `fk_reviews_reservation`;

-- DropForeignKey
ALTER TABLE `salon_pricing` DROP FOREIGN KEY `fk_salon_pricing_service`;

-- DropForeignKey
ALTER TABLE `service_amenities` DROP FOREIGN KEY `fk_service_amenities_amenity`;

-- DropForeignKey
ALTER TABLE `service_amenities` DROP FOREIGN KEY `fk_service_amenities_service`;

-- DropForeignKey
ALTER TABLE `service_extras` DROP FOREIGN KEY `fk_service_extras_service`;

-- DropForeignKey
ALTER TABLE `service_extras` DROP FOREIGN KEY `fk_service_extras_sound_package`;

-- DropForeignKey
ALTER TABLE `service_persona_pricing` DROP FOREIGN KEY `fk_service_persona_pricing_service`;

-- DropForeignKey
ALTER TABLE `service_photos` DROP FOREIGN KEY `fk_service_photos_service`;

-- DropForeignKey
ALTER TABLE `service_service_event_types` DROP FOREIGN KEY `fk_service_service_event_types_event_type`;

-- DropForeignKey
ALTER TABLE `service_service_event_types` DROP FOREIGN KEY `fk_service_service_event_types_service`;

-- DropForeignKey
ALTER TABLE `services` DROP FOREIGN KEY `fk_services_cancellation_policy`;

-- DropForeignKey
ALTER TABLE `services` DROP FOREIGN KEY `fk_services_provider`;

-- DropForeignKey
ALTER TABLE `sound_packages` DROP FOREIGN KEY `fk_sound_packages_service`;

-- DropForeignKey
ALTER TABLE `technical_disputes` DROP FOREIGN KEY `fk_technical_disputes_reported_by`;

-- DropForeignKey
ALTER TABLE `technical_disputes` DROP FOREIGN KEY `fk_technical_disputes_reservation`;

-- DropTable
DROP TABLE `alcohol_permits`;

-- DropTable
DROP TABLE `amenities`;

-- DropTable
DROP TABLE `arco_requests`;

-- DropTable
DROP TABLE `audit_logs`;

-- DropTable
DROP TABLE `availability_blocks`;

-- DropTable
DROP TABLE `call_logs`;

-- DropTable
DROP TABLE `cancellation_policies`;

-- DropTable
DROP TABLE `cancellations`;

-- DropTable
DROP TABLE `commission_settings`;

-- DropTable
DROP TABLE `consent_logs`;

-- DropTable
DROP TABLE `content_reports`;

-- DropTable
DROP TABLE `contracts`;

-- DropTable
DROP TABLE `conversations`;

-- DropTable
DROP TABLE `dynamic_pricing_rules`;

-- DropTable
DROP TABLE `favorites`;

-- DropTable
DROP TABLE `identity_verifications`;

-- DropTable
DROP TABLE `inventory_slots`;

-- DropTable
DROP TABLE `invoices`;

-- DropTable
DROP TABLE `messages`;

-- DropTable
DROP TABLE `notifications`;

-- DropTable
DROP TABLE `operating_hours`;

-- DropTable
DROP TABLE `package_members`;

-- DropTable
DROP TABLE `packages`;

-- DropTable
DROP TABLE `payments`;

-- DropTable
DROP TABLE `provider_blocks`;

-- DropTable
DROP TABLE `quick_replies`;

-- DropTable
DROP TABLE `refunds`;

-- DropTable
DROP TABLE `reservation_extras`;

-- DropTable
DROP TABLE `reservation_items`;

-- DropTable
DROP TABLE `reservation_status_history`;

-- DropTable
DROP TABLE `reservations`;

-- DropTable
DROP TABLE `reviews`;

-- DropTable
DROP TABLE `salon_pricing`;

-- DropTable
DROP TABLE `scheduled_messages`;

-- DropTable
DROP TABLE `service_amenities`;

-- DropTable
DROP TABLE `service_event_types`;

-- DropTable
DROP TABLE `service_extras`;

-- DropTable
DROP TABLE `service_persona_pricing`;

-- DropTable
DROP TABLE `service_photos`;

-- DropTable
DROP TABLE `service_service_event_types`;

-- DropTable
DROP TABLE `services`;

-- DropTable
DROP TABLE `sound_packages`;

-- DropTable
DROP TABLE `technical_disputes`;

-- DropTable
DROP TABLE `users`;

