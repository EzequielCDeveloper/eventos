# Frontend Admin Specification

## Purpose

Defines the admin panel React application: moderation, provider management, global stats, technical disputes, and commission configuration.

## Requirements

### Requirement: Admin Information Architecture (FR-003)

The system MUST provide an AdminLayout component wrapping all admin routes. Admin has exactly 5 functions: moderation, provider management, stats, technical disputes, commission. Commission configuration interface: admin can set global commission rate.

#### Scenario: Admin dashboard

- GIVEN a user with role `administrador`
- WHEN the admin panel loads
- THEN exactly 5 function areas are accessible: moderation, provider management, stats, technical disputes, commission

#### Scenario: Commission rate update

- GIVEN an admin on the commission config page
- WHEN a new commission rate (e.g., 12%) is submitted
- THEN the `commission_settings` table is updated and the new rate applies to subsequent payments

#### Scenario: Non-admin blocked

- GIVEN a user with role `usuario`
- WHEN attempting to access admin routes
- THEN the user is redirected or shown 403
