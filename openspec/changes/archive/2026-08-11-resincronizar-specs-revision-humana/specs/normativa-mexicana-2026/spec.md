# Delta for Normativa Mexicana 2026

## MODIFIED Requirements

### Requirement: Permisos de Alcohol — Normativa Municipal SLRC, Sonora

La plataforma SHALL documentar que los permisos de alcohol dependen de la normativa municipal. Para el MVP, la plataforma SHALL seguir la normativa municipal de San Luis Río Colorado, Sonora, México. El sistema NO SHALL gestionar permisos de alcohol directamente — solo documentar el requisito y notificar al usuario. La plataforma SHALL SIEMPRE notificar al usuario las consecuencias de no tramitar el permiso.

(Previously: No especificaba normativa SLRC, Sonora ni enfatizaba notificación SIEMPRE de consecuencias)

#### Scenario: Documentación de permisos con normativa SLRC

- GIVEN que un cliente solicita servicio con alcohol
- WHEN se planifica el evento
- THEN el sistema SHALL informar que se requiere permiso municipal (según normativa SLRC, Sonora para el MVP)
- AND SHALL notificar si el permiso no se confirma H-5 antes

#### Scenario: Notificación SIEMPRE de consecuencias

- GIVEN que un cliente reserva un evento con servicio de alcohol
- WHEN se planifica el evento
- THEN la plataforma SHALL SIEMPRE notificar las consecuencias de no tramitar el permiso
- AND las consecuencias SHALL incluir: evento sin servicio/venta de alcohol, responsabilidad legal según normativa municipal SLRC

#### Scenario: Elección del usuario sin cancelación automática

- GIVEN que el permiso no está confirmado a H-5
- WHEN el usuario recibe notificación de consecuencias
- THEN SHALL poder elegir "Continuar sin alcohol" o "Cancelar reserva"
- AND NO SHALL haber cancelación automática — la decisión final es del usuario
- AND si cancela, SHALL aplicar política de cancelación del proveedor

## ADDED Requirements

### Requirement: Verificación de Edad — Responsabilidad del Proveedor

La edad legal para el consumo de bebidas alcohólicas en México es de 18 años. La plataforma SHALL documentar este requisito pero NO SHALL verificar la edad de los asistentes al evento — esa responsabilidad recae en el proveedor y el titular del permiso municipal.

#### Scenario: Documentación de responsabilidad de edad

- GIVEN que un proveedor ofrece servicio de alcohol
- WHEN publica su servicio
- THEN SHALL aceptar que la responsabilidad de verificación de edad recae en el proveedor
- AND la plataforma SHALL documentar este requisito sin implementar mecanismos de verificación
