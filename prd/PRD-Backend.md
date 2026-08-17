---
id: prd-backend
title: "PRD — Backend (Node.js + Express + MariaDB)"
version: "1.1.0"
status: draft
audience: backend-engineers, ai-agents
stack:
  runtime: Node.js + Express
  database: MariaDB 10.6+ / MySQL 8.0+
  orm: Prisma (D-001)
  auth: JWT propia (backend-issued, POST /api/auth/login)
  payments: Conekta (MXN)
  realtime: Socket.IO
  voice_video: Agora (managed, global CDN; free tier 10K min/month)
  notifications: FCM (push) + Resend (email)
  storage: local disk + Nginx (MVP, migration path Cloudflare R2)
  deploy: Docker + VPS + Nginx + Cloudflare
related_docs:
  - database_schema.sql
  - pagos_y_comisiones.md
  - flujo_de_reserva.md
  - cancelaciones_y_reembolsos.md
  - notificaciones.md
  - mensajeria.md
  - verificacion_de_identidad.md
  - verificamex_integracion.md
  - paquetes_colaborativos.md
  - normativa_mexicana_2026.md
  - roles_y_permisos.md
---

# PRD — Backend (Node.js + Express + MariaDB)

> Plataforma eventos — Marketplace de servicios para eventos en México.
> Este documento es el contrato de requisitos del backend. Está diseñado para ser leído y analizado por humanos y por agentes de IA (opencode, etc.). Cada requisito tiene ID estable, prioridad, criterios de aceptación y fuente de trazabilidad.

## Cómo leer este PRD

- **IDs**: `BR-XXX.NN` — estables, referenciables por agentes y tareas.
- **Prioridad**: `Must` (obligatorio MVP) | `Should` (importante) | `Could` (deseable/diferido).
- **Fuente**: documento de producto original que origina el requisito.
- **Open Questions**: tabla `BQ-XXX` — decisiones abiertas; las resueltas en diseño están marcadas con su decisión D-XXX.

## Revision Notes

| Versión | Cambio |
|---------|--------|
| 1.2.0 | Design decisions D-011..D-014 resolved: Agora for voice/video (D-005), BullMQ for jobs (D-011), backend file upload proxy (D-012), Zustand+localStorage persistence (D-013), Socket.IO client config (D-014). Dark mode and map view deferred to post-MVP. Open questions BQ-003, BQ-008 closed. |
| 1.1.0 | Stack decisions (commit b887f08): auth JWT propia (no Firebase), Socket.IO chat, voice/video in MVP (PeerJS/Agora), CFDI diferido. Decisiones de diseño D-001..D-010 resueltas en design.md |

---

## BR-001: API Surface — REST Resource Endpoints

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-001.1 | Must | Define REST endpoints for all 30+ domain entities | Every table in database_schema.sql has at least one corresponding route | database_schema.sql |
| BR-001.2 | Must | Use plural nouns for resource collections (`/reservations`, `/services`, `/users`) | No singular resource paths except for sub-resources | REST convention |
| BR-001.3 | Must | Support standard HTTP methods: GET (read), POST (create), PUT/PATCH (update), DELETE (soft/hard) | Methods map correctly to CRUD operations | database_schema.sql |
| BR-001.4 | Must | Return JSON responses with consistent envelope: `{ data, meta, errors }` | All endpoints use same shape | gaps §4 |
| BR-001.5 | Must | Implement pagination for list endpoints: `?page=1&limit=20` with `meta: { total, page, limit, pages }` | Lists return paginated results | gaps §4 |
| BR-001.6 | Should | Support filtering via query params: `?service_type=salon&status=publicado` | Search endpoint accepts 8+ filter dimensions | interfaces_cliente.md |
| BR-001.7 | Should | Support sorting: `?sort=rating:desc&sort=price:asc` | Results ordered by specified fields | gaps §4 |
| BR-001.8 | Must | Use versioning prefix: `/api/v1/...` | All endpoints under /api/v1 | gaps §4 |

