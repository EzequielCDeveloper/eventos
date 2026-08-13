# Mensajería — Specification

## Purpose

Definir las capacidades de chat: texto, voz, video, notas de voz MVP y automatizaciones.

## Requirements

### Requirement: Chat Texto

El sistema SHALL soportar chat de texto entre cliente y proveedor. El chat SHALL estar disponible durante todo el flujo de reserva y después del evento.

#### Scenario: Cliente envía mensaje de texto

- GIVEN que un cliente tiene una reserva activa
- WHEN envía un mensaje de texto al proveedor
- THEN el proveedor SHALL recibir notificación del mensaje
- AND el mensaje SHALL persistir en el historial

### Requirement: Chat de Voz y Video

El sistema SHALL soportar llamadas de voz y video entre cliente y proveedor. El chat de voz y video SHALL estar disponible en el MVP.

#### Scenario: Llamada de voz

- GIVEN que un cliente quiere hablar con el proveedor
- WHEN inicia una llamada de voz
- THEN el proveedor SHALL recibir la llamada
- AND la llamada SHALL establecerse si el proveedor acepta

### Requirement: Notas de Voz MVP

El sistema SHALL soportar notas de voz tipo WhatsApp en MVP. Cada nota de voz SHALL tener un límite de 2 minutos. No SHALL haber transcripción de notas de voz en MVP.

#### Scenario: Envío de nota de voz

- GIVEN que un cliente quiere enviar nota de voz
- WHEN graba y envía una nota de voz de 45 segundos
- THEN la nota SHALL entregarse al proveedor
- AND el proveedor SHALL poder reproducirla

#### Scenario: Nota de voz excede límite

- GIVEN que un usuario graba una nota de voz
- WHEN la nota supera los 2 minutos
- THEN el sistema SHALL cortar la grabación a 2 minutos
- AND SHALL mostrar advertencia de "límite de 2 minutos alcanzado"

### Requirement: Persistencia de Mensajes

Todos los mensajes, notas de voz y llamadas SHALL persistirse en el historial del chat. El historial SHALL ser accesible por ambas partes después del evento.

#### Scenario: Historial accesible post-evento

- GIVEN que un evento ya ocurrió
- WHEN el cliente o proveedor accede al chat
- THEN SHALL ver el historial completo de mensajes y notas de voz
