---
id: prd-frontend
title: "PRD — Frontend (React + Vite)"
version: "1.1.0"
status: draft
audience: frontend-engineers, ai-agents
stack:
  framework: React 18
  bundler: Vite 5
  routing: React Router v6
  state: Zustand + React Query
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

# PRD — Frontend (React + Vite)

> Plataforma eventos — Marketplace de servicios para eventos en México.
> Este documento es el contrato de requisitos del frontend. Está diseñado para ser leído y analizado por humanos y por agentes de IA (opencode, etc.). Cada requisito tiene ID estable, prioridad, criterios de aceptación y fuente de trazabilidad.

## Cómo leer este PRD

- **IDs**: `FR-XXX.NN` — estables, referenciables por agentes y tareas.
- **Prioridad**: `Must` (obligatorio MVP) | `Should` (importante) | `Could` (deseable/diferido).
- **Fuente**: documento de producto original que origina el requisito.
- **Open Questions**: tabla `FQ-XXX` — decisiones abiertas; las resueltas en diseño están marcadas con su decisión D-XXX.

## Revision Notes

| Versión | Cambio |
|---------|--------|
| 1.2.0 | Design decisions resolved: Agora for voice/video (D-005), Zustand+localStorage persistence (D-013), Socket.IO client config (D-014), file upload through backend (D-012). Dark mode (FR-015.5) and map view (FR-004.4) deferred to post-MVP. Open questions FQ-004, FQ-005, FQ-007, FQ-008 closed. |
| 1.1.0 | Stack decisions (commit b887f08): auth JWT propia vía backend (no Firebase), chat Socket.IO (`lib/socket.ts`), voice/video in MVP (PeerJS/Agora), CFDI diferido. Decisiones de diseño D-001..D-010 resueltas en design.md |

---

## FR-001: Information Architecture — Client

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-001.1 | Must | 5-tab bottom navigation: Inicio, Favoritos, Rentas, Chat, Perfil | Tabs render correctly, active state indicated | interfaces_cliente.md |
| FR-001.2 | Must | Secondary navigation on Inicio: Salones / Sonidos / Servicios | Category filter tabs visible on home | interfaces_cliente.md |
| FR-001.3 | Must | Role-based routing: client routes guarded, provider routes separate | Unauthorized access redirects to correct layout | roles_y_permisos.md |
| FR-001.4 | Must | AppLayout component for client-facing pages | Layout wraps all client routes | frontend-architecture.md |
| FR-001.5 | Should | Deep linking: service detail, booking flow state, reservation detail | Direct URL access works | gaps §5 |

## FR-002: Information Architecture — Provider

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-002.1 | Must | ProviderLayout component for dashboard pages | Layout wraps all provider routes | frontend-architecture.md |
| FR-002.2 | Must | 5-tab dashboard: Hoy, Mensajes, Calendario, Anuncios, Estadísticas | All tabs functional | interfaces_proveedor.md |
| FR-002.3 | Must | Onboarding wizard (3 steps) with auto-save between steps | Step 1 (type/location), Step 2 (photos/description), Step 3 (pricing/policies) | interfaces_proveedor.md |
| FR-002.4 | Must | Onboarding resumes on app close (localStorage or API) | Incomplete onboarding detected and resumed | interfaces_proveedor.md |
| FR-002.5 | Should | Tax calculator: auto-calculate, simulate, breakdown | Calculator accessible from dashboard | interfaces_proveedor.md |
| FR-002.6 | Should | Monthly report: transactions, gross, taxes, commission, net (CFDI diferido) | Report downloadable/viewable | interfaces_proveedor.md |

## FR-003: Information Architecture — Admin

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-003.1 | Must | AdminLayout component for admin pages | Layout wraps all admin routes | frontend-architecture.md |
| FR-003.2 | Must | Admin has exactly 5 functions: moderation, provider management, stats, technical disputes, commission | Admin UI limited to these functions | roles_y_permisos.md |
| FR-003.3 | Must | Commission configuration interface | Admin can set global commission rate | pagos_y_comisiones.md |

## FR-004: Search & Discovery

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-004.1 | Must | Search with 8+ filter dimensions: date, capacity, zone, budget, event type, pool, internet, rating | All filters functional | interfaces_cliente.md |
| FR-004.2 | Must | Filter state persists across navigation | Filters retained when returning to search | interfaces_cliente.md |
| FR-004.3 | Must | Results display: photo, title, rating, price, capacity, location | All fields shown in list view | interfaces_cliente.md |
| FR-004.4 | Could | Map view for results (post-MVP) | Map renders with service markers — **Deferred** to post-MVP (Leaflet + OpenStreetMap if needed). List view sufficient for MVP. | interfaces_cliente.md |

