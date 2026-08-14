---
title: "Documentación del Producto — App Eventos"
estado: completo
version: "1.1"
fecha: "2026-08-11"
fuentes:
  - openspec/changes/documentacion-producto-eventos/design.md
  - openspec/changes/documentacion-producto-eventos/specs/README/spec.md
---

# Documentación del Producto — App Eventos

Marketplace de servicios para eventos en México: salones de eventos, equipos de sonido/iluminación, y servicios-persona (meseros, bartenders, etc.). Conecta clientes (particulares y empresas) con proveedores verificados, con pagos vía Conekta en MXN.

**Para entender el producto en 30 segundos**: Lee [→ vision_y_alcance.md](vision_y_alcance.md) (qué es, para quién, cómo genera ingresos).

## Guía de Navegación

La documentación sigue un orden de dependencias lineales. Cada documento es autocontenido con cross-references al siguiente.

```
0. README.md                    ← estás aquí
1. vision_y_alcance.md          ← base: qué es el producto
2. roles_y_permisos.md          ← depende de: vision
3. taxonomia_de_servicios.md    ← depende de: vision, roles
4. paquetes_colaborativos.md    ← depende de: vision, taxonomía, roles
5. flujo_de_reserva.md          ← depende de: taxonomía, paquetes, roles
6. pagos_y_comisiones.md        ← depende de: flujo, vision
7. cancelaciones_y_reembolsos.md ← depende de: pagos, flujo
8. mensajeria.md                ← depende de: roles, flujo
9. notificaciones.md            ← depende de: flujo, roles, mensajeria
10. verificacion_de_identidad.md ← depende de: roles, normativa
11. interfaces_cliente.md        ← depende de: flujo, taxonomía, pagos
12. interfaces_proveedor.md      ← depende de: flujo, taxonomía, roles
13. normativa_mexicana_2026.md   ← standalone
14. verificamex_integracion.md   ← depende de: verificación, normativa
```

## Índice de Documentos

| # | Documento | Capability | Estado |
|---|-----------|------------|--------|
| 0 | [README.md](README.md) | Índice maestro, glossario, tabla decisiones | ✅ Completo |
| 1 | [vision_y_alcance.md](vision_y_alcance.md) | MVP, segmentos, modelo ingresos, alcance | ✅ Completo |
| 2 | [roles_y_permisos.md](roles_y_permisos.md) | Roles, permisos, verificación, ranking, admin | ✅ Completo |
| 3 | [taxonomia_de_servicios.md](taxonomia_de_servicios.md) | Tipos servicio, modelos precios, concurrencia, extras | ✅ Completo |
| 4 | [paquetes_colaborativos.md](paquetes_colaborativos.md) | Paquete multi-proveedor, líder salón, invitación | ✅ Completo |
| 5 | [flujo_de_reserva.md](flujo_de_reserva.md) | Bloques horas, contrato físico, firma, permisos | ✅ Completo |
| 6 | [pagos_y_comisiones.md](pagos_y_comisiones.md) | Conekta, comisión, depósito, impuestos, cobro | ✅ Completo |
| 7 | [cancelaciones_y_reembolsos.md](cancelaciones_y_reembolsos.md) | Políticas por actor, retención, devolución | ✅ Completo |
| 8 | [mensajeria.md](mensajeria.md) | Chat texto/voz/video, notas voz MVP | ✅ Completo |
| 9 | [notificaciones.md](notificaciones.md) | 14+ tipos, triggers, canales | ✅ Completo |
| 10 | [verificacion_de_identidad.md](verificacion_de_identidad.md) | INE presencial, KYC APIs, badges | ✅ Completo |
| 11 | [interfaces_cliente.md](interfaces_cliente.md) | Explorar, buscar, filtros, favoritos, rentas | ✅ Completo |
| 12 | [interfaces_proveedor.md](interfaces_proveedor.md) | Onboarding wizard, dashboard 5 tabs, agenda | ✅ Completo |
| 13 | [normativa_mexicana_2026.md](normativa_mexicana_2026.md) | LFPDPPP, Ley Consumer, Código Comercio | ✅ Completo |
| 14 | [verificamex_integracion.md](verificamex_integracion.md) | API Verificamex, Lista Nominal, errores | ✅ Completo |

**Leyenda**: ✅ Completo | 🟡 Parcial | ⚠️ Pendiente

## Archivos Legacy Preservados

Los siguientes archivos originales fueron preservados como `_legacy` para rollback safety:

| Archivo Legacy | Derivado de | Contenido migrado a |
|---------------|-------------|---------------------|
| `eventos_legacy.md` | `eventos.md` | `interfaces_cliente.md`, `interfaces_proveedor.md` |

**Rollback**: Para restaurar, renombrar `*_legacy.md` → nombre original.

## Stack de Implementación Futura

