# Taxonomía de Servicios — Specification

## Purpose

Definir los tipos de servicio, sus modelos de precios, categorías y sistema de extras.

## Requirements

### Requirement: Tres Tipos de Servicio

El sistema SHALL soportar tres tipos: salón de eventos, sonido (equipos), y servicios-persona. Cada tipo SHALL tener modelo de precios, formulario de alta y lógica de concurrencia diferenciada.

#### Scenario: Salón — modelo de precios

- GIVEN que un prestador configura un salón
- WHEN define precios
- THEN SHALL establecer: bloque de horas base, precio hora extra, extras, impuestos, y tarifa de uso de app
- AND la concurrencia SHALL forzarse a 1 evento a la vez

#### Scenario: Sonido — modelo de precios

- GIVEN que un prestador configura sonido
- WHEN define precios
- THEN SHALL establecer: paquete de equipo + personal, horas base, hora extra, extras (nombre, descripción, precio, imagen obligatorios), impuestos, tarifa de uso de app

#### Scenario: Servicio-persona — modelo de precios

- GIVEN que un prestador configura un servicio-persona
- WHEN define precios
- THEN SHALL establecer: precio por persona por hora, impuestos, tarifa por persona

### Requirement: Concurrencia Configurable

La concurrencia de eventos simultáneos SHALL ser un campo numérico configurable por proveedor. Salones SHALL estar forzados a máximo 1 evento simultáneo. Sonidos y servicios-persona SHALL poder configurar su límite.

#### Scenario: Salón forzado a 1 evento

- GIVEN que un salón intenta reservar 2 eventos en la misma fecha/hora
- WHEN el sistema valida disponibilidad
- THEN SHALL rechazar la segunda reserva con mensaje de "salón ya reservado"

#### Scenario: Sonido con concurrencia configurable

- GIVEN que un proveedor de sonido configura concurrencia en 3
- WHEN tiene 3 reservas activas para la misma fecha
- THEN SHALL aceptar una cuarta reserva si no supera el límite configurado

### Requirement: Mínimo de Fotos

El sistema SHALL exigir mínimo 5 fotos en alta resolución para cada servicio. Las fotos SHALL ser revisadas por moderación antes de publicación.

#### Scenario: Alta con menos de 5 fotos

- GIVEN que un prestador intenta publicar un servicio
- WHEN tiene menos de 5 fotos cargadas
- THEN el sistema SHALL bloquear la publicación con mensaje de "mínimo 5 fotos requeridas"

#### Scenario: Fotos aprobadas por moderación

- GIVEN que un prestador carga 5 fotos nuevas
- WHEN las fotos pasan revisión de moderación
- THEN el servicio SHALL aparecer en búsqueda con las fotos aprobadas

### Requirement: Extras Configurables

Cada tipo de servicio SHALL permitir agregar extras. Los extras de sonido SHALL tener: nombre, descripción, precio e imagen (todos obligatorios). Los extras de salón y servicio-persona SHALL tener nombre, descripción y precio.

#### Scenario: Proveedor agrega extra a sonido

- GIVEN que un proveedor de sonido crea un extra
- WHEN completa nombre, descripción, precio e imagen
- THEN el extra SHALL estar disponible para selección en reservas
