---
title: "Áreas de Simplificación"
estado: completo
version: "1.1"
fecha: "2026-08-11"
fuentes:
  - openspec/changes/documentacion-producto-eventos/specs/areas-de-simplificacion/spec.md
  - openspec/changes/documentacion-producto-eventos/proposal.md
  - openspec/changes/documentacion-producto-eventos/design.md
---

# Áreas de Simplificación MVP

> **Disclaimer**: Este documento documenta decisiones de simplificación del MVP.
> Cada item es un supuesto validable que **MUST** confirmarse antes de generalización.
> Ninguna simplificación es accidental — todas son deliberadas con trade-off explícito.

## Tabla Maestra de Supuestos

| #   | Supuesto                                | Contexto                                                   | Decisión MVP                                                                                        | Alternativa Considerada                          | Impacto                                                            | Validación                                                |
| --- | --------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------- |
| 1   | Viáticos por KM                         | Proveedores móviles necesitan cobrar traslado              | Campo opcional configurable, sin cálculo automático                                                 | Cálculo automático por zona + GPS                | Sin validación de zona; proveedor asume riesgo de cobro incorrecto | [x] ✓ Validado por revisión humana                        |
| 2   | Reserva inmediata vs. aprobación manual | Salones necesitan revisar antes de confirmar               | Cada proveedor elige modo al inicio (manual o inmediata); **editable después del setup inicial**     | Forzar un solo modo para todos                   | Proveedor puede cambiar su modo cuando lo desee                    | [x] ✓ Validado — configurable y editable post-setup       |
| 3   | Precios dinámicos                       | Eventos en temporada alta podrían cobrar más               | **Implementados en MVP**: proveedor ajusta precios por temporada, demanda o día de la semana        | Precios fijos sin ajuste                          | Mayor flexibilidad comercial; requiere configuración del proveedor | [x] ✓ Validado — feature del MVP                         |
| 4   | Mínimo de fotos                         | Servicios sin fotos generan desconfianza                   | 5 fotos obligatorias en alta de servicio                                                            | 3 fotos (menos barrera) o 10 fotos (más calidad) | Barrera de entrada para proveedores; calidad del catálogo          | [x] ✓ Validado por revisión humana (5 es óptimo)          |
| 5   | Alcance del administrador               | ¿Hasta dónde llega el admin?                               | 5 funciones: moderación, proveedores, stats, disputas técnicas, comisión. **NO** soporte al cliente | Incluir soporte al cliente en admin              | Riesgo de scope creep si se agrega soporte                         | [x] ✓ Validado por revisión humana                        |
| 6   | Concurrencia numérica simple            | Proveedores de sonido/servicios atienden múltiples eventos | **Calendario de inventario por slot**: cantidad máxima de eventos por fecha + horario (slot)        | Campo numérico simple sin inventario fino        | Gestión granular de disponibilidad por slot                        | [x] ✓ Validado — inventario por slot requerido            |
| 7   | Depósito × cancelación                  | ¿Qué pasa con depósito al cancelar?                        | Orden: anticipo (no reembolsable) → depósito (reembolsable); cancelación proveedor devuelve TODO    | Otras combinaciones de orden                     | Claridad en política, pero rigidez en edge cases                   | [x] ✓ Validado por revisión humana                        |
| 8   | Ceremonia del contrato                  | Contrato debe ser legalmente válido                        | Flujo bilateral: agendar cita → firma presencial → doble confirmación en app                        | Contrato 100% digital (firma electrónica)        | Más pasos, pero mayor seguridad legal                              | [x] ✓ Validado por revisión humana                        |
| 9   | Permiso de alcohol H-5                  | Permisos municipales tienen timeline estricto              | **Opcional**; SIEMPRE notificar consecuencias de no tramitarlo; normativa SLRC, Sonora (MVP)        | Bloquear reserva si no hay permiso               | Usuario decide con información completa; no es cancelación automática | [x] ✓ Validado — elección del usuario                   |
| 10  | Notas de voz                            | Usuarios móviles prefieren voz sobre texto                 | Límite 2 min por nota, sin transcripción en MVP                                                     | Sin límite + transcripción                       | Funcionalidad reducida, pero MVP viable                            | [x] ✓ Validado por revisión humana                        |

## Detalle por Supuesto

### Supuesto 1: Viáticos por KM

