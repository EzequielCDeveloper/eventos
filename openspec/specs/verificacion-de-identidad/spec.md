# Verificación de Identidad — Specification

## Purpose

Definir los métodos de verificación: INE presencial, opciones KYC (Truora, Veriff, Verificamex) y Lista Nominal.

## Requirements

### Requirement: Verificación Obligatoria para Proveedores

Todos los proveedores SHALL completar verificación de identidad antes de publicar servicios. El sistema SHALL ofrecer dos vías: INE presencial (firma física) o verificación KYC remota.

#### Scenario: Proveedor elige verificación INE presencial

- GIVEN que un proveedor completa su registro
- WHEN selecciona "Verificar con INE presencial"
- THEN SHALL agendar cita para entrega de INE
- AND la verificación SHALL completarse con firma física

#### Scenario: Proveedor elige verificación KYC remota

- GIVEN que un proveedor completa su registro
- WHEN selecciona "Verificar en línea"
- THEN SHALL elegir entre Truora, Veriff o Verificamex
- AND el proceso SHALL completarse de forma remota

### Requirement: Verificación con Verificamex

El sistema SHALL integrar con la API de Verificamex para verificar INE contra Lista Nominal. La verificación SHALL validar: vigencia del INE, nombre completo, y estatus en Lista Nominal.

#### Scenario: Verificación exitosa con Verificamex

- GIVEN que un proveedor ingresa sus datos de INE
- WHEN se consulta la API de Verificamex
- THEN la respuesta SHALL confirmar vigencia y coincidencia de nombre
- AND el proveedor SHALL quedar verificado

#### Scenario: Verificación fallida — INE no encontrado

- GIVEN que un proveedor ingresa datos de INE
- WHEN la API de Verificamex no encuentra el INE
- THEN el sistema SHALL mostrar "INE no encontrado en Lista Nominal"
- AND el proveedor SHALL poder reintentar o elegir otro método

#### Scenario: Verificación fallida — INE vencido

- GIVEN que un proveedor ingresa datos de INE vencido
- WHEN se consulta la API de Verificamex
- THEN el sistema SHALL mostrar "INE vencido — favor de actualizar"
- AND la verificación SHALL quedar pendiente

### Requirement: Verificación Voluntaria para Clientes

Los clientes MAY verificar su identidad voluntariamente. La verificación completada SHALL mostrar badge en el perfil.

#### Scenario: Cliente verifica identidad

- GIVEN que un cliente quiere verificar su identidad
- WHEN completa el proceso de verificación
- THEN su perfil SHALL mostrar badge de "Identidad verificada"
