# Exploration: PRD Plataforma Eventos — Backend, Frontend & Unification

## Product Overview

**What**: Marketplace connecting clients (individuals + companies) with verified event-service providers in Mexico. Covers three service types: event venues (salones), sound/lighting equipment (sonido), and person-services (meseros, bartenders, cocineros).

**Target Users**:
- **Clientes** (usuarios): Individuals and companies seeking event services. Two segments: `particular` (weddings, quinceañeras, birthdays) and `empresa` (corporate events, posadas).
- **Proveedores** (prestadores): Service providers who publish listings, manage availability, accept bookings, and get paid.
- **Administrador**: Platform operator with exactly 5 functions: content moderation, provider management, global stats, technical disputes, commission configuration.

**Core Value Proposition**: "Airbnb for events" — discover, book, and pay for event services with contractual guarantees, verified providers, and integrated payments in MXN via Conekta.

**Revenue Model**: Commission per transaction (configurable by admin), summed into the client-visible price. Client sees "rent + taxes"; provider sees full price including commission.

---

## 1. Domain Model — All Entities from database_schema.sql

### Users & Legal Foundation

| Table | Purpose | Key Columns | Statuses/Enums |
|-------|---------|-------------|----------------|
| `users` | All platform users (3 roles) | `role`: usuario/prestador/administrador; `segment`: particular/empresa; `verified`; `deleted_at` (soft delete for ARCO); `privacy_consent_accepted_at` | — |
| `consent_logs` | LFPDPPP audit trail for consent | `consent_type`: aviso_privacidad/terminos_condiciones/cookies/verificacion_identidad; `accepted` (bool); `privacy_policy_version` | — |
| `arco_requests` | ARCO rights (Access/Rectify/Cancel/Oppose) | `tipo`: acceso/rectificacion/cancelacion/oposicion; `status`: pendiente/en_proceso/completado/rechazado; `deadline_at` (+20 business days) | — |
| `identity_verifications` | Verification audit log (METADATA ONLY — no INE data) | `method`: ine_presencial/kyc; `kyc_provider`: verificamex/truora/veriff; `result`: verificado/ine_vencido/ine_no_encontrado/datos_no_coinciden/error_api/pendiente; `estatus_lista_nominal`: activo/vencido/no_encontrado | — |
| `provider_blocks` | Admin block/unblock history | `blocked_at`, `unblocked_at` (NULL = currently blocked) | — |

### Services Catalog

| Table | Purpose | Key Columns | Statuses/Enums |
|-------|---------|-------------|----------------|
| `services` | Service listings (3 types) | `service_type`: salon/sonido/servicio_persona; `status`: borrador/pendiente_verificacion/publicado/rechazado; `location_type`: fija/area_servicio; `approval_mode`: manual/inmediata; `deposit_amount`; `cancellation_policy_id` | — |
| `service_photos` | Photos with moderation (min 5 to publish) | `status`: pendiente_moderacion/aprobada/rechazada; `position` (display order) | — |
| `amenities` | Open catalog (Wi-Fi, pool, dance floor, etc.) | `name` (unique) | — |
| `service_amenities` | N:M bridge (service ↔ amenity) | CASCADE on both FKs | — |
| `service_event_types` | Open catalog (Boda, Quinceañera, Corporativo, Infantil) | `name` (unique); `is_active` | — |
| `service_service_event_types` | N:M bridge (service ↔ event type) | CASCADE on both FKs | — |

### Pricing Models (3 types)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `salon_pricing` | 1:1 with salon services | `base_block_hours`, `base_block_price` (MXN), `extra_hour_price` (MXN) |
| `sound_packages` | 1:N per sound service | `name`, `description`, `base_price`, `base_hours`, `extra_hour_price` |
| `service_persona_pricing` | 1:1 with persona services | `price_per_person_per_hour` (MXN) |
| `service_extras` | Upsell extras | `sound_package_id` (nullable — service-level vs package-specific); `image_url` MANDATORY for sound extras |
| `dynamic_pricing_rules` | MVP feature: season/demand/weekday/block adjustments | `adjustment_type`: temporada/demanda/dia_semana/bloque_turno; `adjustment_value` (%, negative = discount); `scope` (JSON: date ranges, weekdays, blocks) |

