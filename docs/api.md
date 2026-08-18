# FiestaExpert API Reference

The REST API behind the Plataforma Eventos marketplace. Node + Express + MariaDB
(Prisma), versioned under `/api/v1`. This reference is generated from the
backend routes (`backend/src/routes/v1/*`) and matches the running code exactly.

## Quick path

1. Base URL: `https://<your-domain>/api/v1` (single origin — Nginx proxies
   `/api/` to the backend; no CORS needed in production).
2. Get a token: `POST /api/v1/auth/login` with `{ email, password }`.
3. Call protected endpoints with `Authorization: Bearer <accessToken>`.
4. Treat every success body as `{ data: ..., meta? }` and every failure as
   `{ error: { code, message, details? } }`.

> Public endpoints (`/health`, `/auth/register`, `/auth/login`, `/auth/refresh`,
> `/webhooks/*`, service search/detail/slots) do **not** require a token.

## Conventions

| Topic | Rule |
|-------|------|
| Versioning | All routes under `/api/v1`. Anything else → `404 NOT_FOUND`. |
| Success envelope | `{ "data": <T>, "meta": { total, page, limit, pages }? }` (BR-001.4). |
| Error envelope | `{ "error": { "code": <ErrorCode>, "message": string, "details"? } }` (BR-003). |
| Pagination | Query `?page=&limit=` (defaults 1 / 20, max limit 100). Lists return `meta`. |
| Auth | `Authorization: Bearer <accessToken>` (JWT). Missing/invalid → `401 UNAUTHORIZED` (BR-002). |
| Roles | `usuario`, `prestador`, `administrador` (BR-002.3–BR-002.4). Violation → `403 FORBIDDEN`. |
| Money | `DECIMAL(10,2)` MXN, returned as ISO-safe values (BR-004.4). |
| Dates | ISO 8601. Time-only values use `HH:mm[:ss]`; date-only use `YYYY-MM-DD`. |
| Rate limits | Auth endpoints `10 req/min` per IP; general API `100 req/min` (BR-014.3) → `429 RATE_LIMITED`. |
| Logging | Every request is JSON-logged: method, path, status, duration, user_id (BR-014.2). |

### Error codes (BR-003.3)

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Zod body/query/params validation failed; `details[]` lists field issues. |
| `UNAUTHORIZED` | 401 | Missing/expired/invalid JWT, soft-deleted user, bad webhook signature. |
| `FORBIDDEN` | 403 | Authenticated but wrong role, or signed-URL missing/expired/invalid. |
| `NOT_FOUND` | 404 | Resource/route not found. |
| `CONFLICT` | 409 | Duplicate unique key (e.g. favorite already added, already reviewed). |
| `RESERVATION_SLOT_CONFLICT` | 409 | Slot already taken at booking time (D-007 `SELECT FOR UPDATE`). |
| `STATE_TRANSITION_INVALID` | 409 | Reservation state machine rejected the transition. |
| `PROVIDER_NOT_VERIFIED` | 422 | Provider tried to publish without identity verification (BR-002.5). |
| `UNPROCESSABLE_ENTITY` | 422 | Business rule violation (e.g. review before event/paid). |
| `PAYMENT_FAILED` | 402 | Conekta charge/refund failed. |
| `RATE_LIMITED` | 429 | Too many requests (see rate limits above). |
| `SERVICE_UNAVAILABLE` | 503 | Health check when DB is down. |
| `INTERNAL_ERROR` | 500 | Unhandled error — no internals leak (BR-003.2). |

## Authentication flow

```
POST /api/v1/auth/register  → 201 { data: { user, tokens } }
POST /api/v1/auth/login     → 200 { data: { user, tokens } }
POST /api/v1/auth/refresh   → 200 { data: { user, tokens } }   (rotates)
POST /api/v1/auth/logout    → 200 { data: { revoked: true } }  (revokes refresh token)
```

`tokens = { accessToken: "<jwt>", refreshToken: "<jwt>" }`.
`access_token` validity is set by `JWT_EXPIRES_IN` (default `7d`); refresh
tokens rotate to `JWT_REFRESH_EXPIRES_IN` (default `30d`) and are single-use
(revoked on refresh/logout).

```bash
# Login and use the token
curl -s -X POST https://example.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"password123"}'
# → { "data": { "user": { ... }, "tokens": { "accessToken": "...", "refreshToken": "..." } } }

curl -s https://example.com/api/v1/users/me \
  -H 'Authorization: Bearer <accessToken>'
```