## BR-002: Authentication & Authorization

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-002.1 | Must | Verify backend-issued JWT on every protected endpoint | Requests without valid JWT return 401 | Updated: JWT propia (commit b887f08) |
| BR-002.2 | Must | Extract user ID and role from verified JWT payload | `req.user.id`, `req.user.role`, `req.user.segment` available in middleware | roles_y_permisos.md |
| BR-002.3 | Must | Enforce 3 roles: `usuario`, `prestador`, `administrador` | Role-based middleware rejects unauthorized access with 403 | roles_y_permisos.md |
| BR-002.4 | Must | Admin endpoints gated to exactly 5 functions: moderation, provider management, stats, technical disputes, commission | Admin cannot access non-admin routes; non-admin cannot access admin routes | roles_y_permisos.md |
| BR-002.5 | Must | Provider verification required before publishing services | `verified = true` checked at service publish; reject with descriptive error | verificacion_de_identidad.md |
| BR-002.6 | Must | Soft-deleted users (deleted_at set) cannot authenticate | JWT verification checks deleted_at is NULL | LFPDPPP/ARCO |
| BR-002.7 | Must | Issue JWT on login (POST /api/auth/login) and support refresh flow | Backend issues tokens; refresh endpoint validates and rotates | Updated: JWT propia (commit b887f08) |

## BR-003: Error Model

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-003.1 | Must | Return structured error responses: `{ error: { code, message, details? } }` | All errors follow same shape | gaps §4 |
| BR-003.2 | Must | Use standard HTTP status codes: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 409 (conflict), 422 (unprocessable), 500 (server) | Status codes match error type | gaps §4 |
| BR-003.3 | Must | Include machine-readable error codes: `RESERVATION_SLOT_CONFLICT`, `PROVIDER_NOT_VERIFIED`, `PAYMENT_FAILED` | Frontend can programmatically handle errors | gaps §4 |
| BR-003.4 | Should | Log all 500 errors with stack trace and request context | Server errors logged for debugging | gaps §4 |

## BR-004: Data Model — MariaDB Schema Mapping

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-004.1 | Must | Map all 30+ tables from database_schema.sql to Prisma models | Every table has a corresponding model | database_schema.sql |
| BR-004.2 | Must | Use `DECIMAL(10,2)` for all MXN monetary amounts | No floating-point for money | database_schema.sql |
| BR-004.3 | Must | Use ENUM types for closed sets (roles, statuses, payment types, notification types) | DB enums match application enums | database_schema.sql |
| BR-004.4 | Must | Use JSON columns for free-form payloads (scope, notification payload, cancellation_policy_snapshot) | JSON columns parseable by application | database_schema.sql |
| BR-004.5 | Must | Implement soft delete (deleted_at) on users and services tables | Soft-deleted records excluded from queries by default | LFPDPPP/ARCO |
| BR-004.6 | Must | Use ON DELETE RESTRICT for all FKs except junction tables (CASCADE) | No accidental data loss on parent deletion | database_schema.sql |
| BR-004.7 | Must | Create migration strategy: versioned SQL migrations, up/down pairs, idempotent | Migrations runnable in any environment | gaps §4 |
| BR-004.8 | Should | Seed data: default amenities, event types, initial commission rate | Platform usable after migration | database_schema.sql |
| BR-004.9 | Must | Maintain 2 materialized views: `v_provider_ranking`, `v_slot_availability` | Views queryable via API | database_schema.sql |

> **Decisión de diseño (D-001)**: Prisma — adopta el schema de 1051 líneas por `prisma db pull` (introspection), sin reescritura. Verificar ENUMs tras introspectar.

