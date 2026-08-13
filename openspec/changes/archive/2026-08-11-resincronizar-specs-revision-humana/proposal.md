# Proposal: Resincronizar Specs con Revisión Humana v1.1

## Intent

Los 16 specs de `openspec/specs/` fueron generados durante el cambio `documentacion-producto-eventos`. Posteriormente, el usuario realizó una revisión humana de `areas_de_simplificacion.md` (v1.1) que introdujo 3 decisiones nuevas (23→26), actualizó la documentación de producto, y definió precios dinámicos por proveedor con paquetes. Los specs quedaron desactualizados: 3 contradicciones críticas (precios dinámicos "fuera de MVP", concurrencia "sin slot", tabs del dashboard incorrectos), 4 gaps significativos (stack, normativa SLRC, comisiones, flujo), y 1 obsoleto (README 23→26).

## Scope

### In Scope
- Actualizar 7 specs en `openspec/specs/` con delta preciso por capability:
  - `areas-de-simplificacion` — resolver 3 contradicciones críticas + 2 faltantes
  - `taxonomia-de-servicios` — agregar precios dinámicos MVP + inventario por slot + precios de paquetes
  - `pagos-y-comisiones` — comisión sobre precio vigente con ajuste dinámico + paquetes
  - `interfaces-proveedor` — tabs dashboard v1.1 + onboarding wizard + inventario por slot
  - `vision-y-alcance` — stack Next.js+Firebase + precios dinámicos in-scope + inventario por slot
  - `normativa-mexicana-2026` — SLRC Sonora MVP + notificación consecuencias + elección usuario
  - `README` — 26 decisiones, versión 1.1, stack
- Integrar la clarificación del usuario sobre precios dinámicos con paquetes: proveedor decide precios, puede usar tasa fija, variar por día/temporada, cargar precio de cada paquete de sonido
- Documentar reglas de negocio: proveedor controla precios (no tasa fija universal), paquetes con equipos y personal tienen precio independiente por día/temporada

### Out of Scope
- Los 16 documentos `.md` de producto de la raíz (ya en v1.1, NO se tocan)
- 9 specs sin cambios: cancelaciones, roles, paquetes, verificacion, verificamex, interfaces-cliente, mensajeria, notificaciones, flujo-de-reserva
- `areas_de_simplificacion.md` de raíz
- Código, tests, implementación técnica

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `areas-de-simplificacion`: Reemplazar "Precios Dinámicos — Fuera de MVP" por "Dentro del MVP"; reemplazar "Concurrencia — Campo Numérico Simple" por "Calendario de Inventario por Slot"; agregar editabilidad post-setup del modo de aprobación; agregar referencia normativa SLRC Sonora; reforzar notificación SIEMPRE de consecuencias de alcohol
- `taxonomia-de-servicios`: ADDED "Precios Dinámicos — Feature MVP" (proveedor decide precios, tasa fija opcional, variación por día/temporada, carga de precios por paquete); MODIFICAR concurrencia a inventario por slot con indicadores de cupo
- `pagos-y-comisiones`: ADDED comisión calculada sobre precio vigente con ajuste dinámico; ADDED desglose con precio vigente (base + ajuste) + impuestos; ADDED comisión sobre precio de paquete con variación
- `interfaces-proveedor`: MODIFICAR tabs dashboard a Hoy/Mensajes/Calendario/Anuncios/Estadísticas; ADDED ajuste dinámico de precios en Tab 3; ADDED inventario por slot con indicadores; MODIFICAR onboarding wizard pasos a Lo Fundamental/El Escaparate Visual/Reglas y Precios; ADDED modo aprobación editable post-setup en Paso 3
- `vision-y-alcance`: ADDED "Stack de Implementación" (Next.js + Firebase); MODIFICAR In Scope con precios dinámicos e inventario por slot; MODIFICAR Out of Scope con cálculo automático de viáticos
- `normativa-mexicana-2026`: MODIFICAR permisos de alcohol con normativa SLRC Sonora MVP; ADDED obligatoriedad SIEMPRE de notificación de consecuencias; ADDED elección del usuario (continuar/cancelar sin cancelación automática); ADDED responsabilidad de verificación de edad en proveedor
- `README`: MODIFICAR tabla decisiones 23→26; MODIFICAR versión 1.0→1.1; ADDED sección stack de implementación futura

## Approach

**Resincronización por Grupo de Impacto** (Approach 2 de exploración):

