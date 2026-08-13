# Normativa Mexicana 2026 — Specification

## Purpose

Documentar las leyes y regulaciones mexicanas que impactan la plataforma, con referencias citadas y estado conocido 2026. Incluir disclaimer de que la información puede estar desactualizada.

## Requirements

### Requirement: Ley Federal de Protección de Datos Personales (LFPDPPP)

La plataforma SHALL cumplir con la LFPDPPP para el tratamiento de datos personales. El sistema SHALL obtaining consentimiento explícito para recolección y uso de datos. El usuario SHALL poder ejercer derechos ARCO (acceso, rectificación, cancelación, oposición).

#### Scenario: Consentimiento de datos

- GIVEN que un usuario se registra en la plataforma
- WHEN completa el formulario de registro
- THEN SHALL aceptar explícitamente el aviso de privacidad
- AND SHALL poder revocar consentimiento en cualquier momento

#### Scenario: Derechos ARCO

- GIVEN que un usuario quiere acceder a sus datos
- WHEN solicita acceso a sus datos personales
- THEN el sistema SHALL proporcionar información completa de datos almacenados
- AND SHALL processar la solicitud en el plazo legal

### Requirement: Ley Federal de Protección al Consumidor

La plataforma SHALL cumplir con la Ley Federal de Protección al Consumidor. El sistema SHALL mostrar información clara de precios, condiciones de venta, y políticas de cancelación antes de la transacción.

#### Scenario: Información clara de precios

- GIVEN que un cliente visualiza un servicio
- WHEN ve el resumen de reserva
- THEN SHALL ver: precio total, impuestos, política de cancelación, y condiciones

### Requirement: Código de Comercio — Contratos

Los contratos generados por la plataforma SHALL cumplir con el Código de Comercio en materia de contratos electrónicos. El contrato físico presencial SHALL ser válido como instrumento legal.

#### Scenario: Validez del contrato

- GIVEN que ambas partes firman contrato físico
- WHEN se confirma en la app
- THEN el contrato SHALL ser legalmente válido según Código de Comercio

### Requirement: Permisos de Alcohol — Normativa Municipal SLRC, Sonora

La plataforma SHALL documentar que los permisos de alcohol dependen de la normativa municipal. Para el MVP, la plataforma SHALL seguir la normativa municipal de San Luis Río Colorado, Sonora, México. El sistema NO SHALL gestionar permisos de alcohol directamente — solo documentar el requisito y notificar al usuario. La plataforma SHALL SIEMPRE notificar al usuario las consecuencias de no tramitar el permiso.

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

### Requirement: Verificación de Edad — Responsabilidad del Proveedor

La edad legal para el consumo de bebidas alcohólicas en México es de 18 años. La plataforma SHALL documentar este requisito pero NO SHALL verificar la edad de los asistentes al evento — esa responsabilidad recae en el proveedor y el titular del permiso municipal.

#### Scenario: Documentación de responsabilidad de edad

- GIVEN que un proveedor ofrece servicio de alcohol
- WHEN publica su servicio
- THEN SHALL aceptar que la responsabilidad de verificación de edad recae en el proveedor
- AND la plataforma SHALL documentar este requisito sin implementar mecanismos de verificación

### Requirement: Impuestos — SAT / CFDI

La plataforma SHALL generar comprobantes fiscales digitales (CFDI) cuando aplique. El sistema SHALL calcular y retener impuestos según la legislación fiscal mexicana vigente.

#### Scenario: Generación de CFDI

- GIVEN que un cliente completa un pago
- WHEN se procesa el cobro
- THEN SHALL generarse CFDI correspondiente
- AND el cliente SHALL poder descargar su comprobante fiscal

### Requirement: Comercio Electrónico

La plataforma SHALL cumplir con la normativa de comercio electrónico mexicana. Los términos y condiciones SHALL estar disponibles antes de cada transacción.

#### Scenario: Términos y condiciones

- GIVEN que un cliente procede a reservar
- WHEN completa el proceso de reserva
- THEN SHALL aceptar términos y condiciones
- AND SHALL poder acceder a ellos en cualquier momento

### Requirement: COFEPRIS — Alimentos

Si la plataforma permite venta de alimentos, SHALL considerar la normativa de COFEPRIS. La plataforma SHALL documentar que la responsabilidad sanitaria recae en el proveedor.

#### Scenario: Documentación de responsabilidad sanitaria

- GIVEN que un proveedor ofrece servicio de catering
- WHEN publica su servicio
- THEN SHALL aceptar que la responsabilidad sanitaria es del proveedor
- AND el sistema SHALL documentar este requisito

### Requirement: Disclaimer de Estado Conocido

Todos los documentos de normativa SHALL incluir disclaimer: "Información basada en estado conocido 2026. Consulte asesoría legal para confirmación actualizada."

#### Scenario: Disclaimer visible

- GIVEN que un revisor lee documentos de normativa
- WHEN accede a cualquier sección legal
- THEN SHALL ver disclaimer de "estado conocido 2026" al inicio del documento
