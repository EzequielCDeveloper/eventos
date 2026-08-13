---
title: "Visión y Alcance"
estado: completo
version: "1.1"
fecha: "2026-08-11"
fuentes:
  - openspec/changes/documentacion-producto-eventos/specs/vision-y-alcance/spec.md
  - openspec/changes/documentacion-producto-eventos/proposal.md
---

# Visión y Alcance

Plataforma marketplace que conecta clientes (particulares y empresas) con proveedores de servicios para eventos en México: salones de eventos, equipos de sonido/iluminación, y servicios-persona (meseros, bartenders, etc.).

## MVP

El MVP opera como marketplace de servicios para eventos en México con dos segmentos simultáneos:

| Segmento | Ejemplos | Estado MVP |
|----------|----------|------------|
| Particulares | Fiestas de cumpleaños, XV años, bodas, bautizos | Activo |
| Empresas | Posadas corporativas, eventos empresariales, lanzamientos | Activo |

Si la complejidad operativa de empresas supera la capacidad del equipo, el alcance **SHALL** caer a particulares únicamente con migración de cuentas existentes y aviso previo.

→ Ver [→ roles_y_permisos.md#roles](roles_y_permisos.md#roles) para permisos por segmento.

## Modelo de Ingresos

El sistema genera ingresos mediante **comisión por transacción** sumada al precio visible del cliente.

| Concepto | Descripción |
|----------|-------------|
| Tarifa de uso de app | Sinónimo de comisión por transacción. El cliente **NO** ve desglose de comisión. |
| Comisión | Porcentaje sobre monto total de la reserva. Configurable por administrador (→ ver [roles_y_permisos.md#administrador](roles_y_permisos.md#administrador)). |
| Cálculo | Comisión **SHALL** sumarse al precio del proveedor. El cliente ve "renta + impuestos". |

> Ejemplo: Proveedor configura servicio en $5,000 MXN. Comisión 10%. Cliente ve $5,500 MXN + impuestos.

El proveedor es responsable de incluir la comisión en su定价 al configurar servicios.

→ Ver [→ taxonomia_de_servicios.md#modelos-de-precio](taxonomia_de_servicios.md#modelos-de-precio) para detalle por tipo de servicio.

## Alcance del Marketplace

El marketplace cubre **tres tipos de servicio**:

| Tipo | Descripción | Modelo de precio |
|------|-------------|------------------|
| Salón de eventos | Espacios físicos para celebraciones | Bloque de horas + extras |
| Sonido | Equipos de audio, iluminación, pantallas | Paquete de equipo + horas |
| Servicio-persona | Meseros, bartenders, cocineros, etc. | Precio por persona por hora |

Cada tipo tiene modelo de precios, formulario de alta y lógica de concurrencia diferenciada. El sistema **SHALL** soportar paquetes colaborativos multi-proveedor (→ ver [→ taxonomia_de_servicios.md#tipos-de-servicio](taxonomia_de_servicios.md#tipos-de-servicio)).

## Alcance del Marketplace — Boundary

El marketplace **SHALL** operar únicamente en territorio mexicano. Los pagos **SHALL** procesarse en MXN a través de Conekta API (→ ver [→ pagos_y_comisiones.md](pagos_y_comisiones.md) para detalle de integración).

### In Scope (MVP)

- Registro y verificación de proveedores y clientes
- Publicación y búsqueda de servicios (3 tipos)
- Reserva por bloques de horas
- **Precios dinámicos configurados por el proveedor** (temporada, demanda, día de la semana — → ver [→ taxonomia_de_servicios.md#precios-dinámicos—capacidad-del-proveedor-supuesto-3](taxonomia_de_servicios.md#precios-dinámicos—capacidad-del-proveedor-supuesto-3))
- **Calendario de inventario por slot** (cantidad máxima de eventos por fecha + horario — → ver [→ taxonomia_de_servicios.md#concurrencia](taxonomia_de_servicios.md#concurrencia))
- Pagos vía Conekta (anticipo + saldo + depósito)
- Paquetes colaborativos multi-proveedor
- Chat texto entre cliente y proveedor
- Notificaciones push y email
- Calificación post-pago
- Panel administrativo básico

### Out of Scope (MVP)

- Pagos internacionales
- Mediación de disputas comerciales por parte del administrador
- Transcripción automática de notas de voz
- Cálculo automático de viáticos por kilómetro

→ Ver [→ areas_de_simplificacion.md](areas_de_simplificacion.md) para trade-offs detallados del MVP.

## Stack de Implementación Futura

Cuando se pase a la fase de implementación, la aplicación **SHALL** desarrollarse con **Next.js** (frontend/backend) y **Firebase** (backend-as-a-service: autenticación, base de datos, almacenamiento, notificaciones), conforme a la decisión humana de revisión de simplificaciones (→ ver [→ areas_de_simplificacion.md#checklist-de-validación-general](areas_de_simplificacion.md#checklist-de-validación-general)).

> **Nota**: Esta sección documenta la dirección tecnológica indicada en la revisión humana. El detalle técnico de la implementación queda fuera del alcance de esta documentación de producto.

## Criterios de Éxito

| Criterio | Métrica |
|----------|---------|
| Cobertura de marketplace | ≥3 proveedores por tipo de servicio en zona piloto |
| Tasa de conversión | ≥15% de búsquedas a reservas completadas |
| Tiempo de orientación | <30 segundos para entender la documentación desde README |
| Resolución de verificación | <5 minutos para verificación KYC remota |

## Documentos Relacionados

| Documento | Relación |
|-----------|----------|
| `roles_y_permisos.md` | Permisos por rol y verificación |
| `taxonomia_de_servicios.md` | Tipos de servicio y modelos de precio |
| `pagos_y_comisiones.md` | Modelo de ingresos → comisión |
| `flujo_de_reserva.md` | Reserva → pago anticipo/saldo |
