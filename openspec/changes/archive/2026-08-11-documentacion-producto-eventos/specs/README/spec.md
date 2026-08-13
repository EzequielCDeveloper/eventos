# README — Índice Maestro — Specification

## Purpose

Crear el documento índice que enlaza toda la documentación del producto: visión, glossario, tabla de decisiones (1-23), y navegación entre documentos.

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

### Requirement: Tabla de Decisiones (1-23)

El README SHALL incluir tabla de decisiones de producto numerada (1-23). Cada fila SHALL mostrar: número de decisión, descripción breve, y enlace al documento donde se detalla.

#### Scenario: Tabla completa

- GIVEN que un revisor quiere verificar cobertura
- WHEN revisa la tabla de decisiones
- THEN SHALL ver las 23 decisiones numeradas con enlace a documento correspondiente

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

El README SHALL mostrar estado de cada documento (completo/parcial) y versión (1.0). La tabla SHALL actualizarse cuando se modifique un documento.

#### Scenario: Verificación de estado

- GIVEN que un revisor quiere saber qué documentos están completos
- WHEN revisa la tabla de estado
- THEN SHALL ver indicador de estado para cada documento
