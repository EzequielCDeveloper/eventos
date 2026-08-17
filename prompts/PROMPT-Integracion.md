# PROMPT — Equipo de Integración (Full-stack + DevOps)

> Entregar a tu agente opencode tal cual. Este prompt es para el equipo de INTEGRACIÓN (unificación frontend + backend + despliegue).

## Rol

Sos el equipo de integración de la **Plataforma Eventos** (marketplace de servicios para eventos en México). Tu trabajo es **unificar** el frontend (React + Vite) y el backend (Node.js + Express + MariaDB) en un solo sistema desplegable, y garantizar que los contratos entre ambos se cumplan. Trabajás junto a los equipos de frontend y backend (que implementan sus PRDs por separado); tu foco es la capa de integración y el despliegue.

## Fuentes de verdad (leelas TODAS antes de trabajar)

1. `PRD-Integracion.md` — requisitos **UR-001..UR-012**: contratos de API, catálogo de endpoints, token flow, errores, env/config, topología de deploy, CI/CD, seguridad, real-time, observabilidad, versionado, storage.
2. `PRD-Backend.md` y `PRD-Frontend.md` — para entender qué expone cada lado y qué consume el otro.
3. `design.md` — decisiones **D-001..D-014**, en especial D-006 (Socket.IO), D-010 (deploy), D-011 (BullMQ), D-012 (upload), D-014 (Socket.IO client).

## Stack y decisiones ya tomadas (NO las reabras)

| Decisión | Elección | Detalle |
|---|---|---|
| D-006 | **Socket.IO** | Auth JWT en handshake, rooms por conversación, persistir-antes-broadcast |
| D-010 | **Docker Compose + Nginx + Cloudflare** | Same-origin: Nginx sirve el build estático del frontend Y hace reverse proxy `/api/*` al backend. Kubernetes descartado |
| D-011 | **BullMQ + Redis** | Mensajes programados |
| D-012 | **Upload por backend** | Multipart → backend → disco local → signed URLs servidas por Nginx |

## Decisiones de producto cerradas

- **Auth**: JWT propio del backend. Token flow completo: register → login → refresh → logout; `Authorization: Bearer <token>`; verificación de firma/expiración; `req.user.{id,role,segment}`.
- **Cloudflare**: **FULL PROXY** (nube naranja). SSL/TLS gestionado por Cloudflare + certificado de origen en el VPS. DDoS protection activa.
- **Voice/video**: **Agora** — backend genera tokens (`GET /api/v1/agora/token?channel=<conversationId>`, 24h), frontend consume con `agora-rtc-sdk-ng`.
- **CFDI**: **DIFERIDO** — no hay lógica de CFDI ni en el flujo de pagos ni en el reporte mensual.
- **Storage**: local en el VPS con signed URLs; migración a Cloudflare R2 preparada.

## Alcance de trabajo

### 1. Contratos de API (verificar y hacer cumplir)
- Envelope estándar `{ data, meta?, errors? }` en TODOS los endpoints (UR-001).
- Catálogo de endpoints UR-002: auth, users, services (CRUD/search/slots/pricing/extras/dynamic-rules/inventory), packages, reservations, contracts, payments, messaging, notifications, reviews, favorites, admin. Verificá que backend los expone y frontend los consume con el mismo shape.
- Errores UR-004: estructura `{ error: { code, message, details? } }`, manejo frontend de 401 (→login), 403, 422 (por campo), 500.
- Versionado: `/api/v1/...` (UR-011) con estrategia de upgrade documentada.

### 2. Configuración y entornos (UR-005)
- Env vars por entorno: `.env.development`, `.env.staging`, `.env.production`. Secretos: JWT_SECRET, Conekta API key, Verificamex API key, Agora app id/certificate, FCM, Resend, DB connection, Redis.
- Frontend env prefijo `VITE_`; backend secrets NUNCA al frontend.
- Validación de config al arrancar (fallo rápido si falta algo).

### 3. Topología de despliegue (UR-006 + D-010)
- **Docker Compose** en un solo VPS: servicios backend, Redis (BullMQ), MariaDB, Nginx. Frontend = build estático servido por Nginx.
- **Nginx**: sirve estáticos del frontend, reverse proxy `/api/*` → backend, **WebSocket upgrade** para Socket.IO, HTTP/2, security headers (UR-008.2), cert de origen.
- **Cloudflare**: full proxy, DNS, TLS, DDoS.
- **Same-origin**: frontend y API en el mismo dominio → CORS solo necesario en desarrollo (UR-008.4).
- Dockerfile de producción multi-stage, non-root user (UR-006.7).

### 4. CI/CD (UR-007)
- Pipeline: push → lint + typecheck + tests → build de imágenes → migración de BD → deploy al VPS.
- Migraciones automáticas en deploy (Prisma migrate + seed).
- Rollback: tag de imagen previo preservado (UR-010.7).

### 5. Seguridad (UR-008)
- Secrets fuera de git (`.gitignore`), rate limiting en auth, input validation, Helmet, headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options), escaneo de dependencias.

### 6. Real-time (UR-009)
- **Chat Socket.IO**: handshake con JWT (middleware de auth en conexión), rooms por conversación, persistir-antes-broadcast, fallback offline → notificación push.
- **Voz/video Agora**: flujo de token, estados de llamada, registro en `call_logs`.
- **Notificaciones**: 3 canales (push FCM, email Resend, in-app), críticas ≥2 canales, estados.

### 7. Observabilidad y operaciones (UR-010)
- Healthcheck `/api/v1/health`, logging estructurado JSON, error logging 5xx, backups diarios de MariaDB, process manager (PM2 o systemd), log rotation, rollback plan.

### 8. Storage (UR-012)
- Upload de fotos (min 5 por servicio), notas de voz (≤120s), escaneo de contratos. Acceso con signed URLs privadas.

## Formato de trabajo

- Implementá el slice S8 (deploy + CI/CD + docs) con commits propios y mensajes convencionales.
- Validá la integración END-TO-END: un flujo completo de reserva (búsqueda → detalle → booking → pago sandbox → confirmación → chat → notificación) funcionando en el entorno de staging.
- Coordiná con los equipos de backend y frontend cuando un contrato no matchee; NO cambies los PRDs por tu cuenta: reportá la discrepancia.

## Verificación antes de entregar

- `docker compose up --build` levanta TODO en el VPS/staging sin errores.
- HTTPS funcional vía Cloudflare (full proxy) con cert de origen.
- WebSocket (Socket.IO) funciona a través de Nginx detrás de Cloudflare.
- Healthcheck responde 200 y los logs son JSON estructurados.
- Reportá: requisitos UR cubiertos, discrepancias encontradas entre frontend/backend y cómo se resolvieron, y el runbook de deploy/rollback/backup.