### Inventory / Calendar

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `inventory_slots` | Slot inventory (date + time range + capacity) | `slot_date`, `start_time`, `end_time`, `capacity` (salon forced to 1); UNIQUE on (service, date, start, end) |
| `availability_blocks` | Maintenance/out-of-operation/private events | `type`: mantenimiento/inoperacion/evento_privado; `start_datetime`, `end_datetime` |
| `operating_hours` | Rentable hours per weekday | `day_of_week` (1=Mon..7=Sun), `open_time`, `close_time`, `base_block_duration_hours` (4/6/8), `extra_hours_allowed` |

### Collaborative Packages

| Table | Purpose | Key Columns | Statuses |
|-------|---------|-------------|----------|
| `packages` | Multi-provider packages (salon leader only) | `leader_provider_id`, `closed_price` (NULL until composed) | `status`: creado/invitaciones_pendientes/invitaciones_aceptadas/disponibilidad_verificada/disponible_para_reserva/reservado/completado (7 states) |
| `package_members` | Invited providers (sound/persona only) | `service_type`: sonido/servicio_persona; `invitation_status`: pendiente/aceptada/rechazada; `member_price` | — |

### Reservations (13 states)

| Table | Purpose | Key Columns | Statuses |
|-------|---------|-------------|----------|
| `reservations` | Core booking entity | `client_id`, `package_id` (nullable), `event_date`, `start_time`, `end_time`, `block_hours`, `extra_hours`, `total_price`, `base_amount`, `extras_amount`, `taxes_amount`, `commission_amount`, `commission_rate`, `cancellation_policy_snapshot` (JSON) | 13 states: creado → invitaciones_pendientes → invitaciones_aceptadas → disponibilidad_verificada → disponible_para_reserva → pendiente_firma → contrato_confirmado → permiso_alcohol → pago_anticipo → confirmada → en_curso → completada/cancelada |
| `reservation_status_history` | Audit trail (trigger-populated) | `changed_by` (actor) | — |
| `reservation_items` | Line items per service | `sound_package_id`, `person_count`, `hours`, `unit_price_snapshot` | — |
| `reservation_extras` | Selected extras | `extra_id`, `quantity`, `price_snapshot` | — |

### Payments, Refunds, Cancellations

| Table | Purpose | Key Columns | Statuses |
|-------|---------|-------------|----------|
| `payments` | Conekta payments (MXN only) | `payment_type`: anticipo/saldo/deposito_garantia; `conekta_charge_id`; `due_date`; CHECK `currency = 'MXN'` | `status`: pendiente/procesado/fallido/reembolsado/retenido/devuelto |
| `refunds` | Refund records | `reason`: cancelacion_proveedor/cancelacion_cliente/deposito_devolucion/politica_proveedor/permiso_alcohol_no_confirmado (5 reasons) | `status`: pendiente/procesado |
| `cancellations` | Cancellation records | `cancelled_by`: cliente/proveedor; `timing`: lejana/cercana; `retention_percent`; `retention_accepted` (bool — explicit acceptance required for near cancellations) | — |

### Contracts & Alcohol Permits

| Table | Purpose | Key Columns | Statuses |
|-------|---------|-------------|----------|
| `contracts` | Physical presential contract (1:1 with salon reservations) | `signing_appointment_at`, `signing_location`, `client_confirmed_at`, `provider_confirmed_at`, `document_url` (digital preservation) | `status`: pendiente_firma/firmando/pendiente_confirmacion/contrato_confirmado (4 states) |
| `alcohol_permits` | Documentation only (platform does NOT manage permits) | `requested` (bool); `h5_decision`: continuar_sin_alcohol/cancelar; `consequences_notified_at` | `status`: lista_espera/confirmado/no_confirmado |

