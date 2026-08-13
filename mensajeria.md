---
title: "Mensajería"
estado: completo
version: "1.0"
fecha: "2026-08-11"
fuentes:
  - openspec/changes/documentacion-producto-eventos/specs/mensajeria/spec.md
  - openspec/changes/documentacion-producto-eventos/specs/flujo-de-reserva/spec.md
  - openspec/changes/documentacion-producto-eventos/design.md
---

# Mensajería

Capacidades de comunicación entre cliente y proveedor: chat de texto, llamadas de voz y video, notas de voz tipo WhatsApp en MVP, respuestas rápidas y mensajes programados. El chat **SHALL** estar disponible durante todo el flujo de reserva y después del evento.

→ Ver [→ interfaces_cliente.md#chat](interfaces_cliente.md) y [→ interfaces_proveedor.md#tab-2-mensajes-centro-de-comunicación](interfaces_proveedor.md#tab-2-mensajes-centro-de-comunicación) para la interfaz de chat en cada rol.

## Chat de Texto (Decisión 12)

El sistema **SHALL** soportar chat de texto en tiempo real entre cliente y proveedor.

| Característica | Descripción |
|----------------|-------------|
| Disponibilidad | Desde que se inicia contacto hasta después del evento |
| Persistencia | Todos los mensajes se guardan en el historial |
| Acceso post-evento | Ambas partes pueden revisar el historial después del evento |
| Notificación | El receptor recibe notificación push cuando recibe un mensaje |

### Escenario: Envío de mensaje

> DADO que un cliente tiene una reserva activa
> CUANDO envía un mensaje de texto al proveedor
> ENTONCES el proveedor **SHALL** recibir notificación del mensaje
> Y el mensaje **SHALL** persistir en el historial.

### Escenario: Mensaje post-evento

> DADO que un evento ya ocurrió
> CUANDO el cliente o proveedor accede al chat
> ENTONCES **SHALL** ver el historial completo de mensajes.

## Llamadas de Voz y Video (Decisión 12)

El sistema **SHALL** soportar llamadas de voz y video en tiempo real entre cliente y proveedor. Ambas modalidades **SHALL** estar disponibles en el MVP.

### Características

| Modalidad | Descripción |
|-----------|-------------|
| **Voz** | Llamada de audio en tiempo reaL |
| **Video** | Llamada con cámara activa |

### Escenario: Llamada de voz

> DADO que un cliente quiere hablar con el proveedor
> CUANDO inicia una llamada de voz
> ENTONCES el proveedor **SHALL** recibir la llamada
> Y la llamada **SHALL** establecerse si el proveedor acepta.

| Característica | Descripción |
|----------------|-------------|
| Disponibilidad | Desde el chat, durante todo el flujo de reserva |
| Estados | Llamando → En curso → Finalizada |
| Persistencia | Registro de llamadas en el historial (fecha, duración, tipo) |
| Sin grabación | Las llamadas **NO SHALL** grabarse por defecto |

## Notas de Voz MVP (Supuesto 10)

El sistema **SHALL** soportar notas de voz estilo WhatsApp en el MVP. Las notas de voz son una alternativa rápida al texto, ideal para cuando el usuario está en movimiento.

### Restricciones MVP

| Parámetro | Valor |
|-----------|-------|
| Límite de duración | **2 minutos** máximo por nota |
| Transcripción | **NO** disponible en MVP |
| Formato | Audio grabado directamente en la app |
| Reproducción | Con reproducción inline en el chat |

> **Supuesto 10**: Las notas de voz tienen un límite de 2 minutos. No hay transcripción en MVP. Esta funcionalidad puede escalarse en futuras versiones.

### Escenario: Envío de nota de voz

> DADO que un cliente quiere enviar nota de voz
> CUANDO graba y envía una nota de voz de 45 segundos
> ENTONCES la nota **SHALL** entregarse al proveedor
> Y el proveedor **SHALL** poder reproducirla.

### Escenario: Nota de voz excede límite

> DADO que un usuario graba una nota de voz
> CUANDO la nota supera los 2 minutos
> ENTONCES el sistema **SHALL** cortar la grabación a 2 minutos
> Y **SHALL** mostrar advertencia de "límite de 2 minutos alcanzado".

### Interfaz de Nota de Voz

| Elemento | Comportamiento |
|----------|---------------|
| Botón de grabación | Mantener presionado para grabar, soltar para enviar |
| Indicador visual | Barra de progreso con tiempo transcurrido |
| Límite | Aviso a 1:30 minutos, corte automático a 2:00 |
| Reproducción | Botón play con barra de progreso |
| Eliminación | Opción de eliminar nota enviada (solo reciente) |

## Respuestas Rápidas Guardadas

El proveedor **SHALL** poder guardar respuestas rápidas para agilizar la comunicación.

| Característica | Descripción |
|----------------|-------------|
| Creación | El proveedor crea mensajes predefinidos con nombre |
| Uso | Selección de una respuesta de una lista desplegable |
| Edición | Las respuestas **SHALL** ser editables y eliminables |
| Ejemplos | "Confirmo disponibilidad", "Gracias por su interés", "¿Podría confirmar la fecha?" |

### Ejemplo de Respuestas Rápidas

| Nombre | Mensaje |
|--------|---------|
| Confirmar disponibilidad | "¡Hola! Confirmo disponibilidad para la fecha solicitada. ¿Desea avanzar con la reserva?" |
| Agradecer | "¡Gracias por su interés! Estoy a sus órdenes para cualquier pregunta." |
| Pedir fecha | "¿Podría confirmar la fecha y horario que le interesa?" |
| Precio | "El precio base es de $X MXN por bloque de Y horas. ¿Le gustaría conocer los extras disponibles?" |

## Mensajes Programados

El sistema **SHALL** soportar mensajes programados (automatizaciones) que se envían en horarios específicos.

| Mensaje | Trigger | Destinatario | Timing |
|---------|---------|-------------|--------|
| Confirmación de detalles | Reserva confirmada | Cliente | 24h antes del evento |
| Recordatorio de evento | Reserva confirmada | Ambos | H-48 y H-2 |
| Solicitud de review | Evento completado | Cliente | 24h después del evento |
| Recordatorio de pago | Saldo pendiente | Cliente | Antes de la fecha límite |

→ Ver [→ notificaciones.md](notificaciones.md) para el catálogo completo de notificaciones.

## Centro de Comunicación

El chat se integra en el dashboard del proveedor como la pestaña "Mensajes" y en la navbar del cliente como el tab "Chat".

### Flujo de Comunicación

```
Cliente busca servicio → Detalle → "Chatear con proveedor"
    ↓
Chat se crea (si no existe) → Mensajes de texto / notas de voz
    ↓
Durante reserva → Confirmaciones, ajustes, preguntas
    ↓
Post-evento → Historial accesible, calificación
```

### Persistencia del Historial

| Aspecto | Comportamiento |
|---------|---------------|
| Almacenamiento | Todos los mensajes, notas de voz y registros de llamadas se guardan |
| Acceso | Ambas partes acceden al historial completo |
| Post-evento | El historial **SHALL** permanecer accesible después del evento |
| Búsqueda | El usuario **SHALL** poder buscar en el historial por texto |

→ Ver [→ notificaciones.md](notificaciones.md) para notificaciones asociadas a mensajes y eventos de chat.

## Documentos Relacionados

| Documento | Relación |
|-----------|----------|
| `interfaces_cliente.md` | Interfaz de chat del cliente |
| `interfaces_proveedor.md` | Centro de comunicación del proveedor |
| `notificaciones.md` | Notificaciones de mensajes y eventos de chat |
| `flujo_de_reserva.md` | Chat disponible durante todo el flujo |
| `roles_y_permisos.md` | Permisos de comunicación por rol |
