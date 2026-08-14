---
title: "Roles y Permisos"
estado: completo
version: "1.1"
fecha: "2026-08-11"
fuentes:
  - openspec/changes/documentacion-producto-eventos/specs/roles-y-permisos/spec.md
  - openspec/changes/documentacion-producto-eventos/proposal.md
---

# Roles y Permisos

El sistema define tres roles con permisos claramente delimitados: Usuario (cliente), Prestador de servicio (proveedor) y Administrador. Cada rol tiene un alcance específico sin ambigüedad.

## Roles

### Usuario (Cliente)

El rol de usuario permite interactuar con el marketplace como consumidor de servicios.

| Permiso | Descripción |
|---------|-------------|
| Explorar | Navegar catálogo de servicios, ver fotos, descripciones, precios |
| Buscar | Filtrar por tipo, ubicación, precio, fecha, disponibilidad |
| Reservar | Crear reservas, seleccionar bloques de horas, aceptar contratos |
| Pagar | Realizar pagos vía Conekta (anticipo, saldo, depósito) |
| Calificar | Evaluar proveedores post-pago con calificación numérica y comentario |
| Chatear | Enviar mensajes de texto a proveedores |
| Crear paquete | Unirse como miembro a paquetes colaborativos (no como líder) |

### Prestador de Servicio (Proveedor)

El rol de prestador permite ofrecer y gestionar servicios en el marketplace.

| Permiso | Descripción |
|---------|-------------|
| Crear servicio | Publicar salón, equipo de sonido o servicio-persona |
| Configurar precios | Definir bloque de horas, extras, tarifas y ajustes dinámicos (temporada, demanda, día — → ver [→ taxonomia_de_servicios.md#precios-dinámicos—capacidad-del-proveedor-supuesto-3](taxonomia_de_servicios.md#precios-dinámicos—capacidad-del-proveedor-supuesto-3)) |
| Gestionar agenda | Definir horarios disponibles, bloquear fechas, configurar inventario por slot (→ ver [→ taxonomia_de_servicios.md#concurrencia](taxonomia_de_servicios.md#concurrencia)) |
| Aceptar reservas | Responder solicitudes de reserva (inmediato o aprobación manual) |
| Cobrar | Recibir pagos a través de la plataforma |
| Crear paquete | Crear paquetes colaborativos como salón líder |
| Invitar proveedores | Enviar invitaciones a otros proveedores para unirse a paquetes |
| Chatear | Enviar y recibir mensajes de clientes |

### Administrador

El rol de administrador tiene **exactamente 5 funciones**. El administrador **SHALL NO** ofrecer soporte al cliente ni mediación de disputas comerciales.

| # | Función | Alcance |
|---|---------|---------|
| 1 | Moderación de contenido | Aprobar, advertir o eliminar contenido reportado por usuarios |
| 2 | Gestión de proveedores | Bloquear/desbloquear proveedores, revisar quejas |
| 3 | Estadísticas globales | Métricas de plataforma: reservas, ingresos, crecimiento |
| 4 | Disputas técnicas | Resolver problemas técnicos (errores de sistema, pagos fallidos). **NO** disputas comerciales entre cliente y proveedor |
| 5 | Comisión global | Configurar porcentaje de comisión de la plataforma |

> Ejemplo de límite: Si un cliente reporta que el proveedor no entregó el servicio acordado, esto es disputa **comercial** → el sistema redirige al proveedor. Si el pago falló por error técnico, esto es disputa **técnica** → el administrador interviene.

## Verificación de Identidad

La verificación de identidad es **obligatoria** para prestadores de servicio y **voluntaria** para clientes.

| Método | Para quién | Descripción |
|--------|------------|-------------|
| INE presencial | Prestadores | Firma física de identificación oficial en punto de verificación |
| KYC remoto (Truora/Veriff/Verificamex) | Prestadores | Verificación en línea vía APIs de terceros |
| INE presencial | Clientes (opcional) | Mismo proceso que prestadores, en modalidad voluntaria |

Los clientes verificados mostrarkan un **badge de verificación** visible en su perfil.

→ Ver [→ verificacion_de_identidad.md](verificacion_de_identidad.md) para detalle de integración con APIs KYC.

## Sistema de Ranking

El ranking de proveedores se calcula con **tres métricas**:

| # | Métrica | Fórmula | Visible en |
|---|---------|---------|------------|
| 1 | Tasa de respuesta | (Mensajes respondidos / Mensajes recibidos) × 100 | Búsqueda, perfil |
| 2 | Tasa de aceptación | (Reservas aceptadas / Reservas solicitadas) × 100 | Búsqueda, perfil |
| 3 | Calificación promedio | Promedio de calificaciones post-pago (1-5 estrellas) | Búsqueda, perfil |

Las tres métricas **SHALL** actualizarse automáticamente después de cada reserva completada. El ranking **SHALL** ser visible al cliente en resultados de búsqueda y en el perfil del proveedor.

| Escenario | Comportamiento esperado |
|-----------|------------------------|
| Proveedor completa reserva exitosa | Ranking se actualiza al registrarse calificación del cliente |
| Cliente busca servicios | Cada resultado muestra las 3 métricas del proveedor |
| Proveedor con 0 reservas | Métricas muestran "Sin datos" en lugar de 0 |

## Alcance del Administrador — Supuesto 5

El alcance del administrador está definido por el supuesto 5 del proposal:

> **Supuesto**: Alcance del rol Administrador se limita a: moderación contenido, proveedores bloqueados, stats globales, disputas técnicas (no comerciales), comisión global. **NO** incluye soporte al cliente.

Este supuesto fue **validado por revisión humana** (2026-08-11): se confirma que **no se incluye soporte al cliente**. Si en el futuro se requiere soporte al cliente, se crearía un rol adicional (no se extiende el de administrador).

## Documentos Relacionados

| Documento | Relación |
|-----------|----------|
| `vision_y_alcance.md` | Segmentos y modelo de ingresos |
| `taxonomia_de_servicios.md` | Configuración de precios por tipo de servicio |
| `verificacion_de_identidad.md` | Métodos de verificación detallados |
| `interfaces_proveedor.md` | Panel de administración y herramientas |
| `flujo_de_reserva.md` | Estados de reserva y flujos por rol |
