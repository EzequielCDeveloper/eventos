# Design: PRD Plataforma Eventos — Backend, Frontend & Unification

## Technical Approach

Full-stack marketplace: Node.js + Express REST API backed by MariaDB 10.6+ with a React + Vite SPA. Single VPS deployment via Docker Compose, Nginx reverse proxy, Cloudflare full proxy (orange cloud) DNS/TLS. Real-time chat via Socket.IO with JWT-authenticated handshake. Voice/video via Agora (managed, global CDN). Conekta for MXN payments. BullMQ (Redis) for job scheduling. All 30+ existing tables adopted as-is from `database_schema.sql` — no schema rewrite.

## Architecture Diagram

```mermaid
graph TB
  subgraph Client["Browser (React + Vite)"]
    UI[React SPA] --> API[api.ts - axios]
    UI --> Socket[socket.ts - Socket.IO]
    UI --> Conekta[Conekta.js]
    UI --> Agora[Agora RTC SDK]
  end

  subgraph VPS["VPS — Docker Compose"]
    subgraph Nginx["Nginx"]
      Static[Static files /]
      Proxy[/api/* → backend]
      WS[WebSocket /socket.io/]
    end

    subgraph Backend["Node.js + Express"]
      Auth[auth middleware]
      Routes[Route handlers]
      Services[Business logic]
      Repos[Data access layer]
      SocketIO[Socket.IO server]
      Jobs[BullMQ workers]
    end

    MariaDB[(MariaDB 10.6+)]
    Redis[(Redis 7 — BullMQ)]
  end

  subgraph External["External Services"]
    ConektaAPI[Conekta API]
    Verificamex[Verificamex API]
    FCM[Firebase Cloud Messaging]
    Resend[Resend Email API]
    AgoraAPI[Agora RTC Service]
  end

  UI --> Nginx
  Nginx --> Backend
  Socket --> SocketIO
  Backend --> MariaDB
  Backend --> Redis
  Backend --> ConektaAPI
  Backend --> Verificamex
  Backend --> FCM
  Backend --> Resend
  Backend --> AgoraAPI
  SocketIO --> MariaDB
```

## Architecture Decisions

### D-001: ORM / Data Access

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Prisma** | Type-safe, excellent MariaDB adapter, introspects existing schema, migration workflow (`prisma migrate`). Schema-first matches 1051-line SQL source. Auto-generates TS types from schema. Growing ecosystem. | **CHOSEN** |
| Knex.js | Query builder, flexible, good MariaDB support. No type safety, no schema definition. Migration files are raw SQL. | Rejected — no type safety |
| mysql2 raw | Maximum control, zero overhead. All SQL hand-written, no migration tooling, no type generation. | Rejected — unmaintainable at 30+ tables |
| Drizzle | Lightweight, SQL-like API, good types. Smaller ecosystem, less MariaDB maturity than Prisma. | Rejected — ecosystem risk |
| Sequelize | Mature, full ORM. Verbose models, weak TypeScript, known MariaDB quirks. | Rejected — legacy feel |

**Rationale**: Prisma's `schema.prisma` imports the existing SQL via `prisma db pull`, generating models from the 30+ tables without rewrite. Type safety catches mismatches at compile time. Migration workflow (`prisma migrate dev`) produces versioned SQL. MariaDB 10.6+ fully supported.

**Migration strategy**: `database_schema.sql` remains source of truth. Prisma introspects it to generate `schema.prisma`. Future schema changes go through Prisma migrations which produce SQL files. Seed script runs `prisma db seed`.

### D-002: Search Engine

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **SQL WHERE + INDEX** | Simple, zero infra, sufficient for MVP scale (thousands of services, not millions). Composite indexes on (service_type, status, max_capacity). | **CHOSEN** |
| MariaDB FULLTEXT | Built-in full-text on title/description. Requires FULLTEXT index, relevance scoring is basic. | Deferred — add if text search quality insufficient |
| Meilisearch | Fast, typo-tolerant, faceted search. Extra service to run on VPS. | Overkill for MVP |
| Elasticsearch | Powerful, heavy. Massive operational overhead. | Rejected — wrong scale |

**Rationale**: 8+ filter dimensions (date, capacity, zone, budget, event type, pool, internet, rating) map to SQL WHERE clauses with proper indexes. `v_slot_availability` view handles slot filtering. At <10K services, sub-50ms queries are trivial. FULLTEXT index on `services.title, services.description` added as a safety valve.

