# Design: Resincronizar Specs con Revisión Humana v1.1

## Technical Approach

Resincronización **a posteriori** — alineación documental, no nueva arquitectura. Los 16 specs en `openspec/specs/` fueron generados por el cambio `documentacion-producto-eventos`. Posteriormente, una revisión humana de `areas_de_simplificacion.md` (v1.1) introdujo 3 decisiones nuevas (23→26), actualizó precios dinámicos a "dentro del MVP", definió inventario por slot, y especificó normativa SLRC Sonora. Los specs quedaron desactualizados: 3 contradicciones críticas, 4 gaps significativos, 1 obsoleto. El approach aplica deltas in-place sobre los 7 specs afectados, sin tocar los 9 specs sin cambios.

## Architecture Decisions

### Decision: Alineación vs. nueva arquitectura

**Choice**: Tratamiento como resincronización (alignment), no como cambio arquitectónico.
**Alternatives considered**: Diseñar desde cero como si fuera un cambio nuevo con features emergentes.
**Rationale**: No hay nueva funcionalidad ni decisión técnica nueva — solo alineación de specs existentes con decisiones ya documentadas en v1.1. Documentar como "nuevo diseño" crearía confusión sobre la autoría de las decisiones.

### Decision: Aplicación por grupos de impacto

**Choice**: 3 fases — Críticos (3 specs) → Gaps (4 specs) → Verificación cross-references.
**Alternatives considered**: Aplicación secuencial alfabética; delta unificado en un solo archivo.
**Rationale**: Prioriza specs con contradicciones activas que generan riesgo de regresión si se implementa antes de corregir. Los gaps son complementarios, no bloqueantes. La verificación cross-references al final garantiza consistencia terminológica.

### Decision: Delta in-place vs. delta spec separada

**Choice**: Aplicar cambios directamente en `openspec/specs/{domain}/spec.md` (in-place), documentando los deltas en `changes/{change-name}/specs/{domain}/spec.md` como registro.
**Alternatives considered**: Mantener solo delta specs sin modificar los main specs; crear una capa de fusión automática.
**Rationale**: El estado applied es la fuente de verdad. Los deltas en changes/ son el audit trail. No hay herramienta de fusión automática — la aplicación manual es más segura para 7 specs.

### Decision: Autoridad v1.1 como fuente de verdad

**Choice**: `areas_de_simplificacion.md` v1.1 (raíz) es la autoridad para cada MODIFIED/ADDED/REMOVED.
**Alternatives considered**: Cruzar fuentes entre múltiples docs v1.1; usar el exploration.md como autoridad secundaria.
**Rationale**: v1.1 es el documento que el usuario revisó manualmente. Cada delta se verificó contra las secciones exactas de v1.1 antes de escribir.