### Messaging

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `conversations` | Chat thread client ↔ provider | `client_id`, `provider_id`, `service_id` (nullable); UNIQUE on (client, provider, service) |
| `messages` | Full message persistence | `type`: texto/nota_voz; `content` (NULL for voice); `audio_url`; `duration_seconds` (CHECK ≤ 120); `read_at`; `deleted_at` |
| `call_logs` | Voice/video call records | `type`: voz/video; `status`: llamando/en_curso/finalizada; `duration_seconds` |
| `quick_replies` | Provider saved responses | `name`, `content` |
| `scheduled_messages` | 4 automation types | `trigger_type`: reserva_confirmada/evento/pago_pendiente/review; `recipient`: cliente/ambos; `send_at`; `status`: pendiente/enviado |

### Notifications, Reviews, Favorites

| Table | Purpose | Key Columns | Statuses |
|-------|---------|-------------|----------|
| `notifications` | 16 types, 3 channels | `type` (16 ENUM values); `channel`: push/email/in_app; `is_critical` (bool — ≥2 channels required); `payload` (JSON) | `status`: pendiente/enviada/leida |
| `reviews` | 1 per reservation (UNIQUE), 1-5 stars | `client_id`, `provider_id` (denormalized), `rating` (CHECK 1-5), `comment` | — |
| `favorites` | Client favorites | UNIQUE on (client, service) | — |

### Commission, Invoices, Disputes, Moderation, Audit

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `commission_settings` | Global commission rate history | `commission_rate` (DECIMAL 5,2 — %); `changed_by` (admin) |
| `invoices` | CFDI per processed payment | `cfdi_uuid`, `amount`, `taxes`, `retention_isr`, `retention_iva`, `net_amount` |
| `technical_disputes` | Admin-resolved only (NO commercial disputes) | `type`: tecnica; `status`: abierta/resuelta; `resolution` |
| `content_reports` | Admin moderation (approve/warn/remove) | `action`: aprobar/advertir/eliminar; `status`: pendiente/resuelto |
| `audit_logs` | General audit trail | `actor_id` (NULL = system), `action`, `entity_type`, `entity_id`, `old_value`/`new_value` (JSON) |

### Views

- **`v_provider_ranking`**: response_rate_pct, acceptance_rate_pct, avg_rating per provider (NULL when no data → "Sin datos")
- **`v_slot_availability`**: capacity vs active reservations per slot; status_indicator: disponible/parcial/lleno

### Trigger

- **`trg_reservation_status_audit`**: AFTER UPDATE on reservations — inserts into reservation_status_history on every status change

---

## 2. Core Business Flows

### 2.1 Reservation Flow (flujo_de_reserva.md)

**Simple reservation**: Select service → verify slot availability → select date/time block → select extras → price summary → pay advance (Conekta) → confirm.

**Salon reservation (with physical contract)**: Same as above but adds: schedule signing appointment → presential INE delivery + signature → bilateral in-app confirmation → state advances to payment.

**Package reservation**: Salon leader creates package → invites providers → all accept → cross-slot availability verified → package published → client books package → same flow as simple but with multiple reservation_items.

**States**: 13 states (see domain model). Key transitions:
- `creado` → `pendiente_firma` (simple salon) or `invitaciones_pendientes` (package)
- `contrato_confirmado` → `permiso_alcohol` (if alcohol requested) → `pago_anticipo` → `confirmada`
- `confirmada` → `en_curso` → `completada` or `cancelada`

### 2.2 Payments & Commissions (pagos_y_comisiones.md)

- **Conekta API** — MXN only. Tokenization, processing, settlement handled by Conekta.
- **3 payment types**: anticipo (advance), saldo (balance), deposito_garantia (security deposit).
- **Commission**: Summed into visible price. Client sees "rent + taxes" (no commission breakdown). Provider sees full price.
- **Flexible billing**: (1) mandatory advance, (2) full pre-event, (3) post-service (platform does NOT hold post-service payments).
- **Deposit**: Configurable per salon, collected with advance, returned after event if no damage.
- **Taxes**: Automatic IVA calculation. Monthly report per provider. CFDI generation per payment.
- **Application order on cancellation**: Advance (non-refundable) → Deposit (per policy) → Other payments (refundable).

### 2.3 Cancellations & Refunds (cancelaciones_y_reembolsos.md)

