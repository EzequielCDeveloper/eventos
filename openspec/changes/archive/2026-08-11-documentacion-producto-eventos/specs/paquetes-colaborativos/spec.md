# Paquetes Colaborativos — Specification

## Purpose

Definir el flujo de paquetes multi-proveedor, roles de líder e invitado, disponibilidad cruzada y reparto de precios.

## Requirements

### Requirement: Creación de Paquete por Líder

Solo los salones SHALL poder crear paquetes colaborativos. El salón SHALL invitar a otros proveedores (sonido, servicios-persona). Cada invitado SHALL aceptar y rellenar su información antes de confirmar el paquete.

#### Scenario: Salón crea paquete e invita proveedor

- GIVEN que un salón quiere crear un paquete con sonido
- WHEN selecciona "Crear paquete" e invita a un proveedor de sonido
- THEN el proveedor SHALL recibir notificación de invitación
- AND el paquete SHALL estar en estado "Invitaciones pendientes"

#### Scenario: Proveedor acepta invitación

- GIVEN que un proveedor de sonido recibe invitación de paquete
- WHEN acepta la invitación
- THEN SHALL rellenar su información de servicio para el paquete
- AND el paquete SHALL mostrar "Proveedor aceptado"

#### Scenario: Proveedor rechaza invitación

- GIVEN que un proveedor recibe invitación de paquete
- WHEN rechaza la invitación
- THEN el salón SHALL recibir notificación de rechazo
- AND podrá invitar a otro proveedor del mismo tipo

### Requirement: Disponibilidad Cruzada

El sistema SHALL verificar disponibilidad de todos los miembros del paquete para la fecha y horario solicitados. Si un miembro no está disponible, el paquete SHALL permanecer en estado "Pendiente de disponibilidad".

#### Scenario: Todos los miembros disponibles

- GIVEN que un paquete tiene salón + sonido confirmados
- WHEN se verifica disponibilidad para el 15 de marzo de 14:00 a 22:00
- THEN el paquete SHALL estar disponible para reserva

#### Scenario: Un miembro no disponible

- GIVEN que un paquete tiene salón disponible pero sonido no
- WHEN se verifica disponibilidad
- THEN el paquete SHALL mostrar "No disponible — sonido no disponible en fecha solicitada"

### Requirement: Precio del Paquete

El sistema SHALL sumar automáticamente los precios de todos los miembros del paquete. El precio final SHALL ser la suma de: precio base de cada miembro + extras seleccionados + impuestos + tarifa de app. El precio SHALL ser cerrado y visible al cliente.

#### Scenario: Precio calculado automáticamente

- GIVEN que un paquete tiene salón ($8,000) + sonido ($3,500)
- WHEN el cliente visualiza el paquete
- THEN SHALL ver precio total de $11,500 + impuestos + tarifa de app
- AND cada componente SHALL ser visible por separado

### Requirement: Estados del Paquete

El paquete SHALL tener estados: Creado → Invitaciones pendientes → Invitaciones aceptadas → Disponibilidad verificada → Disponible para reserva → Reservado → Completado. Cada transición SHALL generar notificación al salón líder.

#### Scenario: Transición de estado

- GIVEN que un paquete está en "Invitaciones pendientes"
- WHEN todos los invitados aceptan
- THEN el estado SHALL cambiar a "Invitaciones aceptadas"
- AND el salón líder SHALL recibir notificación
