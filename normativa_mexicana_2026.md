---
title: "Normativa Mexicana 2026"
estado: completo
version: "1.1"
fecha: "2026-08-11"
fuentes:
  - openspec/changes/documentacion-producto-eventos/specs/normativa-mexicana-2026/spec.md
  - openspec/changes/documentacion-producto-eventos/design.md
---

# Normativa Mexicana 2026

> ⚠️ **Disclaimer Obligatorio**: La información de este documento está basada en el estado conocido al **2026**. Esta **NO** es asesoría legal. Consulte a un abogado especializado para confirmación actualizada y aplicación específica a su caso.

Este documento documenta las leyes y regulaciones mexicanas que impactan directamente la plataforma. Cada ley se presenta con su alcance, impacto en el producto, e implementación de cumplimiento.

→ Ver [→ verificacion_de_identidad.md](verificacion_de_identidad.md) para verificación INE/RENAPO.
→ Ver [→ verificamex_integracion.md](verificamex_integracion.md) para LFPDPPP en integración con Verificamex.
→ Ver [→ pagos_y_comisiones.md](pagos_y_comisiones.md) para CFDI e impuestos.

## Leyes y Regulaciones

### 1. Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)

| Aspecto | Detalle |
|---------|---------|
| **Alcance** | Regula el tratamiento de datos personales por parte de particulares (la plataforma como responsable) |
| **Qué obliga** | Consentimiento explícito para recolección y uso de datos. Aviso de privacidad claro y accesible. Derechos ARCO (Acceso, Rectificación, Cancelación, Oposición) |
| **Dónde aplica** | Registro de usuarios, verificación de identidad, procesamiento de pagos, chat, perfil |
| **Quién responde** | Responsable de datos (plataforma) |

#### Implementación

| Requisito | Cómo se cumple |
|-----------|---------------|
| Consentimiento explícito | Aviso de privacidad en registro; aceptación obligatoria antes de continuar |
| Derechos ARCO | Formulario de solicitud de acceso, rectificación, cancelación u oposición en perfil |
| Revocación de consentimiento | Opción de eliminar cuenta y datos desde perfil |
| Minimización de datos | Solo se recolecta lo necesario para el servicio |
| Datos sensibles | Se solicita consentimiento expreso adicional para datos biométricos (si aplica) |

#### Escenario: Consentimiento de datos

> DADO que un usuario se registra en la plataforma
> CUANDO completa el formulario de registro
> ENTONCES **SHALL** aceptar explícitamente el aviso de privacidad
> Y **SHALL** poder revocar consentimiento en cualquier momento

#### Escenario: Derechos ARCO

> DADO que un usuario quiere acceder a sus datos
> CUANDO solicita acceso a sus datos personales
> ENTONCES el sistema **SHALL** proporcionar información completa de datos almacenados
> Y **SHALL** procesar la solicitud en el plazo legal (20 días hábiles)

### 2. Ley Federal de Protección al Consumidor

| Aspecto | Detalle |
|---------|---------|
| **Alcance** | Protege los derechos de los consumidores en transacciones comerciales |
| **Qué obliga** | Información clara de precios, condiciones de venta, políticas de cancelación antes de la transacción. Derecho de reclamación. |
| **Dónde aplica** | Publicación de servicios, resumen de reserva, políticas de cancelación, proceso de pago |
| **Quién responde** | Proveedor (como vendedor) y plataforma (como intermediario) |

#### Implementación

| Requisito | Cómo se cumple |
|-----------|---------------|
| Información clara de precios | Precio total visible antes de confirmar reserva: precio + impuestos + comisión |
| Condiciones de venta | Términos y condiciones aceptados antes de cada transacción |
| Política de cancelación | Visible antes de confirmar reserva, con escenarios claros |
| Derecho de reclamación | Contacto del proveedor visible en el perfil; mediación técnica disponible |

#### Escenario: Información clara de precios

> DADO que un cliente visualiza un servicio
> CUANDO ve el resumen de reserva
> ENTONCES **SHALL** ver: precio total, impuestos, política de cancelación, y condiciones

