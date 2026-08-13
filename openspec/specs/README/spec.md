# README — Índice Maestro — Specification

## Purpose

Crear el documento índice que enlaza toda la documentación del producto: visión, glossario, tabla de decisiones (1-26), y navegación entre documentos.

## Requirements

### Requirement: Visión General del Producto

El README SHALL incluir una sección de visión que describa: qué es el producto, para quién, y cuál es el alcance del marketplace de eventos en México.

#### Scenario: Visión completa

- GIVEN que un usuario nuevo accede a la documentación
- WHEN abre el README
- THEN SHALL entender en 30 segundos: qué es, para quién, y dónde encontrar más información

### Requirement: Glossario

El README SHALL incluir glossario de términos clave del dominio: salón, sonido, servicio-persona, paquete colaborativo, bloque de horas, depósito de garantía, contrato físico, etc.

#### Scenario: Consulta de glossario

- GIVEN que un revisor encuentra un término desconocido
- WHEN consulta el glossario del README
- THEN SHALL encontrar definición clara y concisa del término

### Requirement: Tabla de Decisiones (1-26)

El README SHALL incluir tabla de decisiones de producto numerada (1-26). Cada fila SHALL mostrar: número de decisión, descripción breve, y enlace al documento donde se detalla.

#### Scenario: Tabla completa con 26 decisiones

- GIVEN que un revisor quiere verificar cobertura
- WHEN revisa la tabla de decisiones
- THEN SHALL ver las 26 decisiones numeradas con enlace a documento correspondiente
- AND las decisiones 24-26 SHALL ser: Precios dinámicos feature MVP, Permiso alcohol SLRC Sonora, Modo aprobación editable post-setup

#### Scenario: Decisión sin documentar

- GIVEN que una decisión no tiene documento asociado
- WHEN se revisa la tabla
- THEN SHALL mostrar "⚠️ Pendiente de documentar" en la columna de documento

### Requirement: Navegación entre Documentos

El README SHALL proporcionar enlaces a los 16 documentos del producto. Los documentos SHALL seguir orden de dependencia: vision → roles → taxonomía → flujos → interfaces → soporte.

#### Scenario: Navegación por dependencias

- GIVEN que un revisor quiere entender el producto completamente
- WHEN sigue el orden de navegación del README
- THEN SHALL poder leer documentos en secuencia lógica sin saltos

### Requirement: Estado y Versión

El README SHALL mostrar estado de cada documento (completo/parcial) y versión (1.1). La tabla SHALL actualizarse cuando se modifique un documento.

#### Scenario: Verificación de versión

- GIVEN que un revisor quiere saber la versión actual de la documentación
- WHEN revisa el README
- THEN SHALL ver versión 1.1
- AND SHALL ver las 26 decisiones documentadas (100%)

### Requirement: Stack de Implementación

El README SHALL incluir una sección que documente el stack de implementación futura: Next.js + Firebase, conforme a la decisión humana de revisión de simplificaciones.

#### Scenario: Stack documentado en README

- GIVEN que un revisor consulta el README
- WHEN busca información técnica
- THEN SHALL encontrar sección "Stack de Implementación Futura" con Next.js + Firebase
- AND SHALL tener enlace a areas_de_simplificacion.md y vision_y_alcance.md para contexto