## FR-005: Service Detail

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-005.1 | Must | Gallery: minimum 5 photos, swipeable | Photos render, min 5 enforced | interfaces_cliente.md |
| FR-005.2 | Must | Display: pricing, rating, amenities, extras, available time slots | All fields render correctly | interfaces_cliente.md |
| FR-005.3 | Must | Cancellation policy displayed on service detail | Policy section visible before booking | cancelaciones_y_reembolsos.md |
| FR-005.4 | Must | Reviews section: 1-5 stars, comment | Reviews displayed per service | interfaces_cliente.md |
| FR-005.5 | Must | Favorite toggle: add/remove from favorites | Heart icon toggles, state persisted | interfaces_cliente.md |
| FR-005.6 | Should | Availability calendar showing open slots | Calendar component with slot data | flujo_de_reserva.md |

## FR-006: Booking Flow

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

## FR-007: Cancellation & Refund UX

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-007.1 | Must | Client can cancel reservation from detail screen | Cancel action available | cancelaciones_y_reembolsos.md |
| FR-007.2 | Must | Near cancellation: show retention policy, require acceptance | Policy displayed, checkbox/tap required | cancelaciones_y_reembolsos.md |
| FR-007.3 | Must | Provider cancellation: automatic full refund notification | Client notified of refund | cancelaciones_y_reembolsos.md |
| FR-007.4 | Should | Refund status displayed in reservation detail | Refund tracking visible | cancelaciones_y_reembolsos.md |

## FR-008: Notifications Display

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-008.1 | Must | In-app notification center | Notifications listed with read/unread state | notificaciones.md |
| FR-008.2 | Must | Critical notifications highlighted (contract, payment, cancellation) | Visual distinction for critical notifications | notificaciones.md |
| FR-008.3 | Must | Notification badges on navigation tabs | Badge count shown | notificaciones.md |
| FR-008.4 | Should | Push notification handling (browser/mobile) | Push notifications received and displayed | notificaciones.md |
| FR-008.5 | Must | Event reminders: H-48, H-2 | Reminders shown at correct times | notificaciones.md |

## FR-009: Messaging UI

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-009.1 | Must | Chat thread: client ↔ provider | Conversation list + detail view | mensajeria.md |
| FR-009.2 | Must | Real-time message delivery via Socket.IO (lib/socket.ts) | Messages appear without refresh | Updated: Socket.IO decision (commit b887f08) |
| FR-009.3 | Must | Voice note recording and playback (max 120s) | Record button, duration display, playback | mensajeria.md |
| FR-009.4 | Should | Quick replies selector (provider) | Quick reply picker in chat input | mensajeria.md |
| FR-009.5 | Must | Message read receipts (read_at display) | Read status shown | mensajeria.md |
| FR-009.6 | Should | Scheduled messages displayed in thread | System messages appear at trigger time | mensajeria.md |

## FR-010: Verification Flows

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-010.1 | Must | Provider verification prompt on first login (if not verified) | Onboarding detects unverified state | verificacion_de_identidad.md |
| FR-010.2 | Must | KYC verification flow: consent → capture → result | Full flow functional | verificacion_de_identidad.md |
| FR-010.3 | Must | Verification badge display on provider profile | Badge shown if verified | verificacion_de_identidad.md |
| FR-010.4 | Must | Client voluntary verification option | Client can initiate verification | verificacion_de_identidad.md |

## FR-011: Provider Onboarding & Dashboard

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

## FR-012: Favorites & Rental History

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-012.1 | Must | Favorites list: persistent across sessions | Favorites synced with backend | interfaces_cliente.md |
| FR-012.2 | Must | Rental history tabs: Active, In-progress, Completed, Cancelled | All tabs functional | interfaces_cliente.md |
| FR-012.3 | Must | Review enabled only when payment complete AND event_date < now | Review form conditionally shown | cancelaciones_y_reembolsos.md |

## FR-013: State Management

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-013.1 | Must | Zustand stores: authStore, uiStore | Core stores implemented | frontend-architecture.md |
| FR-013.2 | Must | Feature-based stores in feature directories | Each feature manages own state | frontend-architecture.md |
| FR-013.3 | Must | Auth state: JWT, user profile, role | Auth state accessible globally | frontend-architecture.md |
| FR-013.4 | Should | Server state caching (React Query) | API responses cached | D-009, gaps §5 |

## FR-014: API Client Layer

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-014.1 | Must | Centralized API client with JWT attachment | All requests include Authorization header | frontend-architecture.md |
| FR-014.2 | Must | Error handling interceptor | API errors displayed to user | frontend-architecture.md |
| FR-014.3 | Must | Request/response type definitions (TypeScript) | Types match backend shapes | frontend-architecture.md |
| FR-014.4 | Should | Request retry logic for transient failures | Retries on 5xx with backoff | gaps §5 |

