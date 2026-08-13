---
title: "Interfaces del Cliente"
estado: completo
version: "1.0"
fecha: "2026-08-11"
fuentes:
  - openspec/changes/documentacion-producto-eventos/specs/interfaces-cliente/spec.md
  - openspec/changes/documentacion-producto-eventos/specs/flujo-de-reserva/spec.md
  - openspec/changes/documentacion-producto-eventos/specs/taxonomia-de-servicios/spec.md
  - openspec/changes/documentacion-producto-eventos/specs/pagos-y-comisiones/spec.md
  - openspec/changes/documentacion-producto-eventos/design.md
---

# Interfaces del Cliente

Las pantallas y flujos de la interfaz del cliente: explorar, buscar, filtros, detalle de servicio, favoritos, historial de rentas y perfil. Cada pantalla **MUST** seguir el patrón de progressive disclosure — información principal primero, detalles expandibles después.

→ Ver [→ flujo_de_reserva.md](flujo_de_reserva.md) para el flujo de reserva que estas interfaces implementan.
→ Ver [→ taxonomia_de_servicios.md](taxonomia_de_servicios.md) para tipos de servicio y modelos de precio.

## Navegación Principal

La app del cliente opera con **navbar inferior** de 5 secciones fijas:

| Tab | Icono sugerido | Función |
|-----|---------------|---------|
| **Inicio** | 🏠 | Explorar + buscar servicios. Incluye navbar secundaria: Salones / Sonidos / Servicios |
| **Favoritos** | ❤️ | Lista de servicios guardados |
| **Rentas** | 📋 | Historial de reservas activas, pasadas y canceladas |
| **Chat** | 💬 | Centro de comunicación con proveedores |
| **Perfil** | 👤 | Datos personales, verificación, configuración |

### Inicio — Exploración y Búsqueda

La pantalla de inicio **SHALL** mostrar una barra de búsqueda prominentemente, seguida de tarjetas de servicios destacados. La navbar secundaria permite filtrar por tipo de servicio.

**Elementos de la pantalla de inicio**:

| Elemento | Comportamiento |
|----------|---------------|
| Barra de búsqueda | Búsqueda por texto libre (nombre, ubicación, tipo de servicio) |
| Filtros rápidos | Acceso rápido a los filtros más usados (fecha, capacidad, zona) |
| Tarjetas de servicio | Foto principal, nombre, calificación, precio, badge de verificación |
| Scroll infinito | Carga progresiva de resultados |

→ Ver [→ taxonomia_de_servicios.md](taxonomia_de_servicios.md) para los 3 tipos de servicio.

## Búsqueda con Filtros (Decisión 20)

El sistema **SHALL** soportar al menos **8 dimensiones de filtros** para la búsqueda de servicios. Todos los filtros son acumulativos (se aplican en conjunto, no se excluyen mutuamente).

### Filtros Disponibles

| # | Filtro | Tipo | Descripción |
|---|--------|------|-------------|
| 1 | **Fecha** | Selector de fecha | Fecha específica o rango del evento |
| 2 | **Capacidad de personas** | Slider numérico | Mínimo de personas para el evento |
| 3 | **Zona / Ciudad** | Selector geográfico | Colonia, alcaldía, o ciudad |
| 4 | **Presupuesto** | Rango de precio | Precio mínimo y máximo por bloque |
| 5 | **Tipo de evento** | Chips multiselección | Boda, quinceañera, corporativo, infantil, etc. |
| 6 | **Alberca** | Toggle booleano | Filtrar solo servicios con alberca |
| 7 | **Internet** | Toggle booleano | Filtrar solo servicios con Wi-Fi |
| 8 | **Calificación** | Slider mínimo | Calificación mínima del proveedor (1–5 estrellas) |

### Escenario: Búsqueda con filtros

> DADO que un cliente busca salón para 100 personas
> CUANDO aplica filtros: zona CDMX, capacidad 100+, alberca sí, internet sí
> ENTONCES los resultados **SHALL** mostrar solo salones que cumplan todos los filtros.