### D-003: Notification Providers

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **FCM (Firebase Cloud Messaging)** | Free tier covers MVP (unlimited for free). Requires Firebase project (free tier). Web push support via FCM API v1. De facto standard. | **CHOSEN — Push** |
| OneSignal | Free tier limited (30K subs). More dashboard features. | Rejected — free tier too restrictive |
| Web Push (VAPID) | No vendor dependency. Requires service worker, push subscription management. | Rejected — FCM already handles this |
| **Resend** | Free tier: 100 emails/day, 3K/month. Simple API, React Email integration, good deliverability. MX sending supported. | **CHOSEN — Email** |
| SendGrid | Free tier: 100/day. Complex API. | Rejected — more complex for same tier |
| Mailgun | Free tier: 1000/month (first 3 months only). Pay after. | Rejected — temporary free tier |
| Nodemailer + SMTP | No vendor lock-in. Requires SMTP server config. Lower deliverability without IP warming. | Rejected — deliverability risk |

**Cost at VPS scale**: FCM is free. Resend free tier (100/day) covers early MVP; paid plan at $20/mo for 50K emails if needed. In-app notifications are MariaDB `notifications` table — zero cost.

### D-004: File Storage

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Local disk + Nginx serving** | Zero cost, simple, Nginx already serving static. Backup via rsync. Sign via Nginx `secure_link` module or backend-signed tokens. Limitation: single VPS, manual scaling. | **CHOSEN — MVP** |
| Cloudflare R2 | S3-compatible, no egress fees, $0.015/GB. Requires SDK integration. | Migration path — adopt when traffic justifies |
| AWS S3 | Industry standard. Egress fees, more complex billing. | Rejected — cost for MVP |
| MinIO | Self-hosted S3-compatible. Extra container, operational overhead. | Rejected — unnecessary complexity |

**Approach**: Files stored at `/data/uploads/{entity}/{id}/{filename}` on VPS. Backend generates signed URLs with expiration (HMAC token in query string, validated by Nginx `secure_link` or Express middleware). Nginx serves `/uploads/` path. Backup: daily rsync to secondary location or Cloudflare R2 when ready.

**Signed URL flow**: Backend generates `GET /uploads/services/42/photo.jpg?token=xxx&expires=1234567890`. Nginx validates via `secure_link` module or backend middleware checks HMAC signature + expiry.

### D-005: Voice/Video Provider

| Option | Tradeoff | Decision |
|--------|----------|----------|
| PeerJS (WebRTC) — self-hosted | Free, no per-minute cost, full control. Requires STUN/TURN server on VPS (coturn). Browser-dependent quality. Limited to ~10 concurrent calls per VPS CPU. | Rejected — operational complexity, unreliable call quality |
| **Agora** | Managed, reliable, global CDN, SDKs for all platforms. $0.99/1000 minutes (voice), $3.99/1000 minutes (video). Free tier: 10K minutes/month. | **CHOSEN** |
| Daily.co | Managed WebRTC. $0.004/min. Simpler than Agora. | Rejected — Agora has better Mexico edge coverage |

**Rationale**: Agora chosen over PeerJS for operational simplicity and call reliability. PeerJS requires self-hosting STUN/TURN (coturn), which adds VPS operational burden and provides inconsistent call quality across browsers. Agora's global CDN has edge nodes in Mexico (Monterrey, Querétaro), providing sub-100ms latency. Free tier (10K min/month) covers MVP phase; paid tier at $0.99/1000 voice minutes scales linearly. SDKs available for React (Agora RTC SDK for Web). No coturn, no TURN server, no browser compatibility headaches.

**Implementation**: Frontend integrates `agora-rtc-sdk-ng` (Agora Web SDK v4). Backend generates Agora tokens via `agora-access-token` SDK (token expiration: 24h). Token endpoint: `GET /api/v1/agora/token?channel=<conversationId>`. Call state tracked in `call_logs` table (existing schema). Fallback: voice notes via Socket.IO for users who decline video.

### D-006: Socket.IO Architecture

**Server setup**: Single Socket.IO instance attached to Express HTTP server (same port). Configured with `cors: { origin: false }` (same origin via Nginx).

