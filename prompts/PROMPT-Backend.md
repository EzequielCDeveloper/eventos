# PROMPT — Equipo Backend (Node.js + Express + MariaDB)

> Entregar a tu agente opencode tal cual. Este prompt es para el equipo de BACKEND.

## Rol

Sos el equipo de backend de la **Plataforma Eventos** (marketplace de servicios para eventos en México). Implementás la API y la lógica de negocio con **Node.js + Express + MariaDB**. Seguís los PRDs como contrato: cada requisito tiene ID, prioridad y criterios de aceptación.

## Fuentes de verdad (leelas TODAS antes de codear)

1. `PRD-Backend.md` — requisitos **BR-001..BR-014**: API surface, auth JWT, data model, reservas, pagos, cancelaciones, mensajería, notificaciones, verificación, paquetes, regulatorio, integraciones, NFRs.
2. `PRD-Integracion.md` — contratos de API **UR-001..UR-012** (envelope, catálogo de endpoints, token flow, errores, env, seguridad).
3. `database_schema.sql` — **FUENTE DE VERDAD del modelo de datos** (30+ tablas, 2 vistas, 1 trigger). No lo reescribas: adoptalo.
4. `design.md` — decisiones de arquitectura **D-001..D-014** (ver tabla abajo). El stack ya está decidido.

## Stack y decisiones ya tomadas (NO las reabras)

| Decisión | Elección | Detalle |
|---|---|---|
| D-001 | **Prisma** | `prisma db pull` introspecta el schema existente; migraciones versionadas up/down |
| D-002 | **SQL WHERE + índices** | Búsqueda con 8+ filtros; sin engine externo en MVP |
| D-003 | **FCM + Resend** | Push y email |
| D-004 | **Storage local + Nginx** | Signed URLs; migración R2 preparada |
| D-005 | **Agora** | Backend genera tokens: `GET /api/v1/agora/token?channel=<conversationId>`, expiración 24h, con `agora-access-token` |
| D-006 | **Socket.IO** | Auth JWT en handshake, rooms por conversación, persistir-antes-broadcast |
| D-007 | **Pricing dinámico** | Computado solo al reservar, frozen al confirmar |
| D-008 | **Capas** | routes → services → integrations; thin routes, servicios testables |
| D-011 | **BullMQ + Redis** | Mensajes programados (H-48/H-2, review request, recordatorio pago) |
| D-012 | **Upload por backend** | Multipart → validación MIME/tamaño → disco local → signed URL |

## Decisiones de producto cerradas

- **Auth**: JWT propio del backend (`POST /api/auth/login`, `POST /auth/register`, `POST /auth/refresh`, `GET /auth/me`). Sin Firebase. Verificar firma/expiración en cada ruta protegida. Extraer `req.user.{id,role,segment}`.
- **Voice/video**: Agora (managed). NO PeerJS.
- **CFDI**: **DIFERIDO por decisión del usuario** — no implementes generación de CFDI (BR-006.7, BR-012.7 quedan como restricción documentada, sin lógica activa). El reporte mensual (BR-006.8) SÍ va: transacciones, bruto, impuestos, comisión, neto.
- **Admin**: exactamente 5 funciones (moderación, gestión proveedores, stats, disputas técnicas, comisión global). NO soporte al cliente.

## Alcance de implementación

1. **Scaffolding**: Express + TypeScript, estructura por capas, `/api/v1` versionado, middleware (auth, error handler con `{ error: { code, message, details? } }`, validación, rate limiting en auth, helmet, CORS para dev).
2. **Data layer**: Prisma contra `database_schema.sql` (30+ tablas), migraciones, seed (amenities, tipos de evento, comisión inicial), vistas `v_provider_ranking` y `v_slot_availability`.
3. **Auth**: register/login/refresh/me, 3 roles (`usuario`, `prestador`, `administrador`), soft-delete check, JWT propio.
4. **CRUD servicios**: servicios, pricing, extras, reglas dinámicas, inventory (slots/blocks/hours), búsqueda con filtros (D-002).
5. **Reservas**: máquina de 13 estados, validación transaccional de slots, concurrencia de salón = 1 (app-level), history por cambio, snapshot de política de cancelación, total = base + extras + impuestos + comisión, flujo permiso alcohol.
6. **Pagos Conekta**: anticipo/saldo/depósito, comisión (settings vigente), MXN forzado, reembolsos (orden: anticipo → depósito → otros), webhooks, reporte mensual por proveedor.
7. **Cancelaciones/reembolsos**: políticas por proveedor, retención con `retention_accepted`, razones de reembolso.
8. **Mensajería**: persistir mensajes, notas de voz (≤120s, CHECK constraint), conversaciones UNIQUE (client, provider, service), respuestas rápidas, mensajes programados con BullMQ.
9. **Notificaciones**: 16 tipos, 3 canales, críticas ≥2 canales, estados pendiente→enviada→leida, recordatorios H-48/H-2.
10. **Verificación**: obligatoria proveedor, voluntaria cliente, INE presencial + KYC remoto (Verificamex REST, 10s timeout, metadata-only, consentimiento previo).
11. **Paquetes colaborativos**: solo salones lideran, 7 estados, verificación atómica de slots, precio auto-computado.
12. **Regulatorio**: consentimientos en `consent_logs`, ARCO (20 días hábiles), T&C, preservación de contratos (NOM-151), auto-declaración COFEPRIS.
13. **NFRs**: `/api/v1/health`, logging estructurado, rate limiting, pool, graceful shutdown, backups, audit logs.

## Formato de trabajo

- Implementá en slices reviewable (S1 backend scaffolding+auth+data, S2 CRUD+búsqueda, S3 reservas, S4 pagos, S5 realtime+notificaciones+admin), cada uno con commit propio y mensajes convencionales. No mezcles slices en un commit.
- Cada slice: implementación + pruebas (unitarias de servicios, integración de rutas) + docs mínimas.
- NO implementes CFDI. NO crees frontend. NO configures deploy (eso es el equipo de integración).

## Verificación antes de entregar

- `npm run lint` y `npm run typecheck` pasan.
- `npm test` pasa (o documentá exactamente qué falta y por qué).
- Prisma `db pull` contra el schema real no produce errores.
- Reportá: qué requisitos BR/UR quedaron cubiertos, cuáles parciales y cuáles no, con justificación.
