# Interfaces Cliente — Specification

## Purpose

Definir las pantallas y flujos de la interfaz del cliente: explorar, buscar, filtros, detalle, favoritos, rentas y perfil.

## Requirements

### Requirement: Exploración y Búsqueda

El cliente SHALL poder explorar servicios por categoría (salón, sonido, servicio-persona). La búsqueda SHALL soportar filtros: fecha, capacidad de personas, zona/ciudad, presupuesto, tipo de evento, alberca, internet, calificación del proveedor.

#### Scenario: Búsqueda con filtros

- GIVEN que un cliente busca salón para 100 personas
- WHEN aplica filtros: zona CDMX, capacidad 100+, alberca sí, internet sí
- THEN los resultados SHALL mostrar solo salones que cumplan todos los filtros

#### Scenario: Búsqueda sin resultados

- GIVEN que un cliente busca con filtros muy restrictivos
- WHEN no hay servicios que cumplan
- THEN el sistema SHALL mostrar "No encontramos resultados" y sugerir ampliar filtros

### Requirement: Detalle del Servicio

El cliente SHALL ver detalle completo del servicio: nombre, descripción, fotos (mínimo 5), precio, disponibilidad, calificación, verificación, y extras disponibles.

#### Scenario: Visualización de detalle

- GIVEN que un cliente selecciona un servicio de la búsqueda
- WHEN accede al detalle
- THEN SHALL ver: fotos, precio, disponibilidad, calificación, y opción de reservar

### Requirement: Favoritos

El cliente SHALL poder guardar servicios como favoritos. Los favoritos SHALL persistirse y estar accesibles desde el perfil.

#### Scenario: Agregar a favoritos

- GIVEN que un cliente encuentra un servicio que le gusta
- WHEN presiona "Agregar a favoritos"
- THEN el servicio SHALL guardarse en su lista de favoritos

### Requirement: Historial de Rentas

El cliente SHALL ver su historial de rentas: reservas activas, pasadas, y canceladas. Cada reserva SHALL mostrar estado, fecha, monto, y opción de calificar (solo reservas completadas).

#### Scenario: Calificar reserva completada

- GIVEN que un cliente tiene una reserva completada con pago total y fecha pasada
- WHEN accede al historial
- THEN SHALL ver opción de "Calificar" activa
- AND SHALL poder dejar review y calificación

#### Scenario: Review solo tras pago completo + fecha pasada

- GIVEN que un cliente tiene reserva con saldo pendiente
- WHEN accede al historial
- THEN la opción de calificar SHALL estar deshabilitada
- AND SHALL mostrar "Disponible después del pago completo"

### Requirement: Perfil del Cliente

El cliente SHALL poder ver y editar su perfil: nombre, foto, teléfono, email, y verificación de identidad (opcional).

#### Scenario: Editar perfil

- GIVEN que un cliente accede a su perfil
- WHEN modifica su nombre y foto
- THEN los cambios SHALL guardarse y reflejarse inmediatamente