## Data Flow

    v1.1 (áreas_de_simplificacion.md)  ← autoridad
           │
    exploration.md (matriz de desalineación)  ← análisis
           │
    proposal.md (7 specs, approach por grupos)  ← plan
           │
    7 delta specs (MODIFIED/ADDED/REMOVED)  ← ejecución
           │
    openspec/specs/{domain}/spec.md  ← estado applied
           │
    tasks.md (15/15 [x])  ← trazabilidad

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `openspec/changes/.../specs/areas-de-simplificacion/spec.md` | Create | 3 MODIFIED + 2 REMOVED: precios dinámicos, concurrencia, aprobación, alcohol SLRC |
| `openspec/changes/.../specs/taxonomia-de-servicios/spec.md` | Create | 1 ADDED + 2 MODIFIED: precios dinámicos MVP, inventario por slot, paquetes |
| `openspec/changes/.../specs/interfaces-proveedor/spec.md` | Create | 3 MODIFIED + 2 ADDED: tabs, onboarding, concurrencia, ajuste calendario, aprobación |
| `openspec/changes/.../specs/pagos-y-comisiones/spec.md` | Create | 3 ADDED: comisión precio vigente, desglose, comisión paquete |
| `openspec/changes/.../specs/vision-y-alcance/spec.md` | Create | 1 ADDED + 2 MODIFIED + 1 REMOVED: stack, in-scope, out-scope, viáticos |
| `openspec/changes/.../specs/normativa-mexicana-2026/spec.md` | Create | 3 MODIFIED + 1 ADDED: SLRC, consecuencias, elección usuario, verificación edad |
| `openspec/changes/.../specs/README/spec.md` | Create | 2 MODIFIED + 1 ADDED: tabla 26 decisiones, versión 1.1, stack |
| `openspec/specs/areas-de-simplificacion/spec.md` | Modify | Applied: 5 requirements reemplazados/incrementados |
| `openspec/specs/taxonomia-de-servicios/spec.md` | Modify | Applied: 3 requirements reemplazados/incrementados |
| `openspec/specs/interfaces-proveedor/spec.md` | Modify | Applied: 5 requirements reemplazados/incrementados |
| `openspec/specs/pagos-y-comisiones/spec.md` | Modify | Applied: 3 requirements agregados |
| `openspec/specs/vision-y-alcance/spec.md` | Modify | Applied: 3 requirements modificados |
| `openspec/specs/normativa-mexicana-2026/spec.md` | Modify | Applied: 4 requirements modificados/agregados |
| `openspec/specs/README/spec.md` | Modify | Applied: 3 fields modificados |

## Key Terms Mapping

| Término | Definición | Specs donde aparece |
|---------|-----------|---------------------|
| calendario de inventario por slot (fecha + horario) | Capacidad máxima de eventos por slot temporal | areas-de-simplificacion, taxonomia-de-servicios, interfaces-proveedor, vision-y-alcance |
| precio vigente (base + ajuste dinámico) | Precio resultante de base + porcentaje de ajuste | areas-de-simplificacion, taxonomia-de-servicios, pagos-y-comisiones |
| indicadores de cupo (disponible/parcial/lleno) | Estado visual del inventario por slot | areas-de-simplificacion, taxonomia-de-servicios, interfaces-proveedor |
| precio independiente por día/temporada (paquetes) | Cada paquete de sonido tiene precio ajustable independiente | taxonomia-de-servicios, pagos-y-comisiones, interfaces-proveedor |
| normativa SLRC, Sonora | Normativa municipal de San Luis Río Colorado para MVP | areas-de-simplificacion, normativa-mexicana-2026 |
| notificación SIEMPRE de consecuencias | Obligación de informar consecuencias de no tramitar permiso | areas-de-simplificacion, normativa-mexicana-2026 |
| modo aprobación editable post-setup | Cambio de modo manual/inmediato después de alta | areas-de-simplificacion, interfaces-proveedor |
| Next.js + Firebase (stack) | Stack tecnológico definitivo para MVP | vision-y-alcance, README |

## Interfaces / Contracts

No hay interfaces técnicas nuevas. El contrato es documental: cada requirement en los 7 specs modificados usa keywords RFC 2119 (SHALL, NO SHALL, MAY) y escenarios Given/When/Then consistentes con el formato existente del proyecto.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Consistencia terminológica | Términos clave aparecen en todos los specs donde deben estar | `grep` cross-reference verification |
| Alineación 1:1 con v1.1 | Cada MODIFIED/ADDED/REMOVED对照 secciones exactas de v1.1 | Verificación manual对照 exploration.md |
| 0 contradicciones | Precios dinámicos NO como "Fuera de MVP"; campo numérico simple NO en specs modificados | `grep` anti-patterns |
| Cross-references | Specs se referencian mutuamente correctamente | Revisión de referencias cruzadas |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Los 7 main specs fueron actualizados in-place durante la fase apply. Los deltas en `changes/{change-name}/specs/` sirven como audit trail. El README refleja la versión 1.1 con 26 decisiones.

## Open Questions

- [ ] Ninguno — el cambio ya está implementado (15/15 tareas completadas).