- **Client cancels**: Advance non-refundable. Near cancellation → provider's configurable policy applies (retention %, window, deposit refundability). Policy MUST be shown and accepted before confirming.
- **Provider cancels**: FULL refund of everything (advance + deposit + additional payments). Automatic processing + client notification.
- **No mediation**: Commercial disputes stay outside the app. Only technical disputes handled by admin.
- **Alcohol permit**: If user chooses not to get permit at H-5, they decide continue-or-cancel. If cancel → provider's cancellation policy applies (not automatic).

### 2.4 Notifications (notificaciones.md)

16 notification types across 3 channels (push, email, in-app). Critical notifications (contract, payment, cancellation) MUST use ≥2 channels. Key types:
- Contract signing (push + email, both parties)
- Payment confirmations (push + in-app or push + email + in-app)
- Event reminders (H-48 push+email, H-2 push, both parties)
- Alcohol permit H-5 (push + email, client)
- Cancellation (push + email + in-app, the non-canceling party)

### 2.5 Messaging (mensajeria.md)

- Real-time text chat (persistent, searchable, accessible post-event)
- Voice/video calls (NOT recorded by default)
- Voice notes (max 120s, no transcription in MVP)
- Quick replies (provider-editable)
- Scheduled messages (4 types: booking confirmation +24h, event reminder H-48/H-2, review request +24h, payment reminder)

### 2.6 Identity Verification (verificacion_de_identidad.md, verificamex_integracion.md)

- **Mandatory for providers** (blocks publication). **Voluntary for clients** (badge).
- **Method 1**: INE presencial — physical ID delivery + contract signing.
- **Method 2**: KYC remote — Verificamex (primary, low cost), Truora (mid), Veriff (high).
- **Verificamex**: REST API, checks INE against Lista Nominal. Returns vigente/coincidencia_nombre/estatus. Logs ONLY metadata (no CURP, no name, no OCR stored).
- **Privacy**: LFPDPPP compliant — no INE data persisted, no biometric data, explicit consent required.

### 2.7 Collaborative Packages (paquetes_colaborativos.md)

- Only salons can create/lead packages.
- Flow: Create → invite providers (sound/persona) → all accept → cross-slot availability verified → publish → client books.
- 7 package states. Price auto-computed as sum of member prices + extras + taxes + hidden platform fee.
- If member rejects, leader can invite another of same type.

---

## 3. Regulatory Constraints (normativa_mexicana_2026.md)

| Law | Key Requirement | System Impact |
|-----|----------------|---------------|
| **LFPDPPP** | Explicit consent, ARCO rights, privacy notice | Consent logs, ARCO request table, soft delete, no INE data storage |
| **Ley Consumer** | Clear pricing, visible cancellation policy | Price breakdown before confirm, policy shown pre-booking |
| **Código Comercio** | Valid electronic contracts | Physical bilateral contract, in-app confirmation, digital preservation |
| **Alcohol Permits** | Municipal (SLRC reference), optional | Document requirement, H-5 notification, user choice (no auto-cancel) |
| **SAT/CFDI** | Digital tax receipts, ISR/IVA retention | Invoice table, CFDI generation, monthly reports |
| **Comercio Electrónico** | T&C before transaction, seller info | T&C acceptance, provider profile visible |
| **COFEPRIS** | Sanitary responsibility | Provider self-declaration when publishing catering |
| **NOM-151** | Electronic document preservation | Contract scan/photo retention (pending validation) |
| **INE/RENAPO** | Identity verification via Lista Nominal | Verificamex integration, metadata-only logging |

---

## 4. Backend-Relevant Requirements

### Data Rules
- MariaDB 10.6+ / MySQL 8.0+, InnoDB, utf8mb4_unicode_ci
- DECIMAL(10,2) for all MXN amounts
- ENUM for closed sets (roles, statuses, payment types, notification types)
- JSON for free-form payloads (scope, notification payload, cancellation_policy_snapshot)
- Soft delete (deleted_at) for users and services (LFPDPPP/ARCO)
- Foreign keys: ON DELETE RESTRICT (except junction tables → CASCADE)
- Audit trail: reservation_status_history (trigger), audit_logs (general), consent_logs