- **Contexto**: Proveedores móviles (sonido, servicios-persona) necesitan cobrar traslado. Sin cálculo automático, el proveedor debe configurar tarifa manualmente.
- **Decisión**: Campo opcional configurable por proveedor. Tarifa por KM sin validación de zona de cobertura en MVP.
- **Alternativa descartada**: Cálculo automático por zona + GPS que determine distancia y costo. Requiere integración con API de mapas, geocoding, y lógica de zonas.
- **Impacto**: El proveedor asume riesgo de cobrar de más o de menos. El cliente no tiene garantía de precio justo por traslado. **Se mitiga** con transparencia: el costo de viáticos se muestra antes de confirmar reserva.
- **Validación**: [x] ✓ Validado por revisión humana — no se requiere cálculo automático; el proveedor asume el riesgo de cobrar de más o de menos.

→ Aplica en: [→ taxonomia_de_servicios.md](taxonomia_de_servicios.md), [→ pagos_y_comisiones.md](pagos_y_comisiones.md)

NOTA DE REVISION HUMANA: NO SE REQUIERE CALCULO AUTOMATICO DE GENERALIZACION Y PROVEEDOR ASUME RIESGO DE COBRAR DE MAS O DE MENOS

### Supuesto 2: Reserva Inmediata vs. Aprobación Manual

- **Contexto**: Salones de eventos necesitan revisar disponibilidad antes de confirmar. Servicios simples (bartender, sonido) pueden confirmar automáticamente.
- **Decisión**: Cada proveedor elige su modo de aprobación al momento del alta (manual o inmediata), con un default según tipo de servicio. **Posterior al setup inicial**, el proveedor **MAY** cambiar dicha configuración cuando lo desee.
- **Alternativa descartada**: Forzar un solo modo para todos los tipos de servicio, o fijar el modo por tipo sin posibilidad de cambio posterior. Reduciría complejidad pero no se ajusta a la realidad operativa de cada giro ni a su evolución.
- **Impacto**: El proveedor controla su modo de aprobación durante todo el ciclo de vida del servicio. Un cambio de modo aplica a solicitudes futuras.
- **Validación**: [x] ✓ Validado por revisión humana — configurable al inicio y editable después del setup inicial.

NOTA DE REVISION HUMANA: implementar que todos puedan al inicio configurar si manual o inmediatamente, POSTERIOR AL SETUP INICIAL, si asi lo desea puede cambiar dicha configuracion

→ Aplica en: [→ flujo_de_reserva.md](flujo_de_reserva.md), [→ interfaces_proveedor.md](interfaces_proveedor.md)

### Supuesto 3: Precios Dinámicos — Implementados en el MVP

- **Contexto**: Eventos en temporada alta (fin de año, quincenas) podrían justificar precios mayores. Surge pricing es estándar en marketplaces.
- **Decisión**: **Precios dinámicos implementados dentro del MVP**: el proveedor **SHALL** poder ajustar sus precios dinámicamente según temporada, demanda o día de la semana, además de la configuración base por bloque de horas.
- **Alternativa descartada**: Precios fijos únicos sin ajuste por temporada, demanda o día de la semana. Limitaría la capacidad del proveedor de capitalizar temporada alta.
- **Impacto**: El proveedor capitaliza temporada alta y demanda sin depender de actualizaciones manuales globales. **Se mitiga** con transparencia: el precio vigente se muestra al cliente antes de confirmar reserva y el desglose permanece claro.
- **Validación**: [x] ✓ Validado por revisión humana — se implementan precios dinámicos dentro del MVP.

NOTA DE REVISION HUMANA: IMPLEMENTAR PRECIOS DINAMICOS DENTRO DEL MVP

