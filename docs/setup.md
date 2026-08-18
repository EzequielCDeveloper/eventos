# Local development setup — FiestaExpert

Get the Plataforma Eventos stack (Express + MariaDB backend, React + Vite SPA,
Socket.IO, BullMQ jobs) running on your machine. See `docs/api.md` for the API
contract and `docker-compose.yml` for the production topology.

## Quick path

Prerequisites: **Node 20+**, **npm**, **Docker + Docker Compose**, and a running
**MariaDB 10.6+** (or the container provided below).

```bash
# 1. Install dependencies
cd backend  && npm ci && cd ..
cd frontend && npm ci && cd ..

# 2. Environment files (never commit real values)
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env.local     # VITE_* — optional in dev
cp .env.example          .env                    # compose stack (db/redis)

# 3. Start the database + Redis (host-run backend/frontend connect to these)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db redis

# 4. Prepare the schema + seed
cd backend
npx prisma migrate dev          # creates events_db + applies 000_init
npx prisma db seed              # default amenities, event types, commission
cd ..

# 5. Run the servers (two terminals)
cd backend  && npm run dev      # API + Socket.IO on :3000
cd frontend && npm run dev      # Vite on :5173 (proxies /api,/uploads,/socket.io → :3000)
```

Smoke test:

```bash
curl http://localhost:3000/api/v1/health        # → {"status":"ok","db":"connected"}
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"Ana Test","email":"ana@example.com","phone":"5512345678","password":"password123"}'
# → 201 { "data": { "user": {...}, "tokens": {...} } }
open http://localhost:5173                      # SPA loads, API reachable
```

## Prerequisites detail

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20 | backend `engines.node`, matches Docker images |
| npm | 9+ | used by both services |
| Docker + Compose | recent | only needed for `db`/`redis` (or the full stack) |
| MariaDB | 10.6+ | or use the compose `db` container (`:3306`) |
| Redis | 7.x | optional for boot, required for scheduled jobs (D-011) |

The backend **fails fast on startup** if required env vars are missing
(LFPDPPP/UR-005). Placeholders boot in `NODE_ENV=development`; placeholders are
rejected in `NODE_ENV=production` (see `backend/src/config/env.ts`).

## Environment variables

### Backend — `backend/.env`