### Business Rules
- Salon concurrency forced to 1 (app-level validation, not DB constraint)
- Slot availability: transactional count of active reservations vs capacity at booking time
- Review enabling: full payment completed AND event_date < now (app-enforced)
- Voice note duration CHECK ≤ 120s (DB-enforced)
- Currency CHECK = 'MXN' (DB-enforced)
- Commission rate: latest row in commission_settings = current rate
- Rating CHECK BETWEEN 1 AND 5
- Cancellation retention acceptance: required before processing near cancellation (app-enforced)

### Integrations
- **Conekta**: Payment processing, tokenization, charge IDs. MXN only.
- **Verificamex**: INE verification via Lista Nominal. REST API, POST, 10s timeout, API key auth.
- **Truora / Veriff**: Alternative KYC providers (maintained as options).
- **JWT Auth**: Backend-issued JWT (POST /api/auth/login). No Firebase dependency for authentication.
- **Socket.IO**: Real-time text chat (decided, commit b887f08). Frontend client at `lib/socket.ts`.
- **Voice/Video**: PeerJS (WebRTC) or Agora — in scope for MVP (decision pending).
- **Push notifications**: Channel for 13 of 16 notification types.
- **Email**: Channel for 8 of 16 notification types.

### Auth/Roles/Permissions
- 3 roles: usuario, prestador, administrador (no support role)
- Backend-issued JWT → role-based layout routing (no Firebase dependency)
- Admin: exactly 5 functions (moderation, provider management, stats, technical disputes, commission)
- Provider verification required before publishing (blocks at application level)

---

## 5. Frontend-Relevant Requirements

### Client Interface (interfaces_cliente.md)
- **5-tab bottom nav**: Inicio, Favoritos, Rentas, Chat, Perfil
- **Secondary nav**: Salones / Sonidos / Servicios (on Inicio tab)
- **Search**: 8+ filter dimensions (date, capacity, zone, budget, event type, pool, internet, rating)
- **Service detail**: Gallery (min 5 photos), pricing, rating, amenities, extras, available time slots, cancellation policy, reviews
- **Booking flow**: Select date/time → extras → price summary → pay (Conekta) → contract signing (salon) → confirmation
- **Favorites**: Persistent across sessions, sorted by date added
- **Rental history**: Active/In-progress/Completed/Cancelled tabs
- **Reviews**: Enabled only when payment complete AND event date passed

### Provider Interface (interfaces_proveedor.md)
- **Onboarding wizard (3 steps)**: Step 1 (type, location, capacity) → Step 2 (photos min 5, title, description) → Step 3 (pricing, policies, cancellation, deposit). Auto-save between steps. Resumes on app close.
- **Dashboard (5 tabs)**:
  1. **Hoy** (Today): Urgent alerts, weekly summary, reminders, quick actions
  2. **Mensajes**: Inbox, text chat, voice notes, quick replies, scheduled messages
  3. **Calendario**: Monthly/weekly view, dynamic pricing config, slot inventory, date blocking, availability indicators
  4. **Anuncios**: Edit photos, description, rules, cancellation policy
  5. **Estadísticas**: Payment history, earnings projection, response rate, acceptance rate, average rating
- **Agenda**: Free for all providers, adaptable to any service type
- **Tax calculator**: Auto-calculate, simulate, breakdown
- **Monthly report**: Transactions, gross, taxes, commission, net, CFDI

### Frontend Architecture (frontend-architecture.md)
- **Stack**: Vite 5 + React 18, React Router v6, Zustand (state), Tailwind CSS + Radix UI, JWT auth (backend-issued), Socket.IO (real-time chat), Conekta.js (payments)
- **Feature-based folder structure**: `features/{auth,search,booking,provider,chat,payments,notifications,profile,admin}/`
- **Shared components**: `components/{ui,layout,icons}/`
- **Global**: `hooks/`, `lib/{api,socket,conekta,formatters,constants}`, `stores/{authStore,uiStore}`, `types/{models,api}`
- **Layouts**: AppLayout (client), ProviderLayout (provider dashboard), AdminLayout (admin)
- **Protected routes**: Role-based routing

---

## 6. Frontend-Backend Unification Concerns

### API Contracts Needed
The documentation describes WHAT the system does but NOT the API surface. The following REST endpoints are implied by the docs:

