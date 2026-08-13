# Flujo de Reserva — Specification

## Purpose

Definir el flujo completo de reserva: desde selección hasta confirmación, incluyendo contrato físico, firma bilateral, permisos y estados intermedios.

## Requirements

### Requirement: Reserva Simple (Sin Paquete)

Una reserva simple SHALL seguir el flujo: selección de servicio → verificación de disponibilidad → selección de fecha/horario → selección de extras → resumen de precio → pago de anticipo → confirmación. El sistema SHALL mostrar disponibilidad en tiempo real.

#### Scenario: Reserva exitosa de salón

- GIVEN que un cliente selecciona un salón disponible
- WHEN elige fecha 15 de marzo, 14:00-22:00, y 2 extras
- THEN el sistema SHALL mostrar resumen con: precio bloque + hora extra + extras + impuestos + tarifa
- AND el cliente SHALL proceder a pago de anticipo

#### Scenario: Salón no disponible

- GIVEN que un cliente selecciona un salón
- WHEN la fecha/horario ya está reservado
- THEN el sistema SHALL mostrar "No disponible" y sugerir fechas alternativas

### Requirement: Contrato Físico Presencial

El sistema SHALL requerir contrato físico para reservas de salón. El flujo SHALL ser: agendar cita en app → firma presencial → doble confirmación en app (cada parte marca) → estado PENDIENTE hasta doble confirmación. La reserva SHALL permanecer PENDIENTE hasta que ambas partes confirmen la firma.

#### Scenario: Agendar cita de firma

- GIVEN que un cliente completa reserva de salón
- WHEN selecciona "Agendar firma de contrato"
- THEN SHALL poder elegir fecha y lugar para firma presencial
- AND ambas partes SHALL recibir recordatorio

#### Scenario: Firma presencial completada

- GIVEN que ambas partes se encuentran para firmar
- WHEN el cliente entrega INE y ambos firman
- THEN cada parte SHALL confirmar la firma en la app
- AND el estado de reserva SHALL cambiar a "Contrato confirmado"

#### Scenario: Doble confirmación pendiente

- GIVEN que solo el salón confirmó la firma
- WHEN el cliente aún no confirma
- THEN el estado SHALL permanecer "Pendiente de confirmación"
- AND el cliente SHALL recibir recordatorio de confirmar firma

### Requirement: Permiso de Alcohol

El permiso de alcohol NO SHALL bloquear la reserva. El permiso SHALL estar en lista de espera. Si no se confirma 5 horas (H-5) antes del evento, el sistema SHALL notificar al usuario por push + email y preguntar si continuar o cancelar. Si cancela, aplica la política del proveedor.

#### Scenario: Permiso confirmado antes de H-5

- GIVEN que un cliente solicitó permiso de alcohol
- WHEN el permiso se confirma 6 horas antes del evento
- THEN la reserva SHALL continuar sin interrupciones

#### Scenario: Permiso no confirmado a H-5

- GIVEN que el permiso no está confirmado a H-5
- WHEN se alcanza las 5 horas antes del evento
- THEN el sistema SHALL enviar notificación push + email
- AND el usuario SHALL poder elegir "Continuar sin alcohol" o "Cancelar reserva"

#### Scenario: Usuario cancela por permiso no confirmado

- GIVEN que el usuario recibe notificación de permiso no confirmado
- WHEN elige "Cancelar reserva"
- THEN SHALL aplicar la política de cancelación del proveedor
- AND el sistema SHALL procesar el reembolso según corresponda

### Requirement: Estados de Reserva

El sistema SHALL gestionar estados: PAQUETE (creado, invitaciones), CONTRATO (pendiente firma), PERMISO-ALCOHOL (lista de espera), PAGO (anticipo/saldo), CONFIRMADA, EN CURSO, COMPLETADA, CANCELADA. Cada estado SHALL generar notificación relevante.

#### Scenario: Transición de estados

- GIVEN que una reserva está en estado "Contrato confirmado"
- WHEN se procesa el pago de anticipo
- THEN el estado SHALL cambiar a "Confirmada"
- AND ambas partes SHALL recibir confirmación de pago
