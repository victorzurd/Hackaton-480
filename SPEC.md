# SPEC: Paquete de diseño

## Índice

1. [El alumno y su problema](#1-el-alumno-y-su-problema)
2. [Flujo del alumno](#2-flujo-del-alumno)
3. [Respuesta a los problemas](#3-respuesta-a-los-problemas)
4. [Historias de usuario](#4-historias-de-usuario)
5. [Arquitectura](#5-arquitectura)
6. [Modelo de datos y flujo hacia la IA](#6-modelo-de-datos-y-flujo-hacia-la-ia)
7. [Agentes de IA](#7-agentes-de-ia)
8. [Contenido](#8-contenido)
9. [Coste](#9-coste)
10. [Idea original](#10-idea-original)
11. [Alcance para el 30/11](#11-alcance-para-el-3011)


## 1. El alumno y su problema

Ahora mimso el alumnado no se ve los videos enteros dado al problema de la experiencia de usuario, la interfaz, formato tradicional sin personalización adaptada a cada alumno


## 2. Flujo del alumno


- **Inicio:** el alumno ve sus cursos, módulos y progreso.
- **Encuesta inicial:** responde una sola vez por módulo para detectar lo que ya sabe.
- **Itinerario:** ve qué contenidos debe hacer y cuáles se salta, y puede recuperar los saltados.
- **Contenido:** ve el vídeo o escucha el podcast y elige si responde durante el contenido o al final.
- **Resultados:** ve sus aciertos, sus fallos y la explicación de cada pregunta.
- **Repaso:** ve vídeos cortos verticales sobre lo que ha fallado.
- **Tutor IA:** habla por voz con un tutor que conoce sus errores.


## 3. Respuesta a los problemas


## Problema 1
El formato tradicional de videos en la epoca actual del contenido vertical y rápido hace que los alumnos no completen los videos del módulo y los salten.

### Corrección
- Generación de podcast a partir de videos para usar como metodo de estudio y videos rápidos verticales editados automáticamente mediante IA de los fallos en encuestas/tests de los vídeos.


## Problema 2:
Los alumnos no tienen atención cercana ni personalizada de un tutor responsable.

### Corrección
- Generación de llamada de voz en directo mediante lenguaje natural con un tutor IA con los datos del usuario y información de sus errores en encuestas/test


## Problema 3:
No se sabe si el alumno aprende ya que solo se hace un examen al final

### Corrección
- Se harán encuestas/test dinámicos en los videos/podcasts para poder comprobar si el usuario ha entendido los conocimientos de esa parte del módulo, podrá elegir si en la parte del vídeo contestar a esa pregunta o a todas al final


## Problema 4:
Los itineratrios son iguales para todos, quien sabe conocimiento de parte del módulo tiene que ver videos que ya sabe el contenido

### Corrección
- Realizar una unica encuesta de personalización de contenido al empezar cada módulo para saber si es conocedor de parte de contenido del módulo 
para saltar videos y encuestas 


## 4. Historias de usuario

<!-- Entre 5 y 8, con prioridad y criterios de aceptación. -->

| Como... | Quiero... | Para... | Prioridad (imprescindible / deseable / fuera) | Criterios de aceptación |
| --- | --- | --- | --- | --- |
| alumno | hacer una única encuesta al empezar cada módulo | saltarme los vídeos y tests de lo que ya sé | imprescindible | La encuesta aparece una sola vez por módulo, al terminar se ve qué contenidos se saltan y el alumno puede recuperar cualquiera de ellos |
| alumno | responder preguntas durante el vídeo o todas al final | comprobar si he entendido cada parte | imprescindible | El alumno elige el modo antes de empezar, las preguntas tratan sobre la parte ya vista, tras responder ve si ha acertado y por qué, el resultado se guarda |
| alumno | hablar por voz en directo con un tutor IA que conozca mis errores | resolver dudas con atención personalizada | imprescindible | Se inicia desde el módulo, el tutor usa los fallos guardados del alumno, se basa en el contenido del curso y avisa si no sabe la respuesta |
| alumno | que mis datos personales estén protegidos antes de llegar a la IA | usar el tutor con confianza | imprescindible | Toda petición pasa por el servicio de protección de datos, nombre y email no llegan al LLM, si el servicio falla, no se envía nada |
| alumno | recibir vídeos cortos verticales sobre lo que he fallado | repasar rápido sin volver a ver el vídeo entero | deseable | Se proponen a partir de las preguntas falladas, formato vertical y máximo 60 s, enlazan con el momento del vídeo original |
| alumno | escuchar un podcast generado a partir de los vídeos | estudiar sin tener que mirar la pantalla | deseable | El audio se basa en las transcripciones del módulo, se puede pausar y continuar, permite responder los tests al final |
| tutor | ver el progreso y los errores de cada alumno | saber quién necesita ayuda sin esperar al examen final | deseable | Muestra progreso y tests por alumno, destaca los conceptos más fallados, cada tutor solo ve a sus alumnos |

## 5. Arquitectura

```mermaid
flowchart LR
    cliente["Cliente"]

    subgraph monolito["Monolito"]
        servidor["Servidor"]
        rag["Sistema RAG"]
    end

    bd[("PostgreSQL")]
    proteccion["Servicio de protección de datos"]
    llm["Google Gemini Flash"]
    empresas["Empresas externas"]
    otros["Otros servicios 480"]

    cliente <--> servidor
    servidor <--> bd
    servidor <--> rag
    rag <--> bd
    servidor <--> proteccion
    rag -->|"contexto para la IA"| proteccion
    proteccion <--> llm
    servidor <-->|"API pública"| empresas
    servidor <--> otros
```

Para un MVP, un único servidor concentra la lógica y conecta al cliente con los datos, la IA y los servicios externos. Es una arquitectura rápida de construir y conterizar con Docker.

- **Cliente:** interfaz donde el alumno ve vídeos, escucha podcasts, responde tests/examenes y hace tutor-IA.
- **Servidor:** Gestiona usuarios, cursos, encuestas, tests y progreso, y coordina las peticiones a la IA con un servicio intermediario para no revelar datos sensibles a la IA.
- **PostgreSQL:** guarda los usuarios, los módulos, las transcripciones, las respuestas y el progreso.
- **Sistema RAG:** módulo del monolito que recupera de PostgreSQL las transcripciones del módulo, los errores del alumno y la lista de columnas permitidas para que la IA responda a medida (detalle en el apartado 6).
- **Servicio de protección de datos:** paso obligatorio entre el servidor y el LLM. Elimina o seudonimiza los datos personales antes de enviarlos a la IA.
- **LLM (Google Gemini, modelo Flash):** selecciona los fragmentos de repaso, escribe los guiones de podcast y da respuesta al alumno como tutor IA. Solo recibe datos ya protegidos.
- **Empresas externas:** se conectan con el servidor mediante una API pública.
- **Otros servicios 480:** otros sistemas de 480 con los que el servidor intercambia información.

## 6. Modelo de datos y flujo hacia la IA

### Entidades principales

| Entidad | Datos principales | Relaciones |
| --- | --- | --- |
| Usuario | id, nombre, email, rol (alumno / tutor) | Un tutor tiene varios alumnos |
| Curso | id, título, descripción | Tiene varios módulos |
| Módulo | id, título, orden | Pertenece a un curso y tiene varios contenidos |
| Contenido | id, tipo (vídeo / podcast / vídeo corto), título, URL, transcripción | Pertenece a un módulo. El podcast y el vídeo corto se generan a partir de vídeos |
| Pregunta | id, tipo (encuesta inicial / test), enunciado, opciones, respuesta correcta, explicación, concepto, minuto | Pertenece a un módulo y, si es de test, a un contenido |
| Respuesta | id, respuesta, acierto, fecha | Une a un alumno con una pregunta |
| Progreso | estado (pendiente / completado / saltado), fecha | Une a un alumno con un contenido |
| Sesión de tutoría | id, fecha, duración, resumen | Pertenece a un alumno y a un módulo |

### Datos del alumno que salen hacia la IA

| Dato | ¿Sale hacia la IA? | Para qué |
| --- | --- | --- |
| Nombre y email | No | No son necesarios |
| Identificador real del alumno | No | No es necesario |
| Preguntas falladas y conceptos asociados | Sí | Personalizar el tutor y los vídeos cortos |
| Resultado de la encuesta inicial | Sí | Adaptar las explicaciones a lo que ya sabe |
| Módulo y contenido actual | Sí | Dar contexto al tutor |
| Lo que dice el alumno al tutor | Sí, transcrito y filtrado | Responder a sus dudas |
| Audio original de la voz | No | Se transcribe antes y al LLM solo llega texto |

Las transcripciones de los vídeos también se envían, pero son contenido del curso y no datos del alumno.

### Tratamiento para cumplir la condición de privacidad

1. **Minimización:** el servidor solo prepara los datos necesarios para cada petición.
2. **Seudonimización:** el identificador real se sustituye por uno temporal de sesión. La correspondencia no sale de nuestro sistema.
3. **Filtrado del texto libre:** el servicio de protección de datos detecta y sustituye nombres, emails, teléfonos y documentos de identidad, por ejemplo por `[NOMBRE]` o `[EMAIL]`.
4. **Voz:** el audio se transcribe dentro de nuestro sistema, el texto se filtra y después se envía al LLM. El audio no se guarda.
5. **Paso obligatorio:** ninguna petición llega al LLM sin pasar por el servicio. Si falla, no se envía nada.
6. **Proveedor de IA:** usamos Google Gemini (modelo Flash) a través de la API de pago.
7. **Transparencia:** se informa al alumno de que habla con una IA y de qué datos se utilizan.

El filtrado automático puede no detectar todos los datos personales, por lo que se pide al alumno que no los comparta con el tutor.

### Sistema RAG

El RAG recupera de PostgreSQL las transcripciones del módulo actual, los errores del alumno y las columnas permitidas, y se los da filtrando sin ningún dato de personal a Gemini como contexto para que responda a medida. Sus límites son:

- **Columnas permitidas:** la IA solo conoce las de una lista cerrada, sin nombre, email, contraseñas ni identificadores reales.
- **Sin SQL libre:** solo puede solicitar consultas predefinidas de lectura, y el servidor las limita al alumno de la sesión.
- **Protección de datos:** todo el contexto se filtra antes de llegar a Gemini.

Detalle en [docs/rag.md](docs/rag.md).

## 7. Agentes de IA

| Agente | Qué hace | Modelo y por qué | Entrada | Salida | Límites |
| --- | --- | --- | --- | --- | --- |
| Tutor | Resuelve dudas de forma personalizada | Gemini Flash: rápido y con coste contenido | Pregunta filtrada, transcripciones del módulo y errores del alumno | Respuesta en texto, que se convierte en voz | Solo el curso, solo los datos del alumno y sin SQL libre |
| Selector de repaso | Elige el fragmento de vídeo que explica un fallo | Gemini Flash: trabaja con el texto de la transcripción | Pregunta fallada y transcripción con minutos | Minuto de inicio, minuto de fin y título | Máximo 60 s y no genera imágenes. El recorte lo hace el servidor |
| Guionista de podcast | Convierte los vídeos en un guion de audio | Gemini Flash: resume y adapta el texto | Transcripciones del módulo | Guion del podcast | Solo contenido del curso y no recibe datos del alumno |

El itinerario no usa IA: el servidor aplica reglas sobre los resultados de la encuesta inicial.

Las preguntas tampoco usan IA: quien sube los vídeos escribe a mano las de la encuesta inicial y los tests, con su respuesta correcta, explicación, concepto y minuto.

## 8. Contenido

Demo de 15 vídeos de un curso de progrmación en Python


## 9. Coste

### Coste de IA por alumno y mes

Estimación con los precios de `gemini-3.8-flash`
| Uso por alumno y mes | Entrada | Salida | Coste |
| --- | --- | --- | --- |
| Tutor: 40 preguntas | 520.000 tokens | 20.000 tokens | 0,93 $ |
| Repaso: 8 fragmentos | 24.000 tokens | 3.200 tokens | 0,06 $ |
| **Total** | **544.000 tokens** | **23.200 tokens** | **0,99 $** |

Aparte, generar los guiones de podcast de 15 vídeos cuesta unos 0,23 $ una sola vez, compartidos entre todos los alumnos.

## 10. Idea original

### Qué es

Un ciclo de repaso a partir de los errores: cada fallo en un test se convierte en un vídeo corto vertical con el momento exacto que lo explica y en un tema para el tutor por voz.

### Por qué mejora la experiencia del alumno o el trabajo de los tutores

- **Alumno:** repasa solo lo que ha fallado, en un formato rápido, y no tiene que explicar al tutor dónde se ha atascado.
- **Tutor:** los errores registrados le permiten saber qué conceptos necesitan refuerzo y quién necesita ayuda antes del examen final.

## 11. Alcance para el 30/11

### Qué entra y por qué

- **Encuesta inicial e itinerario:** evita repetir contenido que el alumno ya sabe.
- **Tests durante el vídeo o al final:** permiten comprobar si aprende y generan los errores que usa el resto de la solución.
- **Tutor IA por voz:** da atención personalizada. Si la voz no está a tiempo, se usará un chat de texto.
- **Protección de datos y RAG:** son necesarios para usar el tutor con privacidad y dentro de sus límites.
- **Un curso con 10-15 imágenes de muestra:** suficiente para demostrar el recorrido completo.

Si da tiempo, por este orden: vídeos cortos a partir de los fallos, podcast y panel del tutor.

### Qué no entra y por qué

- **Embeddings, búsqueda vectorial y caché semántica:** con el volumen del MVP basta con que el RAG recupere el contenido del módulo mediante consultas a PostgreSQL.
- **Vídeos reales del curso:** en la demo se sustituyen por imágenes de muestra.
- **Edición avanzada de vídeo:** los vídeos cortos serían recortes del original, porque generar o editar vídeo es costoso.
- **Integración real con empresas externas y otros servicios 480:** no es necesaria para probar la experiencia del alumno.
- **Varios cursos:** con uno basta para validar la solución.
- **Aplicación móvil nativa:** la web permite llegar antes a una demo.
