---
title: "Notificaciones"
estado: completo
version: "1.0"
fecha: "2026-08-11"
fuentes:
  - openspec/changes/documentacion-producto-eventos/specs/notificaciones/spec.md
  - openspec/changes/documentacion-producto-eventos/specs/flujo-de-reserva/spec.md
  - openspec/changes/documentacion-producto-eventos/design.md
---

# Notificaciones

Catálogo completo de notificaciones del sistema: 16 tipos diferenciados con su trigger, canal de entrega, destinatario y timing. Las notificaciones críticas **SHALL** usar múltiples canales para garantizar entrega.

→ Ver [→ flujo_de_reserva.md](flujo_de_reserva.md) para los estados que generan notificaciones.
→ Ver [→ mensajeria.md](mensajeria.md) para mensajes programados asociados.

## Canales de Notificación

| Canal | Descripción | Cuándo usar |
|-------|-------------|-------------|
| **Push** | Notificación push en dispositivo móvil | Urgente, temporal, recordatorios |
| **Email** | Correo electrónico | Confirmaciones, resúmenes, documentación |
| **In-app** | Dentro de la aplicación | Estado de procesos, historial, acciones pendientes |

### Regla de Multi-Canal

Las notificaciones clasificadas como **críticas** (contrato, pago, cancelación) **SHALL** usar al menos **2 canales** (push + email o push + in-app). Las demás **SHALL** usar un canal primario y pueden usar canales secundarios.

## Catálogo Completo de Notificaciones (Decisión 21)

El sistema **SHALL** generar al menos **16 tipos de notificación** diferenciados.

### Tabla Maestra

| # | Notificación | Disparador | Canal | Destinatario | Timing |
|---|-------------|-----------|-------|-------------|--------|
| 1 | **Firma de contrato** | Cita de firma agendada | Push + Email | Ambos (cliente + proveedor) | Al agendar + recordatorio el día de la firma |
| 2 | **Saldo pendiente** | Saldo restante por pagar | Push | Cliente | Recordatorio antes de la fecha límite de pago |
| 3 | **Confirmación de pago** | Pago procesado exitosamente | Push + In-app | Proveedor | Inmediato al confirmar el pago |
| 4 | **Recordatorio evento H-48** | 48 horas antes del evento | Push + Email | Ambos | H-48 exacto |
| 5 | **Recordatorio evento H-2** | 2 horas antes del evento | Push | Ambos | H-2 exacto |
| 6 | **Encuesta de satisfacción** | Evento completado + 24h | Push + Email | Cliente | 24h después del evento |
| 7 | **Invitación de paquete** | Salón invita proveedor | In-app + Push | Proveedor invitado | Inmediato al enviar invitación |
| 8 | **Aceptación de invitación** | Proveedor acepta paquete | In-app | Salón líder | Inmediato |
| 9 | **Rechazo de invitación** | Proveedor rechaza paquete | In-app | Salón líder | Inmediato |
| 10 | **Anticipo recibido** | Cliente paga anticipo | Push + In-app | Proveedor | Inmediato al confirmar pago |
| 11 | **Pago completo recibido** | Cliente completa saldo | Push + Email + In-app | Proveedor | Inmediato |
| 12 | **Cancelación** | Reserva cancelada | Push + Email + In-app | Ambos (quien no canceló) | Inmediato al procesar cancelación |
| 13 | **Reembolso procesado** | Reembolso ejecutado | Push + Email | Cliente | Inmediato al procesar reembolso |
| 14 | **Review recibida** | Cliente publica calificación | In-app + Push | Proveedor | Inmediato al publicar review |
| 15 | **Nueva agenda disponible** | Proveedor crea evento en agenda | In-app | Proveedor (confirmación) | Inmediato |
| 16 | **Permiso de alcohol H-5** | 5 horas antes del evento, permiso pendiente | Push + Email | Cliente | H-5 exacto |

### Descripción por Notificación