**Auth**: POST /auth/register, POST /auth/login, POST /auth/logout, GET /auth/me
**Users**: GET/PUT /users/me, POST /users/verify-ine, POST /users/verify-kyc
**Services**: CRUD /services, GET /services/search (with 8+ filter params), GET /services/:id/slots
**Pricing**: CRUD /services/:id/pricing (salon/sound/persona), CRUD /services/:id/extras, CRUD /services/:id/dynamic-rules
**Inventory**: CRUD /services/:id/slots, CRUD /services/:id/blocks, CRUD /services/:id/hours
**Packages**: POST /packages, POST /packages/:id/invite, PUT /packages/:id/members/:id/respond, GET /packages/:id/availability
**Reservations**: POST /reservations, GET /reservations, PUT /reservations/:id/status, GET /reservations/:id/timeline
**Contracts**: GET /contracts/:id, PUT /contracts/:id/confirm
**Payments**: POST /payments, GET /payments/:id, POST /payments/:id/refund
**Messages**: GET /conversations, GET /conversations/:id/messages, POST /conversations/:id/messages, POST /messages/:id/voice
**Notifications**: GET /notifications, PUT /notifications/:id/read
**Reviews**: POST /reviews, GET /services/:id/reviews
**Favorites**: POST /favorites, DELETE /favorites/:id
**Admin**: GET /admin/stats, PUT /admin/commission, GET /admin/disputes, PUT /admin/disputes/:id, GET /admin/moderation, PUT /admin/moderation/:id

### Shared Data Shapes
- **User**: { id, full_name, email, phone, avatar_url, role, segment, verified }
- **Service**: { id, provider_id, service_type, status, title, description, location, max_capacity, ... }
- **Reservation**: { id, client_id, package_id, status, event_date, start_time, end_time, total_price, ... }
- **Payment**: { id, reservation_id, payment_type, amount, currency, status, conekta_charge_id, ... }
- **Message**: { id, conversation_id, sender_id, type, content, audio_url, created_at, read_at }
- **Notification**: { id, user_id, type, channel, is_critical, status, payload, sent_at, read_at }