See `backend/.env.example` for the full annotated list. Key ones:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | `mysql://user:pass@host:3306/eventos_db` (Prisma) |
| `JWT_SECRET` | signs access/refresh tokens (generate with `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | token lifetimes (`7d` / `30d`) |
| `SIGNED_URL_SECRET` | HMAC secret for uploads signed URLs (D-004) |
| `REDIS_URL` | BullMQ queue URL (`redis://localhost:6379` when using the container) |
| `CONEKTA_API_KEY`, `CONEKTA_WEBHOOK_SECRET/PUBLIC_KEY` | Conekta charges + webhook signature |
| `VERIFICAMEX_API_KEY`, `VERIFICAMEX_API_URL` | KYC verification |
| `FCM_SERVICE_ACCOUNT` | JSON service-account blob for push |
| `RESEND_API_KEY`, `RESEND_FROM` | transactional email |
| `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` | RTC token signing (D-005) |
| `UPLOAD_DIR` | where uploads are written (`/data/uploads` default) |
| `NODE_ENV` | `development` for local; production rejects placeholders |

### Frontend — `frontend/.env.local` (all `VITE_*`, baked at build time)

| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_API_URL` | full API base; **empty = same-origin** through the dev proxy / Nginx | empty |
| `VITE_CONEKTA_PUBLIC_KEY` | Conekta.js publishable key; empty → simulated payment (mockup mode) | empty |
| `VITE_AGORA_APP_ID` | Agora RTC app id; empty → call buttons disabled | empty |

### Compose — root `.env`

`docker-compose.yml` reads the root `.env` (auto-loaded). Required: `DB_ROOT_PASSWORD`,
`DB_PASSWORD`. Everything is documented in `.env.example` — copy, then fill.

## Database

Source of truth is `database_schema.sql` (repo root, D-001). Prisma introspected
it into `backend/prisma/schema.prisma`; the baseline migration `000_init`
reproduces it so `prisma migrate deploy` can provision an empty DB.

```
cd backend
npx prisma migrate dev      # local: applies 000_init + regenerates client
npx prisma db seed          # seeds amenities, event types, commission rate
npx prisma generate         # regenerate @prisma/client after schema changes
npm run prisma:deploy       # production-equivalent (migrate deploy)
```

Migration history lives in `backend/prisma/migrations/`; `down.sql` is a
recovery aid only — production migrations are forward-only (D-010).

## Running the full stack in Docker (dev)

Containerized backend + Vite frontend with hot reload (UR-006.6):

```bash
cp .env.example .env                          # ensure DB_ROOT_PASSWORD / DB_PASSWORD
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
# backend  → http://localhost:3000   (tsx watch, live reload)
# frontend → http://localhost:5173   (Vite HMR)
```

Notes on this mode:

- The frontend container sets `VITE_API_URL=http://localhost:3000/api/v1`, so
  the **browser** talks straight to the exposed backend (no Vite proxy inside).
- Relative `/uploads` signed URLs are a dev-only gap in this mode (they hit
  :5173, which has no `/uploads` route) — the host-run flow below covers
  uploads. Uploads remain client fail-closed until the backend `POST /uploads`
  route lands (S9 follow-up).
- The Fastest path: run both dev servers on the host (Quick path above) — the
  Vite proxy already forwards `/api`, `/uploads`, `/socket.io` to `:3000`.
- `nginx` is excluded in dev (it is only part of the production stack).

## Production deployment (VPS)

1. Provision a VPS, install Docker + Docker Compose, and clone the repo to
   e.g. `/opt/eventos`.
2. Create `.env` from `.env.example` and fill real secrets.
3. Place TLS certs (Cloudflare **Origin CA** or Let's Encrypt) at
   `./certs/fullchain.pem` and `./certs/privkey.pem` (nginx serves 443).
4. Run `./scripts/deploy.sh` — it builds images, exports the frontend `dist`,
   runs `docker compose up -d`, applies `prisma migrate deploy`, and waits on
   `/api/v1/health` (UR-007.4–UR-007.5).
5. Point DNS at the VPS behind **Cloudflare Full proxy** (SSL: Full/Strict,
   WebSocket: on); origin TLS uses the certs from step 3 (D-010, UR-006.4).

Deploying manually:

```bash
docker compose build backend frontend
./scripts/deploy.sh          # pull/up/migrate/healthcheck
docker compose logs --tail=100 backend   # debugging
```

Rollback (D-010): previous images remain tagged (`eventos-backend:previous`);
recreate with the previous tag and restore a DB backup if a migration must be
undone. Backups run daily via `scripts/backup.sh` (cron; 7 daily + 4 weekly
retention).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Backend exits on boot with `[config] Invalid environment variables` | `.env` missing a required var or a placeholder left in `NODE_ENV=production` |
| `PrismaClientInitializationError` / `P1001` | `DATABASE_URL` wrong, or `db` container not ready — run `npx prisma migrate dev` first |
| `ECONNREFUSED` from the API client | `VITE_API_URL` empty + no proxy → point it at `http://localhost:3000/api/v1` |
| Socket.IO reconnects forever | backend not running, or Nginx missing the WebSocket upgrade headers (`/socket.io/` block) |
| `429 RATE_LIMITED` during local testing | you hit 100 req/min (10/min on `/auth/*`); wait a minute or set `NODE_ENV=test` for the backend |
| `403 FORBIDDEN` on `/uploads/...` | signed URL expired/invalid — regenerate via `signUrl()` (token + `expires` required) |
