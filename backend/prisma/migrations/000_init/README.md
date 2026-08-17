# Migration 000_init — Baseline

Baseline migration for the full `eventos_db` schema, generated from
`schema.prisma` (itself produced by `prisma db pull` against the canonical
`database_schema.sql`, per design decision D-001).

## Contents

| Section | Source | Notes |
|---------|--------|-------|
| 44 `CREATE TABLE`s | `prisma migrate diff --from-empty --to-schema-datamodel` | Native ENUMs, `DECIMAL(10,2)` MXN, `JSON` columns, FKs (RESTRICT, CASCADE on junction tables), indexes with canonical names |
| 8 named `CHECK` constraints | canonical `database_schema.sql` | Not expressible in the Prisma datamodel; added as `ALTER TABLE` (MariaDB adds 9 extra JSON-validity checks automatically) |
| Base catalog seed (`INSERT IGNORE`) | canonical seed section | 5 amenities, 4 event types (idempotent) |
| Views `v_provider_ranking`, `v_slot_availability` | canonical views section | `CREATE OR REPLACE VIEW`, queried via `$queryRaw` (Prisma models cannot express views) |
| Trigger `trg_reservation_status_audit` | canonical trigger section | Single `CREATE TRIGGER` statement (no `DELIMITER` — Prisma's migration engine executes statements directly) |

## Notes

- **Source of truth**: `database_schema.sql` remains canonical (D-001).
  This migration reproduces it 1:1 so an empty database can be fully
  provisioned with `prisma migrate deploy`.
- **Deployment paths** (resolved in slice S8):
  1. *Init-script path*: the container mounts `database_schema.sql` into
     `docker-entrypoint-initdb.d` (D-010). After first boot, record this
     baseline as applied with
     `prisma migrate resolve --applied 000_init` so migration history
     matches the live schema.
  2. *Migration-only path*: start the container with an empty database and
     let `prisma migrate deploy` create everything.
- **Rollback**: `down.sql` in this directory is a recovery aid (Prisma
  migrations are forward-only in production, D-010).
- **Known nuance**: MariaDB implements `JSON` as a `LONGTEXT` alias with a
  `json_valid` check, so `prisma db pull` introspects JSON columns as
  `String @db.LongText`. This schema intentionally types the 8 semantic
  JSON columns (`users.notification_prefs`, `services.location`,
  `services.coverage_area`, `dynamic_pricing_rules.scope`,
  `reservations.cancellation_policy_snapshot`, `notifications.payload`,
  `audit_logs.old_value`, `audit_logs.new_value`) as Prisma `Json` for
  typed client access. `migrate dev` may report cosmetic drift on these
  columns when comparing against a `db pull`ed baseline; `migrate deploy`
  (production) is unaffected.