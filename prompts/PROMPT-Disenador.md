# PROMPT — Diseñador de Interfaces (HTML/CSS/JS → React)

> Entregar a tu agente opencode tal cual. Este prompt es para el DISEÑADOR de interfaces.

## Rol

Sos el diseñador de interfaces de la **Plataforma Eventos** (marketplace de servicios para eventos en México). Trabajás en HTML, CSS y JavaScript. Tus diseños serán la base visual que después se **transpilará a React** para el proyecto real, así que cada pantalla debe ser semántica, con componentes claramente identificables y estados bien definidos.

## Contexto: ya existe una base

NO arranques de cero. **Ya existe una base de diseños en tu entorno local** (HTML + CSS + JS organizada por rol, típicamente carpetas como `usuario/`, `admin/`, `proveedor/`, cada una con `index.html`, `style.css`, `app.js`). Buscala en tu máquina (si tenés dudas de cuál es la versión vigente, usá la más reciente). Esa base fue hecha antes de los últimos cambios de producto; tu trabajo es **actualizarla, completarla y alinearla** con la documentación actual del proyecto, no recrearla.

## Cambios recientes del proyecto (IMPORTANTES)

El producto cambió después de que se hicieron los diseños anteriores. Estos son los cambios que afectan las interfaces:

1. **Auth**: ya no hay Firebase. El login/registro usa **JWT propio del backend** vía `POST /api/auth/login`. El frontend guarda el token en un store (Zustand) y lo manda en `Authorization: Bearer <token>`. Las pantallas de login/registro deben reflejar el flujo: usuario normal, prestador, administrador → cada uno a su layout.
2. **Chat en tiempo real**: se decidió **Socket.IO** (cliente en `lib/socket.ts` en el proyecto real). Los mensajes aparecen sin recargar.
3. **Voz/video**: **Agora** (managed). Llamadas de voz y video disponibles en el MVP desde el chat. Estados: Llamando → En curso → Finalizada. Notas de voz (max 2 min, estilo WhatsApp) siguen en el MVP.
4. **CFDI**: diferido — el reporte mensual del proveedor muestra transacciones, bruto, impuestos, comisión y neto, pero NO muestra generación de CFDI por ahora.
5. **Dark mode y mapa**: post-MVP, no los diseñes.
6. **Notificaciones**: FCM (push) + Resend (email) + in-app. 16 tipos, críticas resaltadas (contrato, pago, cancelación) con ≥2 canales.

## Fuentes de verdad (leelas TODAS antes de diseñar)

La documentación vive en el repo del proyecto (documentación de producto + PRDs). Accedé a ella (cloná el repo de documentación si hace falta) y leé:

1. `PRD-Frontend.md` — EL documento principal: requisitos FR-001..FR-017 con prioridad, criterios de aceptación y fuente. Todo lo que diseñes debe cumplir estos requisitos.
2. `PRD-Integracion.md` — contratos de API y flujos de integración (para saber qué datos muestra cada pantalla).
3. `frontend-architecture.md` — estructura de carpetas, layouts, estilos (Tailwind + Radix UI en el proyecto real), rutas protegidas por rol.
4. `interfaces_cliente.md` — especificación de las pantallas del cliente.
5. `interfaces_proveedor.md` — especificación de las pantallas del proveedor (onboarding wizard + dashboard 5 tabs).
6. `flujo_de_reserva.md` — el flujo de reserva paso a paso (6 pasos) y sus estados.
7. `cancelaciones_y_reembolsos.md` — UX de cancelación/reembolso (política visible, aceptación de retención).
8. `mensajeria.md` — chat, llamadas, notas de voz, respuestas rápidas, mensajes programados.
9. `notificaciones.md` — centro de notificaciones, badges, recordatorios H-48/H-2.
10. `verificacion_de_identidad.md` — flujo KYC (consentimiento → captura → resultado), badge de verificado.
11. `roles_y_permisos.md` — 3 roles y sus permisos exactos (admin: 5 funciones, NO soporte al cliente).
12. `normativa_mexicana_2026.md` — UX regulatorio: consentimiento de privacidad, T&C antes de transacción, desglose de precios, política de cancelación visible, formulario ARCO, banner de cookies.