## BR-005: Business Logic — Reservas

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-005.1 | Must | Implement 13-state reservation lifecycle: creado → invitaciones_pendientes → ... → completada/cancelada | State transitions enforced, invalid transitions rejected | flujo_de_reserva.md |
| BR-005.2 | Must | Validate slot availability transactionally at booking time | Concurrent bookings for same slot = one succeeds, one rejected | flujo_de_reserva.md |
| BR-005.3 | Must | Salon concurrency forced to 1 (app-level, not DB constraint) | Only one active reservation per salon slot | flujo_de_reserva.md |
| BR-005.4 | Must | Generate reservation_status_history on every status change (via trigger or application logic) | Audit trail complete for every reservation | database_schema.sql |
| BR-005.5 | Must | Snapshot cancellation policy into reservation at creation time | `cancellation_policy_snapshot` populated | cancelaciones_y_reembolsos.md |
| BR-005.6 | Must | Calculate total_price = base_amount + extras_amount + taxes_amount + commission_amount | Price breakdown correct and stored | pagos_y_comisiones.md |
| BR-005.7 | Should | Support package reservations with multiple reservation_items | Package creates linked reservation_items per member | paquetes_colaborativos.md |
| BR-005.8 | Must | Alcohol permit flow: if requested, pause state at permiso_alcohol until H-5 decision | State machine halts at alcohol permit step | flujo_de_reserva.md |

> **Decisión de diseño (D-007)**: pricing dinámico computado solo al reservar (frozen al confirmar), sin precios stale.

## BR-006: Business Logic — Pagos & Comisiones

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-006.1 | Must | Integrate Conekta server-side SDK for payment processing (MXN only) | Charges created via Conekta API, charge_id stored | pagos_y_comisiones.md |
| BR-006.2 | Must | Support 3 payment types: anticipo, saldo, deposito_garantia | Each type processed correctly | pagos_y_comisiones.md |
| BR-006.3 | Must | Commission: latest commission_settings row = current rate | Rate applied to each payment | pagos_y_comisiones.md |
| BR-006.4 | Must | Commission summed into visible price (client sees rent + taxes; provider sees full price) | Price calculation matches specification | pagos_y_comisiones.md |
| BR-006.5 | Must | Currency CHECK = 'MXN' enforced at application and DB level | No non-MXN payments accepted | pagos_y_comisiones.md |
| BR-006.6 | Must | Support flexible billing: (1) mandatory advance, (2) full pre-event, (3) post-service | Billing model configurable per reservation | pagos_y_comisiones.md |
| BR-006.7 | Could | Generate CFDI per processed payment | Invoice record created with cfdi_uuid | **Deferred**: "por el momento CFDI queda pendiente" (user instruction). Requirement kept for future implementation. |
| BR-006.8 | Must | Monthly tax report per provider: transactions, gross, taxes, commission, net | Report queryable by admin and provider | pagos_y_comisiones.md |

## BR-007: Business Logic — Cancelaciones & Reembolsos

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-007.1 | Must | Client cancellation: advance is non-refundable; near cancellation applies provider policy | Retention percentage and window enforced | cancelaciones_y_reembolsos.md |
| BR-007.2 | Must | Provider cancellation: FULL refund of advance + deposit + additional payments | Automatic refund processing + client notification | cancelaciones_y_reembolsos.md |
| BR-007.3 | Must | Retention acceptance required before processing near cancellation | `retention_accepted = true` checked | cancelaciones_y_reembolsos.md |
| BR-007.4 | Must | Application order on cancellation: advance → deposit → other payments | Refunds applied in correct order | cancelaciones_y_reembolsos.md |
| BR-007.5 | Must | Refund reasons: cancelacion_proveedor, cancelacion_cliente, deposito_devolucion, politica_proveedor, permiso_alcohol_no_confirmado | Correct reason recorded | cancelaciones_y_reembolsos.md |
| BR-007.6 | Should | Generate refund via Conekta API and update payment status to reembolsado | Conekta refund initiated, payment status updated | pagos_y_comisiones.md |

## BR-008: Business Logic — Mensajería

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-008.1 | Must | Persist all text messages with sender, timestamp, read_at | Messages stored in messages table | mensajeria.md |
| BR-008.2 | Must | Support voice notes: max 120s duration, audio_url, duration_seconds | DB CHECK constraint enforced | mensajeria.md |
| BR-008.3 | Must | conversations UNIQUE on (client_id, provider_id, service_id) | No duplicate conversation threads | mensajeria.md |
| BR-008.4 | Should | Implement quick replies for providers | CRUD for quick_replies table | mensajeria.md |
| BR-008.5 | Should | Implement scheduled messages: 4 automation types | Messages queued and sent at correct trigger | mensajeria.md |
| BR-008.6 | Must | Messages searchable and accessible post-event | Messages queryable by conversation | mensajeria.md |

