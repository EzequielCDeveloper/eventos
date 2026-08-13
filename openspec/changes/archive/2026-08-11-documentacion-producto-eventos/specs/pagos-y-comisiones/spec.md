# Pagos y Comisiones — Specification

## Purpose

Definir el procesamiento de pagos vía Conekta, modelo de comisiones, tarifa de app, impuestos, depósito de garantía y cobro flexible.

## Requirements

### Requirement: Procesamiento vía Conekta en MXN

El sistema SHALL procesar todos los pagos vía Conekta en pesos mexicanos (MXN). No SHALL aceptar otras monedas en MVP.

#### Scenario: Pago exitoso en MXN

- GIVEN que un cliente procede a pagar
- WHEN ingresa datos de tarjeta en Conekta
- THEN el pago SHALL procesarse en MXN
- AND el comprobante SHALL mostrar monto en pesos

### Requirement: Comisión por Transacción

La comisión de plataforma SHALL sumarse al precio del cliente. El cliente SHALL ver "precio de renta + impuestos" sin desglose de comisión. El proveedor SHALL ver el precio final completo incluyendo comisión y SHALL ajustar su定价 en consecuencia.

#### Scenario: Cliente ve precio sin desglose de comisión

- GIVEN que un servicio cuesta $5,000 + comisión del 10%
- WHEN el cliente visualiza el resumen
- SHALL ver "Renta: $5,000 + Impuestos: $XXX" sin mención de comisión
- AND el total pagado incluye la comisión oculta

#### Scenario: Proveedor ve precio con comisión

- GIVEN que el proveedor configura servicio en $5,000
- WHEN visualiza su panel de precios
- SHALL ver "Precio cliente: $5,500 (incluye comisión 10%)"
- AND podrá ajustar su precio base

### Requirement: Cobro Flexible

El proveedor SHALL definir su política de cobro: (1) anticipo obligatorio de monto configurable, (2) pago completo antes del evento, o (3) cobro posterior al servicio. La plataforma NO SHALL hacerse responsable de impago si el proveedor elige cobro posterior.

#### Scenario: Anticipo obligatorio

- GIVEN que un proveedor configura anticipo del 50%
- WHEN un cliente reserva
- THEN SHALL pagar 50% al momento de reserva
- AND el saldo restante SHALL vencer antes del evento

#### Scenario: Pago completo pre-evento

- GIVEN que un proveedor requiere pago completo
- WHEN un cliente reserva
- THEN SHALL pagar el 100% al momento de reserva

#### Scenario: Cobro post-servicio

- GIVEN que un proveedor elige cobro posterior
- WHEN el cliente completa la reserva
- THEN la plataforma NO SHALL retener pagos
- AND el proveedor es responsable de cobrar directamente

### Requirement: Depósito de Garantía

El depósito de garantía SHALL ser configurable por salón. El depósito SHALL ser separable del anticipo. En caso de cancelación, el orden de aplicación SHALL ser: anticipo (no reembolsable) → depósito (reembolsable según política).

#### Scenario: Depósito configurado por salón

- GIVEN que un salón configura depósito de $2,000
- WHEN un cliente reserva
- THEN SHALL pagar anticipo + depósito por separado

#### Scenario: Cancelación — aplicación de depósito

- GIVEN que un cliente cancela con anticipo de $3,000 y depósito de $2,000
- WHEN se procesa la cancelación
- THEN el anticipo ($3,000) SHALL ser no reembolsable
- AND el depósito ($2,000) SHALL reembolsarse según política del proveedor

### Requirement: Impuestos — Calculadora y Reporte

El sistema SHALL calcular impuestos automáticamente y sumarlos al precio. El sistema SHALL generar reporte mensual de impuestos para cada proveedor.

#### Scenario: Cálculo automático de impuestos

- GIVEN que un servicio tiene precio de $5,000
- WHEN se calcula el total
- THEN el sistema SHALL sumar IVA u otros impuestos aplicables
- AND el total SHALL incluir impuestos desglosados

#### Scenario: Reporte mensual de impuestos

- GIVEN que un proveedor tiene ventas en el mes
- WHEN accede a su reporte mensual
- THEN SHALL ver desglose de impuestos cobrados por transacción
