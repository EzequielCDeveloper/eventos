---
title: "Taxonomía de Servicios"
estado: completo
version: "1.1"
fecha: "2026-08-11"
fuentes:
  - openspec/changes/documentacion-producto-eventos/specs/taxonomia-de-servicios/spec.md
  - openspec/changes/documentacion-producto-eventos/proposal.md
---

# Taxonomía de Servicios

El sistema soporta tres tipos de servicio con modelos de precios, concurrencia y configuración diferenciados. Cada tipo tiene un formulario de alta propio y reglas de disponibilidad específicas.

## Tipos de Servicio

| Tipo | Descripción | Modelo de precio | Concurrencia |
|------|-------------|------------------|--------------|
| Salón de eventos | Espacios físicos para celebraciones | Bloque de horas + hora extra + extras | Forzada a 1 evento simultáneo |
| Sonido | Equipos de audio, iluminación, pantallas | Paquete equipo + horas base + hora extra + extras | Configurable por proveedor |
| Servicio-persona | Meseros, bartenders, cocineros, etc. | Precio × persona × hora | Configurable por proveedor |

→ Ver [→ vision_y_alcance.md#alcance-del-marketplace](vision_y_alcance.md#alcance-del-marketplace) para contexto general.

## Modelos de Precio

### Salón de Eventos — Bloque de Horas

El modelo de salón se basa en bloques de horas con precio base.

| Concepto | Descripción | Obligatorio |
|----------|-------------|-------------|
| Bloque de horas base | Número de horas incluidas en el precio base | Sí |
| Precio bloque base | Monto total del bloque de horas | Sí |
| Precio hora extra | Costo por hora adicional fuera del bloque | Sí |
| Extras | Servicios adicionales (decoración, mobiliario, etc.) | No |
| Impuestos | Impuestos aplicables (IVA, etc.) | Sí |
| Tarifa de uso de app | Comisión de la plataforma (→ ver [→ vision_y_alcance.md#modelo-de-ingresos](vision_y_alcance.md#modelo-de-ingresos)) | Sí |

> Ejemplo: Salón "Las Palmas" — Bloque 4 horas base: $8,000 MXN. Hora extra: $2,500 MXN. Extra: "Decoración temática" $1,500 MXN.

### Sonido — Paquete de Equipo

El modelo de sonido combina un paquete de equipo con horas de servicio.

| Concepto | Descripción | Obligatorio |
|----------|-------------|-------------|
| Paquete de equipo + personal | Descripción del equipo incluido (bocinas, luces, pantallas, etc.) | Sí |
| Nombre del paquete | Identificador del paquete | Sí |
| Descripción del paquete | Detalle del contenido del paquete | Sí |
| Horas base | Horas de servicio incluidas en el precio base | Sí |
| Hora extra | Costo por hora adicional | Sí |
| Extras | Servicios adicionales con: nombre, descripción, precio e imagen | Sí (cada extra) |
| Impuestos | Impuestos aplicables | Sí |
| Tarifa de uso de app | Comisión de la plataforma | Sí |

Los extras de sonido **MUST** incluir los 4 campos obligatorios: nombre, descripción, precio e imagen. Sin estos campos, el extra **SHALL** quedar en borrador.

> Ejemplo: Paquete "Sonido Básico" — 2 bocinas, 4 luces LED, mezcladora. Nombre: "Básico". Descripción: "Equipo para fiesta de 100 personas". Horas base: 5. Hora extra: $800 MXN. Extra: "Pantalla LED 50 pulgadas" — nombre, descripción, precio $1,200 MXN, imagen.

### Servicio-Persona — Precio por Hora

El modelo de servicios-persona se basa en tarifa por persona por hora.

| Concepto | Descripción | Obligatorio |
|----------|-------------|-------------|
| Precio por persona por hora | Tarifa unitaria por cada persona contratada | Sí |
| Impuestos | Impuestos aplicables | Sí |
| Tarifa por persona | Comisión de la plataforma por persona | Sí |

> Ejemplo: Bartender — $250 MXN/persona/hora. Para 3 bartenders en 6 horas: $250 × 3 × 6 = $4,500 MXN.

## Precios Dinámicos — Capacidad del Proveedor (Supuesto 3)

Los **precios dinámicos** son una **feature del MVP**: el proveedor **SHALL** poder ajustar sus precios dinámicamente por temporada, demanda o día de la semana. El ajuste se configura sobre el precio base del modelo correspondiente (bloque, paquete o por persona).

| Dimensiones de ajuste | Ejemplo |
|-----------------------|---------|
| Temporada | Fines de año, quincenas, vacaciones (ej. 20% sobre el precio base en diciembre) |
| Demanda | Fechas con alta demanda (ej. sábados de bodas) |
| Día de la semana | Tarifas diferenciadas finde semana vs. entre semana |
| Bloque / turno | Diferenciar precio por bloque de horas o turno del día |

| Regla | Comportamiento |
|-------|----------------|
| Precio base siempre visible | El precio vigente de la fecha/horario consultado **SHALL** mostrarse al cliente antes de confirmar reserva |
| Desglose transparente | El desglose (bloque + extras + impuestos + tarifa) **SHALL** calcularse sobre el precio vigente de la reserva (→ ver [→ pagos_y_comisiones.md](pagos_y_comisiones.md)) |
| Configurable por proveedor | El ajuste **MAY** configurarse desde el calendario del proveedor (→ ver [→ interfaces_proveedor.md#tab-3-calendario](interfaces_proveedor.md#tab-3-calendario)) |
| Sin percepción negativa | No se aplican recargos ocultos: cualquier ajuste dinámico **SHALL** ser visible en el detalle del servicio antes del pago |

> Ejemplo: Salón "Las Palmas" configura precio base de $8,000 MXN por bloque de 4 horas y un ajuste dinámico de +20% para sábados en temporada alta (diciembre). El sábado de diciembre se cotiza en $9,600 MXN, mostrado al cliente antes de confirmar.

## Concurrencia

La concurrencia controla cuántos eventos simultáneos puede atender un proveedor en la misma fecha y horario. Para sonidos y servicios-persona se gestiona mediante inventario por slot (fecha + horario) en el calendario del proveedor.

### Regla General

| Tipo | Concurrencia | Configurable |
|------|-------------|--------------|
| Salón | Forzada a 1 | No — restricción del sistema |
| Sonido | Inventario por slot (numérica) | Sí — calendario en agenda del proveedor |
| Servicio-persona | Inventario por slot (numérica) | Sí — calendario en agenda del proveedor |

### Salón — Concurrencia Forzada a 1 (Decisión 7)

Los salones **SHALL** estar forzados a un máximo de 1 evento simultáneo. Esta restricción **MUST** ser validada por el sistema al momento de la reserva, no configurable por el proveedor.

| Escenario | Resultado |
|-----------|-----------|
| Salón libre en fecha/hora solicitada | Reserva permitida |
| Salón ya reservado en fecha/hora solicitada | Reserva rechazada: "Salón ya reservado en esa fecha y horario" |
| Intento de configurar concurrencia >1 | Campo bloqueado con mensaje: "Los salones solo admiten 1 evento simultáneo" |

### Sonido/Servicios-Persona — Inventario por Slot (Supuesto 6)

Sonidos y servicios-persona **SHALL** gestionar su disponibilidad mediante un **calendario de inventario por slot**: el proveedor define la cantidad máxima de eventos que puede atender en la misma **fecha y horario** (slot). La disponibilidad no se controla solo por fecha, sino por slot específico.

| Escenario | Resultado |
|-----------|-----------|
| Límite del slot = 3, reservas activas en el slot = 2 | Nueva reserva permitida |
| Límite del slot = 3, reservas activas en el slot = 3 | Nueva reserva rechazada: "Límite de eventos simultáneos alcanzado en ese horario" |
| Límite del slot = 1 | Se comporta como salón (1 evento por slot) |
| Slot con cupo libre pero fecha con otros slots llenos | Reserva permitida solo si el horario solicitado tiene cupo |

> Ejemplo: Proveedor de sonido configura inventario por slot con límite 3. Puede atender hasta 3 eventos en el mismo slot (fecha + horario). Si el sábado tiene 3 eventos de 10:00–14:00, el slot de 14:00–18:00 permanece con cupo para otros 3 eventos.

El calendario de inventario por slot **SHALL** reflejarse en la agenda del proveedor (→ ver [→ interfaces_proveedor.md#tab-3-calendario](interfaces_proveedor.md#tab-3-calendario)) y la verificación de disponibilidad del flujo de reserva (**SHALL** validarse por slot, no solo por fecha).

## Mínimo de Fotos

El sistema **SHALL** exigir un mínimo de 5 fotos en alta resolución para cada servicio publicado. Este requisito aplica a los tres tipos de servicio.

| Estado | Comportamiento |
|--------|---------------|
| Menos de 5 fotos | Publicación bloqueada: "Mínimo 5 fotos requeridas" |
| 5 o más fotos | Publicación permitida (pendiente de moderación) |
| Fotos en revisión | Servicio en estado "Borrador" hasta aprobación de moderación |

## Extras y Upselling

Cada tipo de servicio permite agregar extras configurables. Los extras funcionan como upselling que el cliente puede seleccionar al reservar.

| Tipo | Campos obligatorios del extra | Campos opcionales |
|------|-------------------------------|-------------------|
| Salón | Nombre, descripción, precio | Imagen |
| Sonido | Nombre, descripción, precio, imagen | — |
| Servicio-persona | Nombre, descripción, precio | Imagen |

Los extras **SHALL** agregarse al precio total de la reserva. El cliente **SHALL** ver el desglose de extras seleccionados antes de confirmar el pago.

→ Ver [→ pagos_y_comisiones.md](pagos_y_comisiones.md) para cálculo de precio total con extras.

## Depósito de Garantía (Decisión 10)

El depósito de garantía es un monto retenido temporalmente que se devuelve al cliente después del evento, sujeto a la política del proveedor.

| Aspecto | Valor |
|---------|-------|
| ¿Quién lo configura? | Cada salón de forma independiente |
| ¿Es obligatorio? | No — a discreción del salón |
| ¿Cuándo se cobra? | Junto con el anticipo, al confirmar reserva |
| ¿Cuándo se devuelve? | Después del evento, si no hay daños reportados |
| ¿Es reembolsable? | Sí, condicional a ausencia de daños |

> Ejemplo: Salón cobra depósito de $2,000 MXN. Evento se realiza sin incidentes → depósito se devuelve 48 horas después del evento. Si hay daños, proveedor reporta y se deduce del depósito.

→ Ver [→ cancelaciones_y_reembolsos.md](cancelaciones_y_reembolsos.md) para escenarios de cancelación con depósito.

## Documentos Relacionados

| Documento | Relación |
|-----------|----------|
| `vision_y_alcance.md` | Segmentos y modelo de ingresos |
| `roles_y_permisos.md` | Permisos de proveedor para configurar servicios |
| `paquetes_colaborativos.md` | Paquetes multi-proveedor |
| `flujo_de_reserva.md` | Reserva por bloques de horas |
| `pagos_y_comisiones.md` | Cálculo de precio total y comisión |