> **Decisión de diseño (D-006)**: Socket.IO — auth JWT en handshake, rooms por conversación, persistir-antes-broadcast. Ver PRD de Integración.

## BR-009: Business Logic — Notificaciones

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-009.1 | Must | Implement 16 notification types across 3 channels (push, email, in_app) | All types sendable | notificaciones.md |
| BR-009.2 | Must | Critical notifications (contract, payment, cancellation) use ≥2 channels | Multi-channel dispatch for critical events | notificaciones.md |
| BR-009.3 | Must | Notification status tracking: pendiente → enviada → leida | Status transitions enforced | notificaciones.md |
| BR-009.4 | Should | Push notification integration (FCM) | Push delivery functional | D-003 |
| BR-009.5 | Should | Email notification integration (Resend) | Email delivery functional | D-003 |
| BR-009.6 | Must | Event reminders: H-48 push+email, H-2 push, both parties | Timing and channels correct | notificaciones.md |

## BR-010: Business Logic — Verificación de Identidad

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-010.1 | Must | Verification mandatory for providers (blocks publication) | Provider cannot publish until verified | verificacion_de_identidad.md |
| BR-010.2 | Must | Verification voluntary for clients (badge display) | Client can optionally verify | verificacion_de_identidad.md |
| BR-010.3 | Must | INE presencial method: physical delivery + contract signing | Method supported in system | verificacion_de_identidad.md |
| BR-010.4 | Must | KYC remote method: Verificamex (primary), Truora (mid), Veriff (high) | All 3 providers configurable | verificamex_integracion.md |
| BR-010.5 | Must | Verificamex integration: REST API, POST, 10s timeout, API key auth | API calls succeed or timeout handled | verificamex_integracion.md |
| BR-010.6 | Must | Identity verification logs ONLY metadata (no CURP, no name, no OCR data stored) | No PII in identity_verifications beyond metadata | LFPDPPP |
| BR-010.7 | Must | Explicit consent required before identity verification | consent_logs entry created before verification | LFPDPPP |

## BR-011: Business Logic — Paquetes Colaborativos

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-011.1 | Must | Only salons can create/lead packages | Service type validation on package creation | paquetes_colaborativos.md |
| BR-011.2 | Must | 7-state package lifecycle: creado → invitaciones_pendientes → ... → reservado → completado | State transitions enforced | paquetes_colaborativos.md |
| BR-011.3 | Must | Cross-slot availability verification before publish | All member slots checked atomically | paquetes_colaborativos.md |
| BR-011.4 | Must | Price auto-computed: sum of member prices + extras + taxes + hidden platform fee | Price calculation correct | paquetes_colaborativos.md |
| BR-011.5 | Should | Member rejection → leader can invite replacement of same type | Invitation replacement supported | paquetes_colaborativos.md |

## BR-012: Regulatory Compliance — Mexican Law 2026

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-012.1 | Must | LFPDPPP: explicit consent before data collection | consent_logs table used for all consents | normativa_mexicana_2026.md |
| BR-012.2 | Must | LFPDPPP: ARCO rights support (Access, Rectify, Cancel, Oppose) | arco_requests table with 20 business-day deadline | normativa_mexicana_2026.md |
| BR-012.3 | Must | LFPDPPP: no INE/biometric data persisted | identity_verifications stores metadata only | normativa_mexicana_2026.md |
| BR-012.4 | Must | Ley Consumer: clear price breakdown before booking confirmation | Price summary shown to client pre-payment | normativa_mexicana_2026.md |
| BR-012.5 | Must | Ley Consumer: cancellation policy visible before booking | Policy displayed and accepted before reservation | normativa_mexicana_2026.md |
| BR-012.6 | Must | Código Comercio: valid electronic contracts | Bilateral confirmation + digital preservation | normativa_mexicana_2026.md |
| BR-012.7 | Could | SAT/CFDI: digital tax receipts per payment | CFDI generation and storage | **Deferred**: "por el momento CFDI queda pendiente" (user instruction). Requirement kept as documented constraint for future implementation. |
| BR-012.8 | Must | Comercio Electrónico: T&C before transaction | Terms acceptance logged | normativa_mexicana_2026.md |
| BR-012.9 | Should | COFEPRIS: sanitary self-declaration for catering | Declaration field on service creation | normativa_mexicana_2026.md |
| BR-012.10 | Should | NOM-151: electronic document preservation for contracts | Contract scan retention strategy defined | normativa_mexicana_2026.md |

