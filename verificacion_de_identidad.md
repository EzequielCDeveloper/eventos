---
title: "Verificación de Identidad"
estado: completo
version: "1.0"
fecha: "2026-08-11"
fuentes:
  - openspec/changes/documentacion-producto-eventos/specs/verificacion-de-identidad/spec.md
  - openspec/changes/documentacion-producto-eventos/design.md
---

# Verificación de Identidad

La verificación de identidad es **obligatoria** para proveedores y **voluntaria** para clientes. El sistema ofrece dos vías: verificación presencial con INE o verificación remota vía APIs KYC (Truora, Veriff, Verificamex). La verificación completada habilita un badge visible en el perfil.

→ Ver [→ roles_y_permisos.md#verificación-de-identidad](roles_y_permisos.md#verificación-de-identidad) para contexto de roles.
→ Ver [→ verificamex_integracion.md](verificamex_integracion.md) para detalle técnico de integración con Verificamex.

## Método 1: INE Presencial (Decisión 11)

El sistema **SHALL** soportar verificación presencial mediante entrega física de INE y firma de contrato. Este método es el principal para salones de eventos, donde la firma presencial es parte del flujo natural de reserva.

| Aspecto | Descripción |
|---------|-------------|
| Requisito | Proveedor presenta INE vigente en punto de verificación |
| Proceso | Firma física de contrato + cotejo de INE contra el solicitante |
| Resultado | Estado: VERIFICADO — habilitado para publicar servicios |
| Dónde ocurre | Punto de verificación presencial o durante cita de firma de contrato |

> Ejemplo: Un proveedor de salón agenda cita de firma. Al llegar, entrega su INE al representante de la plataforma. El representante verifica coincidencia de foto y nombre, y el proveedor firma el contrato. La verificación se registra en el sistema.

### Escenario: Proveedor elige verificación INE presencial

> DADO que un proveedor completa su registro
> CUANDO selecciona "Verificar con INE presencial"
> ENTONCES **SHALL** agendar cita para entrega de INE
> Y la verificación **SHALL** completarse con firma física

→ Ver [→ flujo_de_reserva.md#contrato-físico-presencial](flujo_de_reserva.md#contrato-físico-presencial) para el flujo de firma bilateral.

## Método 2: Verificación KYC Remota (Decisión 22)

El sistema **SHALL** ofrecer verificación remota vía APIs de terceros. El proveedor elige entre tres proveedores KYC:

| Proveedor | Tipo | Verifica | Costo relativo |
|-----------|------|----------|----------------|
| **Verificamex** | API INE vs Lista Nominal | Vigencia INE, nombre, CURP, estatus Lista Nominal | Bajo |
| **Truora** | KYC multi-documento | Documento de identidad + selfie + liveness | Medio |
| **Veriff** | KYC global | Documento de identidad + verificación biométrica | Alto |

→ Ver [→ verificamex_integracion.md](verificamex_integracion.md) para integración técnica con Verificamex (opción principal).

### Selección de Proveedor KYC

El sistema **SHALL** permitir al proveedor elegir entre las tres opciones. La recomendación por defecto **SHALL** ser Verificamex por costo y simplicidad. La elección **SHALL** registrarse para métricas de uso.

| Criterio | Verificamex | Truora | Veriff |
|----------|-------------|--------|--------|
| Disponibilidad México | ✅ Nativa | ✅ | ✅ |
| Verifica INE directo | ✅ Lista Nominal | Parcial | Parcial |
| Costo por verificación | Bajo | Medio | Alto |
| Complejidad integración | Baja | Media | Media |

### Escenario: Proveedor elige verificación KYC remota

> DADO que un proveedor completa su registro
> CUANDO selecciona "Verificar en línea"
> ENTONCES **SHALL** elegir entre Truora, Veriff o Verificamex
> Y el proceso **SHALL** completarse de forma remota

## Verificación Voluntaria para Clientes

Los clientes **MAY** verificar su identidad voluntariamente. La verificación completada **SHALL** mostrar un badge en el perfil visible para otros usuarios.

| Aspecto | Descripción |
|---------|-------------|
| ¿Es obligatoria? | No — completamente voluntaria |
| Métodos disponibles | Mismos que proveedores (INE presencial o KYC remoto) |
| Beneficio | Badge de "Identidad verificada" visible en perfil |
| Visibilidad | Otros usuarios ven el badge en el perfil del verificado |

### Escenario: Cliente verifica identidad

> DADO que un cliente quiere verificar su identidad
> CUANDO completa el proceso de verificación
> ENTONCES su perfil **SHALL** mostrar badge de "Identidad verificada"

## Badges de Confianza

El sistema **SHALL** mostrar badges de verificación en perfiles de usuarios verificados.

| Badge | Quién lo muestra | Requisito |
|-------|-----------------|-----------|
| ✅ Identidad verificada | Proveedor | Verificación completada (INE presencial o KYC) |
| ✅ Identidad verificada | Cliente | Verificación voluntaria completada |

Los badges **SHALL** ser visibles en:
- Perfil del usuario
- Resultados de búsqueda (junto al nombre)
- Detalle de servicio (proveedor)
- Chat (antes del primer mensaje)

## Flujo de Verificación del Proveedor

La verificación del proveedor **SHALL** completarse **antes** de publicar servicios. El flujo depende del método elegido:

| Momento | Método INE presencial | Método KYC remoto |
|---------|----------------------|-------------------|
| Alta de registro | Selecciona "Verificar después" o "Verificar ahora" | Selecciona proveedor KYC |
| Durante proceso | Agenda cita → entrega INE → firma | Ingresa datos → espera respuesta API |
| Resultado | Verificado al completar firma | Verificado al recibir respuesta positiva |
| Bloqueo | No puede publicar hasta verificar | No puede publicar hasta verificar |

### Verificación vs. Publicación

> DADO que un proveedor completó su registro
> CUANDO intenta publicar un servicio sin verificación
> ENTONCES el sistema **SHALL** bloquear la publicación
> Y **SHALL** mostrar "Complete su verificación de identidad para publicar"

## Privacidad de Datos — LFPDPPP

El tratamiento de datos de identificación personal **SHALL** cumplir con la LFPDPPP. El sistema **SHALL**:

| Requisito | Implementación |
|-----------|---------------|
| Consentimiento explícito | Aviso de privacidad antes de iniciar verificación |
| Datos biométricos | **NO** se almacenan — solo se usan para cotejo en tiempo real |
| Logs de verificación | Solo metadatos: ID usuario, resultado, timestamp |
| Retención | Datos de INE no se conservan después de la verificación |
| Derechos ARCO | Usuario puede solicitar eliminación de datos de verificación |

> Los datos de INE (nombre, CURP, OCR) se procesan exclusivamente para la verificación y **NO SHALL** almacenarse permanentemente en la plataforma. Los logs contienen únicamente metadatos de auditoría.

→ Ver [→ normativa_mexicana_2026.md#ley-federal-de-protección-de-datos-personales-lfpdppp](normativa_mexicana_2026.md#ley-federal-de-protección-de-datos-personales-lfpdppp) para cumplimiento legal.
→ Ver [→ verificamex_integracion.md#seguridad-de-datos](verificamex_integracion.md#seguridad-de-datos) para seguridad en la integración con Verificamex.

## Documentos Relacionados

| Documento | Relación |
|-----------|----------|
| `roles_y_permisos.md` | Verificación como requisito de rol proveedor |
| `verificamex_integracion.md` | Integración técnica con API Verificamex |
| `normativa_mexicana_2026.md` | LFPDPPP — privacidad de datos de identificación |
| `flujo_de_reserva.md` | Firma presencial como parte del flujo de reserva |
| `interfaces_proveedor.md` | Estado de verificación en panel del proveedor |