**Rooms per conversation**: Each conversation maps to a Socket.IO room `conv:{conversationId}`. On connection, client joins rooms for their conversations (queried from `conversations` table where `client_id = user.id OR provider_id = user.id`).

**JWT auth middleware on handshake** (resolves UR-009/UQ-009):

```typescript
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.users.findUnique({ where: { id: payload.sub } });
    if (!user || user.deleted_at) return next(new Error('Invalid user'));
    socket.data.user = user;
    next();
  } catch (e) { next(new Error('Invalid token')); }
});
```

**Message persistence**: Every message event writes to `messages` table via Prisma before broadcasting. Server emits to room after DB write confirms. This ensures persistence even if a client disconnects mid-delivery.

**Offline delivery**: When a user is not connected to Socket.IO, message is persisted to DB. Push notification (FCM) sent as fallback for the offline user. On reconnect, client fetches unread messages via REST `GET /conversations/:id/messages?after=<lastMessageId>`.

### D-007: Dynamic Pricing Timing

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Computed at booking time only** | Simple, no stale data. User sees "base price" on search, adjusted price on booking step 3. Slight UX disconnect. | **CHOSEN** |
| Computed at search time | Accurate price in search results. More DB queries per search. Rules change between search and booking. | Rejected — stale price risk |
| Persisted per slot | Zero runtime computation. Rules change → stale prices. Extra table to maintain. | Rejected — data drift |

**Concurrency-safe approach**: Dynamic pricing rules are read-only at booking time (snapshot). The `dynamic_pricing_rules` table is queried during price calculation in the booking service. A `SELECT ... FOR UPDATE` on the relevant `inventory_slots` row during reservation creation prevents double-booking. Price is frozen into `reservations.total_price` at confirmation — no retroactive recalculation.

### D-008: Backend Structure

```
backend/
├── src/
│   ├── config/              # env.ts (zod validation), database.ts, redis.ts
│   ├── middleware/
│   │   ├── auth.ts          # JWT verification, role extraction
│   │   ├── requireRole.ts   # Role-based access (usuario/prestador/admin)
│   │   ├── errorHandler.ts  # Global error handler → structured responses
│   │   ├── validate.ts      # Zod schema validation middleware
│   │   └── rateLimiter.ts   # express-rate-limit (auth endpoints: 10/min)
│   ├── routes/              # Express routers, thin — delegate to services
│   │   ├── v1/
│   │   │   ├── auth.routes.ts
│   │   │   ├── users.routes.ts
│   │   │   ├── services.routes.ts
│   │   │   ├── reservations.routes.ts
│   │   │   ├── payments.routes.ts
│   │   │   ├── messages.routes.ts
│   │   │   ├── notifications.routes.ts
│   │   │   ├── uploads.routes.ts
│   │   │   ├── agora.routes.ts
│   │   │   ├── admin.routes.ts
│   │   │   └── index.ts     # Mounts all /api/v1/* routes
│   ├── services/            # Business logic (pure functions, Prisma calls)
│   │   ├── auth.service.ts
│   │   ├── reservation.service.ts  # State machine, slot validation
│   │   ├── payment.service.ts      # Conekta integration
│   │   ├── notification.service.ts # Multi-channel dispatch
│   │   ├── message.service.ts      # Persist + broadcast
│   │   ├── search.service.ts       # Filter queries
│   │   ├── upload.service.ts       # File validation, storage, signed URLs
│   │   └── agora.service.ts        # Token generation, call state
│   ├── integrations/        # External service clients
│   │   ├── conekta.ts
│   │   ├── verificamex.ts
│   │   ├── fcm.ts
│   │   ├── resend.ts
│   │   └── agora.ts         # Agora REST API (token generation)
│   ├── socket/              # Socket.IO setup + handlers
│   │   ├── index.ts         # Server init, auth middleware
│   │   └── handlers.ts      # join, message, typing events
│   ├── jobs/                # BullMQ workers (Redis)
│   │   ├── queue.ts         # Queue definitions, Redis connection
│   │   ├── scheduled-messages.ts
│   │   ├── event-reminders.ts
│   │   └── alcohol-h5.ts
│   ├── app.ts               # Express app setup (helmet, cors, json, routes)
│   └── server.ts            # HTTP server + Socket.IO attach
├── prisma/
│   └── schema.prisma        # Generated from DB introspection
├── Dockerfile               # Multi-stage: build → production
└── package.json
```

