---
id: prd-unification
title: "PRD — Integración & Despliegue (Frontend + Backend)"
version: "1.1.0"
status: draft
audience: full-stack-engineers, devops, ai-agents
stack:
  frontend: React 18 + Vite 5
  backend: Node.js + Express
  database: MariaDB 10.6+
  auth: JWT (backend-issued)
  chat: Socket.IO
  voice_video: Agora (managed, global CDN)
  payments: Conekta
  deploy: Docker + VPS + Nginx + Cloudflare
related_docs:
  - frontend-architecture.md
  - database_schema.sql
  - normativa_mexicana_2026.md
---

# PRD — Integración & Despliegue (Frontend + Backend)

> Plataforma eventos — Marketplace de servicios para eventos en México.
> Este documento es el contrato de integración entre frontend y backend, más la topología de despliegue. Está diseñado para ser leído y analizado por humanos y por agentes de IA (opencode, etc.). Cada requisito tiene ID estable, prioridad, criterios de aceptación y fuente de trazabilidad.

## Cómo leer este PRD

- **IDs**: `UR-XXX.NN` — estables, referenciables por agentes y tareas.
- **Prioridad**: `Must` (obligatorio MVP) | `Should` (importante) | `Could` (deseable/diferido).
- **Fuente**: documento de producto original o requisito hermano (BR/FR) que origina el requisito.
- **Open Questions**: tabla `UQ-XXX` — decisiones abiertas; las resueltas en diseño están marcadas con su decisión D-XXX.

## Revision Notes

| Versión | Cambio |
|---------|--------|
| 1.2.0 | Design decisions resolved: Agora for voice/video (D-005), Cloudflare full proxy confirmed (D-010), BullMQ for jobs (D-011), Socket.IO client config (D-014). Open questions UQ-005, UQ-006 closed. |
| 1.1.0 | Stack decisions (commit b887f08): auth JWT propia backend (UR-003), chat Socket.IO decidido (UR-009.1), voice/video in MVP (UR-009.2), CFDI diferido. Decisiones de diseño D-001..D-010 resueltas en design.md |

---

## UR-001: API Contract — Request/Response Shapes

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-001.1 | Must | Standard response envelope: `{ data: T, meta?: { total, page, limit, pages }, errors?: [{ code, message, details? }] }` | All endpoints use same shape | gaps §6 |
| UR-001.2 | Must | JSON Content-Type on all responses | `Content-Type: application/json` header | gaps §6 |
| UR-001.3 | Must | Request body: JSON for POST/PUT/PATCH | No form-encoded bodies | gaps §6 |
| UR-001.4 | Must | Query params for filtering, pagination, sorting | Standardized param names | gaps §6 |
| UR-001.5 | Must | ID format: integer auto-increment (MariaDB) | IDs consistent across API | database_schema.sql |
| UR-001.6 | Should | Date/time format: ISO 8601 strings | Consistent date handling | gaps §6 |

## UR-002: API Contract — Endpoints Catalog

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

## UR-003: Auth Token Flow

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-003.1 | Must | Client registers via POST /auth/register (backend handles user creation + JWT issuance) | User created in MariaDB, JWT returned | Updated: JWT propia (commit b887f08) |
| UR-003.2 | Must | Client logs in via POST /api/auth/login (backend validates credentials, issues JWT) | JWT returned on success; 401 on failure | Updated: JWT propia (commit b887f08) |
| UR-003.3 | Must | Frontend stores JWT in Zustand authStore and sends in `Authorization: Bearer <token>` header | All API requests include token | frontend-architecture.md |
| UR-003.4 | Must | Backend verifies JWT signature and expiration on every protected endpoint | Invalid/expired tokens rejected with 401 | Updated: JWT propia (commit b887f08) |
| UR-003.5 | Must | Backend extracts user ID, role, segment from JWT claims | `req.user` populated | roles_y_permisos.md |
| UR-003.6 | Must | Role-based middleware gates access | 403 returned for unauthorized roles | roles_y_permisos.md |
| UR-003.7 | Must | Token refresh: POST /auth/refresh validates current JWT and issues new one | Seamless refresh without re-login | Updated: JWT propia (commit b887f08) |

## UR-004: Error Handling Contract

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-004.1 | Must | Backend returns structured errors: `{ error: { code, message, details? } }` | Frontend can parse and display | BR-003 |
| UR-004.2 | Must | Frontend handles 401 → redirect to login | Auth errors caught globally | gaps §6 |
| UR-004.3 | Must | Frontend handles 403 → show "unauthorized" message | Forbidden errors displayed | gaps §6 |
| UR-004.4 | Must | Frontend handles 422 → display validation errors per field | Form validation errors shown | gaps §6 |
| UR-004.5 | Should | Frontend handles 500 → show generic error, log details | Server errors handled gracefully | gaps §6 |