1. **Grupo Crítico** (3 specs con contradicciones): areas-de-simplificacion, taxonomia-de-servicios, interfaces-proveedor — se actualizan primero por riesgo de regresión
2. **Grupo Alto** (4 specs con gaps): pagos-y-comisiones, vision-y-alcance, normativa-mexicana-2026, README — se actualizan segundo
3. Cada spec se modifica in-place en `openspec/specs/` (NO se crean delta specs en changes/ porque esto es resincronización, no implementación)

Precios dinámicos con paquetes: se integra la regla de negocio del usuario (proveedor decide, tasa fija opcional, variación día/temporada, carga por paquete) como requirements nuevos en taxonomia y pagos.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/specs/areas-de-simplificacion/spec.md` | Modified | 5 requirements: 2 MODIFIED (precios dinámicos, concurrencia), 3 ADDED (aprobación editabilidad, SLRC, notificación consecuencias) |
| `openspec/specs/taxonomia-de-servicios/spec.md` | Modified | 2 requirements: 1 ADDED (precios dinámicos MVP con paquetes), 1 MODIFIED (concurrencia→inventario por slot) |
| `openspec/specs/pagos-y-comisiones/spec.md` | Modified | 3 requirements ADDED (comisión precio vigente, desglose, comisión paquete) |
| `openspec/specs/interfaces-proveedor/spec.md` | Modified | 6 requirements: 3 MODIFIED (tabs, onboarding, concurrencia), 3 ADDED (ajuste dinámico calendario, inventario slot, modo aprobación) |
| `openspec/specs/vision-y-alcance/spec.md` | Modified | 3 requirements: 1 ADDED (stack), 2 MODIFIED (in-scope, out-scope) |
| `openspec/specs/normativa-mexicana-2026/spec.md` | Modified | 4 requirements: 3 MODIFIED (SLRC, consecuencias, elección usuario), 1 ADDED (verificación edad) |
| `openspec/specs/README/spec.md` | Modified | 3 fields: numeración decisiones, versión, stack |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Regresión cross-references entre specs modificados | Med | Revisar referencias cruzadas después de cada spec; mantener consistencia de términos (inventario por slot, precio vigente) |
| Drift silencioso entre spec y v1.1 | Baja | Verificar cada MODIFIED contra las secciones exactas de areas_de_simplificacion.md v1.1 antes de escribir |
| Omisión de la clarificación de paquetes | Media | La clarificación del usuario se documenta explícitamente en taxonomia y pagos como requirements separados |
| Inconsistencia en definición de "precio vigente" | Baja | Definir "precio vigente = base + ajuste dinámico" una vez en taxonomia y reutilizar el término en pagos y flujo |

## Rollback Plan

Revertir los 7 archivos modificados desde el último commit del repo (sin git, mantener backup previo de cada spec antes de modificar). Cada spec se lee completamente antes de editar; si la edición falla o genera inconsistencia, se descarta y se reintentá.

## Dependencies

- `areas_de_simplificacion.md` v1.1 (raíz) como fuente de verdad para la resincronización
- Clarificación del usuario sobre precios dinámicos con paquetes (documentada en exploration.md)
- Ninguna dependencia externa o de código

## Success Criteria

- [ ] Los 7 specs modificados contienen requirements que alinean 1:1 con areas_de_simplificacion.md v1.1
- [ ] 0 contradicciones entre specs y v1.1 (verificación manual contra matriz de exploración)
- [ ] La nueva clarificación de precios por paquete está documentada como requirement en taxonomia y pagos
- [ ] Precios dinámicos ya NO aparecen como "Fuera de MVP" en ningún spec
- [ ] Inventario por slot reemplaza "campo numérico simple" en todos los specs afectados
- [ ] Tabs del dashboard en interfaces-proveedor coinciden con v1.1
- [ ] Stack Next.js+Firebase documentado en vision-y-alcance y README
- [ ] Normativa SLRC Sonora especificada como requisito MVP en normativa
- [ ] verify fase posterior pasa sin contradicciones

## Proposal question round

Dado que el usuario ya proporcionó clarificación explícita sobre precios dinámicos con paquetes y el alcance está bien definido en la entrada, no se requiere ronda de preguntas. Las siguientes suposiciones se aplican:

1. **Precios dinámicos**: el proveedor tiene control total — puede elegir tasa fija, variar por día/temporada, y cargar precios independientes por paquete
2. **Inventario por slot**: reemplaza completamente "campo numérico simple" — la granularidad es fecha + horario
3. **Stack**: Next.js + Firebase es la decisión técnica definitiva para el MVP
4. **Normativa SLRC**: aplica solo a permisos de alcohol en San Luis Río Colorado, Sonora, para el MVP
5. **Los 9 specs sin cambios** se confirman como alineados — no requieren revisión adicional
