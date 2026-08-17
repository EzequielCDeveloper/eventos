# Tasks: PRD Plataforma Eventos — Backend, Frontend & Unification

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~3200 (greenfield full-stack platform) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 8 PRs (S1→S8), stacked-to-main |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

> **NOTE**: This is a documentation/planning repo with no source code. Verification here is documentation-quality review, not automated test execution. Tasks reference concrete file paths for the target implementation repo.

### Suggested Work Units

| Slice | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|-------|------|-----------|----------------------|-----------------|-------------------|
| S1 | Backend scaffolding + auth + data layer | PR 1 | `npx tsc --noEmit && npx prisma generate` | N/A — no test runner in doc repo; validate at apply time | Revert backend/ scaffold, prisma/, types/ |
| S2 | Auth routes + services CRUD + search | PR 2 | `curl POST /api/auth/login` + `curl GET /api/v1/services` | N/A — requires running DB; manual curl validation | Revert routes/v1/auth*, routes/v1/services*, services/* |
| S3 | Reservations + packages + contracts | PR 3 | `curl POST /api/v1/reservations` state transitions | N/A — requires MariaDB + seed data | Revert reservation.service.ts, package.service.ts, contract.service.ts |
| S4 | Payments (Conekta) + commissions + tax reports | PR 4 | `curl POST /api/v1/payments` + webhook sim | N/A — requires Conekta sandbox keys | Revert payment.service.ts, integrations/conekta.ts |
| S5 | Real-time (Socket.IO chat) + notifications + identity + admin | PR 5 | `socket.io-client connect` + `curl GET /api/v1/notifications` | N/A — requires running server | Revert socket/, notification.service.ts, admin.routes.ts |
| S6 | Frontend client features | PR 6 | `npm run build` (Vite) | N/A — browser manual test | Revert features/search, features/booking, features/chat |
| S7 | Frontend provider + admin + platform | PR 7 | `npm run build` (Vite) | N/A — browser manual test | Revert features/provider, features/admin, components/ |
| S8 | Deployment + docs | PR 8 | `docker compose config` + `docker compose build` | N/A — requires Docker environment | Revert docker-compose.yml, nginx.conf, Dockerfiles |

## Phase 1: Backend Foundation & Scaffolding (Slice S1)

- [x] 1.1 Create `backend/package.json` — Node.js + Express + TypeScript + Prisma + helmet + cors + express-rate-limit + jsonwebtoken + zod + bullmq + ioredis dependencies (BR-001, BR-014, D-008, D-011)
- [x] 1.2 Create `backend/tsconfig.json` — strict mode, outDir dist, rootDir src, esModuleInterop (D-008)
- [x] 1.3 Create `backend/src/config/env.ts` — Zod-validated env vars: DATABASE_URL, JWT_SECRET, CONEKTA_API_KEY, VERIFICAMEX_API_KEY, FCM_SERVICE_ACCOUNT, RESEND_API_KEY; fail-fast on missing (UR-005, D-010)
- [x] 1.4 Create `backend/src/config/database.ts` — PrismaClient singleton with connection logging (BR-014.4, D-001)
- [x] 1.5 Create `backend/src/middleware/auth.ts` — JWT verification via jsonwebtoken, extract user.id/role/segment into req.user, reject expired/invalid tokens with 401, reject soft-deleted users (deleted_at set) (BR-002.1–BR-002.3, BR-002.6)
- [x] 1.6 Create `backend/src/middleware/requireRole.ts` — Role-based access: requireRole('prestador'), requireRole('administrador'); returns 403 on mismatch (BR-002.3, BR-002.4)
- [x] 1.7 Create `backend/src/middleware/errorHandler.ts` — Global error handler: map AppError to { error: { code, message, details? } }; standard HTTP status codes (BR-003.1–BR-003.3)
- [x] 1.8 Create `backend/src/middleware/validate.ts` — Zod schema validation middleware for request body/query (BR-003.1, UR-008.5)
- [x] 1.9 Create `backend/src/middleware/rateLimiter.ts` — express-rate-limit: 10 req/min on auth endpoints, 100 req/min on API (BR-014.3, UR-008.3)
- [x] 1.10 Create `backend/src/routes/v1/health.routes.ts` — GET /api/v1/health returns 200 with { status: "ok", db: "connected" } (BR-014.1, UR-010.1)
- [x] 1.11 Create `backend/src/app.ts` — Express app: helmet → cors → express.json → rateLimiter → routes → errorHandler (D-008)
- [x] 1.12 Create `backend/src/server.ts` — HTTP server + Socket.IO attach, SIGTERM graceful shutdown (D-006, D-010, BR-014.5)

## Phase 2: Data Layer & Types (Slice S1 continued)

- [x] 2.1 Create `backend/prisma/schema.prisma` — Generate via `prisma db pull` from database_schema.sql; all 30+ tables mapped with correct types: DECIMAL(10,2) for MXN, ENUMs for closed sets, JSON columns, soft delete via deleted_at (BR-004.1–BR-004.6, D-001)
- [x] 2.2 Create `backend/prisma/migrations/` — Versioned SQL migration from introspected schema, up/down pairs, idempotent (BR-004.7)
- [x] 2.3 Create `backend/prisma/seed.ts` — Seed data: default amenities, event types, initial commission rate (BR-004.8)
- [x] 2.4 Create `backend/src/types/models.ts` — TypeScript types matching Prisma models for all 30+ entities (UR-001.5)
- [x] 2.5 Create `backend/src/types/api.ts` — ApiResponse<T> envelope, ErrorCode union, pagination meta types (BR-001.4, BR-003.3, UR-001.1)
- [x] 2.6 Create `backend/src/types/express.d.ts` — Extend Express Request with user: { id, role, segment } (BR-002.2)

## Phase 3: Auth Routes & Service (Slice S2)

- [x] 3.1 Create `backend/src/services/auth.service.ts` — register(): validate unique email, hash password (bcrypt), create user, issue JWT; login(): validate credentials, check deleted_at IS NULL, issue JWT; refresh(): validate current JWT, issue new, invalidate old (BR-002.7, UR-003.1–UR-003.7)
- [x] 3.2 Create `backend/src/routes/v1/auth.routes.ts` — POST /auth/register, POST /auth/login, POST /auth/logout, GET /auth/me, POST /auth/refresh; all under /api/v1 prefix (UR-002.1, BR-001.8)
- [x] 3.3 Create `backend/src/routes/v1/users.routes.ts` — GET /users/me, PUT /users/me, POST /users/verify-ine, POST /users/verify-kyc (UR-002.2)
- [x] 3.4 Create `backend/src/routes/v1/index.ts` — Mount all v1 routers under /api/v1 (BR-001.8, UR-011.1)

## Phase 4: Services CRUD & Search (Slice S2 continued)

- [x] 4.1 Create `backend/src/services/search.service.ts` — List services with 8+ filter dimensions (date, capacity, zone, budget, event type, pool, internet, rating), pagination, sorting; query v_slot_availability view for availability (BR-001.6, BR-001.7, BR-004.9, D-002)
- [x] 4.2 Create `backend/src/routes/v1/services.routes.ts` — GET /services (search), GET /services/:id, POST /services, PUT /services/:id, DELETE /services/:id, GET /services/:id/slots, GET /services/:id/reviews (UR-002.3, UR-002.4, UR-002.5)
- [x] 4.3 Create `backend/src/routes/v1/pricing.routes.ts` — GET/POST/PUT /services/:id/pricing, GET/POST/DELETE /services/:id/extras, GET/POST/DELETE /services/:id/dynamic-rules (UR-002.4)
- [x] 4.4 Create `backend/src/routes/v1/inventory.routes.ts` — GET/POST/PUT/DELETE /services/:id/slots, GET/POST/DELETE /services/:id/blocks, GET/PUT /services/:id/hours (UR-002.5)

## Phase 5: Reservations & Packages (Slice S3)

- [x] 5.1 Create `backend/src/services/reservation.service.ts` — 13-state lifecycle state machine (creado→...→completada/cancelada); validate transitions; transactional slot availability check with SELECT FOR UPDATE; salon concurrency forced to 1; generate reservation_status_history on every change; snapshot cancellation_policy_snapshot at creation; calculate total_price = base + extras + taxes + commission (BR-005.1–BR-005.6, D-007)
- [x] 5.2 Create `backend/src/services/package.service.ts` — 7-state package lifecycle; salon-only creation; cross-slot availability verification; price auto-computation; member invite/respond flow; replacement invitation (BR-011.1–BR-011.5)
- [x] 5.3 Create `backend/src/services/contract.service.ts` — Contract creation on salon booking; GET /contracts/:id; PUT /contracts/:id/confirm; bilateral confirmation logic (UR-002.8, BR-012.6)
- [x] 5.4 Create `backend/src/routes/v1/reservations.routes.ts` — POST /reservations, GET /reservations, PUT /reservations/:id/status, GET /reservations/:id/timeline (UR-002.7)
- [x] 5.5 Create `backend/src/routes/v1/packages.routes.ts` — POST /packages, POST /packages/:id/invite, PUT /packages/:id/members/:id/respond, GET /packages/:id/availability (UR-002.6)
- [x] 5.6 Create `backend/src/routes/v1/contracts.routes.ts` — GET /contracts/:id, PUT /contracts/:id/confirm (UR-002.8)

## Phase 6: Payments & Commissions (Slice S4)

- [x] 6.1 Create `backend/src/integrations/conekta.ts` — Conekta server-side SDK client: createCharge(amount, currency='MXN', metadata), createRefund(chargeId, amount), verifyWebhook(payload, signature); MXN-only enforcement (BR-006.1, BR-006.5, BR-013.1, D-003)
- [x] 6.2 Create `backend/src/services/payment.service.ts` — Process payment via Conekta: anticipo/saldo/deposito_garantia types; calculate commission from latest commission_settings; store conekta_charge_id; update payment status; flexible billing models (BR-006.2–BR-006.6, BR-006.8)
- [x] 6.3 Create `backend/src/services/cancellation.service.ts` — Client cancel: advance non-refundable, near-cancel requires retention_accepted; provider cancel: FULL refund; refund order: advance→deposit→other; five refund reasons; Conekta refund API (BR-007.1–BR-007.6)
- [x] 6.4 Create `backend/src/routes/v1/payments.routes.ts` — POST /payments, GET /payments/:id, POST /payments/:id/refund (UR-002.9)
- [x] 6.5 Create `backend/src/routes/v1/webhooks.routes.ts` — POST /webhooks/conekta: verify signature, update payment status on charge.paid/charge.failed (BR-013.1)

## Phase 7: Real-Time Chat & Notifications (Slice S5)

- [x] 7.1 Create `backend/src/socket/index.ts` — Socket.IO server init: JWT auth middleware on handshake (verify token, check deleted_at, attach user to socket.data); join rooms per conversation (conv:{id}) (D-006, UR-009.1)
- [x] 7.2 Create `backend/src/socket/handlers.ts` — Event handlers: message (persist to DB, broadcast to room), typing, join-conversation, leave-conversation; offline delivery via FCM fallback (D-006, BR-008.1)
- [x] 7.3 Create `backend/src/services/message.service.ts` — Persist messages with sender/timestamp/read_at; voice note storage (max 120s CHECK); conversation uniqueness on (client_id, provider_id, service_id); quick replies CRUD; message search (BR-008.1–BR-008.6)
- [x] 7.4 Create `backend/src/services/notification.service.ts` — 16 notification types across 3 channels (push/email/in_app); critical notifications ≥2 channels; status tracking: pendiente→enviada→leida; event reminders H-48 push+email, H-2 push (BR-009.1–BR-009.6, D-003)
- [x] 7.5 Create `backend/src/integrations/fcm.ts` — Firebase Cloud Messaging client: sendPush(token, title, body, data); handle delivery status (BR-013.4, D-003)
- [x] 7.6 Create `backend/src/integrations/resend.ts` — Resend email client: sendEmail(to, subject, html); track delivery (BR-013.5, D-003)
- [x] 7.7 Create `backend/src/routes/v1/messages.routes.ts` — GET /conversations, GET/POST /conversations/:id/messages (UR-002.10)
- [x] 7.8 Create `backend/src/routes/v1/notifications.routes.ts` — GET /notifications, PUT /notifications/:id/read (UR-002.11)

## Phase 8: Identity Verification & Admin (Slice S5 continued)

- [x] 8.1 Create `backend/src/integrations/verificamex.ts` — Verificamex REST API client: POST with API key, 10s timeout; return verification result; log metadata only (no PII) (BR-010.5, BR-013.2)
- [x] 8.2 Create `backend/src/services/verification.service.ts` — KYC flow: consent_logs entry before verification; call Verificamex; store metadata result; provider verified=true on success; block publish until verified (BR-010.1–BR-010.7)
- [x] 8.3 Create `backend/src/routes/v1/admin.routes.ts` — GET /admin/stats, PUT /admin/commission, GET/POST /admin/disputes, GET/POST /admin/moderation; all gated to role='administrador' (BR-002.4, UR-002.14)
- [x] 8.4 Create `backend/src/routes/v1/reviews.routes.ts` — POST /reviews, GET /services/:id/reviews; review only when payment complete AND event_date < now (UR-002.12, FR-012.3)
- [x] 8.5 Create `backend/src/routes/v1/favorites.routes.ts` — POST /favorites, DELETE /favorites/:id (UR-002.13)

## Phase 9: File Storage & Scheduled Jobs (Slice S5 final)

- [x] 9.1 Create `backend/src/services/storage.service.ts` — Local disk storage at /data/uploads/{entity}/{id}/{filename}; signed URL generation with HMAC token + expiry; Nginx serves /uploads/ (D-004, BR-013.6, UR-012)
- [x] 9.2 Create `backend/src/jobs/scheduled-messages.ts` — BullMQ job: process 4 automation types from scheduled_messages table (BR-008.5, D-011)
- [x] 9.3 Create `backend/src/jobs/event-reminders.ts` — BullMQ job: H-48 push+email, H-2 push reminders to both client and provider (BR-009.6, D-011)
- [x] 9.4 Create `backend/src/jobs/alcohol-h5.ts` — BullMQ job: pause reservations at permiso_alcohol until H-5 decision (BR-005.8, D-011)
- [x] 9.5 Create `backend/src/integrations/agora.ts` + `backend/src/routes/v1/agora.routes.ts` — server-side Agora RTC token generation (appId, appCertificate, uid, channel, role, expiry) via agora-access-token; GET /api/v1/agora/token (requireAuth) (UR-009.2, D-005). Follow-up: discovered at S5 apply (no phase-7-9 task covered voice/video server side).

## Phase 10: Frontend Foundation (Slice S6)

- [x] 10.1 Create `frontend/package.json` — React 18 + Vite 5 + React Router v6 + Zustand + TanStack Query + Tailwind CSS + Radix UI + Socket.IO client + Conekta.js + axios (D-009)
- [x] 10.2 Create `frontend/vite.config.ts` — Vite config with React plugin, proxy /api to backend in dev, Tailwind CSS plugin (D-009)
- [x] 10.3 Create `frontend/tailwind.config.js` — Tailwind config with custom theme, responsive breakpoints, Radix UI integration (FR-015.1, FR-015.3)
- [x] 10.4 Create `frontend/tsconfig.json` — TypeScript strict mode, path aliases (@/ → src/) (D-009)
- [x] 10.5 Create `frontend/src/types/models.ts` — Mirror backend types for all 30+ entities (UR-001.5)
- [x] 10.6 Create `frontend/src/types/api.ts` — ApiResponse<T>, ErrorCode, pagination types matching backend (UR-001.1, BR-003.3)

## Phase 11: Frontend Platform & Shared (Slice S6 continued)

- [x] 11.1 Create `frontend/src/lib/api.ts` — Axios instance: JWT interceptor (attach Authorization: Bearer), 401→redirect /login, retry on 5xx with exponential backoff, error handling interceptor (FR-014.1–FR-014.4)
- [x] 11.2 Create `frontend/src/lib/socket.ts` — Socket.IO client: auth: { token }, auto-reconnect, room management per conversation, event listeners (FR-009.2, D-006)
- [x] 11.3 Create `frontend/src/stores/authStore.ts` — Zustand store: JWT, user profile, role; persist to localStorage; actions: login, logout, setUser (FR-013.1–FR-013.3)
- [x] 11.4 Create `frontend/src/stores/uiStore.ts` — Zustand store: theme, sidebar state, active modals (FR-013.1)
- [x] 11.5 Create `frontend/src/components/layout/AppLayout.tsx` — Client layout: 5-tab bottom nav (Inicio, Favoritos, Rentas, Chat, Perfil); secondary nav on Inicio (Salones/Sonidos/Servicios) (FR-001.1–FR-001.4)
- [x] 11.6 Create `frontend/src/components/layout/ProviderLayout.tsx` — Provider layout: 5-tab dashboard (Hoy, Mensajes, Calendario, Anuncios, Estadísticas) (FR-002.1–FR-002.2)
- [x] 11.7 Create `frontend/src/components/layout/AdminLayout.tsx` — Admin layout: 5 function areas (FR-003.1–FR-003.2)
- [x] 11.8 Create `frontend/src/components/ui/` — Shared primitives: Button, Dialog, Dropdown, Toast, Input, Select, Badge, Card (Radix UI wrappers) (FR-015.2)
- [x] 11.9 Create `frontend/src/components/routing/ProtectedRoute.tsx` — Route guard: check authStore.JWT, redirect unauthenticated to /login; role-based: client/provider/admin render correct layout (FR-017.1–FR-017.3)
- [x] 11.10 Create `frontend/src/App.tsx` — React Router v6 nested routes: / → client routes, /provider/* → provider routes, /admin/* → admin routes; lazy loading per feature (FR-017.1, FR-017.4)

## Phase 12: Frontend Client Features (Slice S6 continued)

- [x] 12.1 Create `frontend/src/features/search/SearchPage.tsx` — Multi-filter search: date, capacity, zone, budget, event type, pool, internet, rating; filter persistence across navigation; results: photo, title, rating, price, capacity, location (FR-004.1–FR-004.3)
- [x] 12.2 Create `frontend/src/features/search/hooks.ts` — useSearch: React Query hook for search API; useFilters: Zustand store for filter state (FR-013.4, FR-004.2)
- [x] 12.3 Create `frontend/src/features/booking/ServiceDetailPage.tsx` — Gallery (min 5 photos, swipeable), pricing, rating, amenities, extras, time slots, cancellation policy, reviews, favorite toggle (FR-005.1–FR-005.6)
- [x] 12.4 Create `frontend/src/features/booking/BookingFlow.tsx` — 6-step flow: date/time → extras → price summary (client-visible: rent+taxes, commission hidden) → Conekta.js payment → contract (salon) → confirmation; price summary shows cancellation policy; alcohol permit prompt at H-5 (FR-006.1–FR-006.9, FR-007.1–FR-007.4)
- [x] 12.5 Create `frontend/src/features/profile/ProfilePage.tsx` — User profile, settings, ARCO rights form, privacy consent, T&C acceptance, cookie consent (FR-016.1–FR-016.6)
- [x] 12.6 Create `frontend/src/features/chat/ChatPage.tsx` — Conversation list + detail; real-time messages via Socket.IO; voice note recording/playback (max 120s); read receipts (FR-009.1–FR-009.6)
- [x] 12.7 Create `frontend/src/features/notifications/NotificationCenter.tsx` — In-app notification center: read/unread state, critical highlights, badge count, push handling (FR-008.1–FR-008.5)
- [x] 12.8 Create `frontend/src/features/favorites/FavoritesPage.tsx` — Favorites list: persistent across sessions, synced with backend (FR-012.1)
- [x] 12.9 Create `frontend/src/features/rentals/RentalHistoryPage.tsx` — Tabs: Active, In-progress, Completed, Cancelled; review form: conditional on payment complete AND event_date < now (FR-012.2–FR-012.3)

## Phase 13: Frontend Provider Features (Slice S7)

- [ ] 13.1 Create `frontend/src/features/provider/ProviderDashboard.tsx` — Hoy tab: urgent alerts, weekly summary, reminders, quick actions (FR-011.5)
- [ ] 13.2 Create `frontend/src/features/provider/CalendarTab.tsx` — Monthly/weekly view, slot inventory, date blocking, dynamic pricing config (FR-011.6, FR-011.9)
- [ ] 13.3 Create `frontend/src/features/provider/ListingsTab.tsx` — Edit photos, description, rules, cancellation policy (FR-011.7)
- [ ] 13.4 Create `frontend/src/features/provider/StatsTab.tsx` — Payment history, earnings, response/acceptance rate, average rating (FR-011.8)
- [ ] 13.5 Create `frontend/src/features/provider/OnboardingWizard.tsx` — 3-step wizard: (1) type/location/capacity, (2) photos min 5/title/description, (3) pricing/policies/cancellation/deposit; progress indicator; auto-save between steps; resume on app close (FR-011.1–FR-011.4, FR-002.3–FR-002.4)
- [ ] 13.6 Create `frontend/src/features/provider/VerificationFlow.tsx` — KYC flow: consent → capture → result; verification badge display; client voluntary verification (FR-010.1–FR-010.4)

## Phase 14: Frontend Admin Features (Slice S7 continued)

- [ ] 14.1 Create `frontend/src/features/admin/AdminDashboard.tsx` — 5 function areas: moderation, provider management, stats, technical disputes, commission (FR-003.1–FR-003.2)
- [ ] 14.2 Create `frontend/src/features/admin/CommissionConfig.tsx` — Set global commission rate; update commission_settings table (FR-003.3)
- [ ] 14.3 Create `frontend/src/features/admin/ModerationPanel.tsx` — Content reports, provider blocks, service moderation (FR-003.2)
- [ ] 14.4 Create `frontend/src/features/admin/ProviderManagement.tsx` — Provider listing, verification status, block/unblock (FR-003.2)

## Phase 15: Deployment & Documentation (Slice S8)

- [ ] 15.1 Create `docker-compose.yml` — Production: backend (build ./backend, env vars, depends_on db healthy), db (mariadb:10.6, healthcheck, schema init), nginx (alpine, ports 80/443, volumes for dist/nginx.conf/certs) (UR-006.1–UR-006.3, D-010)
- [ ] 15.2 Create `docker-compose.dev.yml` — Development override: hot-reload volumes, dev env vars, exposed backend port (UR-006.6)
- [ ] 15.3 Create `backend/Dockerfile` — Multi-stage: build (node:20-alpine, npm ci, prisma generate, tsc) → production (node:20-alpine, non-root user, copy dist, expose 3000) (UR-006.7)
- [ ] 15.4 Create `frontend/Dockerfile` — Multi-stage: build (node:20-alpine, npm ci, npm run build) → production (nginx:alpine, copy dist) (UR-006.7)
- [ ] 15.5 Create `nginx.conf` — Reverse proxy: / → SPA (try_files), /api/* → backend:3000, /socket.io/ → WebSocket upgrade; security headers (X-Content-Type-Options, X-Frame-Options, CSP, HSTS); gzip; /uploads/ static serve (UR-006.3, UR-008.2, D-010)
- [ ] 15.6 Create `.env.example` — Document all env vars: JWT_SECRET, DATABASE_URL, CONEKTA_API_KEY, VERIFICAMEX_API_KEY, FCM_SERVICE_ACCOUNT, RESEND_API_KEY, VITE_API_URL, VITE_CONEKTA_PUBLIC_KEY (UR-005.1–UR-005.4)
- [ ] 15.7 Create `.github/workflows/ci.yml` — GitHub Actions: push/PR → lint → type-check → Docker build; push to main → build → SSH deploy (UR-007.1–UR-007.5)
- [ ] 15.8 Create `scripts/backup.sh` — Daily mysqldump via cron → compressed backup → retention 7 daily + 4 weekly (UR-010.4, D-010)
- [ ] 15.9 Create `scripts/deploy.sh` — Deploy script: docker compose pull → docker compose up -d → prisma migrate deploy → healthcheck (UR-007.4, UR-007.5, D-010)
- [ ] 15.10 Create `docs/api.md` — API reference: endpoint catalog, request/response shapes, auth flow, error codes (UR-001, UR-002, BR-003)
- [ ] 15.11 Create `docs/setup.md` — Local development setup: prerequisites, env vars, docker compose up, database setup (UR-006.6)

## Key Learnings

1. Greenfield full-stack platform requires 63 tasks across 15 phases to cover all PRD requirements systematically.
2. Eight chained PR slices keep each reviewable unit under 400 changed lines with autonomous rollback boundaries.
3. CFDI generation deferred per user instruction eliminates ~2 tasks but requirements remain documented for future activation.
4. Threat matrix is N/A for this documentation/planning deliverable — no routing, shell, or process-integration boundaries.
5. Verification in this documentation repo is documentation-quality review, not automated test execution.
