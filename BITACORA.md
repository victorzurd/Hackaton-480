# Bitácora – 480 Academy | Equipo B

Registro cronológico de la evolución del proyecto.

---

## 25-11-2026 – Avances de desarrollo e integración del equipo

**Responsables:** Víctor, Alex, Iker y Jordi  
**Área:** Frontend, Backend, IA y Documentación  
**Tipo:** Desarrollo e integración

### Objetivo
Avanzar en la implementación de las funcionalidades principales de 480 Academy e integrar los primeros desarrollos y documentación en la rama principal del repositorio.

### Trabajo realizado

**Víctor – Desarrollo**
- Implementación de las interfaces de inicio de sesión y creación de cuentas.
- Adaptación de las pantallas de autenticación a dispositivos móviles mediante TypeScript.
- Incorporación de filtros para el nombre del alumno.
- Desarrollo del catálogo y selector de cursos.
- Subida de un curso de prueba.
- Creación de `CONTEXTO_IA.md`y `DIRECTRICES_DISENO_VISUAL_IA.md`para dar contexto a la IA y mantener cohesión con el proyecto.
- Envío del correo a 480 con el enlace de Github del proyecto y las diferentes fotos de la documentación rellenada durante la primera jornada presencial del Hackadō.

**Alex – IA y protección de datos**
- Desarrollo de un servicio de protección de datos para el tratamiento de información mediante IA.
- Implementación de mecanismos de seudonimización de sesiones.
- Incorporación de filtros para detectar y proteger nombres, correos electrónicos, teléfonos y documentos personales.
- Preparación de pruebas para el backend.
- Documentación de los mecanismos de protección de datos.
- Incorporación de capturas de los mockups a los flujos de alumnos.

**Jordi – Diseño, prototipado y bitácora**
- Incorporación de los archivos del prototipo generado mediante Figma Make al repositorio, como referencia visual y funcional para el equipo de desarrollo.
- Registro en la bitácora.

### Integración y control de versiones
- Integración en `main` de las Pull Requests correspondientes a los desarrollos de autenticación, protección de datos y selector de cursos.

### Problemas o incidencias
No se registran incidencias concretas durante esta fase.

### Próximos pasos
- Continuar el desarrollo e integración de las funcionalidades pendientes.
- Validar el funcionamiento del registro, inicio de sesión y selector de cursos.
- Revisar la integración del servicio de protección de datos con las funcionalidades de IA.
- Conectar las interfaces con la base de datos.
- Mantener actualizada la documentación técnica y funcional.

---



---

## 24-11-2026 – Conceptualización del prototipo y primeros desarrollos

**Responsables:** Víctor, Iker y Jordi  
**Área:** Diseño UX/UI, Frontend, Backend y Documentación  
**Tipo:** Diseño, planificación y desarrollo

### Objetivo
Definir la experiencia de usuario y las principales funcionalidades de 480 Academy, avanzar en el diseño del prototipo y establecer las primeras bases técnicas y documentales del proyecto.

### Trabajo realizado

**Jordi – Diseño UX/UI y prototipado**
- Exploración de Figma Make para la generación del prototipo mediante IA.
- Definición de la estructura inicial de pantallas y flujos de navegación.

**Víctor – Desarrollo**
- Incorporación de la estructura inicial de la base de datos `Database.sql`.
- Actualización de las historias de usuario y especificaciones funcionales en `SPEC.md`.
- Configuración de Github Projects, creación de tareas y asignación.
- Preparación del entorno de desarrollo mediante Docker y Docker Compose para facilitar la ejecución local del proyecto.

**Iker – Documentación**
- Creación de `CONTRIBUTING.md` con las primeras pautas de colaboración y contribución al repositorio.
- Creación de `docs/decisiones.md` para registrar las decisiones técnicas y organizativas del proyecto.

### Decisiones y planteamientos
- Se cambia SupaBase por PostgreSQL.
- Mantener una identidad visual coherente con Cuatroochenta.
- Establecer una documentación común para facilitar la colaboración y el seguimiento de los cambios.