Cuando se pase a la fase de implementación, la aplicación será desarrollada en **Node.js + Express + MariaDB** (backend, con auth JWT propia) y **React + Vite** (frontend), con chat de texto en tiempo real vía **Socket.IO**, voz/video con **PeerJS (WebRTC) o Agora**, y pagos con **Conekta** (→ ver [→ vision_y_alcance.md#stack-de-implementación-futura](vision_y_alcance.md#stack-de-implementación-futura)).

## Tabla de Decisiones

| # | Decisión | Documento | Estado |
|---|----------|-----------|--------|
| 1 | MVP: particulares + empresas | [vision_y_alcance.md#mvp](vision_y_alcance.md#mvp) | [x] |
| 2 | Ingresos: comisión por transacción | [pagos_y_comisiones.md#comisión-por-transacción-decisión-2-decisión-9](pagos_y_comisiones.md#comisión-por-transacción-decisión-2-decisión-9) | [x] |
| 3 | Reserva por bloques de horas | [flujo_de_reserva.md#reserva-por-bloques-de-horas](flujo_de_reserva.md#reserva-por-bloques-de-horas) | [x] |
| 4 | Pagos: Conekta API MXN | [pagos_y_comisiones.md#conekta—procesamiento-en-mxn](pagos_y_comisiones.md#conekta—procesamiento-en-mxn) | [x] |
| 5 | Reviews: solo post-pago + fecha pasada | [interfaces_cliente.md#reviews-post-evento-decisión-5](interfaces_cliente.md#reviews-post-evento-decisión-5) | [x] |
| 6 | Paquetes: líder = salón | [paquetes_colaborativos.md#creación-de-paquete-por-líder](paquetes_colaborativos.md#creación-de-paquete-por-líder) | [x] |
| 7 | Concurrencia: inventario por slot (fecha+horario), 1 forzado salón | [taxonomia_de_servicios.md#concurrencia](taxonomia_de_servicios.md#concurrencia) | [x] |
| 8 | 3 modelos de precios | [taxonomia_de_servicios.md#modelos-de-precio](taxonomia_de_servicios.md#modelos-de-precio) | [x] |
| 9 | Comisión sumada, visibilidad diferenciada | [pagos_y_comisiones.md#visibilidad-diferenciada](pagos_y_comisiones.md#visibilidad-diferenciada) | [x] |
| 10 | Depósito configurable por salón | [pagos_y_comisiones.md#depósito-de-garantía](pagos_y_comisiones.md#depósito-de-garantía) | [x] |
| 11 | Contrato físico, firma dual, permisos | [flujo_de_reserva.md#contrato-físico-presencial](flujo_de_reserva.md#contrato-físico-presencial) | [x] |
| 12 | Chat texto/voz/video, notas voz MVP | [mensajeria.md#chat-de-texto-decisión-12](mensajeria.md#chat-de-texto-decisión-12) | [x] |
| 13 | Cobro flexible, plataforma sin impago | [pagos_y_comisiones.md#cobro-flexible](pagos_y_comisiones.md#cobro-flexible) | [x] |
| 14 | Impuestos: calculadora + reporte | [pagos_y_comisiones.md#impuestos—calculadora-y-reporte](pagos_y_comisiones.md#impuestos—calculadora-y-reporte) | [x] |
| 15 | Agenda gratuita, adaptable a giro | [interfaces_proveedor.md#agenda-electrónica-gratuita-decisión-15--17](interfaces_proveedor.md#agenda-electrónica-gratuita-decisión-15--17) | [x] |
| 16 | Usuario: horarios rentables visibles | [interfaces_cliente.md#horarios-rentables-visibles-decisión-16](interfaces_cliente.md#horarios-rentables-visibles-decisión-16) | [x] |
| 17 | Agenda electrónica gratuita | [interfaces_proveedor.md#agenda-electrónica-gratuita-decisión-15--17](interfaces_proveedor.md#agenda-electrónica-gratuita-decisión-15--17) | [x] |
| 18 | Cancelaciones: 3 escenarios, por actor | [cancelaciones_y_reembolsos.md#cancelación-por-cliente](cancelaciones_y_reembolsos.md#cancelación-por-cliente) | [x] |
| 19 | Sin mediación de disputas | [cancelaciones_y_reembolsos.md#sin-mediación-de-disputas](cancelaciones_y_reembolsos.md#sin-mediación-de-disputas) | [x] |
| 20 | Filtros: 8+ dimensiones | [interfaces_cliente.md#búsqueda-con-filtros-decisión-20](interfaces_cliente.md#búsqueda-con-filtros-decisión-20) | [x] |
| 21 | Notificaciones: 14+ tipos | [notificaciones.md#catálogo-completo-de-notificaciones-decisión-21](notificaciones.md#catálogo-completo-de-notificaciones-decisión-21) | [x] |
| 22 | Verificación: INE + KYC APIs | [verificacion_de_identidad.md#método-2-verificación-kyc-remota-decisión-22](verificacion_de_identidad.md#método-2-verificación-kyc-remota-decisión-22) | [x] |
| 23 | Ranking: 3 métricas | [roles_y_permisos.md#sistema-de-ranking](roles_y_permisos.md#sistema-de-ranking) | [x] |
| 24 | Precios dinámicos: feature del MVP (temporada, demanda, día) | [taxonomia_de_servicios.md#precios-dinámicos—capacidad-del-proveedor-supuesto-3](taxonomia_de_servicios.md#precios-dinámicos—capacidad-del-proveedor-supuesto-3) | [x] |
| 25 | Permiso alcohol: opcional, notificación consecuencias, SLRC Sonora | [flujo_de_reserva.md#permiso-de-alcohol—opcional-con-notificación-de-consecuencias-supuesto-9](flujo_de_reserva.md#permiso-de-alcohol—opcional-con-notificación-de-consecuencias-supuesto-9) | [x] |
| 26 | Modo aprobación: editable post-setup | [interfaces_proveedor.md#paso-3-reglas-y-precios](interfaces_proveedor.md#paso-3-reglas-y-precios) | [x] |

**Cobertura actual**: 26/26 decisiones documentadas (100%). ✅

## Relaciones entre Documentos

| Documento | Relacionado con | Relación |
|-----------|-----------------|----------|
| `vision_y_alcance.md` | `pagos_y_comisiones.md` | Modelo ingresos → comisión |
| `roles_y_permisos.md` | `verificacion_de_identidad.md` | Verificación es requisito de rol proveedor |
| `taxonomia_de_servicios.md` | `pagos_y_comisiones.md` | Tipos de servicio → cálculo precio |
| `flujo_de_reserva.md` | `pagos_y_comisiones.md` | Reserva → pago anticipo/saldo |
| `flujo_de_reserva.md` | `cancelaciones_y_reembolsos.md` | Reserva → cancelación |
| `flujo_de_reserva.md` | `notificaciones.md` | Cada estado → notificación |
| `paquetes_colaborativos.md` | `flujo_de_reserva.md` | Paquete → reserva |
| `interfaces_cliente.md` | `flujo_de_reserva.md` | UI → flujo de reserva |
| `interfaces_proveedor.md` | `flujo_de_reserva.md` | UI → gestión de reservas |
| `interfaces_cliente.md` | `interfaces_proveedor.md` | Experiencias complementarias cliente ↔ proveedor |
| `taxonomia_de_servicios.md` | `interfaces_proveedor.md` | Tipos de servicio → configuración proveedor |
| `verificacion_de_identidad.md` | `verificamex_integracion.md` | Método → integración API |
| `normativa_mexicana_2026.md` | `verificamex_integracion.md` | LFPDPPP → seguridad datos |
| `eventos_legacy.md` | `interfaces_cliente.md` | Skeleton original → contenido migrado |

## Glosario

| Término | Definición |
|---------|------------|
| **Bloque de horas** | Unidad de reserva para salones: número de horas consecutivas incluidas en el precio base. El cliente reserva un bloque y puede extenderlo con horas extra. |
| **Paquete colaborativo** | Conjunto de servicios de múltiples proveedores (salón + sonido + servicios) agrupados bajo una reserva conjunta con precio cerrado. Liderado por el salón. |
| **Salón líder** | Proveedor de salón que crea y administra un paquete colaborativo. Responsable de invitar a otros proveedores y gestionar la disponibilidad cruzada. |
| **Anticipo** | Pago parcial al confirmar reserva. No reembolsable en caso de cancelación por cliente. Parcialmente transferido al proveedor al momento del pago. |
| **Depósito de garantía** | Monto retenido temporalmente como garantía contra daños. Configurable por salón. Reembolsable después del evento si no hay incidentes. |
| **Permiso de alcohol** | Autorización municipal para servir bebidas alcohólicas en un evento. **Opcional** en el MVP; la plataforma notifica SIEMPRE las consecuencias de no tramitarlo y el usuario decide — no es cancelación automática. Referencia del MVP: normativa municipal de San Luis Río Colorado, Sonora. H-5 = 5 horas antes del evento. |
| **Cobro flexible** | Opciones de cobro que evitan impago: (1) pago completo anticipado, (2) anticipo + saldo antes del evento, (3) anticipo + saldo después del evento. La plataforma no asume riesgo de impago. |
| **Tarifa de uso de app** | Sinónimo de comisión por transacción. Porcentaje que la plataforma cobra sobre cada reserva. Visible para el proveedor, oculta para el cliente. |
| **Capacidad concurrente** | Número máximo de eventos simultáneos que un proveedor puede atender en el mismo slot (fecha + horario), gestionado mediante calendario de inventario por slot. Forzada a 1 para salones; configurable para sonidos y servicios-persona. |
