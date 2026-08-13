# Cancelaciones y Reembolsos — Specification

## Purpose

Definir políticas de cancelación por actor, tiempos, retención, devolución y manejo de depósitos.

## Requirements

### Requirement: Cancelación por Cliente — Anticipo No Reembolsable

Cuando un cliente cancela en cualquier momento, el anticipo SHALL ser no reembolsable. Cerca del evento, la política configurada por el salón SHALL aplicar con aviso al usuario ANTES del pago completo.

#### Scenario: Cancelación lejana al evento

- GIVEN que un cliente reserva con anticipo de $3,000
- WHEN cancela 30 días antes del evento
- THEN el anticipo ($3,000) SHALL ser retenido por el proveedor
- AND el depósito (si existe) SHALL reembolsarse

#### Scenario: Cancelación cercana al evento

- GIVEN que un cliente tiene reserva confirmada
- WHEN cancela 5 días antes del evento
- THEN SHALL aplicar la política de cancelación del salón
- AND el usuario SHALL recibir aviso ANTES del pago completo

#### Scenario: Cancelación con aviso previo

- GIVEN que la política del salón establece retención del 50% por cancelación cercana
- WHEN el cliente intenta cancelar
- THEN el sistema SHALL mostrar la política antes de confirmar
- AND el cliente SHALL aceptar explícitamente la retención

### Requirement: Cancelación por Proveedor — Devolución Total

Cuando un proveedor cancela una reserva, SHALL devolver TODO el monto pagado por el cliente. Esto incluye anticipo, depósito y cualquier pago adicional.

#### Scenario: Proveedor cancela reserva

- GIVEN que un proveedor cancela una reserva confirmada
- WHEN el cliente pagó anticipo ($3,000) + depósito ($2,000)
- THEN el sistema SHALL devolver $5,000 completos al cliente
- AND el cliente SHALL recibir notificación de reembolso total

### Requirement: Política de Cancelación Configurable por Proveedor

Cada proveedor SHALL configurar su propia política de cancelación. La política SHALL definir: porcentaje de retención por cancelación cercana, ventana de tiempo para cancelación sin penalización, y si aplica o no depósito reembolsable.

#### Scenario: Proveedor configura política

- GIVEN que un proveedor quiere definir su política
- WHEN accede a configuración de cancelación
- THEN SHALL poder establecer: % retención, ventana sin penalización, y si el depósito es reembolsable

### Requirement: Sin Mediación de Disputas

La plataforma NO SHALL mediar disputas comerciales entre clientes y proveedores. Las disputas SHALL quedarse fuera de la app. La interfaz SHALL mostrar claramente esta limitación.

#### Scenario: Cliente reporta disputa comercial

- GIVEN que un cliente tiene un problema con el servicio prestado
- WHEN intenta abrir disputa en la app
- THEN el sistema SHALL mostrar "Las disputas comerciales se resuelven entre las partes"
- AND SHALL proporcionar información de contacto del proveedor

#### Scenario: Footer muestra limitación

- GIVEN que un usuario navega la aplicación
- WHEN visualiza el footer
- THEN SHALL ver aviso claro de que la plataforma no media disputas
