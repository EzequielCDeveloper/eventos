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

La comisión de plataforma SHALL sumarse al precio del cliente. El cliente SHALL ver "precio de renta + impuestos" sin desglose de comisión. El proveedor SHALL ver el precio final completo incluyendo comisión y SHALL ajustar su precio en consecuencia.

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

### Requirement: Comisión sobre Precio Vigente con Ajuste Dinámico

La comisión de plataforma SHALL calcularse sobre el precio vigente de la reserva, incluyendo los ajustes dinámicos del proveedor (temporada, demanda, día de la semana). El desglose para el cliente SHALL mostrar el precio vigente (base + ajuste dinámico) + impuestos, sin desglosar la comisión.

#### Scenario: Comisión calculada sobre precio con ajuste dinámico

- GIVEN que un servicio tiene precio base de $5,000 MXN con ajuste dinámico de temporada +20% ($6,000)
- WHEN se calcula la comisión del 10%
- THEN la comisión SHALL calcularse sobre $6,000 (precio vigente), no sobre $5,000 (precio base)
- AND el cliente SHALL ver $6,600 + impuestos
- AND el proveedor SHALL ver precio cliente $6,600 (incluye comisión 10%)

#### Scenario: Comisión sobre precio de paquete con variación

- GIVEN que un paquete de sonido tiene precio base de $5,000 MXN con ajuste de +15% para sábados ($5,750)
- WHEN se reserva el paquete un sábado
- THEN la comisión SHALL calcularse sobre $5,750 (precio vigente del paquete)
- AND el desglose SHALL mostrar precio vigente del paquete + impuestos

### Requirement: Desglose con Precio Vigente

El desglose para el cliente SHALL mostrar el precio vigente (base + ajuste dinámico) + impuestos, sin desglosar la comisión. El proveedor SHALL ver el precio final completo incluyendo comisión y SHALL ajustar su precio en consecuencia.

#### Scenario: Cliente ve desglose con precio vigente

- GIVEN que un servicio tiene precio base de $5,000 MXN con ajuste dinámico de temporada +10% ($5,500)
- WHEN el cliente visualiza el resumen de reserva
- THEN SHALL ver "Renta: $5,500 + Impuestos: $XXX" sin mención de comisión
- AND el total pagado incluye la comisión oculta

#### Scenario: Proveedor ve precio con comisión

- GIVEN que el proveedor configura servicio en $5,000 MXN con ajuste dinámico
- WHEN visualiza su panel de precios para la fecha con ajuste
- THEN SHALL ver el precio vigente completo incluyendo comisión
- AND podrá ajustar su precio base y dinámico

### Requirement: Comisión sobre Precio de Paquete con Variación

La comisión de plataforma SHALL aplicarse al precio vigente de cada paquete de sonido de forma independiente. Cada paquete SHALL tener su propio cálculo de comisión basado en su precio vigente (base + ajuste dinámico del paquete específico).

#### Scenario: Dos paquetes con comisiones independientes

- GIVEN que un proveedor tiene "Paquete Básico" ($5,000 base, +10% en diciembre = $5,500) y "Paquete Premium" ($8,000 base, +20% en diciembre = $9,600)
- WHEN un cliente reserva el "Paquete Básico" en diciembre
- THEN la comisión SHALL calcularse sobre $5,500 (precio vigente del Básico)
- AND la comisión del "Premium" SHALL ser independiente, calculada sobre $9,600 cuando se reserve

#### Scenario: Paquete sin ajuste dinámico

- GIVEN que un paquete no tiene ajuste dinámico configurado
- WHEN se reserva
- THEN la comisión SHALL calcularse sobre el precio base del paquete
- AND el comportamiento SHALL ser equivalente al escenario sin precios dinámicos

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