**Middleware stack**: `helmet` → `cors` → `express.json` → `express-rate-limit` (auth) → `auth` → `requireRole` → route handler → `errorHandler`.

**API versioning**: `/api/v1/` prefix on all routes. Version upgrade: create `/api/v2/` alongside, deprecate v1 with `Sunset` header.

**Security**: Helmet.js for security headers. Rate limiting: 10 req/min on auth endpoints, 100 req/min on API. Input validation via Zod schemas on every request body/query.

### D-009: Frontend Architecture

**ADOPT** `frontend-architecture.md` structure as-is:

- `features/{auth,search,booking,provider,chat,payments,notifications,profile,admin}/` — each with components, hooks, pages, types
- `components/{ui,layout,icons}/` — shared UI primitives, AppLayout/ProviderLayout/AdminLayout
- `lib/{api.ts,socket.ts,conekta.ts,formatters.ts,constants.ts}` — centralized utilities
- `stores/{authStore.ts,uiStore.ts}` — Zustand global stores
- `types/{models.ts,api.ts}` — shared TypeScript types

**Additions to adopt**:
- `lib/api.ts`: Axios instance with JWT interceptor (attach `Authorization: Bearer`), 401 redirect to `/login`, retry on 5xx with exponential backoff
- `lib/socket.ts`: Socket.IO client with `auth: { token }`, auto-reconnect, room management per conversation
- React Query (TanStack Query) for server state caching — reduces redundant API calls, handles loading/error/loading states

**Routing guard**: `<ProtectedRoute role="prestador">` wrapper checks `authStore.role`. Lazy loading via `React.lazy()` + `Suspense` per feature route.

**Optimistic UI for booking**: Use React Query's `useMutation` with `onMutate` to optimistically show "booking in progress" state, rollback on error.

### D-010: Deployment Topology

```yaml
# docker-compose.yml (production)
services:
  backend:
    build: ./backend
    environment:
      - DATABASE_URL=mysql://user:pass@db:3306/eventos_db
      - JWT_SECRET=${JWT_SECRET}
      - CONEKTA_API_KEY=${CONEKTA_API_KEY}
      - REDIS_URL=redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 64mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      retries: 5
    restart: unless-stopped

  db:
    image: mariadb:10.6
    volumes:
      - db_data:/var/lib/mysql
      - ./database_schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_ROOT_PASSWORD}
      - MYSQL_DATABASE=eventos_db
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      retries: 5
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  db_data:
  redis_data:
```

