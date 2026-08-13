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

### Requirement: Precios Dinámicos — Feature MVP

Los precios dinámicos son una feature del MVP. El proveedor SHALL poder ajustar sus precios dinámicamente por temporada, demanda o día de la semana. El proveedor DECIDE los precios — no es una tasa fija universal para todos los eventos. El proveedor MAY optar por mantener tasa fija si lo desea. El ajuste se configura sobre el precio base del modelo correspondiente (bloque, paquete o por persona).

#### Scenario: Proveedor configura ajuste por temporada

- GIVEN que un proveedor de salón tiene precio base de $8,000 MXN por bloque de 4 horas
- WHEN configura ajuste dinámico de +20% para sábados en temporada alta
- THEN el precio vigente para sábados en temporada alta SHALL ser $9,600 MXN
- AND el precio base de lunes a viernes SHALL permanecer en $8,000 MXN

#### Scenario: Proveedor opta por tasa fija

- GIVEN que un proveedor no desea configurar precios dinámicos
- WHEN mantiene la configuración por defecto
- THEN el precio SHALL ser el mismo todos los días y temporadas
- AND el sistema NO SHALL forzar ajuste dinámico

#### Scenario: Proveedor carga precios por paquete de sonido

- GIVEN que un proveedor de sonido publica 2 paquetes: "Básico" ($5,000) y "Premium" ($8,000)
- WHEN configura precios dinámicos por paquete
- THEN SHALL poder asignar precio diferenciado por día/temporada a CADA paquete independientemente
- AND el paquete "Básico" MAY tener +10% en diciembre mientras "Premium" tiene +20%
- AND el precio de cada paquete SHALL mostrarse por separado al cliente

#### Scenario: Precio vigente visible al cliente

- GIVEN que un paquete tiene precio base de $5,000 MXN con ajuste dinámico de temporada
- WHEN un cliente consulta el paquete para una fecha con ajuste
- THEN SHALL ver el precio vigente del paquete (base + ajuste) antes de confirmar
- AND NO SHALL haber recargos ocultos

#### Scenario: Desglose transparente

- GIVEN que un cliente reserva un servicio con ajuste dinámico
- WHEN visualiza el resumen
- THEN el desglose (base + extras + impuestos + tarifa) SHALL calcularse sobre el precio vigente
- AND SHALL ver el precio vigente como base del cálculo

### Requirement: Concurrencia Configurable

La concurrencia de eventos simultáneos SHALL gestionarse mediante calendario de inventario por slot (fecha + horario). Salones SHALL estar forzados a máximo 1 evento simultáneo por slot. Sonidos y servicios-persona SHALL poder configurar su límite por slot. El sistema SHALL mostrar indicadores de cupo por slot: disponible / parcial / lleno.

#### Scenario: Salón forzado a 1 evento por slot

- GIVEN que un salón intenta reservar 2 eventos en la misma fecha y horario
- WHEN el sistema valida disponibilidad
- THEN SHALL rechazar la segunda reserva con mensaje de "salón ya reservado en esa fecha y horario"

#### Scenario: Sonido con inventario por slot

- GIVEN que un proveedor de sonido configura inventario de 3 eventos por slot
- WHEN tiene 2 reservas activas en el slot de 10:00–14:00
- THEN SHALL aceptar una nueva reserva en ese slot
- AND SHALL rechazar si el slot alcanza el límite de 3

#### Scenario: Indicadores de cupo

- GIVEN que un proveedor tiene inventario por slot configurado
- WHEN visualiza su calendario
- THEN SHALL ver indicadores de cupo por slot: disponible (cupo libre), parcial (casi lleno), lleno (sin cupo)

### Requirement: Sonido — Modelo de Precios con Paquetes

El modelo de sonido combina un paquete de equipo con horas de servicio. Cada paquete SHALL tener precio independiente que el proveedor puede ajustar dinámicamente por día/temporada. Los extras de sonido SHALL tener: nombre, descripción, precio e imagen (todos obligatorios).

#### Scenario: Dos paquetes con precios independientes

- GIVEN que un proveedor de sonido publica "Paquete Básico" ($5,000) y "Paquete Premium" ($8,000)
- WHEN configura precios dinámicos
- THEN SHALL poder asignar ajuste diferente a cada paquete
- AND el cliente SHALL ver precios por separado para cada paquete

#### Scenario: Paquete con precio por día/temporada

- GIVEN que el "Paquete Básico" tiene precio base de $5,000 MXN
- WHEN el proveedor configura +15% para sábados en temporada alta
- THEN el precio vigente del "Paquete Básico" para sábados en temporada alta SHALL ser $5,750 MXN
- AND el precio entre semana SHALL permanecer en $5,000 MXN

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
