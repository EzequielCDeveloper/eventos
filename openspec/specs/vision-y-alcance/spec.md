# Visión y Alcance — Specification

## Purpose

Definir el alcance del MVP, segmentos objetivo, modelo de ingresos y boundaries del marketplace de servicios para eventos.

## Requirements

### Requirement: Stack de Implementación

Cuando se pase a la fase de implementación, la aplicación SHALL desarrollarse con Next.js (frontend/backend) y Firebase (backend-as-a-service: autenticación, base de datos, almacenamiento, notificaciones), conforme a la decisión humana de revisión de simplificaciones.

#### Scenario: Stack Next.js + Firebase en implementación

- GIVEN que el producto pasa a fase de implementación
- WHEN se selecciona el stack tecnológico
- THEN la aplicación SHALL desarrollarse con Next.js y Firebase
- AND el stack SHALL documentarse como decisión técnica del MVP

### Requirement: MVP — Segmentos Objetivo

El producto SHALL operar como marketplace de servicios para eventos (salones, sonidos, servicios-persona) en México. El MVP SHALL incluir particulares Y empresas (posadas, eventos corporativos). Si la complejidad lo exige, el alcance SHALL caer a particulares únicamente. El MVP SHALL incluir precios dinámicos configurados por el proveedor y calendario de inventario por slot.

#### Scenario: Precios dinámicos dentro del alcance

- GIVEN que el MVP está en fase de diseño
- WHEN se define el alcance
- THEN precios dinámicos (temporada, demanda, día de la semana) SHALL estar dentro del alcance MVP
- AND calendario de inventario por slot SHALL estar dentro del alcance MVP

#### Scenario: Particulares y empresas en MVP

- GIVEN que el producto está en fase MVP
- WHEN un usuario empresa (posadas, corporativos) crea una cuenta
- THEN el sistema SHALL permitir registro y uso completo sin restricción de segmento

#### Scenario: Caída a particulares si la complejidad lo exige

- GIVEN que la complejidad operativa de empresas supera la capacidad del equipo
- WHEN se toma la decisión de reducir alcance
- THEN el sistema SHALL restringir registros nuevos de empresas y migrar existentes con aviso

### Requirement: Modelo de Ingresos

El sistema SHALL generar ingresos mediante comisión por transacción sumada al precio visible del cliente. La tarifa de uso de app ES la comisión. El cliente SHALL ver "renta + impuestos" sin desglose de comisión. El proveedor SHALL ver el precio final completo y SHALL ajustar su precio considerando la comisión.

#### Scenario: Comisión sumada al precio del cliente

- GIVEN que un servicio tiene precio base de $5,000 MXN
- WHEN el cliente visualiza el resumen de reserva
- THEN SHALL ver precio de renta + impuestos, sin desglose de comisión
- AND el total incluye la comisión de la plataforma oculta

#### Scenario: Proveedor ajusta precio con comisión visible

- GIVEN que la comisión es del 10%
- WHEN el proveedor configura su servicio en $5,000 MXN
- THEN SHALL ver el precio final que paga el cliente como $5,500 MXN (o ajustado)
- AND el proveedor es responsable de incluir la comisión en su precio

### Requirement: Alcance del Marketplace

El marketplace SHALL cubrir tres tipos de servicio: salones de eventos, sonidos (equipos de audio/iluminación), y servicios-persona (meseros, bartenders, etc.). Cada tipo tiene modelo de precios distinto. El sistema SHALL soportar paquetes colaborativos multi-proveedor. El sistema SHALL soportar precios dinámicos configurados por el proveedor y calendario de inventario por slot.

#### Scenario: Tres tipos de servicio disponibles

- GIVEN que un proveedor completa su alta
- WHEN selecciona tipo de servicio
- THEN SHALL elegir entre salón, sonido o servicio-persona
- AND cada tipo SHALL tener formulario de alta diferenciado

#### Scenario: Paquete colaborativo multi-proveedor

- GIVEN que un salón crea un paquete e invita a un proveedor de sonido
- WHEN el proveedor de sonido acepta y completa su información
- THEN el sistema SHALL sumar los precios de todos los miembros del paquete
- AND el paquete SHALL tener precio cerrado visible al cliente
