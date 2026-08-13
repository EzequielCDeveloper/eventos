# Exploration: Resincronizar Specs con Revisión Humana v1.1

## Current State

Los 16 specs sincronizados en `openspec/specs/` fueron generados durante el cambio `documentacion-producto-eventos` y archivados. Posteriormente, el usuario realizó una **REVISIÓN HUMANA** de `areas_de_simplificacion.md` introduciendo decisiones nuevas que actualizaron la documentación de producto a v1.1. Los specs quedaron **desactualizados** — contienen requisitos que contradicen o están obsoletos respecto a la v1.1.

## Affected Areas

- `openspec/specs/areas-de-simplificacion/spec.md` — 3 contradicciones críticas
- `openspec/specs/taxonomia-de-servicios/spec.md` — precios dinámicos faltantes, inventario por slot faltante
- `openspec/specs/pagos-y-comisiones/spec.md` — comisión con precios dinámicos faltante
- `openspec/specs/flujo-de-reserva/spec.md` — precio vigente en resumen faltante
- `openspec/specs/interfaces-proveedor/spec.md` — tabs dashboard desalineados, inventario por slot faltante
- `openspec/specs/vision-y-alcance/spec.md` — stack faltante, precios dinámicos in-scope faltante
- `openspec/specs/normativa-mexicana-2026/spec.md` — SLRC Sonora no especificado
- `openspec/specs/README/spec.md` — tabla decisiones desactualizada (23 vs 26)
- `openspec/specs/cancelaciones-y-reembolsos/spec.md` — sin cambios significativos
- `openspec/specs/roles-y-permisos/spec.md` — sin cambios significativos
- `openspec/specs/paquetes-colaborativos/spec.md` — sin cambios significativos
- `openspec/specs/verificacion-de-identidad/spec.md` — sin cambios significativos
- `openspec/specs/verificamex-integracion/spec.md` — sin cambios significativos
- `openspec/specs/interfaces-cliente/spec.md` — sin cambios significativos
- `openspec/specs/mensajeria/spec.md` — sin cambios significativos
- `openspec/specs/notificaciones/spec.md` — sin cambios significativos

## Matriz de Desalineación por Capability

### 1. areas-de-simplificacion

| Requisito en Spec | Estado en v1.1 | Tipo de Brecha | Acción Requerida |
|---|---|---|---|
| "Precios Dinámicos — Fuera de MVP": `El sistema NO SHALL soportar precios dinámicos` | v1.1: "Implementados en MVP: proveedor ajusta precios por temporada, demanda o día de la semana" | **CONTRADICCIÓN CRÍTICA** | MODIFICAR: Reemplazar requisito "Fuera de MVP" por "Dentro del MVP" con scenarios de configuración por proveedor |
| "Concurrencia — Campo Numérico Simple": `NO SHALL implementar calendario de inventario fino ni lógica de disponibilidad por slot` | v1.1: "Calendario de inventario por slot requerido: cantidad máxima de eventos por fecha + horario (slot)" | **CONTRADICCIÓN CRÍTICA** | MODIFICAR: Reemplazar "campo numérico simple" por "calendario de inventario por slot" con scenarios de validación por slot |
| "Aprobación — Configurable por Proveedor": No menciona editabilidad post-setup | v1.1: "editable después del setup inicial" — NOTA DE REVISIÓN HUMANA confirma | **OBSOLETO/FALTANTE** | MODIFICAR: Agregar scenario de edición post-setup del modo de aprobación |
| "Permiso de Alcohol — No Bloqueante": No especifica normativa SLRC, Sonora | v1.1: "SE SIGUE normativa DE SAN LUIS RIO COLORADO, SONORA, MEXICO (PARA EL MVP)" | **FALTANTE** | MODIFICAR: Agregar referencia explícita a normativa SLRC, Sonora en el requirement |
| "Permiso de Alcohol": No enfatiza notificación SIEMPRE de consecuencias | v1.1: "SIEMPRE se debe de notificar al usuario de las consecuencias de no sacar permiso" | **FALTANTE** | MODIFICAR: Reforzar que la notificación de consecuencias es SIEMPRE obligatoria |

### 2. taxonomia-de-servicios

| Requisito en Spec | Estado en v1.1 | Tipo de Brecha | Acción Requerida |
|---|---|---|---|
| No existe requirement de "Precios Dinámicos" | v1.1: Sección completa "Precios Dinámicos — Capacidad del Proveedor (Supuesto 3)" con dimensiones, reglas y ejemplos | **FALTANTE COMPLETO** | ADDED: Nuevo requirement "Precios Dinámicos — Feature MVP" con scenarios de configuración por temporada/demanda/día/bloque |
| Concurrencia: "campo numérico configurable por proveedor" — sin mención de inventario por slot | v1.1: "Calendario de inventario por slot: cantidad máxima de eventos por fecha + horario (slot)" | **OBSOLETO** | MODIFICAR: Reemplazar "campo numérico configurable" por "inventario por slot (fecha + horario)" con scenarios de validación por slot |
| Sonido: "concurrencia configurable" genérico | v1.1: Inventario por slot con indicadores de cupo por slot | **OBSOLETO** | MODIFICAR: Detallar inventario por slot con indicadores disponible/parcial/lleno |

