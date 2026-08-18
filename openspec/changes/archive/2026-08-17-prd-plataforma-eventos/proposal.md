# Proposal: PRD Plataforma Eventos — Backend, Frontend & Unification

## Intent

Transform 16+ product documentation files and a comprehensive database schema into three machine-readable Product Requirements Documents (PRDs) that define the complete system. The existing docs describe WHAT the platform does but lack implementation contracts (no API spec, no auth spec, no deployment spec, no real-time spec). These PRDs bridge that gap. **Stack decisions resolved** (commit b887f08): React + Vite frontend, Node.js + Express + MariaDB backend, JWT auth (no Firebase), Socket.IO for chat, Agora for voice/video. **Design decisions resolved** (v1.2.0): Agora chosen, BullMQ for jobs, file upload proxy, Socket.IO client config, dark mode/map view deferred.

## Scope

### In Scope
- Backend PRD (Node.js + Express + MariaDB): API surface, data model, business logic, integrations, regulatory compliance
- Frontend PRD (React + Vite): Screen requirements, UX flows, architecture conventions, state management
- Unification PRD: API contracts, deployment topology, auth flow, real-time architecture, CI/CD, security

### Out of Scope
- Implementation code or source files
- Database migration scripts (deferred to design)
- Specific UI component library choices (Radix UI assumed from frontend-architecture.md)
- CFDI generation implementation details (deferred — user instruction: "por el momento CFDI queda pendiente")

## Capabilities

### New Capabilities
- `backend-prd`: Complete backend system requirements — API surface, MariaDB schema mapping, business logic, integrations, regulatory
- `frontend-prd`: Complete frontend system requirements — screens, UX flows, architecture, state management, regulatory UX
- `unification-prd`: Cross-cutting integration requirements — API contracts, auth flow, deployment, security, observability, real-time

### Modified Capabilities
None — this is a net-new documentation deliverable, not a change to existing behavior.

## Approach