### Integración y control de versiones
- Incorporación a `main` de los primeros cambios relacionados con la base de datos, las historias de usuario y la documentación de colaboración y decisiones técnicas.
- Sincronización de los cambios de la rama principal mediante Git.

### Revisión y validación
- El equipo revisa y aprueba la estructura de la Base de Datos.

### Coordinación y entorno de desarrollo
- Se acuerda avanzar con la containerización del proyecto mediante Docker.

### Problemas o incidencias
No se registran incidencias concretas durante esta fase.

### Próximos pasos
- Completar los mockups y las pantallas del prototipo.
- Validar los flujos de navegación.
- Continuar el desarrollo del backend y la estructura de datos.
- Concretar el comportamiento de las funcionalidades de IA y del formato pódcast.

---



---

## 23-11-2026 – Planteamiento inicial del proyecto

**Responsables:** Víctor, Alex, Iker y Jordi  
**Área:** General  
**Tipo:** Planificación y documentación

### Objetivo
Definir el planteamiento inicial de la aplicación web para participar en el Hackadō.

### Trabajo realizado
- Definición inicial del stack tecnológico.
- Definición de la propuesta de solución y sus principales funcionalidades.
- Organización del equipo y distribución inicial de responsabilidades.
- Creación del repositorio en GitHub.
- Diseño de los primeros wireframes.
- Planteamiento de la arquitectura de la aplicación.
- Identificación de las posibles herramientas de IA que se utilizarán.

### Decisiones tomadas

**1. Stack tecnológico**

Se propone una arquitectura monolítica con una aplicación web responsive:

- **Frontend:** HTML, CSS y TypeScript.
- **Backend:** Express (Node.js + TypeScript), incluyendo el sistema RAG.
- **Base de datos:** Supabase.
- **Entorno de ejecución:** Docker Compose en local.

**2. Propuesta funcional**

Partiendo de la problemática detectada en 480 Academy —la baja tasa de consumo de los vídeos formativos, la dificultad para interiorizar los conocimientos antes de los exámenes y la limitada disponibilidad de tutores para ofrecer apoyo individualizado—, se plantea una solución basada en los siguientes pilares:

- **Evaluación inicial personalizada:** test de nivel para identificar los conocimientos que el alumno ya domina y adaptar su itinerario formativo.
- **Evaluación continua:** incorporación de cuestionarios durante los contenidos formativos y al finalizar las lecciones.
- **Tutor de IA:** asistente capaz de resolver dudas, explicar conceptos y ayudar al alumno a comprender sus errores.
- **Formato pódcast:** alternativa de consumo de los contenidos mediante audio.

**3. Organización del equipo**

Se establecen WhatsApp y Discord como canales de comunicación y coordinación.

Distribución inicial de responsabilidades:

| Integrante | Responsabilidades |
|---|---|
| Jordi | Frontend, bitácora (BITACORA.md), interfaz de preguntas y cuestionarios, borrador de la presentación. |
| Alex | Integración de IA y desarrollo del tutor de IA. |
| Víctor | Backend, base de datos y cuestionario inicial. |
| Iker | Backend, base de datos, sección de reels y documentación (CONTRIBUTING.md, docs/decisiones.md). |

**4. Arquitectura**

Se plantea un servidor centralizado que concentre la lógica de negocio y gestione la comunicación entre los usuarios, la base de datos, los modelos de IA y los servicios externos.

**5. Inteligencia artificial**

Se contempla utilizar Google Gemini Flash como modelo de IA para las funcionalidades inteligentes de la aplicación.

### Problemas o incidencias
No se registran incidencias durante esta fase.

### Próximos pasos
- Desarrollar los mockups y definir el flujo de navegación del usuario.
- Ampliar la documentación técnica y funcional.
- Concretar las tecnologías y servicios de IA definitivos.
- Comenzar el desarrollo del prototipo.

---