#### 1. Firma de Contrato

| Campo | Valor |
|-------|-------|
| Disparador | Se agenda cita de firma de contrato físico |
| Canal | Push + Email (crítica) |
| Destinatario | Cliente y proveedor |
| Timing | Al agendar la cita + recordatorio el día de la firma |
| Contenido | Fecha, hora y lugar de la firma |

→ Ver [→ flujo_de_reserva.md#contrato-físico-presencial](flujo_de_reserva.md#contrato-físico-presencial) para el flujo de firma.

#### 2. Saldo Pendiente

| Campo | Valor |
|-------|-------|
| Disparador | El cliente tiene saldo restante por pagar |
| Canal | Push |
| Destinatario | Cliente |
| Timing | Recordatorio antes de la fecha límite de pago |
| Contenido | Monto pendiente y fecha límite |

→ Ver [→ pagos_y_comisiones.md#cobro-flexible](pagos_y_comisiones.md#cobro-flexible) para opciones de cobro.

#### 3. Confirmación de Pago

| Campo | Valor |
|-------|-------|
| Disparador | El pago se procesa exitosamente |
| Canal | Push + In-app (crítica) |
| Destinatario | Proveedor |
| Timing | Inmediato |
| Contenido | Monto pagado, tipo de pago (anticipo/saldo) |

#### 4. Recordatorio Evento H-48

| Campo | Valor |
|-------|-------|
| Disparador | 48 horas antes del evento |
| Canal | Push + Email |
| Destinatario | Cliente y proveedor |
| Timing | H-48 exacto |
| Contenido | Detalles del evento, fecha, hora, ubicación |

#### 5. Recordatorio Evento H-2

| Campo | Valor |
|-------|-------|
| Disparador | 2 horas antes del evento |
| Canal | Push |
| Destinatario | Cliente y proveedor |
| Timing | H-2 exacto |
| Contenido | Recordatorio urgente con detalles clave |

#### 6. Encuesta de Satisfacción

| Campo | Valor |
|-------|-------|
| Disparador | Evento completado + 24 horas |
| Canal | Push + Email |
| Destinatario | Cliente |
| Timing | 24h después del evento |
| Contenido | Enlace a encuesta de calificación |

→ Ver [→ interfaces_cliente.md#reviews-post-evento-decisión-5](interfaces_cliente.md#reviews-post-evento-decisión-5) para la interfaz de review.

#### 7. Invitación de Paquete

| Campo | Valor |
|-------|-------|
| Disparador | Salón líder invita a un proveedor |
| Canal | In-app + Push |
| Destinatario | Proveedor invitado |
| Timing | Inmediato |
| Contenido | Detalles del paquete, tipo de servicio solicitado |

→ Ver [→ paquetes_colaborativos.md](paquetes_colaborativos.md) para el flujo de invitación.

#### 8. Aceptación de Invitación

| Campo | Valor |
|-------|-------|
| Disparador | Proveedor acepta invitación al paquete |
| Canal | In-app |
| Destinatario | Salón líder |
| Timing | Inmediato |
| Contenido | Nombre del proveedor, servicio aceptado |

#### 9. Rechazo de Invitación

| Campo | Valor |
|-------|-------|
| Disparador | Proveedor rechaza invitación al paquete |
| Canal | In-app |
| Destinatario | Salón líder |
| Timing | Inmediato |
| Contenido | Nombre del proveedor, opción de invitar a otro |

#### 10. Anticipo Recibido

| Campo | Valor |
|-------|-------|
| Disparador | Cliente paga el anticipo de la reserva |
| Canal | Push + In-app |
| Destinatario | Proveedor |
| Timing | Inmediato |
| Contenido | Monto del anticipo, estado de la reserva |

#### 11. Pago Completo Recibido

| Campo | Valor |
|-------|-------|
| Disparador | Cliente completa el saldo restante |
| Canal | Push + Email + In-app (crítica) |
| Destinatario | Proveedor |
| Timing | Inmediato |
| Contenido | Monto total, confirmación de pago completo |

#### 12. Cancelación

| Campo | Valor |
|-------|-------|
| Disparador | Reserva cancelada por cualquiera de las partes |
| Canal | Push + Email + In-app (crítica) |
| Destinatario | La parte que NO canceló |
| Timing | Inmediato |
| Contenido | Motivo de cancelación, política aplicable, reembolso si aplica |

→ Ver [→ cancelaciones_y_reembolsos.md](cancelaciones_y_reembolsos.md) para escenarios de cancelación.

#### 13. Reembolso Procesado

| Campo | Valor |
|-------|-------|
| Disparador | Se ejecuta un reembolso al cliente |
| Canal | Push + Email |
| Destinatario | Cliente |
| Timing | Inmediato |
| Contenido | Monto reembolsado, método de devolución, plazo estimado |

#### 14. Review Recibida

| Campo | Valor |
|-------|-------|
| Disparador | Cliente publica una calificación |
| Canal | In-app + Push |
| Destinatario | Proveedor |
| Timing | Inmediato |
| Contenido | Calificación (estrellas), comentario del cliente |

#### 15. Nueva Agenda Disponible

| Campo | Valor |
|-------|-------|
| Disparador | Proveedor crea un evento en su agenda electrónica |
| Canal | In-app |
| Destinatario | Proveedor (confirmación propia) |
| Timing | Inmediato |
| Contenido | Confirmación de evento creado, fechas bloqueadas |

#### 16. Permiso de Alcohol H-5

| Campo | Valor |
|-------|-------|
| Disparador | 5 horas antes del evento, permiso de alcohol pendiente |
| Canal | Push + Email (crítica) |
| Destinatario | Cliente |
| Timing | H-5 exacto |
| Contenido | Estado del permiso, opciones: continuar sin alcohol o cancelar |

→ Ver [→ flujo_de_reserva.md#permiso-de-alcohol—h-5](flujo_de_reserva.md#permiso-de-alcohol—h-5) para el timeline de decisión.

## Resumen de Canales por Tipo

| Tipo de Notificación | Push | Email | In-app | Multi-canal |
|----------------------|------|-------|--------|-------------|
| Firma de contrato | ✅ | ✅ | — | Crítica |
| Saldo pendiente | ✅ | — | — | — |
| Confirmación de pago | ✅ | — | ✅ | — |
| Recordatorio H-48 | ✅ | ✅ | — | — |
| Recordatorio H-2 | ✅ | — | — | — |
| Encuesta satisfacción | ✅ | ✅ | — | — |
| Invitación paquete | — | — | ✅ | — |
| Aceptación invitación | — | — | ✅ | — |
| Rechazo invitación | — | — | ✅ | — |
| Anticipo recibido | ✅ | — | ✅ | — |
| Pago completo | ✅ | ✅ | ✅ | Crítica |
| Cancelación | ✅ | ✅ | ✅ | Crítica |
| Reembolso | ✅ | ✅ | — | — |
| Review recibida | ✅ | — | ✅ | — |
| Agenda nueva | — | — | ✅ | — |
| Permiso alcohol H-5 | ✅ | ✅ | — | Crítica |

## Documentos Relacionados

| Documento | Relación |
|-----------|----------|
| `flujo_de_reserva.md` | Estados de reserva que generan notificaciones |
| `pagos_y_comisiones.md` | Notificaciones de pago y reembolso |
| `cancelaciones_y_reembolsos.md` | Notificación de cancelación |
| `paquetes_colaborativos.md` | Notificaciones de invitación y aceptación |
| `mensajeria.md` | Mensajes programados vinculados a notificaciones |
| `interfaces_cliente.md` | Notificaciones recibidas por el cliente |
| `interfaces_proveedor.md` | Notificaciones recibidas por el proveedor |