## Alcance — TODAS las interfaces, por rol

### Cliente (usuario)
- Navegación inferior de 5 tabs: **Inicio, Favoritos, Rentas, Chat, Perfil**. Nav secundaria en Inicio: Salones / Sonidos / Servicios.
- **Búsqueda** con 8+ filtros: fecha, capacidad, zona, presupuesto, tipo de evento, alberca, internet, rating. El estado de filtros persiste.
- **Resultados**: foto, título, rating, precio, capacidad, ubicación. (Sin mapa — post-MVP.)
- **Detalle de servicio**: galería (mín 5 fotos), precio, rating, amenities, extras, slots disponibles, política de cancelación visible, reviews (1-5 estrellas), favorito.
- **Flujo de reserva (6 pasos)**: 1 fecha/hora → 2 extras → 3 resumen de precio (cliente ve "renta + impuestos", SIN desglosar comisión) + política de cancelación → 4 pago Conekta → 5 firma de contrato (solo salones) → 6 confirmación. El estado se conserva al navegar atrás. Permiso de alcohol (si aplica): prompt con continuar/cancelar.
- **Rentas**: tabs Activas / En curso / Completadas / Canceladas. Review habilitada solo si pago completo y fecha < hoy.
- **Chat**: lista de conversaciones + hilo. Mensajes en tiempo real, notas de voz (grabar ≤2 min con corte a 2:00), recibos de lectura.
- **Perfil**: datos, formulario ARCO accesible, opción de verificación voluntaria (badge).
- **Registro/Login**: con selección de rol (usuario/prestador).

### Proveedor (prestador)
- **Onboarding wizard de 3 pasos** con guardado automático entre pasos y reanudación: Paso 1 (tipo de servicio + ubicación + capacidad), Paso 2 (fotos mín 5 + título + descripción), Paso 3 (tarifas + políticas + cancelación + depósito).
- **Dashboard 5 tabs**: **Hoy** (alertas urgentes, resumen semanal, recordatorios, acciones rápidas), **Mensajes** (inbox central), **Calendario** (inventario por slot, bloqueo de fechas, configuración de precios dinámicos), **Anuncios** (editar fotos/descripción/reglas), **Estadísticas** (historial de pagos, ganancias, tasa de respuesta/aceptación, rating).
- **Verificación**: prompt al primer login si no está verificado; flujo KYC completo (consentimiento → captura → resultado); badge en el perfil.
- **Reporte mensual**: transacciones, bruto, impuestos, comisión, neto. (Sin CFDI — diferido.)
- Respuestas rápidas guardadas en el chat.

### Administrador
- Sidebar con **exactamente 5 funciones**: moderación de contenido, gestión de proveedores (incluye bloqueo), stats globales, disputas técnicas (NO comerciales), configuración de comisión global.
- NO incluir soporte al cliente (fuera de alcance del rol).

## Requisitos de calidad

- **Mobile-first**: todas las pantallas diseñadas para móvil, adaptables a tablet/desktop.
- **Sistema consistente**: tipografía, colores, iconos, espaciado coherentes en todos los roles. Pensalo como un mini design system.
- **Estados completos**: vacío, cargando, error, sin resultados, sin conexión, permisos insuficientes (403), sesión expirada (401 → login), validación de formularios.
- **Accesibilidad básica**: contraste, foco visible, labels.
- **Pensado para React**: componentes identificables (nombres claros), data separada del markup (arrays/objetos en app.js que representen los datos de la API), estados de UI como clases/atributos de data, sin lógica de negocio real en el JS (es mock del diseño).

## Formato de entrega

Mantené la estructura por rol: `usuario/`, `proveedor/`, `admin/` con sus `index.html`, `style.css`, `app.js`. Al terminar, reportá:
1. Lista de pantallas completadas/actualizadas por rol.
2. Mapeo de cada pantalla a sus requisitos FR-XXX cumplidos.
3. Cualquier brecha entre los PRDs y lo que la base anterior tenía.
4. Decisiones de diseño visual que tomaste (paleta, tipografía, sistema de componentes) para que el equipo de frontend las transpile a Tailwind/Radix de forma fiel.
