# Proposal: Documentación Completa de Producto — App Eventos

## Intent

El proyecto tiene ~10% de cobertura de las 23 decisiones de producto. Existencia de 2 archivos skeleton (`eventos.md`, `arquitectura_interfaz_proveedores_eventos.md`) y 3 errores de consistencia. Se requiere documentación completa, estructurada y verificable que cubra negocio, flujos, interfaces, pagos, cancelaciones, verificación, normativa y simplificaciones del MVP.

## Scope

### In Scope
- 16 documentos estructurados en `snake_case` español, autocontenidos con cross-referencias
- `README.md` como índice maestro (visión, glossario, tabla de decisiones 1–23)
- Resolución documentada de los 10 loose ends como asunciones validables
- Archivo dedicado `areas_de_simplificacion.md` (User note B)
- Archivo dedicado `normativa_mexicana_2026.md` (User note C)
- Archivo dedicado `verificamex_integracion.md` (User note A + Decision 22)
- Corrección de 3 errores: role mismatch "Administrador", label "asesorado", contradicción concurrencia salón
- Preservación del contenido válido de `arquitectura_interfaz_proveedores_eventos.md` (dashboard 5 tabs, onboarding wizard)

### Out of Scope
- Código fuente, endpoints, esquemas de BD
- Cambios a `eventos.md` o `arquitectura_interfaz_proveedores_eventos.md` (se reescriben como parte del cambio, no se parchean)
- Investigación legal en vivo — se documenta estado conocido 2026 con disclaimer
- Testing automatizado (sin test runner en el proyecto)

## Capabilities

### New Capabilities
- `vision-y-alcance`: MVP, segmentos, modelo ingresos, alcance marketplace
- `roles-y-permisos`: Roles, permisos, verificación, ranking, admin scope
- `taxonomia-de-servicios`: Tipos (salón, sonido, servicio-persona), categorías, extras
- `paquetes-colaborativos`: Paquete completo, líder salón, invitación, disponibilidad cruzada
- `flujo-de-reserva`: Bloques horas, paquete completo, contrato físico, firma, permisos
- `pagos-y-comisiones`: Conekta, comisión, tarifa app, impuestos, depósito, cobro flexible
- `cancelaciones-y-reembolsos`: Políticas por actor, tiempos, retención, devolución
- `mensajeria`: Chat texto/voz/video, MVP notas de voz, automatizaciones
- `notificaciones`: 14+ tipos, triggers, canales
- `verificacion-de-identidad`: INE presencial, KYC APIs, Verificamex, Lista Nominal
- `interfaces-cliente`: Explorar, buscar, filtros, detalle, favoritos, rentas, perfil
- `interfaces-proveedor`: Onboarding, dashboard 5 tabs, agenda, configuración, calendario
- `areas-de-simplificacion`: Trade-offs explícitos, qué NO se hace en MVP
- `normativa-mexicana-2026`: Ley Federal Protección Datos, CNBV, Ley Consumer, permisos alcohol
- `verificamex-integracion`: Detalle técnico integración: API, Lista Nominal, flujo, errores

### Modified Capabilities
- `README` (índice maestro): Nuevo — crea `openspec/specs/README/spec.md` con visión, glossario, tabla de decisiones

## Approach

Documentación estructurada en español neutro/profesional. Cada documento: lead with answer, progressive disclosure, chunking, tablas/checklists sobre prosa para reglas. Cross-referencias entre docs pero cada uno autocontenido. Dependencias de lectura: vision → roles → taxonomía → flujos → interfaces → soporte.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `eventos.md` | Reemplazado | Se eliminan los 2 docs skeleton, se reescriben en estructura nueva |
| `arquitectura_interfaz_proveedores_eventos.md` | Reemplazado | Contenido válido migrado a `interfaces_proveedor.md` |
| `openspec/specs/` | New | 16 specs nuevos (1 capability cada uno) |
| `openspec/changes/documentacion-producto-eventos/` | Modified | exploration.md existente + proposal.md nuevo |

## 10 Supuestos (Loose Ends Resueltos)

| # | Supuesto | Resolución | A Validar |
|---|----------|------------|-----------|
| 1 | Viáticos por KM | Campo opcional configurable por proveedor (tarifa por KM fuera de zona), sin validación de zona en MVP | Sí — confirmar que no se requiere cálculo automático |
| 2 | Reserva inmediata vs. aprobación manual | Cada proveedor elige en su alta; defecto del sistema: aprobación manual para salones, inmediata para servicios simples | Sí — confirmar defaults |
| 3 | Precios dinámicos (surge/seasonal) | Fuera de MVP; precio fijo por configuración del proveedor | Sí — confirmar que no se documenta como futuro |
| 4 | Mínimo de fotos en alta de servicio | 5 fotos obligatorias | Sí — confirmar cantidad |
| 5 | Alcance del rol Administrador | MKP: moderación contenido, proveedores bloqueados, stats globales, disputas técnicas (no comerciales), comisión global | Sí — confirmar que no incluye soporte al cliente |
| 6 | Mecanismo de concurrencia sonidos/servicios | Campo numérico simple en alta (máx. eventos simultáneos por fecha), sin lógica de inventario fino | Sí — confirmar que no se requiere calendario de inventario |
| 7 | Depósito × cancelación | Orden: anticipo (no reembolsable) → depósito (reembolsable según política); cancelación proveedor devuelve TODO | Sí — confirmar orden de aplicación |
| 8 | Ceremonia del contrato físico | Pasos: agendar cita (app), firma presencial, confirmación bilateral en app (cada parte marca), estado PENDIENTE hasta doble confirmación | Sí — confirmar flujo bilateral |
| 9 | Permiso de alcohol >H-5 sin confirmación | Notificación push+email, usuario elige continuar o cancelar; si cancela, aplica política del proveedor | Sí — confirmar que no es cancelación automática |
| 10 | Notas de voz | Límite 2 min por nota, sin transcripción en MVP | Sí — confirmar límite y que transcripción es futuro |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Investigación Verificamex incompleta (API real) | High | Documentar flujo conceptual con disclaimer; verificar API en apply |
| Normativa mexicana 2026 puede estar desactualizada | High | Citar fuentes con fecha; marcar como "estado conocido" con fecha de consulta |
| Contrato físico altamente operacional — UX difícil de documentar solo | Medium | Diagrama de secuencia en design phase; validación con usuario |
| Cancelación × depósito — edge cases implícitos | Medium | Tabla de escenarios exhaustiva en `cancelaciones_y_reembolsos.md` |
| Admin role scope creep | Low | Definición explícita de 5 funciones, sin ambigüedad |

## Rollback Plan

Eliminar los 16 documentos nuevos en `openspec/specs/` y `eventos.md`/`arquitectura_interfaz...` originales restaurados desde git (si se versiona). Los docs skeleton originales se preservan como `eventos_legacy.md` y `arquitectura_legacy.md` durante la fase de apply.

## Success Criteria

- [ ] Cobertura de las 23 decisiones: 100% (cada decisión mapeada a ≥1 documento)
- [ ] 0 contradicciones internas entre documentos
- [ ] Cada documento con estado (completo/parcial) y versión (1.0)
- [ ] Los 10 supuestos documentados en `areas_de_simplificacion.md` con checkbox de validación
- [ ] README.md con tabla de decisiones completa (23 filas)
- [ ] `verificamex_integracion.md` con flujo técnico documentado
- [ ] `normativa_mexicana_2026.md` con referencias legales citadas
