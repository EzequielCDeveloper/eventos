# Delta for Áreas de Simplificación

## MODIFIED Requirements

### Requirement: Precios Dinámicos — Dentro del MVP

El sistema SHALL soportar precios dinámicos en MVP. Los precios SHALL ser configurables por el proveedor según temporada, demanda o día de la semana, además de la configuración base por bloque de horas.

(Previously: "Precios Dinámicos — Fuera de MVP": el sistema NO SHALL soportar precios dinámicos)

#### Scenario: Proveedor configura precios dinámicos

- GIVEN que un proveedor quiere ajustar precios por temporada
- WHEN accede a configuración de precios
- THEN SHALL ver opciones de ajuste por temporada, demanda y día de la semana
- AND SHALL poder configurar porcentaje de ajuste sobre precio base

#### Scenario: Precio vigente visible al cliente

- GIVEN que un proveedor configuró ajuste dinámico de +20% para diciembre
- WHEN un cliente consulta disponibilidad en diciembre
- THEN SHALL ver el precio vigente (base + ajuste) antes de confirmar reserva
- AND NO SHALL haber recargos ocultos

### Requirement: Concurrencia — Calendario de Inventario por Slot

La concurrencia SHALL gestionarse mediante calendario de inventario por slot (fecha + horario). El proveedor SHALL definir la cantidad máxima de eventos por fecha y horario. El sistema NO SHALL usar campo numérico simple sin inventario fino.

(Previously: "Concurrencia — Campo Numérico Simple": campo numérico simple sin calendario de inventario fino)

#### Scenario: Configuración de inventario por slot

- GIVEN que un proveedor de sonido quiere configurar disponibilidad
- WHEN accede a calendario de inventario
- THEN SHALL poder definir cantidad máxima de eventos por slot (fecha + horario)
- AND SHALL ver indicadores de cupo: disponible / parcial / lleno por slot

#### Scenario: Reserva validada por slot

- GIVEN que un proveedor tiene inventario de 3 eventos por slot y ya tiene 3 reservas en el slot de 10:00–14:00
- WHEN un cliente intenta reservar en ese mismo slot
- THEN el sistema SHALL rechazar la reserva con mensaje de "límite de eventos simultáneos alcanzado en ese horario"
- AND el slot de 14:00–18:00 SHALL permanecer con cupo disponible

### Requirement: Aprobación — Configurable por Proveedor

Cada proveedor SHALL elegir su modo de aprobación: manual (contrato físico para salones) o inmediata (servicios simples). El defecto del sistema SHALL ser: aprobación manual para salones, inmediata para servicios simples. El proveedor SHALL poder cambiar dicha configuración después del setup inicial.

(Previously: No mencionaba editabilidad post-setup del modo de aprobación)

#### Scenario: Proveedor edita modo de aprobación post-setup

- GIVEN que un proveedor tiene su servicio activo con aprobación manual
- WHEN cambia la configuración a aprobación inmediata
- THEN la nueva configuración SHALL aplicar a solicitudes futuras
- AND las reservas existentes NO SHALL ser afectadas

### Requirement: Permiso de Alcohol — No Bloqueante con Normativa SLRC, Sonora

El permiso de alcohol NO SHALL bloquear la reserva. Para el MVP, la plataforma SHALL seguir la normativa municipal de San Luis Río Colorado, Sonora, México. La plataforma SHALL SIEMPRE notificar al usuario las consecuencias de no tramitar el permiso. Si no se confirma H-5 antes del evento, el sistema SHALL notificar y preguntar continuar o cancelar. NO SHALL haber cancelación automática — la elección es del usuario.

(Previously: No especificaba normativa SLRC, Sonora ni enfatizaba notificación SIEMPRE de consecuencias)

#### Scenario: Notificación SIEMPRE de consecuencias

- GIVEN que un cliente reserva un evento con servicio de alcohol
- WHEN se planifica el evento
- THEN el sistema SHALL informar que se requiere permiso municipal (opcional según normativa SLRC)
- AND SHALL SIEMPRE notificar las consecuencias de no tramitar el permiso

#### Scenario: Decisión del usuario sin cancelación automática

- GIVEN que el permiso no está confirmado a H-5
- WHEN el usuario recibe notificación de consecuencias
- THEN SHALL poder elegir "Continuar sin alcohol" o "Cancelar reserva"
- AND NO SHALL haber cancelación automática — la decisión es del usuario
- AND si cancela, SHALL aplicar política de cancelación del proveedor

## REMOVED Requirements

### Requirement: Precios Dinámicos — Fuera de MVP

(Reason: Reemplazado por "Precios Dinámicos — Dentro del MVP" — la v1.1 confirma que los precios dinámicos son feature del MVP)
(Migration: Requiere el nuevo requirement "Precios Dinámicos — Dentro del MVP" en este mismo delta)

### Requirement: Concurrencia — Campo Numérico Simple

(Reason: Reemplazado por "Concurrencia — Calendario de Inventario por Slot" — la v1.1 requiere inventario por slot)
(Migration: Requiere el nuevo requirement "Concurrencia — Calendario de Inventario por Slot" en este mismo delta)