Three structured PRD documents with:
- YAML frontmatter (id, title, version, status, audience, stack, related_docs)
- Stable section anchors (## Backend-PRD, ### BR-001 format)
- Numbered requirement IDs: BR-xxx (backend), FR-xxx (frontend), UR-xxx (unification)
- Each requirement: ID, priority (Must/Should/Could), description, acceptance criteria, dependencies, source
- Traceability matrix per PRD
- Open questions / decisions-needed section per PRD

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/changes/prd-plataforma-eventos/proposal.md` | New | This proposal with 3 embedded PRDs |
| `openspec/specs/` | Referenced | 16 domain specs used as source material |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PRDs may be incomplete if docs contradict each other | Medium | Resolved stack decisions (commit b887f08) provide authoritative baseline |
| Voice/video call cost at scale (Agora per-minute pricing) | Low | Free tier 10K min/month covers MVP; migration to self-hosted WebRTC possible if cost exceeds threshold |
| PRD size may challenge reviewer cognitive load | Medium | Machine-readable format enables AI-assisted review |

## Rollback Plan

Delete `openspec/changes/prd-plataforma-eventos/proposal.md`. No code or data changes — this is documentation only.

## Dependencies

- Exploration artifact (`exploration.md`) — fully consumed
- 16 existing domain specs in `openspec/specs/` — referenced as sources
- Stack decisions committed in b887f08 — JWT auth, Socket.IO chat, voice/video in MVP, CFDI deferred

## Success Criteria

- [ ] Three PRDs with >80% traceability to source documentation
- [ ] Every requirement has acceptance criteria
- [x] Stack decisions reflected in all PRD frontmatters (JWT auth, Socket.IO, Agora voice/video)
- [x] Open questions section captures all unresolved design decisions → all product/design questions now resolved (v1.2.0)
- [ ] Machine-parsable format (stable anchors, explicit IDs, no prose-only walls)

---

# PRD 1 — BACKEND (Node.js + Express + MariaDB)

```yaml
---
id: backend-prd
title: "Backend System Requirements — Plataforma Eventos"
version: "1.1.0"
status: draft
audience: backend-engineers, ai-agents
stack:
  runtime: Node.js + Express
  database: MariaDB 10.6+ / MySQL 8.0+
  auth: JWT (backend-issued, POST /api/auth/login)
  payments: Conekta (MXN)
  deploy: Docker
related_docs:
  - database_schema.md
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
```

## Backend-PRD

### BR-001: API Surface — REST Resource Endpoints

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-001.1 | Must | Define REST endpoints for all 30+ domain entities | Every table in database_schema.md has at least one corresponding route | database_schema.md |
| BR-001.2 | Must | Use plural nouns for resource collections (`/reservations`, `/services`, `/users`) | No singular resource paths except for sub-resources | REST convention |
| BR-001.3 | Must | Support standard HTTP methods: GET (read), POST (create), PUT/PATCH (update), DELETE (soft/hard) | Methods map correctly to CRUD operations | database_schema.md |
| BR-001.4 | Must | Return JSON responses with consistent envelope: `{ data, meta, errors }` | All endpoints use same shape | gaps §4 |
| BR-001.5 | Must | Implement pagination for list endpoints: `?page=1&limit=20` with `meta: { total, page, limit, pages }` | Lists return paginated results | gaps §4 |
| BR-001.6 | Should | Support filtering via query params: `?service_type=salon&status=publicado` | Search endpoint accepts 8+ filter dimensions | interfaces_cliente.md |
| BR-001.7 | Should | Support sorting: `?sort=rating:desc&sort=price:asc` | Results ordered by specified fields | gaps §4 |
| BR-001.8 | Must | Use versioning prefix: `/api/v1/...` | All endpoints under /api/v1 | gaps §4 |

### BR-002: Authentication & Authorization

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-002.1 | Must | Verify backend-issued JWT on every protected endpoint | Requests without valid JWT return 401 | Updated: JWT propia (commit b887f08) |
| BR-002.2 | Must | Extract user ID and role from verified JWT payload | `req.user.id`, `req.user.role`, `req.user.segment` available in middleware | roles_y_permisos.md |
| BR-002.3 | Must | Enforce 3 roles: `usuario`, `prestador`, `administrador` | Role-based middleware rejects unauthorized access with 403 | roles_y_permisos.md |
| BR-002.4 | Must | Admin endpoints gated to exactly 5 functions: moderation, provider management, stats, technical disputes, commission | Admin cannot access non-admin routes; non-admin cannot access admin routes | roles_y_permisos.md |
| BR-002.5 | Must | Provider verification required before publishing services | `verified = true` checked at service publish; reject with descriptive error | verificacion_de_identidad.md |
| BR-002.6 | Must | Soft-deleted users (deleted_at set) cannot authenticate | JWT verification checks deleted_at is NULL | LFPDPPP/ARCO |
| BR-002.7 | Must | Issue JWT on login (POST /api/auth/login) and support refresh flow | Backend issues tokens; refresh endpoint validates and rotates | Updated: JWT propia (commit b887f08) |

### BR-003: Error Model

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-003.1 | Must | Return structured error responses: `{ error: { code, message, details? } }` | All errors follow same shape | gaps §4 |
| BR-003.2 | Must | Use standard HTTP status codes: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 409 (conflict), 422 (unprocessable), 500 (server) | Status codes match error type | gaps §4 |
| BR-003.3 | Must | Include machine-readable error codes: `RESERVATION_SLOT_CONFLICT`, `PROVIDER_NOT_VERIFIED`, `PAYMENT_FAILED` | Frontend can programmatically handle errors | gaps §4 |
| BR-003.4 | Should | Log all 500 errors with stack trace and request context | Server errors logged for debugging | gaps §4 |

### BR-004: Data Model — MariaDB Schema Mapping

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-004.1 | Must | Map all 30+ tables from database_schema.sql to Prisma models | Every table has a corresponding model | database_schema.sql, D-001 |
| BR-004.2 | Must | Use `DECIMAL(10,2)` for all MXN monetary amounts | No floating-point for money | database_schema.md |
| BR-004.3 | Must | Use ENUM types for closed sets (roles, statuses, payment types, notification types) | DB enums match application enums | database_schema.md |
| BR-004.4 | Must | Use JSON columns for free-form payloads (scope, notification payload, cancellation_policy_snapshot) | JSON columns parseable by application | database_schema.md |
| BR-004.5 | Must | Implement soft delete (deleted_at) on users and services tables | Soft-deleted records excluded from queries by default | LFPDPPP/ARCO |
| BR-004.6 | Must | Use ON DELETE RESTRICT for all FKs except junction tables (CASCADE) | No accidental data loss on parent deletion | database_schema.md |
| BR-004.7 | Must | Create migration strategy: versioned SQL migrations, up/down pairs, idempotent | Migrations runnable in any environment | gaps §4 |
| BR-004.8 | Should | Seed data: default amenities, event types, initial commission rate | Platform usable after migration | database_schema.md |
| BR-004.9 | Must | Maintain 2 materialized views: `v_provider_ranking`, `v_slot_availability` | Views queryable via API | database_schema.md |

### BR-005: Business Logic — Reservas

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-005.1 | Must | Implement 13-state reservation lifecycle: creado → invitaciones_pendientes → ... → completada/cancelada | State transitions enforced, invalid transitions rejected | flujo_de_reserva.md |
| BR-005.2 | Must | Validate slot availability transactionally at booking time | Concurrent bookings for same slot = one succeeds, one rejected | flujo_de_reserva.md |
| BR-005.3 | Must | Salon concurrency forced to 1 (app-level, not DB constraint) | Only one active reservation per salon slot | flujo_de_reserva.md |
| BR-005.4 | Must | Generate reservation_status_history on every status change (via trigger or application logic) | Audit trail complete for every reservation | database_schema.md |
| BR-005.5 | Must | Snapshot cancellation policy into reservation at creation time | `cancellation_policy_snapshot` populated | cancelaciones_y_reembolsos.md |
| BR-005.6 | Must | Calculate total_price = base_amount + extras_amount + taxes_amount + commission_amount | Price breakdown correct and stored | pagos_y_comisiones.md |
| BR-005.7 | Should | Support package reservations with multiple reservation_items | Package creates linked reservation_items per member | paquetes_colaborativos.md |
| BR-005.8 | Must | Alcohol permit flow: if requested, pause state at permiso_alcohol until H-5 decision | State machine halts at alcohol permit step | flujo_de_reserva.md |

### BR-006: Business Logic — Pagos & Comisiones

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-006.1 | Must | Integrate Conekta server-side SDK for payment processing (MXN only) | Charges created via Conekta API, charge_id stored | pagos_y_comisiones.md |
| BR-006.2 | Must | Support 3 payment types: anticipo, saldo, deposito_garantia | Each type processed correctly | pagos_y_comisiones.md |
| BR-006.3 | Must | Commission: latest commission_settings row = current rate | Rate applied to each payment | pagos_y_comisiones.md |
| BR-006.4 | Must | Commission summed into visible price (client sees rent + taxes; provider sees full price) | Price calculation matches specification | pagos_y_comisiones.md |
| BR-006.5 | Must | Currency CHECK = 'MXN' enforced at application and DB level | No non-MXN payments accepted | pagos_y_comisiones.md |
| BR-006.6 | Must | Support flexible billing: (1) mandatory advance, (2) full pre-event, (3) post-service | Billing model configurable per reservation | pagos_y_comisiones.md |
| BR-006.7 | Could | Generate CFDI per processed payment | Invoice record created with cfdi_uuid | Deferred: "por el momento CFDI queda pendiente" (user instruction). Requirement kept for future implementation. |
| BR-006.8 | Must | Monthly tax report per provider: transactions, gross, taxes, commission, net | Report queryable by admin and provider | pagos_y_comisiones.md |

### BR-007: Business Logic — Cancelaciones & Reembolsos

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-007.1 | Must | Client cancellation: advance is non-refundable; near cancellation applies provider policy | Retention percentage and window enforced | cancelaciones_y_reembolsos.md |
| BR-007.2 | Must | Provider cancellation: FULL refund of advance + deposit + additional payments | Automatic refund processing + client notification | cancelaciones_y_reembolsos.md |
| BR-007.3 | Must | Retention acceptance required before processing near cancellation | `retention_accepted = true` checked | cancelaciones_y_reembolsos.md |
| BR-007.4 | Must | Application order on cancellation: advance → deposit → other payments | Refunds applied in correct order | cancelaciones_y_reembolsos.md |
| BR-007.5 | Must | Refund reasons: cancelacion_proveedor, cancelacion_cliente, deposito_devolucion, politica_proveedor, permiso_alcohol_no_confirmado | Correct reason recorded | cancelaciones_y_reembolsos.md |
| BR-007.6 | Should | Generate refund via Conekta API and update payment status to reembolsado | Conekta refund initiated, payment status updated | pagos_y_comisiones.md |

### BR-008: Business Logic — Mensajería

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-008.1 | Must | Persist all text messages with sender, timestamp, read_at | Messages stored in messages table | mensajeria.md |
| BR-008.2 | Must | Support voice notes: max 120s duration, audio_url, duration_seconds | DB CHECK constraint enforced | mensajeria.md |
| BR-008.3 | Must | conversations UNIQUE on (client_id, provider_id, service_id) | No duplicate conversation threads | mensajeria.md |
| BR-008.4 | Should | Implement quick replies for providers | CRUD for quick_replies table | mensajeria.md |
| BR-008.5 | Should | Implement scheduled messages: 4 automation types | Messages queued and sent at correct trigger | mensajeria.md |
| BR-008.6 | Must | Messages searchable and accessible post-event | Messages queryable by conversation | mensajeria.md |

### BR-009: Business Logic — Notificaciones

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-009.1 | Must | Implement 16 notification types across 3 channels (push, email, in_app) | All types sendable | notificaciones.md |
| BR-009.2 | Must | Critical notifications (contract, payment, cancellation) use ≥2 channels | Multi-channel dispatch for critical events | notificaciones.md |
| BR-009.3 | Must | Notification status tracking: pendiente → enviada → leida | Status transitions enforced | notificaciones.md |
| BR-009.4 | Should | Push notification integration (provider TBD: FCM or OneSignal) | Push delivery functional | gaps §4 |
| BR-009.5 | Should | Email notification integration (provider TBD: SendGrid or Mailgun) | Email delivery functional | gaps §4 |
| BR-009.6 | Must | Event reminders: H-48 push+email, H-2 push, both parties | Timing and channels correct | notificaciones.md |

### BR-010: Business Logic — Verificación de Identidad

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-010.1 | Must | Verification mandatory for providers (blocks publication) | Provider cannot publish until verified | verificacion_de_identidad.md |
| BR-010.2 | Must | Verification voluntary for clients (badge display) | Client can optionally verify | verificacion_de_identidad.md |
| BR-010.3 | Must | INE presencial method: physical delivery + contract signing | Method supported in system | verificacion_de_identidad.md |
| BR-010.4 | Must | KYC remote method: Verificamex (primary), Truora (mid), Veriff (high) | All 3 providers configurable | verificamex_integracion.md |
| BR-010.5 | Must | Verificamex integration: REST API, POST, 10s timeout, API key auth | API calls succeed or timeout handled | verificamex_integracion.md |
| BR-010.6 | Must | Identity verification logs ONLY metadata (no CURP, no name, no OCR data stored) | No PII in identity_verifications beyond metadata | LFPDPPP |
| BR-010.7 | Must | Explicit consent required before identity verification | consent_logs entry created before verification | LFPDPPP |

### BR-011: Business Logic — Paquetes Colaborativos

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-011.1 | Must | Only salons can create/lead packages | Service type validation on package creation | paquetes_colaborativos.md |
| BR-011.2 | Must | 7-state package lifecycle: creado → invitaciones_pendientes → ... → reservado → completado | State transitions enforced | paquetes_colaborativos.md |
| BR-011.3 | Must | Cross-slot availability verification before publish | All member slots checked atomically | paquetes_colaborativos.md |
| BR-011.4 | Must | Price auto-computed: sum of member prices + extras + taxes + hidden platform fee | Price calculation correct | paquetes_colaborativos.md |
| BR-011.5 | Should | Member rejection → leader can invite replacement of same type | Invitation replacement supported | paquetes_colaborativos.md |

### BR-012: Regulatory Compliance — Mexican Law 2026

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-012.1 | Must | LFPDPPP: explicit consent before data collection | consent_logs table used for all consents | normativa_mexicana_2026.md |
| BR-012.2 | Must | LFPDPPP: ARCO rights support (Access, Rectify, Cancel, Oppose) | arco_requests table with 20 business-day deadline | normativa_mexicana_2026.md |
| BR-012.3 | Must | LFPDPPP: no INE/biometric data persisted | identity_verifications stores metadata only | normativa_mexicana_2026.md |
| BR-012.4 | Must | Ley Consumer: clear price breakdown before booking confirmation | Price summary shown to client pre-payment | normativa_mexicana_2026.md |
| BR-012.5 | Must | Ley Consumer: cancellation policy visible before booking | Policy displayed and accepted before reservation | normativa_mexicana_2026.md |
| BR-012.6 | Must | Código Comercio: valid electronic contracts | Bilateral confirmation + digital preservation | normativa_mexicana_2026.md |
| BR-012.7 | Could | SAT/CFDI: digital tax receipts per payment | CFDI generation and storage | Deferred: "por el momento CFDI queda pendiente" (user instruction). Requirement kept as documented constraint for future implementation. |
| BR-012.8 | Must | Comercio Electrónico: T&C before transaction | Terms acceptance logged | normativa_mexicana_2026.md |
| BR-012.9 | Should | COFEPRIS: sanitary self-declaration for catering | Declaration field on service creation | normativa_mexicana_2026.md |
| BR-012.10 | Should | NOM-151: electronic document preservation for contracts | Contract scan retention strategy defined | normativa_mexicana_2026.md |

### BR-013: Integrations

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-013.1 | Must | Conekta server-side SDK: charges, refunds, webhooks | Payment lifecycle managed via Conekta API | pagos_y_comisiones.md |
| BR-013.2 | Must | Verificamex REST API: POST with API key, 10s timeout | KYC verification functional | verificamex_integracion.md |
| BR-013.3 | Must | Backend JWT verification (jsonwebtoken library or equivalent) | Backend validates its own issued tokens | Updated: JWT propia (commit b887f08) |
| BR-013.4 | Should | Push notification provider integration (FCM or OneSignal) | Push delivery functional | notificaciones.md |
| BR-013.5 | Should | Email provider integration (SendGrid or Mailgun) | Email delivery functional | notificaciones.md |
| BR-013.6 | Should | File storage (S3, Cloudflare R2, or local) for photos, voice notes, contract scans | File upload/download functional | gaps §4 |

### BR-014: Non-Functional Requirements

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| BR-014.1 | Must | Health check endpoint: GET /api/v1/health | Returns 200 with DB connectivity status | gaps §4 |
| BR-014.2 | Must | Request logging: method, path, status, duration, user_id | All requests logged | gaps §4 |
| BR-014.3 | Must | Rate limiting on auth endpoints | Brute-force protection | gaps §4 |
| BR-014.4 | Should | Database connection pooling | Pool configured for concurrent requests | gaps §4 |
| BR-014.5 | Should | Graceful shutdown: drain connections, close pool | SIGTERM handling | gaps §4 |
| BR-014.6 | Must | Backup strategy for MariaDB | Automated backups configured | gaps §4 |
| BR-014.7 | Should | Audit logs for all state-changing operations | audit_logs populated | database_schema.md |

### Backend-PRD: Open Questions / Decisions Needed

| ID | Question | Impact | Recommended Resolution |
|----|----------|--------|----------------------|
| BQ-001 | Which ORM/query builder: Sequelize, Knex, Prisma, or raw SQL? | Development speed, type safety | Design phase decision |
| BQ-002 | File storage: local filesystem, S3, or Cloudflare R2? | Cost, scalability, reliability | Design phase decision |
| BQ-003 | Job queue for scheduled messages: BullMQ, node-cron, or in-process? | Reliability, scalability | **Resuelto**: BullMQ + Redis (D-011) |
| BQ-004 | Push notification provider: FCM vs OneSignal? | Cost, feature set | Design phase decision |
| BQ-005 | Email provider: SendGrid vs Mailgun? | Cost, deliverability | Design phase decision |
| BQ-007 | Search implementation: raw SQL queries vs full-text search engine? | Performance, complexity | Design phase decision |
| BQ-008 | Voice/video calls: PeerJS (WebRTC) vs Agora (third-party)? | Scope, cost, complexity | **Resuelto**: Agora (D-005) — managed, global CDN, free tier 10K min/month |
| BQ-009 | Dynamic pricing evaluation timing: at search, at booking, or both? | UX, performance | Product decision |
| BQ-011 | CFDI generation: deferred per user instruction. When re-activated, external SAT library or third-party service? | Compliance, complexity | Deferred — revisit when CFDI is prioritized |

### Backend-PRD: Traceability Matrix

| Requirement | Source Document |
|-------------|----------------|
| BR-001 | gaps §4 (API contracts needed) |
| BR-002 | roles_y_permisos.md, verificacion_de_identidad.md, LFPDPPP |
| BR-003 | gaps §4 (error model undefined) |
| BR-004 | database_schema.md (all 30+ tables) |
| BR-005 | flujo_de_reserva.md, database_schema.md |
| BR-006 | pagos_y_comisiones.md |
| BR-007 | cancelaciones_y_reembolsos.md |
| BR-008 | mensajeria.md |
| BR-009 | notificaciones.md |
| BR-010 | verificacion_de_identidad.md, verificamex_integracion.md |
| BR-011 | paquetes_colaborativos.md |
| BR-012 | normativa_mexicana_2026.md (all 9 regulatory entries) |
| BR-013 | Multiple docs (Conekta, Verificamex); JWT auth (commit b887f08) |
| BR-014 | gaps §4 (non-functional requirements) |

---

# PRD 2 — FRONTEND (React + Vite)

```yaml
---
id: frontend-prd
title: "Frontend System Requirements — Plataforma Eventos"
version: "1.1.0"
status: draft
audience: frontend-engineers, ai-agents
stack:
  framework: React 18
  bundler: Vite 5
  routing: React Router v6
  state: Zustand
  styling: Tailwind CSS + Radix UI
  auth: JWT (backend-issued via POST /api/auth/login)
  chat: Socket.IO (lib/socket.ts)
  payments: Conekta.js
  deploy: Static build → Docker/Nginx
related_docs:
  - interfaces_cliente.md
  - interfaces_proveedor.md
  - frontend-architecture.md
  - flujo_de_reserva.md
  - cancelaciones_y_reembolsos.md
  - notificaciones.md
  - mensajeria.md
  - verificacion_de_identidad.md
  - roles_y_permisos.md
---
```

## Frontend-PRD

### FR-001: Information Architecture — Client

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-001.1 | Must | 5-tab bottom navigation: Inicio, Favoritos, Rentas, Chat, Perfil | Tabs render correctly, active state indicated | interfaces_cliente.md |
| FR-001.2 | Must | Secondary navigation on Inicio: Salones / Sonidos / Servicios | Category filter tabs visible on home | interfaces_cliente.md |
| FR-001.3 | Must | Role-based routing: client routes guarded, provider routes separate | Unauthorized access redirects to correct layout | roles_y_permisos.md |
| FR-001.4 | Must | AppLayout component for client-facing pages | Layout wraps all client routes | frontend-architecture.md |
| FR-001.5 | Should | Deep linking: service detail, booking flow state, reservation detail | Direct URL access works | gaps §5 |

### FR-002: Information Architecture — Provider

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-002.1 | Must | ProviderLayout component for dashboard pages | Layout wraps all provider routes | frontend-architecture.md |
| FR-002.2 | Must | 5-tab dashboard: Hoy, Mensajes, Calendario, Anuncios, Estadísticas | All tabs functional | interfaces_proveedor.md |
| FR-002.3 | Must | Onboarding wizard (3 steps) with auto-save between steps | Step 1 (type/location), Step 2 (photos/description), Step 3 (pricing/policies) | interfaces_proveedor.md |
| FR-002.4 | Must | Onboarding resumes on app close (localStorage or API) | Incomplete onboarding detected and resumed | interfaces_proveedor.md |
| FR-002.5 | Should | Tax calculator: auto-calculate, simulate, breakdown | Calculator accessible from dashboard | interfaces_proveedor.md |
| FR-002.6 | Should | Monthly report: transactions, gross, taxes, commission, net, CFDI | Report downloadable/viewable | interfaces_proveedor.md |

### FR-003: Information Architecture — Admin

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-003.1 | Must | AdminLayout component for admin pages | Layout wraps all admin routes | frontend-architecture.md |
| FR-003.2 | Must | Admin has exactly 5 functions: moderation, provider management, stats, technical disputes, commission | Admin UI limited to these functions | roles_y_permisos.md |
| FR-003.3 | Must | Commission configuration interface | Admin can set global commission rate | pagos_y_comisiones.md |

### FR-004: Search & Discovery

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-004.1 | Must | Search with 8+ filter dimensions: date, capacity, zone, budget, event type, pool, internet, rating | All filters functional | interfaces_cliente.md |
| FR-004.2 | Must | Filter state persists across navigation | Filters retained when returning to search | interfaces_cliente.md |
| FR-004.3 | Must | Results display: photo, title, rating, price, capacity, location | All fields shown in list view | interfaces_cliente.md |
| FR-004.4 | Should | Map view for results (if applicable) | Map renders with service markers | interfaces_cliente.md |

### FR-005: Service Detail

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-005.1 | Must | Gallery: minimum 5 photos, swipeable | Photos render, min 5 enforced | interfaces_cliente.md |
| FR-005.2 | Must | Display: pricing, rating, amenities, extras, available time slots | All fields render correctly | interfaces_cliente.md |
| FR-005.3 | Must | Cancellation policy displayed on service detail | Policy section visible before booking | cancelaciones_y_reembolsos.md |
| FR-005.4 | Must | Reviews section: 1-5 stars, comment | Reviews displayed per service | interfaces_cliente.md |
| FR-005.5 | Must | Favorite toggle: add/remove from favorites | Heart icon toggles, state persisted | interfaces_cliente.md |
| FR-005.6 | Should | Availability calendar showing open slots | Calendar component with slot data | flujo_de_reserva.md |

### FR-006: Booking Flow

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-006.1 | Must | Step 1: Select date and time block | Date/time picker functional | flujo_de_reserva.md |
| FR-006.2 | Must | Step 2: Select extras (if available) | Extras selection with prices | flujo_de_reserva.md |
| FR-006.3 | Must | Step 3: Price summary with breakdown | Client sees rent + taxes (no commission) | pagos_y_comisiones.md |
| FR-006.4 | Must | Step 4: Payment via Conekta.js | Conekta.js integration functional | pagos_y_comisiones.md |
| FR-006.5 | Must | Step 5: Contract signing (salon only) | Presential contract flow triggered | flujo_de_reserva.md |
| FR-006.6 | Must | Step 6: Confirmation | Reservation status updated, confirmation shown | flujo_de_reserva.md |
| FR-006.7 | Must | Price summary shows cancellation policy | Policy visible before payment | cancelaciones_y_reembolsos.md |
| FR-006.8 | Must | Alcohol permit prompt (if applicable) at H-5 | Prompt shown with continue/cancel choice | flujo_de_reserva.md |
| FR-006.9 | Should | Booking flow state preserved on navigation back | State maintained across back navigation | gaps §5 |

### FR-007: Cancellation & Refund UX

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-007.1 | Must | Client can cancel reservation from detail screen | Cancel action available | cancelaciones_y_reembolsos.md |
| FR-007.2 | Must | Near cancellation: show retention policy, require acceptance | Policy displayed, checkbox/tap required | cancelaciones_y_reembolsos.md |
| FR-007.3 | Must | Provider cancellation: automatic full refund notification | Client notified of refund | cancelaciones_y_reembolsos.md |
| FR-007.4 | Should | Refund status displayed in reservation detail | Refund tracking visible | cancelaciones_y_reembolsos.md |

### FR-008: Notifications Display

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-008.1 | Must | In-app notification center | Notifications listed with read/unread state | notificaciones.md |
| FR-008.2 | Must | Critical notifications highlighted (contract, payment, cancellation) | Visual distinction for critical notifications | notificaciones.md |
| FR-008.3 | Must | Notification badges on navigation tabs | Badge count shown | notificaciones.md |
| FR-008.4 | Should | Push notification handling (browser/mobile) | Push notifications received and displayed | notificaciones.md |
| FR-008.5 | Must | Event reminders: H-48, H-2 | Reminders shown at correct times | notificaciones.md |

### FR-009: Messaging UI

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-009.1 | Must | Chat thread: client ↔ provider | Conversation list + detail view | mensajeria.md |
| FR-009.2 | Must | Real-time message delivery via Socket.IO (lib/socket.ts) | Messages appear without refresh | Updated: Socket.IO decision (commit b887f08) |
| FR-009.3 | Must | Voice note recording and playback (max 120s) | Record button, duration display, playback | mensajeria.md |
| FR-009.4 | Should | Quick replies selector (provider) | Quick reply picker in chat input | mensajeria.md |
| FR-009.5 | Must | Message read receipts (read_at display) | Read status shown | mensajeria.md |
| FR-009.6 | Should | Scheduled messages displayed in thread | System messages appear at trigger time | mensajeria.md |

### FR-010: Verification Flows

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-010.1 | Must | Provider verification prompt on first login (if not verified) | Onboarding detects unverified state | verificacion_de_identidad.md |
| FR-010.2 | Must | KYC verification flow: consent → capture → result | Full flow functional | verificacion_de_identidad.md |
| FR-010.3 | Must | Verification badge display on provider profile | Badge shown if verified | verificacion_de_identidad.md |
| FR-010.4 | Must | Client voluntary verification option | Client can initiate verification | verificacion_de_identidad.md |

### FR-011: Provider Onboarding & Dashboard

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-011.1 | Must | 3-step onboarding wizard with progress indicator | Steps clearly marked, progress saved | interfaces_proveedor.md |
| FR-011.2 | Must | Step 1: Service type, location, capacity | Form fields correct per service type | interfaces_proveedor.md |
| FR-011.3 | Must | Step 2: Photos (min 5), title, description | Photo upload with min 5 validation | interfaces_proveedor.md |
| FR-011.4 | Must | Step 3: Pricing, policies, cancellation, deposit | Pricing form per service type | interfaces_proveedor.md |
| FR-011.5 | Must | Hoy tab: urgent alerts, weekly summary, reminders, quick actions | Dashboard shows actionable items | interfaces_proveedor.md |
| FR-011.6 | Must | Calendario tab: monthly/weekly view, slot inventory, date blocking | Calendar functional | interfaces_proveedor.md |
| FR-011.7 | Must | Anuncios tab: edit photos, description, rules, cancellation policy | Listing management | interfaces_proveedor.md |
| FR-011.8 | Must | Estadísticas tab: payment history, earnings, response/acceptance rate, rating | Stats display correct | interfaces_proveedor.md |
| FR-011.9 | Should | Dynamic pricing configuration on calendar | Pricing rules editable | interfaces_proveedor.md |

### FR-012: Favorites & Rental History

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-012.1 | Must | Favorites list: persistent across sessions | Favorites synced with backend | interfaces_cliente.md |
| FR-012.2 | Must | Rental history tabs: Active, In-progress, Completed, Cancelled | All tabs functional | interfaces_cliente.md |
| FR-012.3 | Must | Review enabled only when payment complete AND event_date < now | Review form conditionally shown | cancelaciones_y_reembolsos.md |

### FR-013: State Management

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-013.1 | Must | Zustand stores: authStore, uiStore | Core stores implemented | frontend-architecture.md |
| FR-013.2 | Must | Feature-based stores in feature directories | Each feature manages own state | frontend-architecture.md |
| FR-013.3 | Must | Auth state: JWT, user profile, role | Auth state accessible globally | frontend-architecture.md |
| FR-013.4 | Should | Server state caching (React Query or similar) | API responses cached | gaps §5 |

### FR-014: API Client Layer

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-014.1 | Must | Centralized API client with JWT attachment | All requests include Authorization header | frontend-architecture.md |
| FR-014.2 | Must | Error handling interceptor | API errors displayed to user | frontend-architecture.md |
| FR-014.3 | Must | Request/response type definitions (TypeScript) | Types match backend shapes | frontend-architecture.md |
| FR-014.4 | Should | Request retry logic for transient failures | Retries on 5xx with backoff | gaps §5 |

### FR-015: Design System & Responsive Behavior

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-015.1 | Must | Tailwind CSS utility-first styling | All components use Tailwind | frontend-architecture.md |
| FR-015.2 | Must | Radix UI for accessible primitives | Dialog, dropdown, toast, etc. | frontend-architecture.md |
| FR-015.3 | Must | Responsive: mobile-first, break at tablet/desktop | Layout adapts to screen size | frontend-architecture.md |
| FR-015.4 | Must | Icon system: consistent icon set across app | Icons render correctly | frontend-architecture.md |
| FR-015.5 | Should | Dark mode support (if planned) | Theme toggle functional | gaps §5 |

### FR-016: Regulatory UX

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-016.1 | Must | Privacy consent modal before first data collection | Consent screen shown on first visit | normativa_mexicana_2026.md |
| FR-016.2 | Must | Terms & conditions acceptance before transaction | T&C modal before booking | normativa_mexicana_2026.md |
| FR-016.3 | Must | Price breakdown visible before payment confirmation | Full price shown (rent + taxes) | normativa_mexicana_2026.md |
| FR-016.4 | Must | Cancellation policy displayed before booking | Policy section in booking flow | normativa_mexicana_2026.md |
| FR-016.5 | Should | ARCO rights request form accessible from profile | Form to request data access/deletion | normativa_mexicana_2026.md |
| FR-016.6 | Must | Cookie consent banner | Banner shown, choice recorded | normativa_mexicana_2026.md |

### FR-017: Routing

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-017.1 | Must | React Router v6 with nested routes | Route tree matches IA structure | frontend-architecture.md |
| FR-017.2 | Must | Protected routes: redirect unauthenticated to login | Auth guard functional | frontend-architecture.md |
| FR-017.3 | Must | Role-based route guards: client/provider/admin | Correct layout rendered per role | frontend-architecture.md |
| FR-017.4 | Should | Lazy loading for feature routes | Code splitting working | frontend-architecture.md |

### Frontend-PRD: Open Questions / Decisions Needed

| ID | Question | Impact | Recommended Resolution |
|----|----------|--------|----------------------|
| FQ-004 | File upload: direct to S3/R2 or through backend? | Security, performance | **Resuelto**: backend proxy (D-012) — multer validates MIME/size, saves to disk, returns signed URL |
| FQ-005 | State persistence: how much UI state saved to localStorage? | UX | **Resuelto**: Zustand + localStorage for auth/UI prefs; booking flow via React Query (D-013) |
| FQ-006 | Offline support: any offline-first features? | Complexity | MVP: no offline support |
| FQ-007 | Voice/video calls: PeerJS (WebRTC, self-hosted) vs Agora (managed, per-minute cost)? | Scope, cost | **Resuelto**: Agora (D-005) — managed, global CDN, no TURN server ops |
| FQ-008 | Socket.IO client version and configuration (reconnection, rooms, auth middleware)? | Real-time reliability | **Resuelto**: auto-reconnect exp backoff, JWT auth, room management (D-014) |

### Frontend-PRD: Traceability Matrix

| Requirement | Source Document |
|-------------|----------------|
| FR-001 | interfaces_cliente.md (client IA) |
| FR-002 | interfaces_proveedor.md (provider IA) |
| FR-003 | roles_y_permisos.md (admin functions) |
| FR-004 | interfaces_cliente.md (search/filter) |
| FR-005 | interfaces_cliente.md (service detail) |
| FR-006 | flujo_de_reserva.md, pagos_y_comisiones.md |
| FR-007 | cancelaciones_y_reembolsos.md |
| FR-008 | notificaciones.md |
| FR-009 | mensajeria.md |
| FR-010 | verificacion_de_identidad.md, verificamex_integracion.md |
| FR-011 | interfaces_proveedor.md (dashboard + onboarding) |
| FR-012 | interfaces_cliente.md (favorites + history) |
| FR-013 | frontend-architecture.md (state management) |
| FR-014 | frontend-architecture.md (API client) |
| FR-015 | frontend-architecture.md (design system) |
| FR-016 | normativa_mexicana_2026.md (UX compliance) |
| FR-017 | frontend-architecture.md (routing) |

---

# PRD 3 — UNIFICATION (Frontend + Backend Integration & Deployment)

```yaml
---
id: unification-prd
title: "Integration & Deployment Requirements — Plataforma Eventos"
version: "1.1.0"
status: draft
audience: full-stack-engineers, devops, ai-agents
stack:
  frontend: React 18 + Vite 5
  backend: Node.js + Express
  database: MariaDB 10.6+
  auth: JWT (backend-issued)
  chat: Socket.IO
  voice_video: PeerJS (WebRTC) or Agora
  payments: Conekta
  deploy: Docker + VPS + Nginx + Cloudflare
related_docs:
  - frontend-architecture.md
  - database_schema.md
  - normativa_mexicana_2026.md
  - gaps §6 (unification concerns)
---
```

## Unification-PRD

### UR-001: API Contract — Request/Response Shapes

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-001.1 | Must | Standard response envelope: `{ data: T, meta?: { total, page, limit, pages }, errors?: [{ code, message, details? }] }` | All endpoints use same shape | gaps §6 |
| UR-001.2 | Must | JSON Content-Type on all responses | `Content-Type: application/json` header | gaps §6 |
| UR-001.3 | Must | Request body: JSON for POST/PUT/PATCH | No form-encoded bodies | gaps §6 |
| UR-001.4 | Must | Query params for filtering, pagination, sorting | Standardized param names | gaps §6 |
| UR-001.5 | Must | ID format: integer auto-increment (MariaDB) | IDs consistent across API | database_schema.md |
| UR-001.6 | Should | Date/time format: ISO 8601 strings | Consistent date handling | gaps §6 |

### UR-002: API Contract — Endpoints Catalog

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-002.1 | Must | Auth endpoints: POST /auth/register, POST /auth/login, POST /auth/logout, GET /auth/me (backend-issued JWT) | All 4 functional; backend owns authentication | Updated: JWT propia (commit b887f08) |
| UR-002.2 | Must | User endpoints: GET/PUT /users/me, POST /users/verify-ine, POST /users/verify-kyc | Profile + verification functional | gaps §6 |
| UR-002.3 | Must | Service CRUD: GET/POST/PUT/DELETE /services, GET /services/search, GET /services/:id/slots | Full CRUD + search | gaps §6 |
| UR-002.4 | Must | Pricing CRUD: /services/:id/pricing, /services/:id/extras, /services/:id/dynamic-rules | All pricing types supported | gaps §6 |
| UR-002.5 | Must | Inventory: /services/:id/slots, /services/:id/blocks, /services/:id/hours | Slot + block + hours management | gaps §6 |
| UR-002.6 | Must | Package endpoints: POST /packages, POST /packages/:id/invite, PUT /packages/:id/members/:id/respond, GET /packages/:id/availability | Package lifecycle | gaps §6 |
| UR-002.7 | Must | Reservation endpoints: POST /reservations, GET /reservations, PUT /reservations/:id/status, GET /reservations/:id/timeline | Booking flow | gaps §6 |
| UR-002.8 | Must | Contract: GET /contracts/:id, PUT /contracts/:id/confirm | Contract flow | gaps §6 |
| UR-002.9 | Must | Payment: POST /payments, GET /payments/:id, POST /payments/:id/refund | Payment lifecycle | gaps §6 |
| UR-002.10 | Must | Messaging: GET /conversations, GET/POST /conversations/:id/messages | Chat functional | gaps §6 |
| UR-002.11 | Must | Notifications: GET /notifications, PUT /notifications/:id/read | Notification center | gaps §6 |
| UR-002.12 | Must | Reviews: POST /reviews, GET /services/:id/reviews | Review system | gaps §6 |
| UR-002.13 | Must | Favorites: POST /favorites, DELETE /favorites/:id | Favorites sync | gaps §6 |
| UR-002.14 | Must | Admin: /admin/stats, /admin/commission, /admin/disputes, /admin/moderation | All 5 admin functions | gaps §6 |

### UR-003: Auth Token Flow

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-003.1 | Must | Client registers via POST /auth/register (backend handles user creation + JWT issuance) | User created in MariaDB, JWT returned | Updated: JWT propia (commit b887f08) |
| UR-003.2 | Must | Client logs in via POST /api/auth/login (backend validates credentials, issues JWT) | JWT returned on success; 401 on failure | Updated: JWT propia (commit b887f08) |
| UR-003.3 | Must | Frontend stores JWT in Zustand authStore and sends in `Authorization: Bearer <token>` header | All API requests include token | frontend-architecture.md |
| UR-003.4 | Must | Backend verifies JWT signature and expiration on every protected endpoint | Invalid/expired tokens rejected with 401 | Updated: JWT propia (commit b887f08) |
| UR-003.5 | Must | Backend extracts user ID, role, segment from JWT claims | `req.user` populated | roles_y_permisos.md |
| UR-003.6 | Must | Role-based middleware gates access | 403 returned for unauthorized roles | roles_y_permisos.md |
| UR-003.7 | Must | Token refresh: POST /auth/refresh validates current JWT and issues new one | Seamless refresh without re-login | Updated: JWT propia (commit b887f08) |

### UR-004: Error Handling Contract

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-004.1 | Must | Backend returns structured errors: `{ error: { code, message, details? } }` | Frontend can parse and display | BR-003 |
| UR-004.2 | Must | Frontend handles 401 → redirect to login | Auth errors caught globally | gaps §6 |
| UR-004.3 | Must | Frontend handles 403 → show "unauthorized" message | Forbidden errors displayed | gaps §6 |
| UR-004.4 | Must | Frontend handles 422 → display validation errors per field | Form validation errors shown | gaps §6 |
| UR-004.5 | Should | Frontend handles 500 → show generic error, log details | Server errors handled gracefully | gaps §6 |

### UR-005: Environment & Configuration Management

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-005.1 | Must | Environment variables for all secrets: JWT_SECRET, Conekta API key, Verificamex API key, DB connection | No secrets in code | Updated: JWT propia (commit b887f08) |
| UR-005.2 | Must | Separate .env files per environment: .env.development, .env.staging, .env.production | Environment isolation | gaps §6 |
| UR-005.3 | Must | Frontend env vars prefixed with `VITE_` | Vite can expose to client bundle | gaps §6 |
| UR-005.4 | Must | Backend env vars NOT exposed to frontend | Server-only secrets protected | gaps §6 |
| UR-005.5 | Should | Config validation on startup (e.g., Joi, zod) | Missing config fails fast | gaps §6 |

### UR-006: Deployment Topology

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-006.1 | Must | Docker: frontend static build + backend container | Both containers deployable | gaps §6 |
| UR-006.2 | Must | VPS: single server deployment | All services on one VPS | gaps §6 |
| UR-006.3 | Must | Nginx: serves frontend static files AND reverse proxies /api/* to backend | Static + API on same domain | gaps §6 |
| UR-006.4 | Must | Cloudflare: DNS proxy, SSL/TLS termination, DDoS protection | HTTPS enforced via Cloudflare | gaps §6 |
| UR-006.5 | Must | Single origin: frontend and API on same domain (Nginx routes) | No CORS needed for same-origin | gaps §6 |
| UR-006.6 | Should | Docker Compose for local development | `docker compose up` works | gaps §6 |
| UR-006.7 | Should | Production Dockerfile optimized (multi-stage build, non-root user) | Small image, secure | gaps §6 |

### UR-007: CI/CD Requirements

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-007.1 | Must | Automated tests on push | CI pipeline runs tests | gaps §4 |
| UR-007.2 | Must | Linting and type checking | No lint errors in CI | gaps §4 |
| UR-007.3 | Should | Automated build verification | Docker build succeeds in CI | gaps §4 |
| UR-007.4 | Should | Deployment pipeline: push to main → build → deploy | Continuous deployment functional | gaps §4 |
| UR-007.5 | Should | Database migration step in deployment | Migrations run automatically on deploy | gaps §4 |

### UR-008: Security

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-008.1 | Must | Secrets never in code or version control | .gitignore excludes .env files | gaps §6 |
| UR-008.2 | Must | Security headers via Nginx: X-Content-Type-Options, X-Frame-Options, CSP, HSTS | Headers present on responses | gaps §6 |
| UR-008.3 | Must | Rate limiting on backend (especially auth endpoints) | Brute-force protection | gaps §6 |
| UR-008.4 | Must | CORS configured for development (separate origins) | Frontend can call backend in dev | gaps §6 |
| UR-008.5 | Must | Input validation on all endpoints | SQL injection, XSS prevented | gaps §6 |
| UR-008.6 | Should | Helmet.js or equivalent security middleware | Security headers set | gaps §6 |
| UR-008.7 | Should | Dependency vulnerability scanning | No known critical CVEs | gaps §4 |

### UR-009: Real-Time Architecture — Chat, Voice/Video & Notifications

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-009.1 | Must | Real-time text chat via Socket.IO | Messages delivered bidirectionally in real-time | Updated: Socket.IO decision (commit b887f08) |
| UR-009.2 | Must | Voice/video calls via PeerJS (WebRTC) or Agora | Call initiation, connection, and termination functional | Updated: Voice/video in MVP (commit b887f08) |
| UR-009.3 | Must | Notification delivery via push/email/in_app channels | Notifications dispatched per type/channel spec | notificaciones.md |
| UR-009.4 | Must | Voice note upload and playback (pre-recorded, not real-time streaming) | Voice notes upload and play | mensajeria.md |

**Decided Architecture: Socket.IO for real-time chat.**

Socket.IO chosen over alternatives for chat. Frontend client at `lib/socket.ts`.

| Approach | Status | Notes |
|----------|--------|-------|
| **Socket.IO** | **DECIDED** for chat | Low latency, bidirectional, reliable delivery. Server memory per connection — acceptable for VPS scale. |
| Firebase Realtime DB | REJECTED | Vendor lock-in, separate data store, inconsistent with Express+MariaDB backend |
| Server-Sent Events (SSE) | Not selected | One-directional only, insufficient for chat |
| Polling | Not selected | High latency, wasted bandwidth |

**Voice/Video: Agora — DECIDED for MVP.**

| Approach | Pros | Cons |
|----------|------|------|
| PeerJS (WebRTC) | Free, self-hosted, no per-minute cost | Requires STUN/TURN server, limited scalability, browser-dependent |
| **Agora** | Managed, reliable, global CDN, SDKs | Per-minute cost, vendor dependency |

**Decision (D-005)**: Agora chosen. Managed, global CDN, no TURN server ops. Free tier 10K min/month covers MVP.

### UR-010: Observability & Operations

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-010.1 | Must | Health check endpoint: GET /api/v1/health | Returns 200 with DB status | BR-014.1 |
| UR-010.2 | Must | Application logging: structured JSON logs | Logs queryable by level | gaps §4 |
| UR-010.3 | Must | Error logging: all 5xx errors with context | Errors traceable | BR-014.2 |
| UR-010.4 | Must | Database backup: automated daily backups | Backups restorable | BR-014.6 |
| UR-010.5 | Should | Process manager: PM2 or systemd | Auto-restart on crash | gaps §6 |
| UR-010.6 | Should | Log rotation | Logs don't fill disk | gaps §6 |
| UR-010.7 | Should | Rollback plan: previous Docker image tag preserved | Can revert to last working version | gaps §6 |

### UR-011: API Versioning

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-011.1 | Must | URL-based versioning: `/api/v1/...` | All endpoints versioned | BR-001.8 |
| UR-011.2 | Should | Version upgrade strategy documented | Process for breaking changes defined | gaps §6 |

### UR-012: File Upload & Storage

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-012.1 | Must | Photo upload for services (min 5 photos) | Photos uploadable and stored | interfaces_proveedor.md |
| UR-012.2 | Must | Voice note upload (max 120s audio) | Audio files uploadable | mensajeria.md |
| UR-012.3 | Should | Contract scan/photo storage | Contract documents stored | normativa_mexicana_2026.md |
| UR-012.4 | Must | File access: private URLs with signed tokens | Files not publicly accessible | gaps §6 |

### Unification-PRD: Open Questions / Decisions Needed

| ID | Question | Impact | Recommended Resolution |
|----|----------|--------|----------------------|
| UQ-002 | Push notification provider: FCM vs OneSignal? | Cost, features | **Resuelto**: FCM (D-003) |
| UQ-003 | Email provider: SendGrid vs Mailgun? | Cost, deliverability | **Resuelto**: Resend (D-003) |
| UQ-004 | File storage: S3 vs Cloudflare R2 vs local? | Cost, scalability | **Resuelto**: local + Nginx MVP (D-004), migración R2 |
| UQ-005 | Cloudflare: DNS-only or full proxy (Orange cloud)? | SSL, DDoS, performance | **Resuelto**: full proxy (D-010) — origin cert on VPS, SSL mode Full (Strict) |
| UQ-006 | Voice/video: PeerJS (WebRTC, free) vs Agora (managed, per-minute)? | Scope, cost | **Resuelto**: Agora (D-005) — managed, global CDN, no TURN server ops |
| UQ-007 | Search: SQL LIKE/regex vs full-text engine? | Performance, complexity | **Resuelto**: SQL + índices (D-002), upgrade si necesario |
| UQ-008 | CDN for static assets: Cloudflare + Nginx vs standalone CDN? | Cost, performance | Cloudflare proxy handles this |
| UQ-009 | Socket.IO middleware: auth verification on connection? | Security | **Resuelto**: verificar JWT en handshake (D-006) |

### Unification-PRD: Traceability Matrix

| Requirement | Source Document |
|-------------|----------------|
| UR-001 | gaps §6 (API contracts needed) |
| UR-002 | gaps §6 (endpoint catalog from exploration) |
| UR-003 | roles_y_permisos.md, frontend-architecture.md; Updated: JWT propia (commit b887f08) |
| UR-004 | BR-003 (error model), gaps §6 |
| UR-005 | gaps §6 (env vars needed) |
| UR-006 | gaps §6 (deployment topology) |
| UR-007 | gaps §4 (CI/CD undefined) |
| UR-008 | gaps §6 (security), normativa_mexicana_2026.md |
| UR-009 | mensajeria.md, notificaciones.md, gaps §4 |
| UR-010 | BR-014 (non-functional), gaps §4 |
| UR-011 | BR-001.8 (API versioning) |
| UR-012 | mensajeria.md, interfaces_proveedor.md |

---

## Proposal Question Round

Since this is an auto-mode execution, the following assumptions need user review:

1. **Auth**: JWT owned by backend (POST /api/auth/login). No Firebase dependency for authentication. Backend issues, verifies, and refreshes tokens.

2. **Voice/video calls**: IN SCOPE for MVP. Agora chosen (D-005) — managed, global CDN, free tier 10K min/month. No self-hosted TURN server needed.

3. **Real-time chat**: Socket.IO decided (commit b887f08). Frontend client at `lib/socket.ts`. Backend Socket.IO middleware for auth verification resolved (D-006).

4. **CFDI**: DEFERRED per user instruction ("por el momento CFDI queda pendiente"). Requirements retained as Could priority with documented constraint for future implementation.

5. **File storage**: Backend proxy with multer (D-012) — validates MIME/size, saves to disk, returns signed URLs. Migration to Cloudflare R2 prepared.

---

## Revision Notes

### v1.2.0 (2026-08-14) — Design decisions resolved (D-011..D-014)

**Changes based on**: Design phase resolving remaining open questions.

| Section | Requirement ID | Change |
|---------|---------------|--------|
| Proposal header | Intent | Added design decisions resolved summary (Agora, BullMQ, file upload, Socket.IO) |
| Proposal header | Risks | Voice/video risk updated from "scope" to "cost at scale" (Agora pricing) |
| Proposal Question Round | Item 2 | PeerJS/Agora → Agora decided (D-005) |
| Proposal Question Round | Item 3 | Auth middleware "deferred" → "resolved (D-006)" |
| Proposal Question Round | Item 5 | "deferred to design" → backend proxy (D-012) |
| Backend PRD | BQ-003 | "Pendiente de diseño" → BullMQ + Redis (D-011) |
| Backend PRD | BQ-008 | PeerJS/Agora → Agora (D-005) |
| Frontend PRD | FR-004.4 | "Should" → "Could" — map view deferred to post-MVP |
| Frontend PRD | FR-015.5 | "Should" → "Could" — dark mode deferred to post-MVP |
| Frontend PRD | FQ-004 | "Pendiente de diseño" → backend proxy (D-012) |
| Frontend PRD | FQ-005 | "Pendiente de diseño" → Zustand + localStorage (D-013) |
| Frontend PRD | FQ-007 | PeerJS/Agora → Agora (D-005) |
| Frontend PRD | FQ-008 | "Pendiente de diseño" → Socket.IO client config (D-014) |
| Unification PRD | UQ-005 | "Recomendado: full proxy" → Resuelto (D-010) |
| Unification PRD | UQ-006 | PeerJS/Agora → Agora (D-005) |
| Unification PRD | UR-009.2 | "PeerJS (WebRTC) or Agora" → "Agora (managed, global CDN)" |
| Unification PRD | Voice/Video table | PeerJS rejected; Agora DECIDED |
| Exploration | Voice/Video | Updated to reflect Agora decision |

### v1.1.0 (2026-08-14) — Stack decisions resolved (commit b887f08)

**Changes based on**: Commit b887f08 "docs: actualiza stack de implementacion y limpia referencias deprecated" + user instruction.

| Section | Requirement ID | Change |
|---------|---------------|--------|
| Backend YAML | stack.auth | `Firebase Auth (JWT verification)` → `JWT (backend-issued, POST /api/auth/login)` |
| Backend PRD | BR-002.1 | `Verify Firebase JWT` → `Verify backend-issued JWT`; source updated to "JWT propia" |
| Backend PRD | BR-002.7 | `Should | Support token refresh flow (Firebase handles client-side refresh)` → `Must | Issue JWT on login and support refresh flow`; priority elevated, description updated |
| Backend PRD | BR-006.7 | `Should | Generate CFDI` → `Could | Generate CFDI`; priority lowered, source updated to deferred with user instruction quote |
| Backend PRD | BR-012.7 | `Must | SAT/CFDI: digital tax receipts` → `Could | SAT/CFDI: digital tax receipts`; priority lowered, source updated to deferred |
| Backend PRD | BR-013.3 | `Firebase Admin SDK: JWT verification` → `Backend JWT verification (jsonwebtoken library)`; source updated |
| Backend PRD | BQ-006 | REMOVED (CFDI deferred) |
| Backend PRD | BQ-008 | `Voice/video calls: included in MVP or deferred?` → `Voice/video calls: PeerJS vs Agora?`; resolved to in-scope |
| Backend PRD | BQ-011 | ADDED: CFDI deferred, revisit when prioritized |
| Backend Traceability | BR-013 | Source updated to remove Firebase reference |
| Frontend YAML | stack.auth | `Firebase Auth` → `JWT (backend-issued via POST /api/auth/login)` |
| Frontend YAML | stack.chat | ADDED: `Socket.IO (lib/socket.ts)` |
| Frontend PRD | FR-009.2 | `Real-time message delivery (architecture TBD: WebSocket, SSE, or polling)` → `Real-time message delivery via Socket.IO (lib/socket.ts)` |
| Frontend PRD | FQ-001 | REMOVED (Firebase auth question resolved) |
| Frontend PRD | FQ-002 | REMOVED (Socket.IO decided) |
| Frontend PRD | FQ-003 | REMOVED (voice/video in MVP) |
| Frontend PRD | FQ-007 | ADDED: PeerJS vs Agora decision |
| Frontend PRD | FQ-008 | ADDED: Socket.IO client config |
| Unification YAML | stack.auth | `Firebase Auth` → `JWT (backend-issued)` |
| Unification YAML | stack.chat | ADDED: `Socket.IO` |
| Unification YAML | stack.voice_video | ADDED: `PeerJS (WebRTC) or Agora` |
| Unification PRD | UR-002.1 | Added "(backend-issued JWT)" to auth endpoints |
| Unification PRD | UR-003.1-3.07 | FULL REWRITE: Firebase Auth SDK → backend-issued JWT flow |
| Unification PRD | UR-005.1 | Removed Firebase config from env vars; JWT_SECRET retained |
| Unification PRD | UR-009 | FULL REWRITE: Socket.IO decided for chat; PeerJS/Agora for voice/video IN SCOPE |
| Unification PRD | UQ-001 | REMOVED (Socket.IO decided) |
| Unification PRD | UQ-006 | `Voice/video calls: WebRTC? Third-party? Deferred?` → `PeerJS vs Agora?`; resolved to in-scope |
| Unification PRD | UQ-009 | ADDED: Socket.IO auth middleware |
| Unification Traceability | UR-003 | Source updated to reflect JWT propia |
| Proposal header | Intent | Removed "stack discrepancy" framing; added resolved stack summary |
| Proposal header | Out of Scope | Removed "Video/voice call implementation (flagged as MVP decision needed)" |
| Proposal header | Approach | Removed "Stack discrepancy flags throughout" |
| Proposal header | Risks | Removed "Real-time chat architecture undefined" risk |
| Proposal header | Dependencies | Updated to reference commit b887f08 decisions |
| Proposal header | Success Criteria | Removed "Stack discrepancy flagged" criterion |
| Proposal Question Round | All items | Rewritten to reflect resolved decisions |
| Exploration | Integrations | Firebase Auth → JWT Auth; added Socket.IO and Voice/Video |
| Exploration | Auth/Roles | Firebase Auth → Backend-issued JWT |
| Exploration | Frontend Architecture | Firebase → JWT + Socket.IO; lib path updated |
| Exploration | Auth Token Flow | Firebase flow → Backend JWT flow |
| Exploration | CORS & Config | Firebase config → JWT_SECRET; WebSocket note updated |
| Exploration | Stack Discrepancies | Marked RESOLVED |
| Exploration | Missing Details | Items 2, 3, 8, 10, 14 marked resolved/deferred |
| Exploration | Risks | Stack and chat risks marked resolved; voice/video risk updated |
| Exploration | Recommendation | Updated to reflect resolved stack |
| Exploration | Key Learnings | Updated to reflect resolved decisions |