## BR-013: Integrations

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-013.1 | Must | Conekta server-side SDK: charges, refunds, webhooks | Payment lifecycle managed via Conekta API | pagos_y_comisiones.md |
| BR-013.2 | Must | Verificamex REST API: POST with API key, 10s timeout | KYC verification functional | verificamex_integracion.md |
| BR-013.3 | Must | Backend JWT verification (jsonwebtoken library) | Backend validates its own issued tokens | Updated: JWT propia (commit b887f08) |
| BR-013.4 | Should | Push notification provider integration (FCM) | Push delivery functional | D-003 |
| BR-013.5 | Should | Email provider integration (Resend) | Email delivery functional | D-003 |
| BR-013.6 | Should | File storage (local disk MVP, Cloudflare R2 migration path) for photos, voice notes, contract scans | File upload/download functional | D-004 |

## BR-014: Non-Functional Requirements

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-014.1 | Must | Health check endpoint: GET /api/v1/health | Returns 200 with DB connectivity status | gaps §4 |
| BR-014.2 | Must | Request logging: method, path, status, duration, user_id | All requests logged | gaps §4 |
| BR-014.3 | Must | Rate limiting on auth endpoints | Brute-force protection | gaps §4 |
| BR-014.4 | Should | Database connection pooling | Pool configured for concurrent requests | gaps §4 |
| BR-014.5 | Should | Graceful shutdown: drain connections, close pool | SIGTERM handling | gaps §4 |
| BR-014.6 | Must | Backup strategy for MariaDB | Automated backups configured | gaps §4 |
| BR-014.7 | Should | Audit logs for all state-changing operations | audit_logs populated | database_schema.sql |

## Open Questions / Decisions Needed

| ID | Question | Impact | Resolution |
|----|----------|--------|-----------|
| BQ-001 | Which ORM/query builder? | Dev speed, type safety | **Resuelto**: Prisma (D-001) |
| BQ-002 | File storage: local, S3, or R2? | Cost, scalability | **Resuelto**: local + Nginx MVP (D-004), migración R2 |
| BQ-003 | Job queue for scheduled messages? | Reliability | **Resuelto**: BullMQ + Redis (D-011) |
| BQ-004 | Push provider: FCM vs OneSignal? | Cost, features | **Resuelto**: FCM (D-003) |
| BQ-005 | Email provider: SendGrid vs Mailgun? | Cost, deliverability | **Resuelto**: Resend (D-003) |
| BQ-007 | Search: SQL vs full-text engine? | Performance | **Resuelto**: SQL WHERE + índices (D-002) |
| BQ-008 | Voice/video: PeerJS (WebRTC) vs Agora? | Scope, cost | **Resuelto**: Agora (D-005) — managed, global CDN, free tier 10K min/month |
| BQ-009 | Dynamic pricing timing: search, booking, or both? | UX, performance | **Resuelto**: al reservar (D-007) |
| BQ-011 | CFDI generation — deferred. When re-activated, external SAT library or third-party service? | Compliance | **Diferido** — revisar cuando CFDI se priorice |

## Traceability Matrix

