#!/usr/bin/env bash
#
# Production deploy (UR-007.4–UR-007.5, D-010). Run on the VPS from the repo
# root; drives the compose stack end to end:
#
#   1. build/pull backend image + build the frontend image
#   2. export the frontend dist from the image into ./frontend/dist (the
#      nginx service serves it from the host mount)
#   3. `docker compose up -d` (backend, db, redis, nginx)
#   4. `prisma migrate deploy` on the running backend (forward-only per D-010)
#   5. poll GET /api/v1/health until the API answers 200
#
# Configuration comes from the committed compose files + the local `.env`
# (never committed). Requires: docker + docker compose on the VPS.
#
# Rollback (D-010): previous images stay tagged (eventos-backend:previous);
#   `docker compose up -d --force-recreate` with the previous tag + restore a
#   DB backup if the migration itself must be unwound.
set -euo pipefail

# Repo root = parent of scripts/.
cd "$(dirname "$0")/.."

[ -f .env ] || {
  echo "[deploy] error: .env not found — copy .env.example to .env and fill it in first" >&2
  exit 1
}

echo "[deploy] building backend image"
docker compose build backend

echo "[deploy] building frontend image"
docker build -t eventos-frontend:latest ./frontend

echo "[deploy] exporting frontend dist for the nginx volume"
CID="$(docker create eventos-frontend:latest)"
rm -rf ./frontend/dist
docker cp "${CID}:/usr/share/nginx/html/." ./frontend/dist/
docker rm -f "$CID" >/dev/null 2>&1 || true

echo "[deploy] starting stack"
docker compose up -d

echo "[deploy] applying database migrations (prisma migrate deploy)"
docker compose exec -T backend npx prisma migrate deploy

echo "[deploy] waiting for /api/v1/health"
for i in $(seq 1 30); do
  if docker compose exec -T backend node -e \
    "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1; then
    echo "[deploy] healthy — deploy complete"
    exit 0
  fi
  sleep 2
done

echo "[deploy] error: backend health check did not pass within ~60s" >&2
echo "[deploy] hint: docker compose logs --tail=100 backend" >&2
exit 1
