# Áreas de Simplificación — Specification

## Purpose

Documentar los trade-offs explícitos del MVP: qué NO se hace, qué se simplifica, y por qué. Cada supuesto SHALL documentarse como requisito validable.

## Requirements

### Requirement: Viáticos — Campo Opcional

Los viáticos SHALL ser un campo opcional configurable por proveedor. El sistema NO SHALL validar zona de cobertura ni calcular automáticamente costos por kilómetro en MVP.

#### Scenario: Proveedor configura viáticos

- GIVEN que un proveedor quiere cobrar viáticos
- WHEN agrega campo de viáticos en su configuración
- THEN SHALL poder establecer tarifa por KM sin validación de zona

### Requirement: Aprobación — Configurable por Proveedor

Cada proveedor SHALL elegir su modo de aprobación: manual (contrato físico para salones) o inmediata (servicios simples). El defecto del sistema SHALL ser: aprobación manual para salones, inmediata para servicios simples. El proveedor SHALL poder cambiar dicha configuración después del setup inicial.

#### Scenario: Salón con aprobación manual

- GIVEN que un salón configura aprobación manual
- WHEN un cliente reserva
- THEN la reserva SHALL quedar pendiente de aprobación manual

#### Scenario: Servicio simple con aprobación inmediata

- GIVEN que un proveedor de sonido configura aprobación inmediata
- WHEN un cliente reserva
- THEN la reserva SHALL confirmarse automáticamente

#### Scenario: Proveedor edita modo de aprobación post-setup

- GIVEN que un proveedor tiene su servicio activo con aprobación manual
- WHEN cambia la configuración a aprobación inmediata
- THEN la nueva configuración SHALL aplicar a solicitudes futuras
- AND las reservas existentes NO SHALL ser afectadas

### Requirement: Precios Dinámicos — Dentro del MVP

El sistema SHALL soportar precios dinámicos en MVP. Los precios SHALL ser configurables por el proveedor según temporada, demanda o día de la semana, además de la configuración base por bloque de horas.

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

### Requirement: Depósito × Cancelación — Orden de Aplicación

En cancelación, el orden de aplicación SHALL ser: anticipo primero (no reembolsable) → depósito (reembolsable según política). Cancelación por proveedor SHALL devolver TODO (anticipo + depósito).

#### Scenario: Cancelación cliente — orden correcto

- GIVEN que un cliente cancela con anticipo de $3,000 y depósito de $2,000
- WHEN se procesa la cancelación
- THEN el anticipo ($3,000) SHALL retenerse primero
- AND el depósito ($2,000) SHALL reembolsarse si la política lo permite

### Requirement: Contrato — Flujo Bilateral

El contrato SHALL seguir flujo bilateral: agendar cita → firma presencial → doble confirmación en app → estado PENDIENTE. La reserva SHALL permanecer PENDIENTE hasta que ambas partes confirmen la firma.

#### Scenario: Confirmación unilateral insuficiente

- GIVEN que solo el salón confirmó la firma
- WHEN el cliente aún no confirma
- THEN el estado SHALL permanecer "Pendiente de confirmación"
- AND no SHALL avanzar a "Confirmada"

### Requirement: Permiso de Alcohol — No Bloqueante con Normativa SLRC, Sonora

El permiso de alcohol NO SHALL bloquear la reserva. Para el MVP, la plataforma SHALL seguir la normativa municipal de San Luis Río Colorado, Sonora, México. La plataforma SHALL SIEMPRE notificar al usuario las consecuencias de no tramitar el permiso. Si no se confirma H-5 antes del evento, el sistema SHALL notificar y preguntar continuar o cancelar. NO SHALL haber cancelación automática — la elección es del usuario.

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

### Requirement: Notas de Voz — Límite 2 Minutos

Las notas de voz SHALL tener límite de 2 minutos por nota. No SHALL haber transcripción de notas de voz en MVP. Las notas se reproducirán como audio.

#### Scenario: Nota de voz dentro del límite

- GIVEN que un usuario graba nota de voz de 90 segundos
- WHEN la envía
- THEN la nota SHALL entregarse completamente

#### Scenario: Nota de voz excede límite

- GIVEN que un usuario graba nota de voz de 3 minutos
- WHEN alcanza 2 minutos
- THEN la grabación SHALL cortarse automáticamente
- AND SHALL mostrar advertencia de límite

### Requirement: Sin Mediación de Disputas

La plataforma NO SHALL mediar disputas comerciales. Las disputas SHALL resolverse fuera de la app. La interfaz SHALL mostrar esta limitación claramente.

#### Scenario: Cliente busca mediación

- GIVEN que un cliente tiene disputa con proveedor
- WHEN intenta abrir disputa en la app
- THEN SHALL ver "Las disputas se resuelven entre las partes"
- AND SHALL ver información de contacto del proveedor
