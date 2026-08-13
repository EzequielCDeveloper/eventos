# Tasks: Documentación Completa de Producto — App Eventos

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2,370–2,910 (16 docs + README) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 6 slices encadenados (auto-chain) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Base: README + vision + roles + taxonomía | PR 1 (~570–700 lines) | `ls README.md vision_y_alcance.md roles_y_permisos.md taxonomia_de_servicios.md` + mermaid syntax check | N/A — docs only, no runtime | 4 archivos nuevos, eliminables sin afectar otros |
| 2 | Flujos core: paquetes + reserva + pagos + cancelaciones | PR 2 (~670–800 lines) | `ls paquetes_colaborativos.md flujo_de_reserva.md pagos_y_comisiones.md cancelaciones_y_reembolsos.md` + mermaid check | N/A — docs only | 4 archivos nuevos, eliminables sin afectar otros |
| 3 | Interfaces: cliente + proveedor + mensajería + notificaciones | PR 3 (~530–650 lines) | `ls interfaces_cliente.md interfaces_proveedor.md mensajeria.md notificaciones.md` | N/A — docs only | 4 archivos nuevos, eliminables sin afectar otros |
| 4 | Soporte: verificación + simplificación + normativa + verificamex | PR 4 (~500–620 lines) | `ls verificacion_de_identidad.md areas_de_simplificacion.md normativa_mexicana_2026.md verificamex_integracion.md` | N/A — docs only | 4 archivos nuevos, eliminables sin afectar otros |
| 5 | Migración + limpieza: borrar skeletons + actualizar README | PR 5 (~50–80 lines) | `! test -f eventos.md && ! test -f arquitectura_interfaz_proveedores_eventos.md` | N/A — file deletion only | 2 archivos eliminados, restaurables desde git |
| 6 | Verificación final: cobertura 23 decisiones + cross-refs + mermaid | PR 6 (~0 lines, solo verificación) | Checklist de 23 decisiones contra README tabla | N/A — verification only | N/A — read-only |

## Phase 1: Fundación — Visión, Roles, Taxonomía

- [x] 1.1 Crear `vision_y_alcance.md` (~120–150 líneas): frontmatter YAML + secciones: MVP (particulares+empresas), modelo ingresos (comisión sumada), alcance marketplace (3 tipos servicio), boundary marketplace. Incluir tabla de escenarios de spec.
- [x] 1.2 Crear `roles_y_permisos.md` (~140–170 líneas): 3 roles (Usuario, Prestador, Administrador), permisos por rol, verificación de identidad (INE presencial + KYC), ranking 3 métricas, admin 5 funciones explícitas. Corregir error "Administrador" (era "asesorado").
- [x] 1.3 Crear `taxonomia_de_servicios.md` (~130–160 líneas): 3 tipos servicio (salón, sonido, servicio-persona), modelos precios diferenciados, concurrencia configurable (salón forzado=1), mínimo 5 fotos, extras configurables.

## Phase 2: Flujos Core — Paquetes, Reserva, Pagos, Cancelaciones

- [x] 2.1 Crear `paquetes_colaborativos.md` (~140–170 líneas): líder salón, invitación proveedores, disponibilidad cruzada, precio automático, 7 estados. Incluir diagrama D2 (sequenceDiagram) y D8 (stateDiagram-v2).
- [x] 2.2 Crear `flujo_de_reserva.md` (~200–240 líneas): reserva simple (bloques horas), contrato físico bilateral (diagrama D4), permiso alcohol H-5 (diagrama D5), estados reserva (diagrama D1 stateDiagram). Flujo completo de extremo a extremo.
- [x] 2.3 Crear `pagos_y_comisiones.md` (~170–200 líneas): Conekta MXN (diagrama D6), comisión sumada, cobro flexible (3 opciones), depósito configurable, impuestos calculadora + reporte. Incluir tabla de visibilidad cliente vs proveedor.
- [x] 2.4 Crear `cancelaciones_y_reembolsos.md` (~160–190 líneas): cancelación cliente (anticipo no reembolsable), cancelación proveedor (devolución total), política configurable, sin mediación disputas. Incluir diagrama D3 (flowchart cancelación × depósito).

## Phase 3: Interfaces — Cliente, Proveedor, Mensajería, Notificaciones

- [x] 3.1 Crear `interfaces_cliente.md` (~140–170 líneas): explorar/buscar (8+ filtros), detalle servicio, favoritos, historial rentas (review solo post-pago+fecha pasada), perfil. Migrar contenido de `eventos.md`.
- [x] 3.2 Crear `interfaces_proveedor.md` (~160–190 líneas): onboarding wizard 3 pasos, dashboard 5 tabs (Hoy/Mensajes/Calendario/Anuncios/Estadísticas), agenda gratuita, configuración concurrencia. Migrar contenido válido de `arquitectura_interfaz_proveedores_eventos.md`.
- [x] 3.3 Crear `mensajeria.md` (~100–120 líneas): chat texto, voz/video, notas voz MVP (límite 2min, sin transcripción), persistencia historial.
- [x] 3.4 Crear `notificaciones.md` (~130–160 líneas): 14+ tipos en tabla (trigger, canal, destinatario), canales push/email/in-app, notificaciones críticas multi-canal.

## Phase 4: Soporte — Verificación, Simplificación, Normativa, Verificamex

- [x] 4.1 Crear `verificacion_de_identidad.md` (~120–150 líneas): INE presencial, KYC APIs (Truora, Veriff, Verificamex), verificación voluntaria clientes, badges.
- [x] 4.2 Crear `areas_de_simplificacion.md` (~110–140 líneas): 10 supuestos del proposal, tabla maestra, detalle por supuesto (contexto/decisión/alternativa/impacto/validación), checkboxes de validación.
- [x] 4.3 Crear `normativa_mexicana_2026.md` (~150–180 líneas): disclaimer obligatorio, 7 leyes (LFPDPPP, Ley Consumer, Código Comercio, permisos alcohol, SAT/CFDI, comercio electrónico, COFEPRIS), matriz cumplimiento.
- [x] 4.4 Crear `verificamex_integracion.md` (~120–150 líneas): API endpoints, Lista Nominal, flujo verificación (diagrama D7), manejo de errores (tabla), seguridad datos LFPDPPP (logs solo metadatos).

## Phase 5: Migración y Limpieza

- [x] 5.1 Preservar `eventos.md` como `eventos_legacy.md` y `arquitectura_interfaz_proveedores_eventos.md` como `arquitectura_legacy.md` (rollback safety).
- [x] 5.2 Eliminar `eventos.md` y `arquitectura_interfaz_proveedores_eventos.md` originales.
- [x] 5.3 Actualizar `README.md` con tabla de relaciones documentos y enlaces a los 16 docs.

## Phase 6: Verificación Final

- [x] 6.1 Verificar cobertura de las 23 decisiones: cada decisión de la tabla design.md mapeada a ≥1 documento existente. Registrar en README tabla de decisiones.
- [x] 6.2 Validar cross-references: cada `[→ ver doc.md#sección]` apunta a archivo + sección existentes. Corregir enlaces rotos.
- [x] 6.3 Validar sintaxis mermaid: 8 diagramas (D1–D8) renderizan sin errores. Verificar caption, español neutro, transiciones con guarda.
- [x] 6.4 Verificar 0 contradicciones internas: cross-check de roles, estados, montos, políticas entre documentos.
- [x] 6.5 Verificar frontmatter en cada doc: `estado: completo`, `version: "1.0"`, `fecha: "2026-08-11"`, `fuentes` con spec path.