### Escenario: Búsqueda sin resultados

> DADO que un cliente busca con filtros muy restrictivos
> CUANDO no hay servicios que cumplan
> ENTONCES el sistema **SHALL** mostrar "No encontramos resultados" y sugerir ampliar filtros.

Los filtros se aplican en tiempo real sobre el catálogo. El número de resultados coincidentes **SHALL** mostrarse actualizado al aplicar o quitar cualquier filtro.

## Horarios Rentables Visibles (Decisión 16)

El cliente **SHALL** poder ver los horarios rentables del proveedor directamente en la pantalla de búsqueda y en el detalle del servicio. Esto le permite identificar quickly qué horarios están disponibles para su fecha.

| Elemento | Ubicación | Formato |
|----------|-----------|---------|
| Bloques disponibles | Pantalla de detalle, debajo del calendario | Lista cronológica de bloques de horas con precio |
| Indicador visual | Calendario | Días con disponibilidad resaltados en verde, sin disponibilidad en gris |
| Precio por bloque | Junto a cada bloque | Precio del bloque + horas extra disponibles |

→ Ver [→ flujo_de_reserva.md#reserva-por-bloques-de-horas](flujo_de_reserva.md#reserva-por-bloques-de-horas) para el modelo de reserva por bloques.

## Detalle del Servicio

Al seleccionar un servicio de la búsqueda, el cliente accede a una pantalla de detalle completa.

### Contenido del Detalle

| Sección | Contenido |
|---------|-----------|
| **Galería** | Mínimo 5 fotos, carrusel con zoom |
| **Nombre y descripción** | Título, descripción detallada del servicio |
| **Precio** | Precio base del bloque, horas extras disponibles |
| **Calificación** | Estrellas, número de reviews, badge de verificación |
| **Comodidades** | Etiquetas visuales: Wi-Fi, pista de baile, menú vegano, etc. |
| **Extras** | Lista de complementos con precios (→ ver [→ taxonomia_de_servicios.md#extras-configurables](taxonomia_de_servicios.md#extras-configurables)) |
| **Horarios rentables** | Bloques de horas disponibles con precios (Decisión 16) |
| **Política de cancelación** | Política del proveedor visible antes de reservar |
| **Reviews** | Últimas calificaciones de clientes anteriores |

### Acciones del Detalle

| Acción | Comportamiento |
|--------|---------------|
| **Rentar ahora** | Inicia flujo de reserva → [→ flujo_de_reserva.md](flujo_de_reserva.md) |
| **Chatear con proveedor** | Abre chat directo con el proveedor del servicio |
| **Ver en mapa** | Muestra ubicación del servicio en mapa integrado |
| **Agregar a favoritos** | Guarda el servicio en la lista de favoritos |

## Favoritos

El cliente **SHALL** poder guardar servicios en una lista de favoritos persistente.

| Elemento | Comportamiento |
|----------|---------------|
| Agregar favorito | Botón de corazón en tarjeta de búsqueda o detalle |
| Lista de favoritos | Accesible desde tab "Favoritos" en navbar |
| Ordenación | Por fecha de agregado (más reciente primero) |
| Eliminar favorito | Deslizar para eliminar, o tocar el corazón nuevamente |
| Disponibilidad | Los favoritos **SHALL** persistirse y estar accesibles después de cerrar la app |

## Historial de Rentas (Decisión 5)

El cliente **SHALL** ver su historial de rentas con reservas organizadas por estado.

### Categorías del Historial

| Categoría | Contenido |
|-----------|-----------|
| **Activas** | Reservas confirmadas con fecha futura |
| **En curso** | Reservas del día del evento |
| **Completadas** | Reservas finalizadas con evento realizado |
| **Canceladas** | Reservas canceladas por el cliente o el proveedor |

### Datos de Cada Reserva

| Campo | Descripción |
|-------|-------------|
| Servicio | Nombre y foto del servicio |
| Fecha y horario | Fecha del evento + bloque de horas |
| Estado | Activa / En curso / Completada / Cancelada |
| Monto total | Pago total de la reserva |
| Proveedor | Nombre del proveedor con badge de verificación |
| Acciones | Calificar (si aplica), Ver detalle, Chatear |

### Reviews Post-Evento (Decisión 5)

El sistema **SHALL** permitir reviews **SOLO** cuando se cumplen ambas condiciones:
1. El pago **SHALL** ser completo (sin saldo pendiente).
2. La fecha del evento **SHALL** ser pasada.

| Estado del Pago | Fecha del Evento | Opción de Calificar |
|----------------|-----------------|---------------------|
| Saldo pendiente | Cualquier fecha | **DESHABILITADA** — "Disponible después del pago completo" |
| Pago completo | Futura | **DESHABILITADA** — "Disponible después del evento" |
| Pago completa | Pasada | **HABILITADA** — Botón "Calificar" activo |

> Ejemplo: Un cliente que pagó completamente pero cuya reserva es para el próximo mes **NO** podrá calificar hasta después del evento.

→ Ver [→ pagos_y_comisiones.md#cobro-flexible](pagos_y_comisiones.md#cobro-flexible) para opciones de pago.

## Perfil del Cliente

El cliente **SHALL** poder ver y editar su perfil personal.

### Datos del Perfil

| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| Nombre completo | Texto | Sí |
| Foto de perfil | Imagen | No |
| Teléfono | Teléfono MX | Sí |
| Email | Email | Sí |
| Verificación de identidad | Badge | Opcional |

### Acciones del Perfil

| Acción | Descripción |
|--------|-------------|
| Editar nombre y foto | Cambios se reflejan inmediatamente |
| Verificar identidad | Opcional — guía para verificación INE presencial (→ ver [→ verificacion_de_identidad.md](verificacion_de_identidad.md)) |
| Ver historial de pagos | Resumen de transacciones |
| Configuración de notificaciones | Preferencias de push/email |
| Cerrar sesión | Cierre de sesión con confirmación |

→ Ver [→ roles_y_permisos.md](roles_y_permisos.md) para el rol de Cliente y sus permisos.

## Flujo Rentar / Chatear / Ver Agenda / Pagar

El flujo completo del cliente desde descubrimiento hasta confirmación:

```
Inicio → Buscar/Filtrar → Seleccionar servicio → Detalle
    ↓
"Rentar ahora" → Seleccionar fecha/horario → Seleccionar extras
    ↓
Resumen de precio → Pagar anticipo (Conekta)
    ↓
Contrato físico (salón: agendar firma → firma presencial)
    ↓
Confirmación → Notificación al proveedor
```

| Paso | Pantalla | Acción principal |
|------|----------|-----------------|
| 1 | Inicio | Buscar y filtrar servicios |
| 2 | Detalle | Revisar información, fotos, precio, horarios |
| 3 | Reserva | Seleccionar fecha, bloque de horas, extras |
| 4 | Pago | Ingresar datos de pago vía Conekta |
| 5 | Confirmación | Estado: CONFIRMADA |

→ Ver [→ flujo_de_reserva.md](flujo_de_reserva.md) para el diagrama completo de estados.
→ Ver [→ pagos_y_comisiones.md](pagos_y_comisiones.md) para el procesamiento de pagos.
→ Ver [→ mensajeria.md](mensajeria.md) para chat con proveedores.

## Documentos Relacionados

| Documento | Relación |
|-----------|----------|
| `flujo_de_reserva.md` | UI implementa el flujo de reserva |
| `taxonomia_de_servicios.md` | Tipos de servicio disponibles en la búsqueda |
| `pagos_y_comisiones.md` | Procesamiento de pagos en el flujo |
| `mensajeria.md` | Chat cliente-proveedor desde esta interfaz |
| `notificaciones.md` | Notificaciones recibidas por el cliente |
| `roles_y_permisos.md` | Rol Cliente y sus permisos |
| `interfaces_proveedor.md` | Interfaz del proveedor (contraparte) |
