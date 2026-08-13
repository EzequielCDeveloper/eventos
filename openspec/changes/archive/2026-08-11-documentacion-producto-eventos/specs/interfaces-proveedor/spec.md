# Interfaces Proveedor — Specification

## Purpose

Definir las pantallas del proveedor: onboarding, dashboard 5 tabs, agenda gratuita, configuración y calendario.

## Requirements

### Requirement: Onboarding Wizard

El proveedor SHALL completar un wizard de alta de 3 pasos: (1) datos personales/empresa, (2) tipo de servicio y configuración, (3) fotos y publicación. El wizard SHALL guardar progreso y permitir continuar después.

#### Scenario: Proveedor completa onboarding

- GIVEN que un proveedor nuevo inicia el wizard
- WHEN completa los 3 pasos
- THEN su servicio SHALL estar pendiente de verificación/publicación

#### Scenario: Proveedor abandona wizard

- GIVEN que un proveedor completa paso 1 y 2
- WHEN cierra la aplicación
- THEN SHALL poder continuar desde el paso 3 al reingresar

### Requirement: Dashboard 5 Tabs

El dashboard del proveedor SHALL tener 5 tabs: (1) Reservas, (2) Servicios, (3) Calendario, (4) Chat, (5) Configuración. Cada tab SHALL mostrar información relevante y acciones rápidas.

#### Scenario: Tab de reservas

- GIVEN que un proveedor accede al dashboard
- WHEN selecciona tab "Reservas"
- THEN SHALL ver: reservas activas, pendientes, completadas, y canceladas

#### Scenario: Tab de servicios

- GIVEN que un proveedor accede al dashboard
- WHEN selecciona tab "Servicios"
- THEN SHALL ver lista de servicios publicados con opción de editar/ pausar

### Requirement: Agenda Gratuita

La agenda electrónica SHALL ser gratuita para todos los proveedores. La agenda SHALL ser adaptable a cualquier giro. El proveedor SHALL poder registrar eventos de mantenimiento e inoperación. Los horarios rentables SHALL ser visibles al cliente.

#### Scenario: Proveedor agenda evento

- GIVEN que un proveedor quiere bloquear fechas
- WHEN crea evento de mantenimiento en su agenda
- THEN las fechas SHALL aparecer como "No disponible" para clientes

#### Scenario: Horarios rentables visibles

- GIVEN que un proveedor tiene horarios configurados
- WHEN un cliente busca servicios
- THEN SHALL ver los horarios disponibles del proveedor
- AND SHALL poder filtrar por horario

### Requirement: Configuración de Concurrencia

El proveedor SHALL poder configurar su concurrencia máxima de eventos simultáneos (excepto salones, forzados a 1).

#### Scenario: Sonido configura concurrencia

- GIVEN que un proveedor de sonido accede a configuración
- WHEN establece concurrencia máxima en 4
- THEN SHALL poder aceptar hasta 4 reservas simultáneas para la misma fecha
