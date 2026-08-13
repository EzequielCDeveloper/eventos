# Interfaces Proveedor — Specification

## Purpose

Definir las pantallas del proveedor: onboarding, dashboard 5 tabs, agenda gratuita, configuración y calendario.

## Requirements

### Requirement: Onboarding Wizard

El proveedor SHALL completar un wizard de alta de 3 pasos: (1) Lo Fundamental, (2) El Escaparate Visual, (3) Reglas y Precios. El wizard SHALL guardar progreso y permitir continuar después. El Paso 3 SHALL incluir modo de aprobación (manual vs. inmediata) editable post-setup.

#### Scenario: Proveedor completa onboarding con los 3 pasos correctos

- GIVEN que un proveedor nuevo inicia el wizard
- WHEN completa Paso 1 (Lo Fundamental), Paso 2 (El Escaparate Visual), Paso 3 (Reglas y Precios)
- THEN su servicio SHALL estar pendiente de verificación/publicación

#### Scenario: Proveedor configura modo de aprobación en Paso 3

- GIVEN que un proveedor está en el Paso 3 del wizard
- WHEN selecciona modo de aprobación (manual o inmediata)
- THEN la configuración SHALL guardarse como parte del Paso 3
- AND SHALL poder cambiarla después del setup inicial

#### Scenario: Proveedor abandona wizard

- GIVEN que un proveedor completa paso 1 y 2
- WHEN cierra la aplicación
- THEN SHALL poder continuar desde el Paso 3 al reingresar

### Requirement: Dashboard 5 Tabs

El dashboard del proveedor SHALL tener 5 tabs: (1) Hoy, (2) Mensajes, (3) Calendario, (4) Anuncios, (5) Estadísticas e Insights. Cada tab SHALL mostrar información relevante y acciones rápidas.

#### Scenario: Tab Hoy — Centro de Mando

- GIVEN que un proveedor accede al dashboard
- WHEN abre la app
- THEN SHALL ver tab "Hoy" con: alertas urgentes (reservas pendientes, mensajes sin leer), resumen semanal, recordatorios, acciones rápidas

#### Scenario: Tab Mensajes

- GIVEN que un proveedor accede al dashboard
- WHEN selecciona tab "Mensajes"
- THEN SHALL ver: lista de conversaciones, chat texto, notas de voz, respuestas rápidas, mensajes programados

#### Scenario: Tab Calendario

- GIVEN que un proveedor accede al dashboard
- WHEN selecciona tab "Calendario"
- THEN SHALL ver: vista mensual/semanal, ajuste dinámico de precios, inventario por slot con indicadores, bloqueo de fechas, disponibilidad por slot

#### Scenario: Tab Anuncios

- GIVEN que un proveedor accede al dashboard
- WHEN selecciona tab "Anuncios"
- THEN SHALL ver: edición de fotos, descripción del servicio, reglas, política de cancelación

#### Scenario: Tab Estadísticas e Insights

- GIVEN que un proveedor accede al dashboard
- WHEN selecciona tab "Estadísticas e Insights"
- THEN SHALL ver: historial de pagos, proyección de ganancias, tasa de respuesta, tasa de aceptación, calificación promedio

### Requirement: Configuración de Concurrencia — Inventario por Slot

El proveedor SHALL gestionar su capacidad mediante inventario por slot (fecha + horario): define la cantidad máxima de eventos que puede atender en el mismo slot. Salones están forzados a 1 evento por slot. La configuración SHALL realizarse desde el calendario (Tab 3). Los defaults por tipo SHALL ser: Salón=1, Sonido=2, Servicio-persona=1.

#### Scenario: Sonido configura inventario por slot

- GIVEN que un proveedor de sonido accede al calendario (Tab 3)
- WHEN establece inventario de 3 eventos por slot
- THEN SHALL poder aceptar hasta 3 reservas simultáneas en el mismo slot (fecha + horario)

#### Scenario: Defaults por tipo de servicio

- GIVEN que un proveedor nuevo completa el onboarding
- WHEN se configura su inventario por slot
- THEN el default SHALL ser: Salón=1, Sonido=2, Servicio-persona=1
- AND SHALL poder modificar el default desde el calendario

### Requirement: Ajuste Dinámico de Precios en Calendario

El Tab 3 (Calendario) SHALL incluir la funcionalidad de ajuste dinámico de precios. El proveedor SHALL poder configurar tarifas diferenciadas por temporada, fin de semana o demanda, aplicadas sobre el precio base, desde la vista del calendario.

#### Scenario: Proveedor configura ajuste desde calendario

- GIVEN que un proveedor accede al Tab 3 (Calendario)
- WHEN selecciona fechas o períodos
- THEN SHALL poder configurar ajuste dinámico de precios (porcentaje o monto sobre base)
- AND el ajuste SHALL aplicarse a las reservas en esas fechas/períodos

#### Scenario: Indicadores de inventario por slot en calendario

- GIVEN que un proveedor tiene inventario por slot configurado
- WHEN visualiza el calendario en Tab 3
- THEN SHALL ver indicadores de cupo por slot: disponible / parcial / lleno
- AND SHALL poder ajustar el inventario por slot desde el mismo calendario

### Requirement: Modo Aprobación Editable Post-Setup

El modo de aprobación (manual vs. inmediata) configurado en el onboarding SHALL ser editable después del setup inicial desde la configuración del proveedor. Un cambio de modo aplica a solicitudes futuras.

#### Scenario: Proveedor cambia modo de aprobación

- GIVEN que un proveedor tiene su servicio activo con aprobación manual
- WHEN cambia la configuración a aprobación inmediata
- THEN la nueva configuración SHALL aplicar a solicitudes futuras
- AND las reservas existentes NO SHALL ser afectadas