**Nginx config highlights**:
- `/` → serve SPA (`try_files $uri /index.html`)
- `/api/*` → proxy to `backend:3000`
- `/socket.io/` → proxy with WebSocket upgrade headers
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`
- Gzip compression on text/json/css/js

**Cloudflare**: Full proxy (orange cloud). Origin certificate (Cloudflare Origin CA) on VPS for TLS between Cloudflare edge and origin. SSL mode: Full (Strict). WebSocket support enabled in Cloudflare dashboard.

**Environment variables**:
- `.env.development` — local Docker Compose
- `.env.staging` — staging VPS
- `.env.production` — production VPS
- Frontend: `VITE_API_URL`, `VITE_CONEKTA_PUBLIC_KEY`, `VITE_AGORA_APP_ID`
- Backend: `DATABASE_URL`, `JWT_SECRET`, `CONEKTA_API_KEY`, `VERIFICAMEX_API_KEY`, `FCM_SERVICE_ACCOUNT`, `RESEND_API_KEY`, `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`, `REDIS_URL`

**CI/CD**: GitHub Actions — push to `main` → lint → test → Docker build → SSH deploy to VPS (`docker compose pull && docker compose up -d`). Database migrations: `docker compose exec backend npx prisma migrate deploy` in deployment script.

**Backups**: Daily `mysqldump` via cron on VPS → compressed backup to `/backups/` + optional upload to Cloudflare R2. Retention: 7 daily + 4 weekly.

**Healthcheck**: `GET /api/v1/health` returns `{ status: "ok", db: "connected" }`. Docker healthcheck pings this endpoint. Nginx `proxy_next_upstream` on backend failure.

**Rollback**: Keep previous Docker image tagged (`eventos-backend:previous`). Rollback: `docker compose up -d --force-recreate` with previous tag. DB migrations are forward-only (no down in production); if rollback needed, restore from backup.

### D-011: Job Queue — Scheduled Tasks

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **BullMQ (Redis)** | Reliable job scheduling, retries, delayed jobs, job persistence across restarts. Requires Redis instance. Battle-tested in Node.js ecosystem. | **CHOSEN** |
| node-cron (in-process) | Zero dependencies, simple cron syntax. Jobs lost on restart, no retry, no persistence. | Rejected — unreliable for scheduled messages |
| Agenda (MongoDB) | Persistent, MongoDB-backed. Wrong DB (we use MariaDB). | Rejected — wrong database |
| Custom MariaDB polling | No extra infra. Polling overhead, timing drift, race conditions. | Rejected — poor reliability |

**Rationale**: BR-008.5 requires 4 automation types for scheduled messages (post-booking, pre-event, post-event, follow-up). These MUST survive server restarts and have retry logic. BullMQ with Redis provides: delayed jobs (`add('send-reminder', { userId }, { delay: 48*3600*1000 })`), automatic retries (exponential backoff), job progress tracking, and dashboard (Bull Board). Redis adds ~30MB RAM on VPS — negligible.

**Implementation**: Redis runs as Docker service (`redis:7-alpine`, 64MB maxmemory, `allkeys-lru`). BullMQ workers in `backend/src/jobs/`. Job types: `scheduled-message`, `event-reminder-h48`, `event-reminder-h2`, `alcohol-h5-prompt`. Health check: Redis ping in `/api/v1/health`.

### D-012: File Upload Path

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Backend proxy (multer → local disk)** | Simple, no direct client-to-storage exposure. Backend validates file type/size, saves to `/data/uploads/`, returns signed URL. Upload limit: 10MB per file, 50MB total per request. | **CHOSEN — MVP** |
| Direct to S3/R2 (presigned URLs) | No backend bandwidth usage. Requires presigned URL flow, more complex. | Migration path — adopt with R2 |
| Cloudinary | Auto-optimization, transforms. Vendor dependency, cost at scale. | Rejected — overkill for MVP |

**Rationale**: BR-013.6 + FR-011.3 require photo upload (min 5 photos per service) and voice note upload. Backend proxy approach: client POSTs multipart/form-data to `/api/v1/uploads`, backend validates (MIME type, size), saves to disk, returns `{ url: "/uploads/...", size, mimeType }`. Nginx serves `/uploads/` with `X-Accel-Redirect` for large files. Signed URLs via HMAC token for private access.

**Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp` (photos), `audio/mpeg`, `audio/ogg` (voice notes). Max sizes: photos 5MB, voice notes 10MB (120s audio).

### D-013: Frontend State Persistence

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Zustand + localStorage (selective)** | Persist auth token, user profile, UI preferences (theme, language). NOT for booking flow or form state — those use React Query cache. | **CHOSEN** |
| Full localStorage persistence | Everything survives refresh. Stale data risk, complex reconciliation. | Rejected — data drift |
| sessionStorage only | Tab-scoped, cleared on close. Insufficient for auth persistence. | Rejected — auth needs persistence |
| IndexedDB (via idb) | Large storage, structured queries. Overkill for MVP data volumes. | Rejected — complexity |

**Rationale**: FR-002.4 requires onboarding resume on app close. FR-013.1 requires auth state persistence. Zustand's `persist` middleware with `localStorage` handles this: `authStore` persists `token`, `user`, `role`. `uiStore` persists `theme`, `sidebarCollapsed`. Booking flow state lives in React Query cache (auto-invalidated, no persistence needed). Form state (onboarding wizard) uses `sessionStorage` per step — survives accidental refresh but not tab close.

**Implementation**:
```typescript
// stores/authStore.ts
export const useAuthStore = create(
  persist(
    (set) => ({ token: null, user: null, role: null, ... }),
    { name: 'auth-storage' } // localStorage key
  )
)
```

### D-014: Socket.IO Client Configuration