### 3. pagos-y-comisiones

| Requisito en Spec | Estado en v1.1 | Tipo de Brecha | Acción Requerida |
|---|---|---|---|
| No existe requirement de comisión con precios dinámicos | v1.1: "La comisión SHALL calcularse sobre el precio vigente de la reserva, incluyendo los ajustes dinámicos del proveedor" | **FALTANTE** | ADDED: Nuevo scenario "Comisión sobre precio vigente con ajuste dinámico" |
| No existe mención de desglose con precio vigente | v1.1: "El desglose para el cliente SHALL mostrar el precio vigente (base + ajuste dinámico) + impuestos, sin desglosar la comisión" | **FALTANTE** | ADDED: Scenario de desglose con precio vigente |

### 4. flujo-de-reserva

| Requisito en Spec | Estado en v1.1 | Tipo de Brecha | Acción Requerida |
|---|---|---|---|
| Resumen de precio: no menciona precio vigente con ajuste dinámico | v1.1: "precio del bloque" se refiere al precio vigente de la fecha/horario consultado | **FALTANTE** | MODIFICAR: Aclarar que el resumen muestra el precio vigente (base + ajuste dinámico) |
| Verificación de disponibilidad: no especifica verificación por slot | v1.1: "verificación de disponibilidad por slot (fecha + horario)" | **FALTANTE** | MODIFICAR: Agregar que la verificación de disponibilidad es por slot, no solo por fecha |

### 5. interfaces-proveedor

| Requisito en Spec | Estado en v1.1 | Tipo de Brecha | Acción Requerida |
|---|---|---|---|
| Dashboard tabs: "(1) Reservas, (2) Servicios, (3) Calendario, (4) Chat, (5) Configuración" | v1.1: "(1) Hoy, (2) Mensajes, (3) Calendario, (4) Anuncios, (5) Estadísticas e Insights" | **CONTRADICCIÓN** | MODIFICAR: Reemplazar nombres de tabs por los de v1.1 |
| Calendario tab: no menciona ajuste dinámico de precios | v1.1: "Ajuste dinámico de precios (feature MVP)" como elemento del Tab 3 | **FALTANTE** | ADDED: Agregar "Ajuste dinámico de precios" como elemento del calendario |
| Calendario tab: no menciona inventario por slot con indicadores | v1.1: "Inventario por slot: Cantidad máxima de eventos por fecha + horario (slot), con indicadores de cupo por slot" | **FALTANTE** | ADDED: Agregar inventario por slot con indicadores al calendario |
| Configuración Concurrencia: "concurrencia máxima de eventos simultáneos" genérico | v1.1: "inventario por slot (fecha + horario)" con defaults por tipo | **OBSOLETO** | MODIFICAR: Reemplazar por inventario por slot con defaults: Salón=1, Sonido=2, Serv-persona=1 |
| Onboarding wizard: pasos "(1) datos personales, (2) tipo servicio, (3) fotos" | v1.1: "(1) Lo Fundamental, (2) El Escaparate Visual, (3) Reglas y Precios" | **CONTRADICCIÓN** | MODIFICAR: Actualizar nombres y campos de pasos del wizard |
| Onboarding Paso 3: no menciona "modo aprobación editable post-setup" | v1.1: "Políticas de reserva: Aprobación manual vs. Reserva inmediata" con editabilidad post-setup | **FALTANTE** | MODIFICAR: Agregar campo de modo de aprobación en Paso 3 |

### 6. vision-y-alcance

| Requisito en Spec | Estado en v1.1 | Tipo de Brecha | Acción Requerida |
|---|---|---|---|
| No existe requirement de Stack de Implementación | v1.1: "Next.js + Firebase" — decisión humana de revisión | **FALTANTE COMPLETO** | ADDED: Nuevo requirement "Stack de Implementación" con Next.js + Firebase |
| In Scope: no lista "Precios dinámicos" ni "Calendario de inventario por slot" | v1.1: Ambos items listados explícitamente en In Scope | **FALTANTE** | MODIFICAR: Agregar precios dinámicos e inventario por slot a In Scope |
| Out of Scope: no lista "Cálculo automático de viáticos" | v1.1: Listado en Out of Scope | **FALTANTE** | MODIFICAR: Agregar cálculo automático de viáticos a Out of Scope |

### 7. normativa-mexicana-2026