JWT payload carries the authenticated principal: `user.id`, `user.role`,
`user.segment` (BR-002.2). A JWT for a **soft-deleted user** is rejected
(`deleted_at` guard, BR-002.6).

## Endpoint catalog

Auth `POST /auth/*`, `GET /auth/me` — see [Authentication flow](#authentication-flow).

### Users — `/api/v1/users` (all `requireAuth`)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/users/me` | — | `{ data: { user } }` |
| PUT | `/users/me` | `full_name? phone? avatar_url? (url but nullable) notification_prefs? (object)` | `{ data: { user } }` |
| POST | `/users/verify-ine` | `document_url? notes?` | `201 { data: { verification } }` (offline/INe presencial) |
| POST | `/users/verify-kyc` | `curp, clave_elector, nombre_completo, ocr?` | `201 { data: { verification } }` (Verificamex KYC, BR-010) |
| POST | `/users/arco-requests` | `tipo (acceso/rectificacion/cancelacion/oposicion)` | `201 { data: { id, tipo, status, requested_at, deadline_at } }` (ARCO, BR-012) |
| GET | `/users/arco-requests` | — | `{ data: ArcoRequest[] }` (current user, newest first) |
| GET | `/users/me/cancellation-policy` | — | `{ data: CancellationPolicy }` (auto-created with defaults on first read; role `prestador`) |
| PUT | `/users/me/cancellation-policy` | `retention_percent? (0..100) penalty_free_window_days? (1..90) deposit_refundable? (bool)` | `{ data: CancellationPolicy }` (partial PATCH; role `prestador`) |

> KYC values are used in-flight only and **never persisted or logged** (BR-010.6).
>
> ARCO requests (LFPDPPP, BR-012): created with `status=pendiente` and
> `deadline_at = now + 20 business days`; `deadline_at` is `YYYY-MM-DD`.
>
> Cancellation policies are one-per-provider (unique FK). The read path
> auto-creates the policy with the defaults used at service creation (50%
> retention, 30-day penalty-free window, deposit refundable) — FR-011.7.

### Health & version

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/health` | public | `200 { status: "ok", db: "connected" }`, `503` when DB down (not the standard envelope) |
| GET | `/version` | public | `200 { data: { version: "v1" } }` |

### Services — search & detail — `/api/v1/services` (public reads)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/services` | filters: `service_type, date, capacity, zone, min_price, max_price, event_type, event_type_name, pool, internet, rating, sort (created:desc|rating:desc|price:asc|price:desc|name:asc), page, limit` | `{ data: Service[], meta }` (published, non-deleted only) |
| GET | `/services/:id` | — | `{ data: ServiceDetail }` \| `404` |
| GET | `/services/:id/slots` | `from? to?` (YYYY-MM-DD) | `{ data: SlotAvailability[] }` via `v_slot_availability` |
| GET | `/services/:id/reviews` | `page? limit?` | `{ data: Review[], meta }` |

### Services — provider writes (auth + role `prestador`, owner-only)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/services/me` | — | `{ data: ProviderServiceSummary[] }` (own services, all statuses incl. `borrador`, newest first — FR-011.7) |
| POST | `/services` | full create aggregate: `service_type (salon/ sonido/ servicio_persona), title, description, location_type, location {lat,lng,address}, coverage_area?, max_capacity, approval_mode?, viaticos_per_km?, deposit_amount?, cofepris_responsibility_accepted?, pricing {salon?{(base_block_hours,base_block_price,extra_hour_price)}, sound_packages?[ {name,description,base_price,base_hours,extra_hour_price} ], persona?{price_per_person_per_hour}}, photos?[{url,position}], amenity_ids?, event_type_ids?` | `201 { data: Service }` (draft) |
| PUT | `/services/:id` | partial: `title? description? location_type? location? coverage_area? max_capacity? approval_mode? viaticos_per_km? deposit_amount? cofepris_responsibility_accepted? status? (borrador/pendiente_verificacion/publicado/rechazado)` | `{ data: Service }` (publish gate checks `verified` — BR-002.5) |
| DELETE | `/services/:id` | — | `{ data: { deleted: true } }` (soft delete) |
| POST | `/services/:id/photos` | `url (url ≤500), position? (int ≥0)` | `201 { data: { id, url, position, status, created_at } }` (`status=pendiente_moderacion`, owner only) |
| PUT | `/services/:id/photos/reorder` | `positions: [photoId, …]` (array order = new position) | `{ data: [{ id, position }] }` (owner only) |
| DELETE | `/services/:id/photos/:photoId` | — | `{ data: { deleted: true } }` (hard delete, owner only) |

> `GET /services/me` is the primary source for the provider dashboard
> (FR-011.7). It is registered before `/services/:id` so the literal segment
> wins the match; `min_price` is serialized as a two-decimal money string
> mirroring the marketplace price selector, and `cover_photo_url` is the
> first approved photo.

### Pricing — `/api/v1/services/:serviceId/*` (public reads; writes: `prestador` + owner)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/services/:serviceId/pricing` | — | `{ data: Pricing }` (polymorphic by type) |
| POST | `/services/:serviceId/pricing` | `salon?{..} \| sound_package?{..} \| persona?{..}` | `201 { data }` |
| PUT | `/services/:serviceId/pricing` | same shape | `{ data }` |
| GET | `/services/:serviceId/extras` | — | `{ data: Extra[] }` |
| POST | `/services/:serviceId/extras` | `name, description, price, sound_package_id?` | `201 { data }` |
| DELETE | `/services/:serviceId/extras/:extraId` | — | `{ data: { deleted: true } }` |
| GET | `/services/:serviceId/dynamic-rules` | — | `{ data: Rule[] }` |
| POST | `/services/:serviceId/dynamic-rules` | `adjustment_type (temporada/demanda/dia_semana/bloque_turno), adjustment_value (>=0), scope (object), sound_package_id?` | `201 { data }` |
| DELETE | `/services/:serviceId/dynamic-rules/:ruleId` | — | `{ data: { deleted: true } }` |

### Inventory — `/api/v1/services/:serviceId/*` (public reads; writes: `prestador` + owner)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/services/:serviceId/slots` | `from? to?` | `{ data: Slot[] }` |
| POST | `/services/:serviceId/slots` | `slot_date, start_time, end_time, capacity` | `201 { data }` |
| PUT | `/services/:serviceId/slots/:slotId` | `start_time? end_time? capacity?` | `{ data }` |
| DELETE | `/services/:serviceId/slots/:slotId` | — | `{ data: { deleted: true } }` |
| GET | `/services/:serviceId/blocks` | — | `{ data: Block[] }` |
| POST | `/services/:serviceId/blocks` | `start_datetime, end_datetime (ISO-8601 with offset), type (mantenimiento/inoperacion/evento_privado)` | `201 { data }` |
| DELETE | `/services/:serviceId/blocks/:blockId` | — | `{ data: { deleted: true } }` |
| GET | `/services/:serviceId/hours` | — | `{ data: Hours[] }` |
| PUT | `/services/:serviceId/hours` | `hours: [{ day_of_week (1..7), open_time, close_time, base_block_duration_hours?, extra_hours_allowed? }]` (≤7) | `{ data }` |

### Reservations — `/api/v1/reservations` (auth)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| POST | `/reservations` | `slot_id? \| package_id? \| slot_ids?[id], items?[{sound_package_id? person_count?}], extras?[{extra_id, quantity}], alcohol_requested?` | `201 { data: Reservation }` (transactional slot lock, D-007) |
| GET | `/reservations` | `status? (one of 13 states), event_date?, page?, limit?` | `{ data: Reservation[], meta }` (actor-scoped) |
| PUT | `/reservations/:id/status` | `status (one of 13 states), alcohol_resolution?, alcohol_status?, cancel_reason?, retention_accepted?` | `{ data }` (state machine, BR-005) |
| GET | `/reservations/:id/timeline` | — | `{ data: reservation_status_history[] }` (audit trail) |
| POST | `/reservations/:id/cancel` | `reason? retention_accepted? cancelled_by? (cliente/proveedor)` | `{ data }` (cancellation + refund, BR-007) |

Reservation states: `creado, invitaciones_pendientes, invitaciones_aceptadas,
disponibilidad_verificada, disponible_para_reserva, pendiente_firma,
contrato_confirmado, permiso_alcohol, pago_anticipo, confirmada, en_curso,
completada, cancelada`.

### Packages — `/api/v1/packages` (auth; creation/invite/advance: `prestador`)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| POST | `/packages` | `members: [{ provider_id, service_type (sonido/servicio_persona), member_price? }]` (salon leader only, 1–20) | `201 { data }` |
| GET | `/packages/:id` | — | `{ data }` (leader/member view) |
| POST | `/packages/:id/invite` | `provider_id, service_type, member_price?` | `201 { data }` |
| PUT | `/packages/:id/members/:memberId/respond` | `accept (bool), member_price?` | `{ data }` |
| GET | `/packages/:id/availability` | `date, start_time, end_time` | `{ data: report }` |
| POST | `/packages/:id/availability` | `date, start_time, end_time` | `{ data }` (atomic check + advance state, BR-011.3) |

### Contracts — `/api/v1/contracts` (auth)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/contracts/:id` | — | `{ data: Contract }` (client/provider/admin) |
| PUT | `/contracts/:id/confirm` | `party (cliente/proveedor)` | `{ data }` — advances to `contrato_confirmado` once both parties confirm (BR-012.6) |

### Payments — `/api/v1/payments` (auth)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| POST | `/payments` | `reservation_id, payment_type (anticipo/saldo/deposito_garantia), amount, currency (default MXN, BR-006.5), billing_model (anticipo/completo/post_servicio), description?` | `201 { data }` (Conekta charge) |
| GET | `/payments/reports/monthly` | `year, month` (prestador/administrador) | `{ data: report }` (transactions, gross, taxes, commission, net) |
| GET | `/payments/:id` | — | `{ data }` (participant-scoped, with refunds) |
| POST | `/payments/:id/refund` | `amount?, reason (cancelacion_proveedor/cancelacion_cliente/deposito_devolucion/politica_proveedor/permiso_alcohol_no_confirmado)` | `{ data }` |

### Webhooks — `/api/v1/webhooks` (public, signature-gated)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| POST | `/webhooks/conekta` | raw Conekta event (RSA `DIGEST` or HMAC `X-Conekta-Signature`) | `{ data: { received: true, event } }` — updates payment status on `charge.paid` → `procesado`, `charge.failed`/`charge.declined` → `fallido`. Invalid signature → `401`. |

### Messages & quick replies (auth) — mounted at `/api/v1`

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/conversations` | `page? limit?` | `{ data: Thread[], meta }` (with unread counts) |
| POST | `/conversations` | `client_id, provider_id, service_id? (nullable)` | `201 { data }` (get-or-create unique thread) |
| GET | `/conversations/:id/messages` | `after? (cursor id) page? limit?` | `{ data: Message[], meta }` |
| POST | `/conversations/:id/messages` | `type (texto/nota_voz), content? (≤5000), audio_url? (url ≤500), duration_seconds? (1..120)` | `201 { data }` (voice ≤120s, BR-008.2) |
| PUT | `/conversations/:id/read` | — | `{ data }` (mark read) |
| GET | `/messages/search` | `q, page? limit?` | `{ data: Message[], meta }` (BR-008.6) |
| GET | `/quick-replies` | — | `{ data: Item[] }` (provider) |
| POST | `/quick-replies` | `name, content` | `201 { data }` (provider) |
| PUT | `/quick-replies/:id` | `name? content?` | `{ data }` (provider) |
| DELETE | `/quick-replies/:id` | — | `204` (provider) |

### Notifications — `/api/v1/notifications` (auth)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/notifications` | `status? (pendiente/enviada/leida) page? limit?` | `{ data: Notification[], meta }` |
| GET | `/notifications/unread` | — | `{ data: { unread: number } }` |
| PUT | `/notifications/:id/read` | — | `{ data }` |

### Admin — `/api/v1/admin` (auth + role `administrador`)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/admin/stats` | — | `{ data: { users, services, reservations, payments, moderation, disputes } }` |
| PUT | `/admin/commission` | `commission_rate (0.01..100)` | `{ data: { id, commission_rate, changed_by, changed_at } }` |
| GET | `/admin/disputes` | `status? (abierta/resuelta) page? limit?` | `{ data, meta }` |
| POST | `/admin/disputes` | `reservation_id, type (default tecnica)` | `201 { data }` |
| POST | `/admin/disputes/:id/resolve` | `resolution (≤2000)` | `{ data }` |
| GET | `/admin/moderation` | `status? (pendiente/resuelto) page? limit?` | `{ data, meta }` |
| POST | `/admin/moderation/:id/action` | `action (aprobar/advertir/eliminar)` | `{ data }` — `eliminar` soft-deletes the service |
| GET | `/admin/providers` | `verified? (true/false) page? limit?` | `{ data, meta }` |
| POST | `/admin/providers/:id/block` | `reason` | `201 { data }` |
| POST | `/admin/providers/:id/unblock` | — | `{ data }` |

### Reviews — `/api/v1` (auth)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| POST | `/reviews` | `reservation_id, rating (1..5), comment? (≤2000)` | `201 { data }` — only when reservation `completada`, event date passed, full payment received (FR-012.3) |
| GET | `/reviews/:id` | — | `{ data: Review }` |

### Favorites — `/api/v1` (auth)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| POST | `/favorites` | `service_id` | `201 { data }` (duplicate → `409 CONFLICT`) |
| GET | `/favorites` | — | `{ data: Favorite[] }` (with service preview) |
| DELETE | `/favorites/:id` | — | `204` (owner only) |

### Agora RTC — `/api/v1/agora` (auth)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/agora/token` | `channel (≤64), uid? (0..2^32-1), role? (publisher/subscriber, default publisher)` | `{ data: { appId, token, channel, uid, expiry } }` |

## Real-time (Socket.IO)

Same origin as the page (`/socket.io/`), proxied with WebSocket upgrade by
Nginx (D-006). Handshake: `auth: { token }` (JWT) verified on connect — invalid
or soft-deleted user → connection rejected.

| Direction | Event | Payload |
|-----------|-------|---------|
| client → server | `join-conversation` | `{ conversationId }` |
| client → server | `leave-conversation` | `{ conversationId }` |
| client → server | `message` | `{ conversationId, type: "texto"\|"nota_voz", content? audioUrl? durationSeconds? }` |
| client → server | `typing:start` / `typing:stop` | `{ conversationId }` |
| client → server | `message:read` | `{ conversationId }` |
| server → client | `conversations:joined` | `{ conversationIds }` |
| server → client | `message:new` / `message:sent` | message payload |
| server → client | `typing` | `{ conversationId, userId, isTyping }` |
| server → client | `conversation:joined` / `conversation:left` / `error` | per event |

Rooms are named `conv:{conversationId}`; the server auto-joins the user's
conversations on connect (D-006, BR-008.1).

## Uploads & signed URLs (BR-013.6, D-004)

### POST `/api/v1/uploads` (auth) — store a file

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| POST | `/uploads` | body = raw file bytes; `Content-Type: image/jpeg\|png\|webp, audio/mpeg\|ogg\|webm`; query `entity (services\|conversations\|contracts), entityId (int ≥ 0)` | `201 { data: { url, expires } }` (short-lived signed URL) |

`entityId` `0` is the documented pre-creation bucket used by the provider
onboarding wizard (photos are uploaded in step 2, before the service row is
created in step 3); chat voice notes pass the real conversation id. Files are
written to `UPLOAD_DIR` and served only through the signed URL guard below.

```bash
# Voice note (Chromium MediaRecorder → webm) or service photo
curl -s -X POST http://localhost:3000/api/v1/uploads \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: image/jpeg' \
  --data-binary @foto.jpg \
  '?entity=services&entityId=0'
# → 201 { "data": { "url": "/uploads/services/0/<uuid>.jpg?token=...&expires=...", "expires": 1724000000 } }
```

Files live at `UPLOAD_DIR` (`/data/uploads` by default; a named volume in the
compose stack). `signUrl()` returns
`/uploads/<entity>/<id>/<uuid>.<ext>?token=<hmac-hex>&expires=<epoch-seconds>`.
The backend (and in production the proxying Nginx path) validates the HMAC-SHA256
token + expiry before serving; missing/expired/invalid → `403 FORBIDDEN`.
Allowed uploads: `image/jpeg|png|webp` ≤5MB, `audio/mpeg|ogg|webm` ≤10MB (D-012).
Allowed entities: `services`, `conversations`, `contracts`.

> Note: uploads are validated in-app (`createUploadsGuard`) because Nginx
> `secure_link` only computes MD5 and would reject the HMAC-SHA256 tokens the
> backend signs — the proxy forwards `/uploads/` to the backend for validation.

## Gotchas & documented extras

- `POST /reservations/:id/cancel`, `GET /payments/reports/monthly`,
  `GET /notifications/unread`, `GET /favorites`, `GET /reviews/:id`,
  `POST /packages/:id/availability`, `GET /messages/search`,
  `GET /quick-replies` exist in addition to the original UR-002 catalog where a
  product flow needed a dedicated entry point — each is annotated in the source.
- `GET /api/v1/health` returns a **raw** `{ status, db }` object (no envelope)
  so Docker/uptime probes can parse it trivially.
- Admin routes are role-gated at the router level (BR-002.4): non-admins get
  `403`; admins cannot reach non-admin resources (they live on other routers).