### Deployment Topology
- **Docker**: Containerized backend (Node.js + Express) + frontend (Vite build → static)
- **VPS**: Single VPS deployment
- **Nginx**: Reverse proxy, serves frontend static files, proxies /api to backend
- **Cloudflare**: DNS proxy, SSL termination, DDoS protection
- **Single origin**: Frontend and API on same domain (Nginx routes /api/* to backend)

### Auth Token Flow
1. Client registers/logs in via POST /api/auth/login (backend-issued JWT)
2. Backend returns JWT
3. Frontend stores JWT in Zustand authStore
4. Frontend sends JWT in Authorization header to backend API
5. Backend validates JWT (signature + expiration)
6. Backend extracts user ID and role from JWT claims
7. Role-based middleware gates access

### CORS & Config
- **Single origin** (Nginx proxy) → CORS not needed for same-origin
- If separate origins during development: CORS must be configured on backend
- **Env vars needed**: JWT_SECRET, Conekta API key, Verificamex API key, DB connection
- **WebSocket support**: Cloudflare must be configured for Socket.IO WebSocket upgrade

---

## 7. Gaps, Risks, and Discrepancies

### Stack Discrepancies (RESOLVED — commit b887f08)

| Doc says | User says | Status |
|----------|-----------|--------|
| `vision_y_alcance.md` line 85: "Next.js + Firebase" | React + Vite, Node.js + Express + MariaDB | **Resolved** — user's stack is authoritative |
| `README.md` line 76: "Next.js + Firebase" | Same as above | **Resolved** |
| `config.yaml` line 8: "Next.js + Firebase (OR Node.js/Express/MariaDB per user statement)" | React + Vite + Node.js + Express + MariaDB | **Resolved** |
| `frontend-architecture.md` line 9: "Firebase (auth + realtime chat)" | JWT (backend-issued) + Socket.IO (chat) | **Resolved** — no Firebase dependency |
| `frontend-architecture.md` line 6: "Conekta.js (pagos)" | Consistent | OK |

### Missing Details for PRDs

1. **No API spec exists** — endpoint paths, request/response shapes, error formats, pagination, rate limiting are all undefined
2. ~~**No auth spec**~~ — RESOLVED: JWT owned by backend (commit b887f08)
3. ~~**No real-time spec**~~ — RESOLVED: Socket.IO for chat (commit b887f08)
4. **No notification delivery spec** — push notification provider (FCM? OneSignal?), email provider (SendGrid? Mailgun?)
5. **No file storage spec** — where photos/voice notes/contract scans are stored (S3? Local filesystem? Cloudflare R2?)
6. **No search spec** — how 8+ filter dimensions are implemented (SQL queries? Elasticsearch? Meisearch?)
7. **No deployment spec** — Docker compose structure, Nginx config, Cloudflare tunnel vs DNS-only, SSL
8. ~~**No CFDI generation spec**~~ — DEFERRED per user instruction ("por el momento CFDI queda pendiente"). Requirement kept as documented constraint.
9. **`areas_de_simplificacion.md` does not exist as standalone file** — content is in `openspec/specs/areas-de-simplificacion/spec.md`
10. ~~**Firebase Realtime DB for chat**~~ — RESOLVED: Socket.IO chosen (commit b887f08). No Firebase dependency.
11. **Conekta integration** — docs mention Conekta.js (client-side) but backend needs Conekta server-side SDK for charge creation, webhooks, refunds
12. **Dynamic pricing evaluation** — when/how are dynamic pricing rules applied? At search time? At booking time? Both?
13. **Scheduled messages** — 4 automation types need a job queue or scheduler (cron? Bull/BullMQ? Node-cron?)
14. ~~**Voice/video calls**~~ — RESOLVED: IN SCOPE for MVP. PeerJS (WebRTC) or Agora (commit b887f08). Design phase chooses which.
15. **Review enabling rule** — "payment complete AND event_date < now" — this requires a background job or check at query time

### Risks for PRD Phase

| Risk | Severity | Mitigation |
|------|----------|------------|
| ~~Stack discrepancy may cause PRD to target wrong tech~~ | ~~High~~ | RESOLVED — user's stack authoritative (commit b887f08) |
| No API contract defined — PRDs may be vague on backend surface | High | PRD should define API surface at resource level, leave implementation details to design |
| ~~Real-time chat without clear architecture~~ | ~~Medium~~ | RESOLVED — Socket.IO chosen (commit b887f08) |
| CFDI generation complexity | Medium | DEFERRED per user instruction; kept as documented constraint for future |
| Voice/video calls — PeerJS vs Agora decision needed | Medium | PRD flags as open question with tradeoffs; design phase resolves |
| Missing `areas_de_simplificacion.md` standalone file | Low | Content exists in openspec spec; PRD can reference spec |

---

## Recommendation

**Ready for Proposal**: Yes — with the following conditions:
1. All three PRDs must reflect the resolved stack (React + Vite / Node.js + Express + MariaDB / JWT auth / Socket.IO chat / voice-video in MVP)
2. The backend PRD must define the API surface at resource level (even if endpoints are approximate)
3. The frontend PRD must reflect JWT auth (no Firebase) and Socket.IO for chat
4. The unification PRD must address: JWT auth token flow, Socket.IO architecture, PeerJS/Agora voice-video, file storage, notification delivery, and deployment topology
5. CFDI deferred with clear documentation of future constraint
6. Remaining open questions from section 7 flagged appropriately

---

## Key Learnings

1. The project has 16 structured product specs covering 23 documented decisions with 100% coverage, but zero implementation specs (no API, no deployment, no auth contract).
2. Stack decisions resolved (commit b887f08): JWT auth (no Firebase), Socket.IO for chat, voice/video in MVP (PeerJS or Agora), CFDI deferred.
3. The database schema is comprehensive with 30+ tables, 2 views, and 1 trigger, providing a solid foundation for API design.
4. Real-time features now have architectural direction: Socket.IO for chat, PeerJS/Agora for voice/video. Remaining sub-decisions deferred to design phase.
5. Mexican regulatory requirements (LFPDPPP, SAT/CFDI, Ley Consumer) impose specific data handling constraints that affect both backend data models and frontend UX flows. CFDI deferred but constraint documented.