| Requisito en Spec | Estado en v1.1 | Tipo de Brecha | Acción Requerida |
|---|---|---|---|
| Permisos de Alcohol: no especifica normativa SLRC, Sonora | v1.1: "Para el MVP se sigue la normativa municipal de San Luis Río Colorado, Sonora, México" | **FALTANTE** | MODIFICAR: Agregar referencia explícita a SLRC, Sonora como normativa MVP |
| Permisos de Alcohol: no enfatiza "SIEMPRE notificar consecuencias" | v1.1: "La plataforma SHALL SIEMPRE notificar al usuario las consecuencias de no tramitarlo" | **FALTANTE** | MODIFICAR: Reforzar obligatoriedad de notificación de consecuencias |
| Permisos de Alcohol: no especifica "no cancelación automática" | v1.1: "NO SHALL cancelar la reserva automáticamente — la decisión final es del usuario" | **FALTANTE** | MODIFICAR: Agregar scenario de elección del usuario (continuar/cancelar) |
| Edad Legal Alcohol: no especifica "NO SHALL verificar edad de asistentes" | v1.1: "NO SHALL verificar la edad de los asistentes al evento — esa responsabilidad recae en el proveedor" | **FALTANTE** | ADDED: Scenario de responsabilidad de verificación de edad |

### 8. README

| Requisito en Spec | Estado en v1.1 | Tipo de Brecha | Acción Requerida |
|---|---|---|---|
| Tabla de Decisiones: "1-23" decisiones | v1.1: 26 decisiones documentadas (100%) | **OBSOLETO** | MODIFICAR: Actualizar numeración de 23 a 26 decisiones |
| Versión: "versión (1.0)" | v1.1: "versión 1.1" | **OBSOLETO** | MODIFICAR: Actualizar referencia de versión a 1.1 |
| Stack: no menciona Next.js + Firebase | v1.1: Sección "Stack de Implementación Futura" con Next.js + Firebase | **FALTANTE** | ADDED: Agregar sección de stack de implementación futura |

## Nueva Clarificación del Usuario — Precios Dinámicos con Paquetes

El usuario aclaró que los precios dinámicos aplican también a **paquetes de sonido**:

| Aspecto | Decisión |
|---|---|
| ¿Quién decide los precios? | El **PROVEEDOR** — no es una tasa fija para todos los eventos |
| ¿Puede el proveedor usar tasa fija? | **SÍ**, tiene la opción |
| ¿Puede variar por día y temporada? | **SÍ** — el proveedor selecciona precios según el DÍA y la TEMPORADA |
| ¿Puede cargar precios de paquetes? | **SÍ** — los sonidos publican paquetes con equipos y personal; el proveedor carga el precio de cada paquete, pudiendo variar por día/temporada |

**Impacto en specs**: Este requisito debe integrarse en:
1. `taxonomia-de-servicios/spec.md` — nuevo scenario en "Precios Dinámicos" para carga de precios de paquetes con variación por día/temporada
2. `pagos-y-comisiones/spec.md` — scenario de comisión calculada sobre precio de paquete con ajuste dinámico

## Approaches

### Approach 1: Resincronización Incremental por Spec

Actualizar cada spec individualmente usando las secciones ADDED/MODIFIED/REMOVED del formato delta spec.

- Pros: Cambios granulares, fácil revisión, trazabilidad por domain
- Cons: 16 specs × múltiples cambios = alto volumen de ediciones
- Effort: High

### Approach 2: Resincronización por Grupo de Impacto

Agrupar specs por severidad de desalineación: Críticos (3), Altos (4), Sin cambios (9).

- Pros: Prioriza los cambios más importantes, reduce riesgo de error
- Cons: Requiere identificación correcta de grupos
- Effort: Medium

### Approach 3: Delta Spec Unificado

Crear un único delta spec grande que cubra todos los cambios necesarios.

- Pros: Un solo archivo de referencia
- Cons: Difícil de revisar, pierde granularidad
- Effort: Medium

## Recommendation

**Approach 2: Resincronización por Grupo de Impacto** — Priorizar los 3 specs con contradicciones críticas primero (areas-de-simplificacion, taxonomia-de-servicios, interfaces-proveedor), luego los 4 con gaps significativos (pagos, flujo, vision, normativa), y finalmente README. Los 9 specs restantes no requieren cambios.

## Risks

- **Riesgo de regresión**: Modificar specs puede romper cross-references existentes
- **Riesgo de inconsistencia**: La nueva clarificación sobre paquetes de sonido no está documentada en ningún doc v1.1 — debe crearse o integrarse
- **Riesgo de omisión**: Pueden existir gaps sutiles en specs no analizados en detalle (mensajeria, notificaciones, interfaces-cliente)

## Ready for Proposal

Yes — la exploración está completa. El siguiente paso es `sdd-propose` para definir el plan de resincronización con los 7 specs que requieren cambios.

## Key Learnings

1. Los specs sincronizados contienen 3 contradicciones críticas con la v1.1 que deben resolverse antes de cualquier implementación.
2. La clarificación del usuario sobre precios dinámicos con paquetes es un requisito nuevo que no existe en ningún documento v1.1 actual.
3. 9 de 16 specs no requieren cambios — la desalineación se concentra en domains de taxonomía, pagos, interfaces y visión.
4. El cambio de numeración de decisiones (23→26) en README indica que 3 decisiones nuevas deben documentarse en los specs.
5. La normativa SLRC, Sonora es un requisito MVP que debe especificarse explícitamente en el spec de normativa.
