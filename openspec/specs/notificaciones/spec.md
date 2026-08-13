# Notificaciones — Specification

## Purpose

Definir los tipos de notificaciones, sus triggers y canales de entrega.

## Requirements

### Requirement: Tipos de Notificación

El sistema SHALL generar al menos 14 tipos de notificación diferenciados. Cada notificación SHALL especificar su trigger, canal (push, email, in-app) y destinatario.

#### Scenario: Notificación de contrato

- GIVEN que se agenda una cita de firma de contrato
- WHEN llega la fecha de la cita
- THEN ambas partes SHALL recibir notificación push + email

#### Scenario: Notificación de saldo pendiente

- GIVEN que un cliente tiene saldo pendiente por pagar
- WHEN se acerca la fecha límite de pago
- THEN el cliente SHALL recibir recordatorio push

#### Scenario: Notificación de confirmación de pago

- GIVEN que un cliente completa un pago
- WHEN el pago se procesa exitosamente
- THEN el proveedor SHALL recibir notificación de "Pago confirmado"

#### Scenario: Notificación de recordatorio de evento

- GIVEN que un evento está programado para mañana
- WHEN llega el recordatorio H-24
- THEN ambas partes SHALL recibir notificación push + email

#### Scenario: Notificación de encuesta de satisfacción

- GIVEN que un evento se completó
- WHEN pasa 24 horas después del evento
- THEN el cliente SHALL recibir solicitud de calificación

#### Scenario: Notificación de invitación a paquete

- GIVEN que un salón invita a un proveedor a un paquete
- WHEN se envía la invitación
- THEN el proveedor SHALL recibir notificación in-app + push

#### Scenario: Notificación de aceptación de paquete

- GIVEN que un proveedor acepta invitación a paquete
- WHEN confirma su participación
- THEN el salón líder SHALL recibir notificación

#### Scenario: Notificación de anticipo recibido

- GIVEN que un cliente paga anticipo
- WHEN el pago se confirma
- THEN el proveedor SHALL recibir notificación de anticipo recibido

#### Scenario: Notificación de pago completo

- GIVEN que un cliente completa el saldo restante
- WHEN el pago se procesa
- THEN el proveedor SHALL recibir notificación de pago completo

#### Scenario: Notificación de cancelación

- GIVEN que un cliente cancela una reserva
- WHEN se procesa la cancelación
- THEN el proveedor SHALL recibir notificación de cancelación

#### Scenario: Notificación de reembolso

- GIVEN que un cliente tiene derecho a reembolso
- WHEN se procesa el reembolso
- THEN el cliente SHALL recibir notificación de reembolso con monto

#### Scenario: Notificación H-48 y H-2

- GIVEN que un evento está programado
- WHEN se alcanzan 48 horas antes (H-48)
- THEN ambas partes SHALL recibir recordatorio
- AND cuando se alcancen 2 horas antes (H-2) SHALL recibir segundo recordatorio

#### Scenario: Notificación de review

- GIVEN que un cliente completa una calificación
- WHEN se publica el review
- THEN el proveedor SHALL recibir notificación de nueva calificación

#### Scenario: Notificación de agenda nueva

- GIVEN que un proveedor crea un evento en su agenda
- WHEN se guarda el evento
- THEN SHALL recibir confirmación de agenda creada

### Requirement: Canales de Notificación

Cada notificación SHALL especificar su canal: push (móvil), email, o in-app. Las notificaciones críticas (contrato, pago, cancelación) SHALL usar múltiples canales.

#### Scenario: Notificación multi-canal

- GIVEN que un cliente cancela una reserva
- WHEN se procesa la cancelación
- THEN el proveedor SHALL recibir notificación push + email + in-app
