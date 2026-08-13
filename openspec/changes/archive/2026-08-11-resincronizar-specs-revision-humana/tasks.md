# Tasks: Resincronizar Specs con Revisión Humana v1.1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 280–320 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR — all 7 specs in one |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Apply all 7 deltas (specs only, no code) | Single PR | `grep -c "SHALL" openspec/specs/*/spec.md` | N/A — docs-only, no runtime | 7 spec files independently revertable |

## Phase 1: Grupo Crítico — Contradiciones (3 specs)

- [x] 1.1 **areas-de-simplificacion**: REMOVE "Precios Dinámicos — Fuera de MVP" (L35-44) y "Concurrencia — Campo Numérico Simple" (L46-55). REPLACE "Aprobación" (L19-33) con versión editabilidad post-setup. REPLACE "Permiso de Alcohol" (L79-88) con normativa SLRC + notificación SIEMPRE. ADD "Precios Dinámicos — Dentro del MVP" con 2 escenarios. ADD "Concurrencia — Calendario de Inventario por Slot" con 2 escenarios. ~65 líneas.

- [x] 1.2 **taxonomia-de-servicios**: ADD "Precios Dinámicos — Feature MVP" (5 escenarios: ajuste por temporada, tasa fija, precios por paquete, precio vigente visible, desglose transparente). MODIFY "Concurrencia Configurable" → inventario por slot con indicadores de cupo (3 escenarios). MODIFY "Sonido — Modelo de Precios con Paquetes" → precio independiente ajustable por día/temporada (2 escenarios). ~40 líneas.

- [x] 1.3 **interfaces-proveedor**: MODIFY "Dashboard 5 Tabs" → tabs (1)Hoy (2)Mensajes (3)Calendario (4)Anuncios (5)Estadísticas e Insights (5 escenarios). MODIFY "Onboarding Wizard" → pasos (1)Lo Fundamental (2)El Escaparate Visual (3)Reglas y Precios con modo aprobación. MODIFY "Configuración de Concurrencia" → inventario por slot con defaults. ADD "Ajuste Dinámico de Precios en Calendario" (2 escenarios). ADD "Modo Aprobación Editable Post-Setup" (1 escenario). ~55 líneas.

## Phase 2: Grupo Alto — Gaps (4 specs)

- [x] 2.1 **pagos-y-comisiones**: ADD "Comisión sobre Precio Vigente con Ajuste Dinámico" (2 escenarios: comisión sobre precio con ajuste, comisión sobre paquete con variación). ADD "Desglose con Precio Vigente" (2 escenarios: cliente ve desglose, proveedor ve precio con comisión). ADD "Comisión sobre Precio de Paquete con Variación" (2 escenarios: dos paquetes independientes, paquete sin ajuste). ~50 líneas.

- [x] 2.2 **vision-y-alcance**: ADD "Stack de Implementación" (Next.js + Firebase, 1 escenario). MODIFY "MVP — Segmentos Objetivo" → agregar precios dinámicos e inventario por slot al alcance (3 escenarios). MODIFY "Alcance del Marketplace" → mencionar precios dinámicos. REMOVE "Cálculo Automático de Viáticos" como requirement (mover a Out of Scope). ~35 líneas.

- [x] 2.3 **normativa-mexicana-2026**: MODIFY "Permisos de Alcohol" → normativa SLRC Sonora MVP + notificación SIEMPRE + consecuencias (3 escenarios: doc permisos SLRC, notificación consecuencias, elección usuario). ADD "Verificación de Edad — Responsabilidad del Proveedor" (1 escenario). ~25 líneas.

- [x] 2.4 **README**: MODIFY "Tabla de Decisiones" → numeración 1-26 con decisiones 24-26 (precios dinámicos, alcohol SLRC, aprobación editable). MODIFY "Estado y Versión" → versión 1.1 con 26 decisiones. ADD "Stack de Implementación" (Next.js + Firebase, 1 escenario). ~15 líneas.

## Phase 3: Verificación de Consistencia

- [x] 3.1 **Inventario por slot**: Verificar que "calendario de inventario por slot (fecha + horario)" aparece consistente en: areas-de-simplificacion, taxonomia-de-servicios, interfaces-proveedor, vision-y-alcance. Indicadores de cupo (disponible/parcial/lleno) presentes donde aplique.

- [x] 3.2 **Precio vigente**: Verificar que "precio vigente (base + ajuste dinámico)" se define en taxonomia-de-servicios y se reutiliza en pagos-y-comisiones y areas-de-simplificacion sin contradicciones. Desglose sin comisión visible al cliente consistente.

- [x] 3.3 **Paquetes con variación**: Verificar que "precio independiente por día/temporada" para paquetes de sonido aparece en: taxonomia-de-servicios (modelo de precios con paquetes), pagos-y-comisiones (comisión sobre paquete con variación), interfaces-proveedor (calendario con ajuste).

- [x] 3.4 **Cross-references**: Verificar que areas-de-simplificacion (permiso alcohol SLRC) es consistente con normativa-mexicana-2026 (misma normativa, misma elección usuario). Verificar que interfaces-proveedor (tabs) es consistente con taxonomia (concurrencia por slot desde calendario Tab 3).

## Phase 4: Verificación Final

- [x] 4.1 **Alineación 1:1 con v1.1**: Verificar cada MODIFIED/ADDED/REMOVED contra las secciones exactas de areas_de_simplificacion.md v1.1. Confirmar 0 contradicciones.

- [x] 4.2 **0 contradicciones vs areas_de_simplificacion.md**: Revisar que "Precios Dinámicos — Dentro del MVP" reemplaza "Fuera de MVP", "Calendario de Inventario por Slot" reemplaza "Campo Numérico Simple", aprobación es editabilidad post-setup, alcohol tiene normativa SLRC + notificación SIEMPRE.

- [x] 4.3 **Cross-references OK**: Confirmar que los 7 specs se referencian mutuamente correctamente y que no hay gaps entre dominios (ej: taxonomia dice "inventario por slot" y interfaces-proveedor lo refleja en Tab 3).

- [x] 4.4 **Sin drift**: Confirmar que precios dinámicos NO aparecen como "Fuera de MVP" en ningún spec. Confirmar que "campo numérico simple" NO aparece en ningún spec modificado.

## Key Terms Inventory

| Término | Specs donde debe aparecer |
|---------|---------------------------|
| calendario de inventario por slot (fecha + horario) | areas-de-simplificacion, taxonomia-de-servicios, interfaces-proveedor, vision-y-alcance |
| precio vigente (base + ajuste dinámico) | areas-de-simplificacion, taxonomia-de-servicios, pagos-y-comisiones |
| indicadores de cupo (disponible/parcial/lleno) | areas-de-simplificacion, taxonomia-de-servicios, interfaces-proveedor |
| precio independiente por día/temporada (paquetes) | taxonomia-de-servicios, pagos-y-comisiones, interfaces-proveedor |
| normativa SLRC, Sonora | areas-de-simplificacion, normativa-mexicana-2026 |
| notificación SIEMPRE de consecuencias | areas-de-simplificacion, normativa-mexicana-2026 |
| modo aprobación editable post-setup | areas-de-simplificacion, interfaces-proveedor |
| Next.js + Firebase (stack) | vision-y-alcance, README |
| 26 decisiones / versión 1.1 | README |