| Requirement | Source Document |
|-------------|----------------|
| BR-001 | gaps §4 (API contracts needed) |
| BR-002 | roles_y_permisos.md, verificacion_de_identidad.md, LFPDPPP |
| BR-003 | gaps §4 (error model undefined) |
| BR-004 | database_schema.sql (all 30+ tables) |
| BR-005 | flujo_de_reserva.md, database_schema.sql |
| BR-006 | pagos_y_comisiones.md |
| BR-007 | cancelaciones_y_reembolsos.md |
| BR-008 | mensajeria.md |
| BR-009 | notificaciones.md |
| BR-010 | verificacion_de_identidad.md, verificamex_integracion.md |
| BR-011 | paquetes_colaborativos.md |
| BR-012 | normativa_mexicana_2026.md (all 9 regulatory entries) |
| BR-013 | Multiple docs (Conekta, Verificamex); JWT auth (commit b887f08) |
| BR-014 | gaps §4 (non-functional requirements) |

## Referencias de diseño resueltas

| Decisión | Elección | Detalle |
|----------|----------|---------|
| D-001 | Prisma | Introspecta `database_schema.sql` (1051 líneas); verificar ENUMs |
| D-002 | SQL WHERE + índices | 8+ filtros; <10K servicios sub-50ms |
| D-003 | FCM + Resend | Push + email; costos VPS-scale |
| D-004 | Local + Nginx | Signed URLs; migración R2 lista |
| D-005 | Agora | Managed voice/video; global CDN; free tier 10K min/month |
| D-006 | Socket.IO | Auth JWT handshake, rooms por conversación, persistir-antes-broadcast |
| D-007 | Pricing al reservar | Frozen al confirmar |
| D-008 | Capas routes → services → integrations | Testable, thin routes |
| D-011 | BullMQ + Redis | Job queue para scheduled messages; 64MB Redis, allkeys-lru |
| D-012 | Backend proxy (multer) | File upload validation, signed URLs, /data/uploads/ |
| D-013 | Zustand + localStorage | Auth + UI preferences; booking flow via React Query |
| D-014 | Socket.IO client config | Auto-reconnect (exp backoff), JWT auth, rooms, heartbeat |

## Decisions Register

| ID | Decision | Rationale | Tradeoffs | Status |
|----|----------|-----------|-----------|--------|
| D-001 | Prisma ORM | Introspects 1051-line SQL schema; type-safe; migration workflow | Heavier than raw SQL; learning curve | CLOSED |
| D-002 | SQL WHERE + indexes | 8+ filter dimensions map to WHERE clauses; sub-50ms at <10K services | Full-text search deferred | CLOSED |
| D-003 | FCM + Resend | Free tiers cover MVP; simple API | Vendor dependency; FCM requires Firebase project | CLOSED |
| D-004 | Local disk + Nginx | Zero cost; signed URLs via HMAC | Single VPS; manual scaling | CLOSED |
| D-005 | Agora | Managed; global CDN; no TURN server ops | Per-minute cost at scale ($0.99/1K voice min) | CLOSED |
| D-006 | Socket.IO | Bidirectional; reliable delivery; JWT auth on handshake | Memory per connection; VPS scale acceptable | CLOSED |
| D-007 | Compute at booking | No stale prices; simple | Slight UX disconnect (base price in search) | CLOSED |
| D-008 | Layered backend | Routes → Services → Integrations; testable | More files; cleaner separation | CLOSED |
| D-009 | Adopt frontend-architecture.md | Feature-based structure; React Query for server state | Tailwind + Radix UI assumed | CLOSED |
| D-010 | Docker Compose + Nginx + Cloudflare | Same-origin; WebSocket support; origin cert | Single VPS; manual scaling | CLOSED |
| D-011 | BullMQ + Redis | Reliable job scheduling; retries; persists across restarts | Requires Redis (~30MB RAM) | CLOSED |
| D-012 | Backend file upload proxy | Validates MIME/size; signed URLs; no client-to-storage exposure | Backend bandwidth for uploads | CLOSED |
| D-013 | Zustand + localStorage | Auth persistence; UI preferences; booking flow via React Query | localStorage size limits (5MB) | CLOSED |
| D-014 | Socket.IO client config | Auto-reconnect with exp backoff; JWT auth; room management | Ephemeral connection state (not persisted) | CLOSED |
