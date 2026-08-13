# Roles y Permisos — Specification

## Purpose

Definir los roles del sistema, sus permisos, mecanismos de verificación, sistema de ranking y alcance del administrador.

## Requirements

### Requirement: Roles del Sistema

El sistema SHALL tener tres roles: Usuario (cliente), Prestador de servicio (proveedor), y Administrador. Cada rol SHALL tener permisos claramente definidos sin ambigüedad.

#### Scenario: Registro como usuario

- GIVEN que un usuario nuevo completa registro
- WHEN selecciona "Soy usuario"
- THEN SHALL tener permisos de: explorar, buscar, reservar, pagar, calificar, chatear

#### Scenario: Registro como prestador

- GIVEN que un prestador nuevo completa registro
- WHEN selecciona "Soy prestador de servicio"
- THEN SHALL tener permisos de: crear servicio, configurar precios, gestionar agenda, aceptar reservas, cobrar

#### Scenario: Registro como administrador

- GIVEN que un usuario tiene rol de administrador
- WHEN accede al panel admin
- THEN SHALL tener permisos de: moderar contenido, gestionar proveedores, ver estadísticas, gestionar disputas técnicas, configurar comisión global

### Requirement: Verificación de Identidad

El sistema SHALL ofrecer verificación de identidad obligatoria para prestadores. El método SHALL incluir: INE presencial (firma física), y opciones KYC via APIs (Truora, Veriff, Verificamex). Los clientes SHALL pueden verificar voluntariamente.

#### Scenario: Prestador completa verificación

- GIVEN que un prestador completa su alta
- WHEN solicita verificación de identidad
- THEN SHALL poder elegir entre INE presencial o verificación KYC remota

#### Scenario: Verificación voluntaria para clientes

- GIVEN que un cliente tiene cuenta verificada
- WHEN completa verificación de identidad
- THEN SHALL mostrar badge de verificación en su perfil

### Requirement: Sistema de Ranking

El sistema SHALL calcular ranking de proveedores con tres métricas: tasa de respuesta, tasa de aceptación de reservas, y calificación promedio. El ranking SHALL ser visible al cliente en resultados de búsqueda y perfil del proveedor.

#### Scenario: Ranking en resultados de búsqueda

- GIVEN que un cliente busca servicios
- WHEN se muestran resultados
- THEN cada proveedor SHALL mostrar su ranking con las 3 métricas

#### Scenario: Ranking actualizado automáticamente

- GIVEN que un proveedor completa una reserva exitosa
- WHEN se registra la calificación del cliente
- THEN el ranking del proveedor SHALL actualizarse automáticamente

### Requirement: Alcance del Administrador

El administrador SHALL tener exactamente 5 funciones: (1) moderación de contenido, (2) gestión de proveedores bloqueados, (3) estadísticas globales de la plataforma, (4) disputas técnicas (no comerciales), (5) configuración de comisión global. El administrador SHALL NO ofrecer soporte al cliente ni mediación de disputas comerciales.

#### Scenario: Moderación de contenido

- GIVEN que un usuario reporta contenido inapropiado
- WHEN el administrador revisa el reporte
- THEN SHALL poder aprobar, advertir o eliminar el contenido

#### Scenario: Administrador sin soporte al cliente

- GIVEN que un cliente tiene un problema con su reserva
- WHEN contacta soporte
- THEN el sistema SHALL redirigir al proveedor, no al administrador