## UR-005: Environment & Configuration Management

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-005.1 | Must | Environment variables for all secrets: JWT_SECRET, Conekta API key, Verificamex API key, DB connection | No secrets in code | Updated: JWT propia (commit b887f08) |
| UR-005.2 | Must | Separate .env files per environment: .env.development, .env.staging, .env.production | Environment isolation | gaps §6 |
| UR-005.3 | Must | Frontend env vars prefixed with `VITE_` | Vite can expose to client bundle | gaps §6 |
| UR-005.4 | Must | Backend env vars NOT exposed to frontend | Server-only secrets protected | gaps §6 |
| UR-005.5 | Should | Config validation on startup (e.g., Joi, zod) | Missing config fails fast | gaps §6 |

## UR-006: Deployment Topology

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-006.1 | Must | Docker: frontend static build + backend container | Both containers deployable | gaps §6 |
| UR-006.2 | Must | VPS: single server deployment | All services on one VPS | gaps §6 |
| UR-006.3 | Must | Nginx: serves frontend static files AND reverse proxies /api/* to backend | Static + API on same domain | gaps §6 |
| UR-006.4 | Must | Cloudflare: DNS proxy, SSL/TLS termination, DDoS protection | HTTPS enforced via Cloudflare | gaps §6 |
| UR-006.5 | Must | Single origin: frontend and API on same domain (Nginx routes) | No CORS needed for same-origin | gaps §6 |
| UR-006.6 | Should | Docker Compose for local development | `docker compose up` works | gaps §6 |
| UR-006.7 | Should | Production Dockerfile optimized (multi-stage build, non-root user) | Small image, secure | gaps §6 |

> **Decisión de diseño (D-010)**: Docker Compose + Nginx + Cloudflare, same-origin. Kubernetes rechazado (overkill), Vercel rechazado (sin control de backend).

## UR-007: CI/CD Requirements

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-007.1 | Must | Automated tests on push | CI pipeline runs tests | gaps §4 |
| UR-007.2 | Must | Linting and type checking | No lint errors in CI | gaps §4 |
| UR-007.3 | Should | Automated build verification | Docker build succeeds in CI | gaps §4 |
| UR-007.4 | Should | Deployment pipeline: push to main → build → deploy | Continuous deployment functional | gaps §4 |
| UR-007.5 | Should | Database migration step in deployment | Migrations run automatically on deploy | gaps §4 |

## UR-008: Security

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-008.1 | Must | Secrets never in code or version control | .gitignore excludes .env files | gaps §6 |
| UR-008.2 | Must | Security headers via Nginx: X-Content-Type-Options, X-Frame-Options, CSP, HSTS | Headers present on responses | gaps §6 |
| UR-008.3 | Must | Rate limiting on backend (especially auth endpoints) | Brute-force protection | gaps §6 |
| UR-008.4 | Must | CORS configured for development (separate origins) | Frontend can call backend in dev | gaps §6 |
| UR-008.5 | Must | Input validation on all endpoints | SQL injection, XSS prevented | gaps §6 |
| UR-008.6 | Should | Helmet.js or equivalent security middleware | Security headers set | gaps §6 |
| UR-008.7 | Should | Dependency vulnerability scanning | No known critical CVEs | gaps §4 |

## UR-009: Real-Time Architecture — Chat, Voice/Video & Notifications

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-009.1 | Must | Real-time text chat via Socket.IO | Messages delivered bidirectionally in real-time | Updated: Socket.IO decision (commit b887f08) |
| UR-009.2 | Must | Voice/video calls via Agora (managed, global CDN) | Call initiation, connection, and termination functional | Updated: Agora (D-005) |
| UR-009.3 | Must | Notification delivery via push/email/in_app channels | Notifications dispatched per type/channel spec | notificaciones.md |
| UR-009.4 | Must | Voice note upload and playback (pre-recorded, not real-time streaming) | Voice notes upload and play | mensajeria.md |

**Arquitectura decidida: Socket.IO para chat tiempo real.**

Socket.IO elegido para chat. Cliente frontend en `lib/socket.ts`.

| Approach | Status | Notes |
|----------|--------|-------|
| **Socket.IO** | **DECIDIDO** para chat | Baja latencia, bidireccional, entrega confiable. Memoria por conexión — aceptable a escala VPS |
| Firebase Realtime DB | RECHAZADO | Vendor lock-in, data store separado, inconsistente con backend Express+MariaDB |
| Server-Sent Events (SSE) | No seleccionado | Unidireccional, insuficiente para chat |
| Polling | No seleccionado | Alta latencia, ancho de banda desperdiciado |

**Voice/Video: Agora — DECIDIDO para MVP.**

| Approach | Pros | Cons |
|----------|------|------|
| PeerJS (WebRTC) | Gratis, self-hosted, sin costo por minuto | Requiere servidor STUN/TURN, escalabilidad limitada, dependiente del browser |
| **Agora** | Gestionado, confiable, CDN global, SDKs | Costo por minuto, dependencia de vendor |

**Decisión de diseño (D-005)**: **Agora** — managed, global CDN, sin servidor TURN. Free tier 10K min/month cubre MVP. SDK: `agora-rtc-sdk-ng` (Web SDK v4).

## UR-010: Observability & Operations

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-010.1 | Must | Health check endpoint: GET /api/v1/health | Returns 200 with DB status | BR-014.1 |
| UR-010.2 | Must | Application logging: structured JSON logs | Logs queryable by level | gaps §4 |
| UR-010.3 | Must | Error logging: all 5xx errors with context | Errors traceable | BR-014.2 |
| UR-010.4 | Must | Database backup: automated daily backups | Backups restorable | BR-014.6 |
| UR-010.5 | Should | Process manager: PM2 or systemd | Auto-restart on crash | gaps §6 |
| UR-010.6 | Should | Log rotation | Logs don't fill disk | gaps §6 |
| UR-010.7 | Should | Rollback plan: previous Docker image tag preserved | Can revert to last working version | gaps §6 |

## UR-011: API Versioning

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-011.1 | Must | URL-based versioning: `/api/v1/...` | All endpoints versioned | BR-001.8 |
| UR-011.2 | Should | Version upgrade strategy documented | Process for breaking changes defined | gaps §6 |

## UR-012: File Upload & Storage

| ID | Priority | Requirement | Acceptance Criteria | Source |
|----|----------|-------------|---------------------|--------|
| UR-012.1 | Must | Photo upload for services (min 5 photos) | Photos uploadable and stored | interfaces_proveedor.md |
| UR-012.2 | Must | Voice note upload (max 120s audio) | Audio files uploadable | mensajeria.md |
| UR-012.3 | Should | Contract scan/photo storage | Contract documents stored | normativa_mexicana_2026.md |
| UR-012.4 | Must | File access: private URLs with signed tokens | Files not publicly accessible | gaps §6 |

> **Decisión de diseño (D-004)**: storage local + Nginx con signed URLs para MVP; migración a Cloudflare R2 preparada.

## Open Questions / Decisions Needed

| ID | Question | Impact | Resolution |
|----|----------|--------|-----------|
| UQ-002 | Push notification provider: FCM vs OneSignal? | Cost, features | **Resuelto**: FCM (D-003) |
| UQ-003 | Email provider: SendGrid vs Mailgun? | Cost, deliverability | **Resuelto**: Resend (D-003) |
| UQ-004 | File storage: S3 vs Cloudflare R2 vs local? | Cost, scalability | **Resuelto**: local + Nginx MVP (D-004), migración R2 |
| UQ-005 | Cloudflare: DNS-only or full proxy (Orange cloud)? | SSL, DDoS, performance | **Resuelto**: full proxy (D-010) — origin cert on VPS, SSL mode Full (Strict) |
| UQ-006 | Voice/video: PeerJS (WebRTC, free) vs Agora (managed, per-minute)? | Scope, cost | **Resuelto**: Agora (D-005) — managed, global CDN, no TURN server ops |
| UQ-007 | Search: SQL LIKE/regex vs full-text engine? | Performance, complexity | **Resuelto**: SQL + índices (D-002), upgrade si necesario |
| UQ-008 | CDN for static assets: Cloudflare + Nginx vs standalone CDN? | Cost, performance | Cloudflare proxy handles this |
| UQ-009 | Socket.IO middleware: auth verification on connection? | Security | **Resuelto**: verificar JWT en handshake (D-006) |

## Traceability Matrix

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

## Referencias de diseño resueltas

| Decisión | Elección | Detalle |
|----------|----------|---------|
| D-005 | Agora | Voice/video managed; global CDN; free tier 10K min/month |
| D-006 | Socket.IO | Auth JWT en handshake (UQ-009 resuelto), rooms por conversación, persistir-antes-broadcast |
| D-010 | Docker Compose + Nginx + Cloudflare full proxy | Same-origin, WebSocket support, origin cert, SSL Full (Strict) |
| D-011 | BullMQ + Redis | Job queue para scheduled messages; Redis 64MB allkeys-lru |
| D-014 | Socket.IO client config | Auto-reconnect exp backoff, JWT auth, room management, heartbeat 25s |