### 3. Código de Comercio — Contratos Electrónicos

| Aspecto | Detalle |
|---------|---------|
| **Alcance** | Regula la validez de contratos comerciales, incluyendo electrónicos |
| **Qué obliga** | Los contratos generados por la plataforma **SHALL** cumplir con el Código de Comercio en materia de contratos electrónicos |
| **Dónde aplica** | Contrato físico de reserva, confirmación bilateral en app, términos y condiciones |
| **Quién responde** | Ambas partes (cliente y proveedor) y plataforma como facilitador |

#### Implementación

| Requisito | Cómo se cumple |
|-----------|---------------|
| Validez del contrato | Contrato físico presencial con firma de ambas partes |
| Confirmación bilateral | Ambas partes confirman firma en app antes de avanzar estado |
| Términos claros | Contrato incluye: servicios, precios, fechas, cancelación, depósito |
| Conservación | Contrato firmado se conserva como referencia (foto digital o escaneado) |

#### Escenario: Validez del contrato

> DADO que ambas partes firman contrato físico
> CUANDO se confirma en la app
> ENTONCES el contrato **SHALL** ser legalmente válido según Código de Comercio

→ Ver [→ flujo_de_reserva.md#contrato-físico-presencial](flujo_de_reserva.md#contrato-físico-presencial) para el flujo completo de firma.

### 4. Permisos de Alcohol — Normativa Municipal

| Aspecto | Detalle |
|---------|---------|
| **Alcance** | Los permisos para venta y servicio de bebidas alcohólicas dependen de la normativa municipal de cada localidad |
| **Qué obliga** | Obtener permiso municipal antes de servir alcohol en un evento |
| **Dónde aplica** | Eventos que incluyen servicio de alcohol (bartenders, paquetes con barra) |
| **Quién responde** | El proveedor que ofrece el servicio de alcohol; la plataforma **NO** gestiona permisos directamente |

#### Normativa Local de Referencia del MVP: San Luis Río Colorado, Sonora

Para el MVP, la plataforma **SHALL** basarse en la normativa municipal de **San Luis Río Colorado, Sonora, México** (decisión humana — → ver [→ areas_de_simplificacion.md](areas_de_simplificacion.md) supuesto 9). Implicaciones para el producto:

| Regla MVP | Comportamiento |
|-----------|----------------|
| Permiso **opcional** | El permiso de alcohol **NO SHALL** ser obligatorio para reservar; es elección del usuario |
| Notificación de consecuencias | La plataforma **SHALL** **SIEMPRE** notificar al usuario las **consecuencias de no tramitar el permiso** (evento sin servicio/venta de alcohol; responsabilidad legal según normativa municipal SLRC) |
| No cancelación automática | La falta de permiso **NO SHALL** cancelar la reserva automáticamente — la decisión final es del usuario |
| Timeline H-5 | Notificación 5 horas antes del evento si el permiso no está confirmado, con elección de continuar o cancelar |

> **Nota legal**: Los requisitos específicos de permisos de alcohol del municipio (trámite, vigencia, horarios de venta, giro) deben validarse con asesoría legal local antes de generalizar la plataforma fuera de SLRC. Este documento no constituye asesoría legal.

#### Implementación

| Requisito | Cómo se cumple |
|-----------|---------------|
| Documentación del requisito | La plataforma informa que se requiere permiso municipal (opcional, según normativa SLRC para el MVP) |
| Notificación de consecuencias | La plataforma notifica SIEMPRE las consecuencias de no tramitar el permiso de alcohol |
| Timeline H-5 | Notificación 5 horas antes del evento si el permiso no está confirmado |
| No bloqueante / elección del usuario | El permiso **NO SHALL** bloquear ni cancelar la reserva automáticamente; el usuario decide continuar o cancelar |
| Sin gestión directa | La plataforma **NO SHALL** gestionar permisos — solo documentar el requisito |

#### Escenario: Documentación de permisos

> DADO que un cliente solicita servicio con alcohol
> CUANDO se planifica el evento
> ENTONCES el sistema **SHALL** informar que se requiere permiso municipal
> Y **SHALL** notificar si el permiso no se confirma H-5 antes

→ Ver [→ flujo_de_reserva.md#permiso-de-alcohol—h-5](flujo_de_reserva.md#permiso-de-alcohol—h-5) para el timeline de decisión H-5.

#### Edad Legal para Alcohol

La edad legal para el consumo de bebidas alcohólicas en México es de **18 años**. La plataforma **SHALL** documentar este requisito, pero **NO SHALL** verificar la edad de los asistentes al evento — esa responsabilidad recae en el proveedor y el titular del permiso municipal.

### 5. SAT / CFDI — Impuestos y Comprobantes Fiscales

| Aspecto | Detalle |
|---------|---------|
| **Alcance** | Regula la emisión de comprobantes fiscales digitales (CFDI) y la retención de impuestos |
| **Qué obliga** | Generar CFDI por cada transacción. Retener ISR e IVA cuando aplique. Cumplir con obligaciones de plataformas digitales. |
| **Dónde aplica** | Procesamiento de pagos, reportes mensuales, facturación |
| **Quién responde** | Plataforma (CFDI de comisión) y proveedor (CFDI de servicio) |

#### Implementación

| Requisito | Cómo se cumple |
|-----------|---------------|
| CFDI | Generación automática de comprobante fiscal digital por cada pago procesado |
| Retención ISR | La plataforma retiene ISR según la tasa vigente para plataformas digitales |
| Retención IVA | La plataforma retiene IVA cuando aplique |
| Reporte mensual | Cada proveedor recibe reporte de transacciones, impuestos retenidos, y neto a recibir |
| Plataformas digitales | Cumplimiento de obligaciones como intermediario (artículo 113-E LISR) |

#### Escenario: Generación de CFDI

> DADO que un cliente completa un pago
> CUANDO se procesa el cobro
> ENTONCES **SHALL** generarse CFDI correspondiente
> Y el cliente **SHALL** poder descargar su comprobante fiscal

→ Ver [→ pagos_y_comisiones.md#impuestos—calculadora-y-reporte](pagos_y_comisiones.md#impuestos—calculadora-y-reporte) para el detalle de cálculo y reporte.

### 6. Comercio Electrónico

| Aspecto | Detalle |
|---------|---------|
| **Alcance** | Regula las transacciones comerciales realizadas por medios electrónicos |
| **Qué obliga** | Términos y condiciones disponibles antes de cada transacción. Información del vendedor accesible. Medios de reclamación disponibles. |
| **Dónde aplica** | Registro de usuario, proceso de reserva, aceptación de términos |
| **Quién responde** | Plataforma y proveedores |

#### Implementación

| Requisito | Cómo se cumple |
|-----------|---------------|
| Términos y condiciones | Disponibles antes de cada transacción; aceptación obligatoria |
| Información del vendedor | Perfil del proveedor con datos de contacto y ubicación |
| Medios de reclamación | Contacto del proveedor visible; proceso de disputa técnica documentado |
| Conservación de registros | Transacciones y contratos se conservan digitalmente |

#### Escenario: Términos y condiciones

> DADO que un cliente procede a reservar
> CUANDO completa el proceso de reserva
> ENTONCES **SHALL** aceptar términos y condiciones
> Y **SHALL** poder acceder a ellos en cualquier momento

### 7. COFEPRIS — Alimentos y Bebidas

| Aspecto | Detalle |
|---------|---------|
| **Alcance** | Regula la salud sanitaria de alimentos y bebidas |
| **Qué obliga** | Proveedores de alimentos/catering deben contar con permisos sanitarios. La plataforma documenta la responsabilidad sanitaria del proveedor. |
| **Dónde aplica** | Servicios de catering, bartenders que sirvan alimentos |
| **Quién responde** | El proveedor (responsabilidad sanitaria directa) |

#### Implementación

| Requisito | Cómo se cumple |
|-----------|---------------|
| Documentación | La plataforma informa que la responsabilidad sanitaria recae en el proveedor |
| Permiso sanitario | El proveedor acepta que cuenta con los permisos aplicables al publicar servicio de catering |
| Sin gestión directa | La plataforma **NO SHALL** gestionar permisos sanitarios — solo documentar el requisito |

#### Escenario: Documentación de responsabilidad sanitaria

> DADO que un proveedor ofrece servicio de catering
> CUANDO publica su servicio
> ENTONCES **SHALL** aceptar que la responsabilidad sanitaria es del proveedor
> Y el sistema **SHALL** documentar este requisito

## Matriz de Cumplimiento

| Norma | Qué obliga | Dónde aplica en el producto | Quién responde |
|-------|-----------|---------------------------|----------------|
| LFPDPPP | Consentimiento, derechos ARCO, aviso de privacidad | Registro, verificación, pagos, chat, perfil | Plataforma (responsable de datos) |
| Ley Consumer | Información clara, precios transparentes, cancelación visible | Publicación servicios, reserva, pago | Proveedor + plataforma |
| Código Comercio | Contratos válidos, confirmación bilateral | Contrato reserva, firma, T&C | Ambas partes + plataforma |
| Permisos alcohol | Permiso municipal (referencia MVP: SLRC, Sonora — opcional con notificación de consecuencias), H-5, documentación | Eventos con alcohol | Proveedor (titular permiso) |
| SAT/CFDI | CFDI, retención ISR/IVA, reportes | Pagos, facturación, reportes | Plataforma (intermediario) |
| Comercio electrónico | T&C, información vendedor, reclamación | Registro, reserva, perfil | Plataforma + proveedores |
| COFEPRIS | Permisos sanitarios, responsabilidad proveedor | Catering, alimentos | Proveedor (responsable sanitario) |

## INE / RENAPO — Verificación de Identidad

El INE (Instituto Nacional Electoral) y la RENAPO (Registro Nacional de Población) son las fuentes oficiales para verificación de identidad en México. La verificación contra Lista Nominal a través de Verificamex utiliza datos del INE (CURP, clave de elector, OCR) para confirmar vigencia.

| Fuente | Qué verifica | Uso en plataforma |
|--------|-------------|-------------------|
| **INE — Lista Nominal** | Vigencia de credencial de elector | Verificación de proveedores vía Verificamex |
| **RENAPO — CURP** | Identidad única de la persona | Campo de verificación (complemento) |

→ Ver [→ verificacion_de_identidad.md](verificacion_de_identidad.md) para métodos de verificación.
→ Ver [→ verificamex_integracion.md](verificamex_integracion.md) para integración técnica con Verificamex.

## NOM-151 — Conservación de Documentos Electrónicos

| Aspecto | Detalle |
|---------|---------|
| **Alcance** | Establece los requisitos para la conservación de documentos electrónicos |
| **Relevancia** | Si la plataforma conserva contratos, comprobantes de pago o comunicaciones como prueba electrónica |
| **Estado** | Pendiente de validación legal — verificar si aplica a contratos de reserva generados por la plataforma |

> **Nota**: La aplicabilidad de la NOM-151 a la plataforma debe validarse con asesoría legal. Si aplica, los contratos y comprobantes electrónicos **SHALL** conservarse conforme a los requisitos de la norma.

## Edad Legal para Alcohol

La edad legal para el consumo de bebidas alcohólicas en México es de **18 años** conforme a la Ley General de Salud. La plataforma **SHALL** documentar este requisito pero **NO SHALL** implementar mecanismos de verificación de edad de asistentes — esa responsabilidad recae en el titular del permiso municipal y el proveedor del servicio.

## Documentos Relacionados

| Documento | Relación |
|-----------|----------|
| `verificacion_de_identidad.md` | Métodos de verificación INE/KYC |
| `verificamex_integracion.md` | Integración con Verificamex (LFPDPPP datos INE) |
| `pagos_y_comisiones.md` | CFDI, impuestos, retenciones |
| `flujo_de_reserva.md` | Contrato físico, permisos alcohol |
| `areas_de_simplificacion.md` | Decisiones de simplificación que impactan cumplimiento |