| Aspect | Decision |
|--------|----------|
| **Reconnection** | Auto-reconnect with exponential backoff: 1s, 2s, 4s, 8s, max 30s. `reconnectionAttempts: 10` (then show "connection lost" banner). |
| **Auth** | `auth: { token: useAuthStore.getState().token }` on connection. Token refreshed via REST; Socket.IO reconnects with new token. |
| **Rooms** | Client joins `conv:{id}` rooms on connect. Server sends room list in handshake response. On new conversation, server emits `room:created` → client joins. |
| **Events** | `message:new`, `message:read`, `typing:start`, `typing:stop`, `call:incoming`, `call:accepted`, `call:ended` |
| **Transport** | WebSocket first, fallback to HTTP long-polling (default Socket.IO behavior). Nginx configured with `proxy_set_header Upgrade $http_upgrade` for WS upgrade. |
| **Heartbeat** | Server: `pingInterval: 25000`, `pingTimeout: 20000`. Detects dead connections faster than TCP timeout. |

**Implementation**: `lib/socket.ts` exports singleton `getSocket()` that initializes on first call, reuses connection. Socket stored in Zustand `chatStore` (not persist — ephemeral connection state). Disconnect handler shows toast: "Reconnecting...". Reconnect handler fetches missed messages via REST.

## Data Model Mapping

All 30+ tables from `database_schema.sql` **adopted as-is**. Prisma introspects the live DB to generate models. No schema changes in this phase.

| Table Group | Tables | Mapping |
|-------------|--------|---------|
| Users & Legal | `users`, `consent_logs`, `arco_requests`, `identity_verifications`, `provider_blocks` | Direct Prisma models. Soft delete via `deleted_at` (filtered in default scope). |
| Services | `services`, `service_photos`, `amenities`, `service_amenities`, `service_event_types`, `service_service_event_types` | Direct. N:M junctions via Prisma implicit many-to-many or explicit. |
| Pricing | `salon_pricing`, `sound_packages`, `service_persona_pricing`, `service_extras`, `dynamic_pricing_rules` | Direct. Polymorphic pricing by service_type. |
| Inventory | `inventory_slots`, `availability_blocks`, `operating_hours` | Direct. Slot availability via `v_slot_availability` view. |
| Packages | `packages`, `package_members` | Direct. Package state machine in `reservation.service.ts`. |
| Reservations | `reservations`, `reservation_status_history`, `reservation_items`, `reservation_extras` | Direct. State machine enforced in application layer. Trigger `trg_reservation_status_audit` kept in DB. |
| Payments | `payments`, `refunds`, `cancellations` | Direct. Conekta integration in `payment.service.ts`. |
| Contracts | `contracts`, `alcohol_permits` | Direct. Contract flow in application layer. |
| Messaging | `conversations`, `messages`, `call_logs`, `quick_replies`, `scheduled_messages` | Direct. Socket.IO writes to `messages`. Jobs process `scheduled_messages`. |
| Notifications | `notifications`, `reviews`, `favorites` | Direct. Multi-channel dispatch in `notification.service.ts`. |
| Admin/Commission | `commission_settings`, `invoices`, `technical_disputes`, `content_reports`, `audit_logs` | Direct. CFDI (`invoices`) deferred — table exists but no generation logic. |
| Views | `v_provider_ranking`, `v_slot_availability` | Queried via Prisma `$queryRaw` or raw SQL. |

**No schema migration required** — the SQL file is the canonical source. Prisma `schema.prisma` generated via `prisma db pull`.

## Interfaces / Contracts

### Response Envelope
```typescript
interface ApiResponse<T> {
  data: T;
  meta?: { total: number; page: number; limit: number; pages: number };
  errors?: Array<{ code: string; message: string; details?: unknown }>;
}
```

### Error Codes
```typescript
type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'RESERVATION_SLOT_CONFLICT'
  | 'PROVIDER_NOT_VERIFIED'
  | 'PAYMENT_FAILED'
  | 'STATE_TRANSITION_INVALID'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN';
```

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No data migration required. Schema is new (greenfield). Deployment is Docker Compose on VPS. Rollback via previous Docker image tag + DB backup restore if needed.

## Open Questions

- [x] ~~CFDI generation~~: **DEFERRED** per user instruction. When re-activated, recommend `facturapi` or `billapp` SDK. No design work now.
- [x] ~~Dark mode~~ (FR-015.5): **DEFERRED** to post-MVP. Tailwind dark mode class toggle is trivial to add later; not worth MVP scope.
- [x] ~~Map view for search results~~ (FR-004.4): **DEFERRED** to post-MVP — Leaflet + OpenStreetMap if needed. List view sufficient for MVP.
