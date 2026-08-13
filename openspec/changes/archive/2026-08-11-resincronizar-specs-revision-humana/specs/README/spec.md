# Delta for README

## MODIFIED Requirements

### Requirement: Tabla de Decisiones (1-26)

El README SHALL incluir tabla de decisiones de producto numerada (1-26). Cada fila SHALL mostrar: número de decisión, descripción breve, y enlace al documento donde se detalla.

(Previously: tabla de decisiones numerada 1-23)

#### Scenario: Tabla completa con 26 decisiones

- GIVEN que un revisor quiere verificar cobertura
- WHEN revisa la tabla de decisiones
- THEN SHALL ver las 26 decisiones numeradas con enlace a documento correspondiente
- AND las decisiones 24-26 SHALL ser: Precios dinámicos feature MVP, Permiso alcohol SLRC Sonora, Modo aprobación editable post-setup

#### Scenario: Decisión sin documentar

- GIVEN que una decisión no tiene documento asociado
- WHEN se revisa la tabla
- THEN SHALL mostrar "⚠️ Pendiente de documentar" en la columna de documento

### Requirement: Estado y Versión

El README SHALL mostrar estado de cada documento (completo/parcial) y versión (1.1). La tabla SHALL actualizarse cuando se modifique un documento.

(Previously: versión 1.0)

#### Scenario: Verificación de versión

- GIVEN que un revisor quiere saber la versión actual de la documentación
- WHEN revisa el README
- THEN SHALL ver versión 1.1
- AND SHALL ver las 26 decisiones documentadas (100%)

## ADDED Requirements

### Requirement: Stack de Implementación

El README SHALL incluir una sección que documente el stack de implementación futura: Next.js + Firebase, conforme a la decisión humana de revisión de simplificaciones.

#### Scenario: Stack documentado en README

- GIVEN que un revisor consulta el README
- WHEN busca información técnica
- THEN SHALL encontrar sección "Stack de Implementación Futura" con Next.js + Firebase
- AND SHALL tener enlace a areas_de_simplificacion.md y vision_y_alcance.md para contexto
