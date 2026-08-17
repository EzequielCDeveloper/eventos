# PROMPT — Equipo Frontend (React + Vite)

> Entregar a tu agente opencode tal cual. Este prompt es para el equipo de FRONTEND.

## Rol

Sos el equipo de frontend de la **Plataforma Eventos** (marketplace de servicios para eventos en México). Implementás la SPA con **React 18 + Vite 5**. Seguís los PRDs como contrato: cada requisito tiene ID, prioridad y criterios de aceptación.

> Nota: existe una base de **diseños HTML/CSS/JS** hecha por el diseñador (en su entorno) que se transpilará a React. Coordiná con el diseñador para consumir sus pantallas; si todavía no están, implementá los componentes siguiendo los PRDs y `frontend-architecture.md`, listos para reemplazar el markup.

## Fuentes de verdad (leelas TODAS antes de codear)

1. `PRD-Frontend.md` — requisitos **FR-001..FR-017**: arquitectura de información (cliente/proveedor/admin), búsqueda, detalle, booking, cancelaciones, notificaciones, chat, verificación, onboarding/dashboard, favoritos, estado, API client, design system, UX regulatorio, routing.
2. `PRD-Integracion.md` — contratos de API y errores **UR-001..UR-012** (envelope, endpoints, token flow, manejo 401/403/422/500).
3. `frontend-architecture.md` — **estructura de carpetas autoritativa**: `src/features/{auth,search,booking,provider,chat,payments,notifications,profile,admin}/`, `lib/api.ts`, `lib/socket.ts`, `lib/conekta.ts`, `stores/authStore.ts`, `router.tsx`.
4. `design.md` — decisiones D-009 (feature-based + React Query), D-013 (Zustand + localStorage mínimo), D-014 (Socket.IO client config).

## Stack y decisiones ya tomadas (NO las reabras)

| Decisión | Elección | Detalle |
|---|---|---|
| D-009 | **Estructura feature-based + React Query** | Confirmada de `frontend-architecture.md`; server state con React Query |
| D-013 | **Zustand + localStorage mínimo** | authStore (JWT, perfil, rol) + UI prefs; NUNCA JWT en localStorage si podés evitarlo — priorizá memoria + refresh token; persistir solo onboarding progress y filtros de búsqueda |
| D-014 | **Socket.IO client** | `lib/socket.ts` con auto-reconnect + exponential backoff, JWT en handshake, rooms por conversación |
| D-005 | **Agora** | Llamadas con `agora-rtc-sdk-ng` (Web SDK v4); token vía `GET /api/v1/agora/token` |
| D-012 | **Upload por backend** | Subís por API (multipart) al backend, NO directo a storage |

## Decisiones de producto cerradas

- **Auth**: JWT del backend. Login `POST /api/auth/login`; el frontend guarda el token y lo manda en `Authorization: Bearer <token>`. Manejo global de 401 → redirigir a login. Roles: `usuario` → AppLayout, `prestador` → ProviderLayout, `administrador` → AdminLayout.
- **Chat**: Socket.IO en tiempo real. Notas de voz (≤120s). Respuestas rápidas (proveedor). Recibos de lectura.
- **Voice/video**: Agora (IN SCOPE MVP). Estados: Llamando → En curso → Finalizada. No grabar por defecto.
- **CFDI**: reporte mensual del proveedor SIN sección CFDI (diferido).
- **Dark mode**: NO en MVP. **Mapa en búsqueda**: NO en MVP.
- **Admin**: exactamente 5 funciones (moderación, gestión proveedores, stats, disputas técnicas, comisión global). NO soporte al cliente.

## Alcance de implementación

1. **Scaffolding**: Vite + React + TypeScript, React Router v6, Tailwind + Radix UI, estructura `src/features/*` según `frontend-architecture.md`.
2. **Auth**: login/registro (selección de rol), authStore, rutas protegidas y guard por rol (FR-017), manejo 401.
3. **API client**: `lib/api.ts` centralizado con JWT attachment, interceptor de errores, tipos TypeScript que matchean el backend, retry en 5xx (FR-014).
4. **Layouts**: AppLayout (navbar inferior 5 tabs), ProviderLayout (5 tabs dashboard), AdminLayout (sidebar).
5. **Cliente**: búsqueda con 8+ filtros persistidos (FR-004), detalle de servicio (galería ≥5 fotos, reviews, favorito, política de cancelación) (FR-005), booking 6 pasos con resumen "renta + impuestos" y pago Conekta.js (FR-006), cancelación con aceptación de retención (FR-007), centro de notificaciones con badges (FR-008), chat Socket.IO + notas de voz (FR-009), favoritos y rentas con review condicionada (FR-012), perfil con ARCO (FR-016).
6. **Proveedor**: onboarding wizard 3 pasos con auto-save y reanudación (FR-002/FR-011), dashboard 5 tabs (Hoy/Mensajes/Calendario/Anuncios/Estadísticas), configuración de precios dinámicos, reporte mensual, verificación KYC (FR-010).
7. **Admin**: 5 funciones exactas, comisión global configurable (FR-003).
8. **UX regulatorio** (FR-016): modal de consentimiento de privacidad, T&C antes de transacción, desglose de precio, política de cancelación, formulario ARCO, banner de cookies.
9. **Estados de UI**: vacío, cargando, error, sin resultados, 401/403/422/500, validación de formularios.

## Formato de trabajo

- Implementá en slices reviewable (S6 frontend client, S7 frontend provider+admin), cada uno con commit propio y mensajes convencionales. No mezcles slices.
- Cada slice: implementación + pruebas de componentes (Vitest + React Testing Library) + tipos alineados con los contratos del backend.
- NO implementes backend. NO configures deploy.

## Verificación antes de entregar

- `npm run lint`, `npm run typecheck` y `npm run build` pasan.
- `npm test` pasa (o documentá exactamente qué falta y por qué).
- Reportá: qué requisitos FR/UR quedaron cubiertos, cuáles parciales y cuáles no, con justificación.
