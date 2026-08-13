# Arquitectura de Interfaz y Flujo para Anfitriones
## Marketplace de Servicios para Eventos (Modelo Airbnb)

Este documento sintetiza la estructura de las interfaces de proveedores en Airbnb y su adaptación a un modelo de negocio enfocado en eventos (salones, mobiliario, banquetes, personal, etc.).

---

## 1. El Flujo de Registro (Onboarding del Proveedor)
El éxito del registro radica en un asistente paso a paso (wizard) donde cada pantalla solicita una sola acción o conjunto de datos muy específico para no abrumar al usuario.

*   **Paso 1: Lo fundamental**
    *   Definición del servicio (Ej. Salón, Meseros, Equipo de Sonido).
    *   Ubicación (fija para salones, área de servicio para proveedores móviles).
    *   Capacidad máxima (personas que caben o eventos simultáneos).
*   **Paso 2: El escaparate visual y descriptivo**
    *   Carga de fotografías (establecer un mínimo requerido para mantener calidad visual).
    *   Título atractivo y descripción detallada del servicio.
    *   Selección de "comodidades" o "características" (Ej. Wi-Fi, pista de baile, menú vegano) mediante etiquetas o tarjetas visuales.
*   **Paso 3: Reglas y precios**
    *   Configuración de tarifas (base, por hora, por bloque).
    *   Políticas de reserva (Aprobación manual vs. Reserva inmediata).
    *   Bloqueo de fechas no disponibles iniciales.

---

## 2. El Dashboard del Proveedor (Las 5 Pestañas Core)
Una vez activo, el proveedor gestiona su operación a través de 5 secciones principales en su aplicación o portal web:

1.  **Hoy (Centro de mando):**
    *   Alertas de acción inmediata (reservas pendientes de aprobación, mensajes sin leer).
    *   Resumen de los eventos de la semana actual.
    *   Recordatorios de operación (Ej. "Tienes un evento mañana").
2.  **Mensajes (Centro de comunicación):**
    *   Inbox centralizado para negociar y hablar con los clientes.
    *   **Herramientas de automatización:** Respuestas rápidas guardadas y mensajes programados (ej. mensaje automático de confirmación de detalles 24h antes del evento).
3.  **Calendario (Gestión de inventario y precios):**
    *   Vista visual de disponibilidad y ocupación mensual/semanal.
    *   Ajuste dinámico de precios (ej. configurar tarifas más altas en fines de semana o temporada alta).
4.  **Anuncios (Gestión de perfil/catálogo):**
    *   Edición de fotos, descripciones, y reglas del servicio.
    *   Gestión de políticas de cancelación.
5.  **Estadísticas e Insights (Rendimiento del negocio):**
    *   Historial de pagos y proyección de ganancias futuras.
    *   Métricas clave que el algoritmo de búsqueda usará para posicionar al proveedor: *Tasa de respuesta* (rapidez de contestación), *Tasa de aceptación* de reservas y *Calificación promedio*.

---

## 3. Adaptaciones Clave para el Sector de Eventos
A diferencia del alquiler de alojamiento tradicional, los eventos requieren una arquitectura de base de datos y un diseño de interfaz mucho más flexible:

| Característica / Módulo | Lógica Tradicional (Airbnb) | Adaptación Necesaria para Eventos |
| :--- | :--- | :--- |
| **Tiempo de Reserva** | Por Noches (Check-in / Check-out). | **Por Horas / Turnos:** El calendario debe permitir rentar por bloques de 4, 6 u 8 horas, fraccionando un mismo día. |
| **Geolocalización** | Ubicación Fija (La propiedad no se mueve). | **Ubicación Dinámica / Radio de Cobertura:** Proveedores móviles (fotógrafos, banqueteros, músicos) deben poder definir su "zona de trabajo" poligonal o radial y el sistema debe calcular tarifas de viáticos extras por KM si el evento sale de la zona base. |
| **Control de Disponibilidad** | Binaria (1 casa = 1 reserva a la vez, encendido/apagado). | **Capacidad Concurrente:** Una empresa de mobiliario o decoración puede tener inventario/personal para cubrir 3 o 4 eventos simultáneos en la misma fecha. El calendario necesita control de volumen. |
| **Flexibilidad de Inventario** | Inventario Fijo (Rentas el espacio completo). | **Extras (Upselling / Ventas Cruzadas):** Opción de agregar complementos al carrito desde la página del proveedor. (Ej. Sonido base, pero con opción a "Agregar luces LED por $500", o "Agregar DJ por $1000"). |

---
*Documento sintetizado para la estructuración y diseño UI/UX de plataforma marketplace de eventos.*
