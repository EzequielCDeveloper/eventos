# Delta for Pagos y Comisiones

## ADDED Requirements

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