## FR-015: Design System & Responsive Behavior

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-015.1 | Must | Tailwind CSS utility-first styling | All components use Tailwind | frontend-architecture.md |
| FR-015.2 | Must | Radix UI for accessible primitives | Dialog, dropdown, toast, etc. | frontend-architecture.md |
| FR-015.3 | Must | Responsive: mobile-first, break at tablet/desktop | Layout adapts to screen size | frontend-architecture.md |
| FR-015.4 | Must | Icon system: consistent icon set across app | Icons render correctly | frontend-architecture.md |
| FR-015.5 | Could | Dark mode support (post-MVP) | Theme toggle functional — **Deferred** to post-MVP. Tailwind dark mode class toggle is trivial to add later. | gaps §5 |

## FR-016: Regulatory UX

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-016.1 | Must | Privacy consent modal before first data collection | Consent screen shown on first visit | normativa_mexicana_2026.md |
| FR-016.2 | Must | Terms & conditions acceptance before transaction | T&C modal before booking | normativa_mexicana_2026.md |
| FR-016.3 | Must | Price breakdown visible before payment confirmation | Full price shown (rent + taxes) | normativa_mexicana_2026.md |
| FR-016.4 | Must | Cancellation policy displayed before booking | Policy section in booking flow | normativa_mexicana_2026.md |
| FR-016.5 | Should | ARCO rights request form accessible from profile | Form to request data access/deletion | normativa_mexicana_2026.md |
| FR-016.6 | Must | Cookie consent banner | Banner shown, choice recorded | normativa_mexicana_2026.md |

## FR-017: Routing

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| FR-017.1 | Must | React Router v6 with nested routes | Route tree matches IA structure | frontend-architecture.md |
| FR-017.2 | Must | Protected routes: redirect unauthenticated to login | Auth guard functional | frontend-architecture.md |
| FR-017.3 | Must | Role-based route guards: client/provider/admin | Correct layout rendered per role | frontend-architecture.md |
| FR-017.4 | Should | Lazy loading for feature routes | Code splitting working | frontend-architecture.md |

## Open Questions / Decisions Needed

| ID | Question | Impact | Resolution |
|----|----------|--------|-----------|
| FQ-004 | File upload: direct to S3/R2 or through backend? | Security, performance | **Resuelto**: backend proxy (D-012) — multer validates MIME/size, saves to disk, returns signed URL |
| FQ-005 | State persistence: how much UI state saved to localStorage? | UX | **Resuelto**: Zustand + localStorage for auth/UI prefs; booking flow via React Query (D-013) |
| FQ-006 | Offline support: any offline-first features? | Complexity | MVP: no offline support |
| FQ-007 | Voice/video calls: PeerJS (WebRTC, self-hosted) vs Agora (managed, per-minute cost)? | Scope, cost | **Resuelto**: Agora (D-005) — managed, global CDN, no TURN server ops |
| FQ-008 | Socket.IO client version and configuration (reconnection, rooms, auth middleware)? | Real-time reliability | **Resuelto**: auto-reconnect exp backoff, JWT auth, room management (D-014) |

## Traceability Matrix

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

## Referencias de diseño resueltas

| Decisión | Elección | Detalle |
|----------|----------|---------|
| D-005 | Agora | Voice/video managed; global CDN; free tier 10K min/month |
| D-006 | Socket.IO | Cliente en `lib/socket.ts`, auth JWT en handshake, rooms por conversación |
| D-009 | Adoptar frontend-architecture.md + React Query | Estructura feature-based confirmada; server state via React Query |
| D-012 | Backend file upload proxy | Client POSTs multipart → backend validates → signed URL returned |
| D-013 | Zustand + localStorage | Auth token + user profile + UI prefs persisted; booking flow via React Query |
| D-014 | Socket.IO client config | Auto-reconnect exp backoff (1s→30s), JWT auth, room management, heartbeat 25s |

## Decisions Register

| ID | Decision | Rationale | Tradeoffs | Status |
|----|----------|-----------|-----------|--------|
| D-005 | Agora | Managed voice/video; no TURN server ops | Per-minute cost at scale | CLOSED |
| D-006 | Socket.IO | Bidirectional chat; reliable delivery | Memory per connection | CLOSED |
| D-009 | Adopt frontend-architecture.md | Feature-based; React Query for server state | Tailwind + Radix UI assumed | CLOSED |
| D-012 | Backend file upload proxy | Validates MIME/size; no direct client-to-storage | Backend bandwidth for uploads | CLOSED |
| D-013 | Zustand + localStorage | Auth persistence; UI prefs; booking via React Query | localStorage 5MB limit | CLOSED |
| D-014 | Socket.IO client config | Auto-reconnect; JWT auth; room management | Ephemeral connection state | CLOSED |
