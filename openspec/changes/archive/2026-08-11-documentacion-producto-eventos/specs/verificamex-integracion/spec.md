# Verificamex Integración — Specification

## Purpose

Definir el detalle técnico de la integración con Verificamex: API, Lista Nominal, flujo de verificación y manejo de errores.

## Requirements

### Requirement: API de Verificamex

El sistema SHALL integrar con la API de Verificamex para verificar INE contra Lista Nominal. La integración SHALL validar: vigencia del INE, nombre completo, CURP, y estatus en Lista Nominal.

#### Scenario: Consulta exitosa a API

- GIVEN que el sistema envía datos de INE a Verificamex
- WHEN la API responde con éxito
- THEN SHALL recibir: vigencia (true/false), coincidencia de nombre, estatus en Lista Nominal

#### Scenario: API no disponible

- GIVEN que el sistema intenta consultar Verificamex
- WHEN la API no responde (timeout o error)
- THEN el sistema SHALL permitir verificación alternativa (INE presencial)
- AND SHALL registrar el error para monitoreo

### Requirement: Lista Nominal — Validación

El sistema SHALL consultar la Lista Nominal a través de Verificamex para confirmar que el INE está vigente y no ha sido reportado como perdido o robado.

#### Scenario: INE vigente en Lista Nominal

- GIVEN que un proveedor ingresa datos de INE
- WHEN se consulta Lista Nominal
- THEN la respuesta SHALL confirmar "Vigente" y coincidencia de datos

#### Scenario: INE no encontrado en Lista Nominal

- GIVEN que un proveedor ingresa datos de INE
- WHEN Lista Nominal no encuentra el registro
- THEN el sistema SHALL mostrar "INE no registrado en Lista Nominal"
- AND SHALL sugerir verificación presencial

### Requirement: Flujo de Verificación

El flujo SHALL ser: ingreso de datos INE → consulta API Verificamex → validación Lista Nominal → resultado (aprobado/rechazado/pendiente). Cada paso SHALL registrar logs para auditoría.

#### Scenario: Flujo completo exitoso

- GIVEN que un proveedor ingresa datos de INE completos
- WHEN el sistema processa la verificación
- THEN SHALL consultar API → validar Lista Nominal → aprobar verificación
- AND SHALL registrar cada paso en logs de auditoría

#### Scenario: Verificación rechazada

- GIVEN que un proveedor ingresa datos de INE
- WHEN la verificación falla (INE vencido o no encontrado)
- THEN el sistema SHALL mostrar motivo del rechazo
- AND SHALL permitir reintentar con otros datos o método alternativo

### Requirement: Manejo de Errores

El sistema SHALL manejar errores de la API de Verificamex: timeout, error de servicio, datos inválidos, rate limiting. Cada error SHALL tener mensaje claro para el usuario y fallback apropiado.

#### Scenario: Timeout de API

- GIVEN que la API de Verificamex tarda más de 10 segundos
- WHEN se alcanza el timeout
- THEN el sistema SHALL mostrar "Servicio temporalmente no disponible"
- AND SHALL ofrecer verificación alternativa

#### Scenario: Rate limiting

- GIVEN que se alcanza el límite de consultas a la API
- WHEN se intenta una nueva consulta
- THEN el sistema SHALL mostrar "Máximo de intentos alcanzado"
- AND SHALL sugerir esperar o usar método alternativo

### Requirement: Seguridad de Datos

Los datos de INE procesados por Verificamex SHALL tratarse según LFPDPPP. El sistema NO SHALL almacenar datos biométricos innecesarios. Los logs de verificación SHALL contener solo metadatos (éxito/fallo, timestamp), no datos personales.

#### Scenario: Almacenamiento seguro

- GIVEN que se completa una verificación
- WHEN se guardan logs
- THEN los logs SHALL contener solo: ID proveedor, resultado, timestamp
- AND NO SHALL contener datos de INE, nombre, o CURP
