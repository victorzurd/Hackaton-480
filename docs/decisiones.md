# Decisiones del proyecto — Equipo B

Tres decisiones clave: qué hemos decidido, qué alternativas había y por qué elegimos esta. El detalle técnico está en [SPEC.md](../SPEC.md).

---

## 1. Stack tecnológico

**Decisión:** un monolito con web responsive (HTML, CSS y TypeScript) en el frontend, servidor Express (Node.js + TypeScript) que incluye el sistema RAG, base de datos PostgreSQL y todo levantado en local con Docker Compose.

**Alternativas:** app móvil nativa, un framework de frontend como React, Java con Spring Boot para el backend, Supabase como base de datos y autenticación gestionadas, o separar el servidor en microservicios.

**Por qué:** el cliente acepta una web responsive, y sin framework la página pesa poco y carga rápido en 4G. Con TypeScript en frontend y backend todo el equipo usa el mismo lenguaje. Java con Spring Boot es una opción sólida para producción, pero obligaba a trabajar con dos lenguajes y requiere más configuración inicial, algo que no compensa en un prototipo de una semana. Para un MVP, un único servidor es más rápido de construir que varios servicios. Al principio elegimos Supabase, pero lo cambiamos por PostgreSQL en Docker. Así cualquiera arranca el proyecto con un solo comando, y el servidor queda preparado para integrarse después con los servicios de 480.

---

## 2. Modelo y proveedor de IA

**Decisión:** **Google Gemini Flash**, por su API de pago, para el Tutor, el Selector de repaso, el Guionista de podcast y el evaluador del examen inicial. Ninguna respuesta libre del alumno llega a Gemini sin pasar por el servicio de protección de datos.

**Alternativas:** modelos más potentes y caros (variantes "Pro" o equivalentes de otros proveedores), NotebookLM para generar los podcasts, o un modelo abierto ejecutado en local.

**Por qué:** las tareas trabajan con texto (transcripciones, errores, preguntas y respuestas del diagnóstico) y no necesitan un modelo grande, así que Flash da respuestas rápidas a un coste de unos 0,99 $ por alumno y mes (apartado 9 del SPEC). Descartamos NotebookLM porque el guion del podcast lo puede hacer el mismo modelo, sin añadir otro proveedor. Un modelo local evitaba sacar datos fuera, pero necesita hardware que no tenemos. Usamos la API de pago y minimizamos y filtramos las respuestas del alumno antes de enviarlas; Gemini nunca recibe nombre, email ni identificador real.

---

## 3. Decisión de producto que más condiciona la solución

**Decisión:** **los errores del alumno en los tests son el eje de toda la solución.** Cada pregunta guarda su concepto y el minuto del vídeo que la explica, y cada fallo alimenta los vídeos cortos de repaso, el tutor IA y el seguimiento del tutor.

**Alternativas:** medir solo el examen final, como hace hoy 480 Academy, o generar las preguntas automáticamente con IA.

**Por qué:** responde al problema "no sabemos si el alumno aprende" y da a la IA un contexto concreto sobre el alumno sin usar datos personales. Esta decisión condiciona el modelo de datos (preguntas con concepto y minuto, respuestas con acierto), el alcance (los tests son imprescindibles porque sin ellos no hay errores que usar) y la forma de crear contenido. Las preguntas se escriben a mano en vez de generarlas con IA, para que el concepto y el minuto sean fiables y el coste se mantenga bajo.

---

## 4. Examen inicial e itinerario

**Decisión:** al inscribirse en un curso, el alumno completa una única evaluación inicial con preguntas abiertas de todos los contenidos, ejemplos visuales y opción de dictado por voz. No cuenta como nota. Gemini analiza las respuestas filtradas, decide qué contenidos domina y devuelve el orden de módulos; el servidor valida y aplica el resultado. El examen inicial no aparece como paso dentro del árbol del itinerario.

**Por qué:** la evaluación ocurre antes de empezar el recorrido y permite que tanto el orden de módulos como el de contenidos respondan a los conocimientos previos del alumno. Los tests asociados al aprendizaje sí se muestran junto a sus contenidos dentro del árbol.