→ Aplica en: [→ taxonomia_de_servicios.md#modelos-de-precio](taxonomia_de_servicios.md#modelos-de-precio)

### Supuesto 4: Mínimo 5 Fotos en Alta de Servicio

- **Contexto**: Servicios sin fotos generan desconfianza y baja conversión. Fotos de calidad son críticas para la experiencia del cliente.
- **Decisión**: 5 fotos obligatorias al publicar un servicio. El sistema bloquea la publicación si no hay al menos 5 fotos.
- **Alternativa descartada**: 3 fotos (menos barrera, pero menor calidad percibida) o 10 fotos (más calidad, pero barrera excesiva para nuevos proveedores).
- **Impacto**: Barrera de entrada para proveedores sin fotos listas. Se mitiga con guía de fotos sugeridas y permite subir de_gallery del dispositivo.
- **Validación**: [x] ✓ Validado por revisión humana — 5 es la cantidad óptima.

→ Aplica en: [→ taxonomia_de_servicios.md](taxonomia_de_servicios.md), [→ interfaces_proveedor.md](interfaces_proveedor.md)

NOTA DE REVISION HUMANA: APROBAR ESTA PROPUESTA, 5 ES LA CANTIDAD OPTIMA

### Supuesto 5: Alcance del Rol Administrador

- **Contexto**: Definir qué puede y qué NO puede hacer el administrador. Riesgo de scope creep si se agrega soporte al cliente.
- **Decisión**: Exactamente 5 funciones: (1) moderación de contenido, (2) gestión de proveedores, (3) estadísticas globales, (4) disputas técnicas, (5) comisión global. **NO** incluye soporte al cliente ni mediación de disputas comerciales.
- **Alternativa descartada**: Incluir soporte al cliente dentro del rol de administrador. Ampliaría el alcance pero difuminaría responsabilidades y aumentaría carga de trabajo.
- **Impacto**: No hay soporte al cliente desde la plataforma. Los clientes con problemas técnicos contactan al admin; los problemas comerciales se resuelven entre las partes. **Se mitiga** con FAQ y canal de ayuda autogestionado.
- **Validación**: [x] ✓ Validado por revisión humana — no incluye soporte al cliente.

→ Aplica en: [→ roles_y_permisos.md#administrador](roles_y_permisos.md#administrador)

NOTA DE REVISION HUMANA: ACEPTADA, NO SE INCLUYE SOPORTE AL CLIENTE.

### Supuesto 6: Concurrencia — Calendario de Inventario por Slot

- **Contexto**: Proveedores de sonido y servicios-persona pueden atender múltiples eventos simultáneos. Con inventario por slot, la disponibilidad se controla por fecha Y horario específico.
- **Decisión**: **Calendario de inventario por slot requerido**: el proveedor **SHALL** definir la cantidad máxima de eventos que puede atender en la misma fecha y horario (slot). La disponibilidad se gestiona por slot (fecha + horario), no solo por fecha.
- **Alternativa descartada**: Campo numérico simple de máx. simultáneos por fecha, sin inventario fino. Imposibilita controlar en qué horarios atiende cada evento.
- **Impacto**: Control granular de disponibilidad por slot. Un proveedor con concurrencia 3 puede atender hasta 3 eventos en el mismo slot y definir por horario dónde tiene espacio. **Se mitiga** con el calendario de inventario en la agenda del proveedor (→ ver [→ interfaces_proveedor.md](interfaces_proveedor.md)).
- **Validación**: [x] ✓ Validado por revisión humana — el calendario de inventario por slot es necesario.

→ Aplica en: [→ taxonomia_de_servicios.md#concurrencia](taxonomia_de_servicios.md#concurrencia)

NOTA DE REVISION HUMANA:ES NECESARIO, inventario de cantidad de eventos maxima que puede atender un proveedor, en un mismo fecha y horario, Calendario DE INVENTARIO POR SLOT

### Supuesto 7: Depósito × Cancelación — Orden de Aplicación

- **Contexto**: Al cancelar, ¿qué pasa con el depósito de garantía? El orden de aplicación determina cuánto pierde el cliente.
- **Decisión**: Orden de aplicación: (1) anticipo — no reembolsable, se queda con el proveedor; (2) depósito — reembolsable según política del proveedor. Cancelación por proveedor: devolución **TOTAL** (anticipo + depósito).
- **Alternativa descartada**: Devolver todo al cliente (incluido anticipo) o no devolver nada. Ambas generan disputas y perciben injusticia.
- **Impacto**: El cliente pierde el anticipo siempre al cancelar. El depósito se devuelve si la política del proveedor lo permite. **Se mitiga** mostrando la política de cancelación antes de confirmar reserva.
- **Validación**: [x] ✓ Validado por revisión humana — el orden de aplicación es el correcto.

→ Aplica en: [→ cancelaciones_y_reembolsos.md](cancelaciones_y_reembolsos.md), [→ pagos_y_comisiones.md#depósito-de-garantía](pagos_y_comisiones.md#depósito-de-garantía)

NOTA DE REVISION HUMANA: ES CORRECTO EL orden

### Supuesto 8: Ceremonia del Contrato Físico

- **Contexto**: Los contratos de alquiler de salón deben ser legalmente válidos. La firma electrónica puede no ser suficiente para ciertos tipos de contrato.
- **Decisión**: Flujo bilateral: (1) agendar cita de firma en app, (2) firma presencial del contrato físico, (3) doble confirmación en app (cada parte confirma), (4) estado PENDIENTE hasta doble confirmación.
- **Alternativa descartada**: Contrato 100% digital con firma electrónica. Más ágil pero potencialmente sin validez legal para ciertos tipos de contrato en México.
- **Impacto**: Más pasos y tiempo para confirmar reserva. La reserva permanece PENDIENTE hasta que ambas partes firmen y confirmen. **Se mitiga** con recordatorios automáticos y flexibilidad en la fecha de firma.
- **Validación**: [x] ✓ Validado por revisión humana — se confirma el flujo bilateral presencial.

→ Aplica en: [→ flujo_de_reserva.md#contrato-físico-presencial](flujo_de_reserva.md#contrato-físico-presencial)

NOTA DE REVISION HUMANA: CONFIRMO

### Supuesto 9: Permiso de Alcohol — Opcional con Notificación de Consecuencias (SLRC, Sonora)

- **Contexto**: Los permisos de alcohol dependen de la normativa municipal. Para el MVP se sigue la normativa de **San Luis Río Colorado, Sonora, México**. H-5 (5 horas antes del evento) es el límite para confirmar el permiso.
- **Decisión**: El permiso de alcohol es **OPCIONAL**. La plataforma **SHALL** **SIEMPRE** notificar al usuario las **consecuencias de no tramitarlo**. NO es cancelación automática: la elección final es del usuario. Si no se confirma H-5, el sistema notifica y permite elegir: continuar sin alcohol o cancelar la reserva.
- **Alternativa descartada**: Bloquear la reserva automáticamente si el permiso no está confirmado H-5. Generaría cancelaciones forzadas y mala experiencia.
- **Impacto**: El usuario decide con información completa de consecuencias. Si elige continuar sin alcohol, pierde el servicio de alcohol. Si cancela, aplica la política de cancelación del proveedor. **Se mitiga** con notificación temprana (H-48), recordatorio H-5 y notificación explícita de consecuencias.
- **Validación**: [x] ✓ Validado por revisión humana — permiso opcional, notificación de consecuencias obligatoria, elección del usuario.

→ Aplica en: [→ flujo_de_reserva.md#permiso-de-alcohol—h-5](flujo_de_reserva.md#permiso-de-alcohol—h-5)

NOTA DE REVISION HUMANA: SE SIGUE normativa DE SAN LUIS RIO COLORADO, SONORA, MEXICO (PARA EL MVP), PERMISO DE Alcohol ES OPCIONAL, MAS SIEMPRE SE DEBE DE NOTIFICAR AL USUARIO DE LAS CONCESECUENCIAS DE NO SACAR PERMISO DE Alcohol Y SE CONFIRMA QUE NO ES CANCELACION AUTOMATICA SINO ELECCION DEL USUARIO.

### Supuesto 10: Notas de Voz — Límite 2 Min sin Transcripción

- **Contexto**: Usuarios móviles prefieren voz sobre texto para comunicarse rápido. Las notas de voz estilo WhatsApp son ideales para cuando el usuario está en movimiento.
- **Decisión**: Límite de **2 minutos** por nota de voz. Sin transcripción en MVP. Las notas se reproducen como audio.
- **Alternativa descartada**: Sin límite de duración + transcripción automática. Requiere integración con servicio de transcripción (costo adicional) y manejo de notas largas.
- **Impacto**: Funcionalidad reducida comparada con apps de mensajería completas. El usuario no puede buscar en el contenido de notas de voz. **Se mitiga** con límite generoso (2 min es suficiente para la mayoría de mensajes).
- **Validación**: [x] ✓ Validado por revisión humana — 2 minutos es suficiente; la transcripción es funcionalidad futura.

→ Aplica en: [→ mensajeria.md#notas-de-voz-mvp](mensajeria.md#notas-de-voz-mvp)

NOTA DE REVISION: CONFIRMA LIMITE DE 2 MINUTOS.

## Checklist de Validación General

NOTA DE REVISION HUMANA: se notifica que cuando se pase a implementacion, la app estara desarrollada en NEXT.js + Firebase

- [x] Supuestos 1, 4, 5, 7, 8 y 10 validados por revisión humana (sin cambio de contenido).
- [x] Supuestos 2, 3, 6 y 9 actualizados según decisión humana final.
- [x] **Stack de implementación futura**: cuando se pase a implementación, la app será desarrollada en **Next.js + Firebase** (indicado por el usuario en la revisión humana).

## Referencias

→ Ver [→ vision_y_alcance.md](vision_y_alcance.md) para el alcance general del MVP que motiva estas simplificaciones.
→ Ver los documentos específicos indicados en cada supuesto para la implementación concreta de cada simplificación.
