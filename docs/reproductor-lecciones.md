# Reproductor de lecciones

## Objetivo y alcance

La pantalla permite abrir desde el itinerario un vídeo de lección, consultar su
transcripción y avanzar a los vídeos vecinos del mismo itinerario. Se integra
con la API autenticada y reutiliza la identidad visual de `web/styles.css`.

El alcance no incluye biblioteca de reels, persistencia del progreso,
sincronización temporal de la transcripción ni cambios al examen inicial.

## Flujo de navegación

1. En el itinerario, `web/auth.ts` mantiene el comportamiento de otros tipos de
   contenido. Los elementos `tipo: "video"` enlazan a la pantalla interna.
2. El enlace envía los identificadores como parámetros `curso` y `contenido`:
   `/leccion.html?curso=<courseId>&contenido=<contentId>`.
3. La pantalla consulta `GET /api/courses/:courseId/lessons/:contentId` con el
   token Bearer guardado en `sessionStorage`.
4. El enlace «Volver al itinerario» lleva a
   `/curso.html?id=<courseId>&vista=itinerary`.
5. Si la carga del detalle funciona, la pantalla consulta el itinerario
   existente (`GET /api/courses/:id/itinerary`), conserva el orden de sus
   módulos y contenidos y ofrece navegación entre los elementos de tipo vídeo
   anterior y siguiente. Si no puede cargar esa navegación, conserva la
   lección y muestra el estado correspondiente.

## API y datos

El detalle requiere autenticación de alumno. La ruta comprueba que la cuenta
está activa y tiene el rol de alumno, que existe una matrícula `activo` o
`finalizado` en el curso solicitado y que el contenido es un vídeo perteneciente
a ese curso. Los identificadores se validan y las consultas usan parámetros.
La autorización y la disponibilidad de los recursos se tratan por separado:
si la lección está autorizada, se devuelve aunque no tenga URL, duración o
transcripción.

La respuesta contiene `contenidoId`, `titulo`, `moduloTitulo`, `videoUrl`,
`duracionSegundos` y `transcripcion`. URL, duración y transcripción pueden ser
`null`. Si hay varias transcripciones, se prioriza español (`es`), luego inglés
(`en`) y después el idioma por código; los duplicados se resuelven por el ID
más bajo. El contrato completo ya está documentado en
[`auth-api.md`](auth-api.md).

La pantalla distingue los errores de sesión (`401`), autorización (`403`),
contenido no encontrado en ese curso (`404`) y fallos de conexión/servidor.
Una URL de vídeo o transcripción ausente no se presenta como un error de
autorización.

## Pantalla y presentación

`web/leccion.html` contiene la estructura única para el modo normal y el
preview: encabezado de lección, reproductor HTML5, controles de navegación,
transcripción, mensajes de estado y enlaces para volver o iniciar sesión.
`web/leccion.ts` carga y presenta los datos. El texto se inserta con
`textContent`, no como HTML; la URL del vídeo se limita a protocolos HTTP/HTTPS.

La composición sigue el mockup `docs/img/video-modulo.webp`. Se reutilizan
componentes existentes (por ejemplo, `topbar`, `page-main` y botones) y los
estilos nuevos se aíslan bajo clases `lesson-*`, con adaptación para pantallas
pequeñas. No se modifican variables globales ni se añaden librerías visuales.

## Preview de desarrollo

El modo preview se activa con `?preview=1` y presenta datos locales de
demostración, una transcripción de ejemplo y el vídeo público de prueba de MDN:
`https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4`.
Utiliza el mismo HTML, TypeScript y CSS que la pantalla real; no lee el token ni
llama a la API.

`scripts/dev.mjs` inicia el servidor con `NODE_ENV=development`. El middleware
de `src/server.ts` permite `GET /leccion.html?preview=1` únicamente en ese
entorno; fuera de él responde `404`. La ruta normal de lección y la API
conservan sus comprobaciones habituales. No hay tokens ficticios ni bypass de
autorización. La guía de arranque está en [`../LOCAL.md`](../LOCAL.md).

Para probarlo en el entorno local habitual:

```powershell
npm run dev
```

Abre `http://localhost:3000/leccion.html?preview=1`. Si el puerto 3000 está
ocupado por Docker, sigue en `LOCAL.md` las instrucciones para detener la API
y el proxy antes de iniciar el servidor local. Aunque el preview no consulta la
API, el proceso de desarrollo sigue el arranque normal del proyecto.

## Archivos de la funcionalidad

| Archivo | Responsabilidad |
| --- | --- |
| [`../web/leccion.html`](../web/leccion.html) | Estructura de la pantalla y estados accesibles. |
| [`../web/leccion.ts`](../web/leccion.ts) | Preview, petición autenticada, errores, transcripción y navegación vecina. |
| [`../web/styles.css`](../web/styles.css) | Estilos específicos `lesson-*` y diseño responsive, además de la identidad existente. |
| [`../web/auth.ts`](../web/auth.ts) | Enlace interno únicamente para contenidos de tipo vídeo del itinerario. |
| [`../src/routes/courses.ts`](../src/routes/courses.ts) | Endpoint protegido de detalle de lección. |
| [`../src/server.ts`](../src/server.ts) | CSP de medios y restricción de acceso al preview fuera de desarrollo. |
| [`../scripts/dev.mjs`](../scripts/dev.mjs) | Inicio local de la API con `NODE_ENV=development`. |
| [`../package.json`](../package.json) | Scripts existentes de desarrollo, build y tests; no se añadieron dependencias. |
| [`../tests/routes/courses-lesson.test.ts`](../tests/routes/courses-lesson.test.ts) | Pruebas del endpoint, matrícula, estado de cuenta, pertenencia y recursos opcionales. |
| [`auth-api.md`](auth-api.md) | Contrato del endpoint y política de selección de transcripción. |
| [`../LOCAL.md`](../LOCAL.md) | Arranque local y acceso al preview. |

## Compatibilidad y consideraciones

- Los contenidos que no son vídeos conservan sus enlaces y comportamiento
  previos en el itinerario.
- Login, registro, matrícula, examen inicial y las rutas de API existentes no
  se sustituyen por lógica del reproductor.
- `feat/reels-backend` también modifica `src/server.ts`; se debe revisar y
  combinar ese archivo al integrar ambas ramas. La auditoría previa no encontró
  otro proveedor de vídeo introducido por reels.
- La CSP usa `mediaSrc: ["'self'", "https:"]` para cubrir las URL actuales de
  vídeos y la fuente del preview sin asumir que todos los cursos comparten un
  único proveedor (los vídeos CS50P inspeccionados usan `cdn.cs50.net`; el
  preview usa `interactive-examples.mdn.mozilla.net`). Restringirla a hosts
  concretos queda como mejora futura de endurecimiento, no como bloqueo
  conocido de la funcionalidad.
- No se añadieron dependencias externas.

## Validación

### Ejecutada

- `npm run build`: compilación de backend y frontend correcta.
- `npm test`: 212 pruebas aprobadas.
- `git diff --check`: sin errores de whitespace.
- En navegador, el preview local se abrió sin sesión, presentó el vídeo de
  prueba y la transcripción, y no llamó a la API. Se comprobó también el diseño
  responsive.
- Se probó el flujo de la interfaz y la navegación del itinerario con respuestas
  simuladas. Una petición real sin token devolvió `401`, como se espera.
- Se inspeccionó PostgreSQL real en modo de solo lectura: CS50P tenía diez
  contenidos de vídeo con URL, pero todavía no tenía transcripciones ni
  duraciones importadas. También había una matrícula activa, aunque el examen
  inicial no estaba completado.

### Pendiente antes de considerar completa la validación E2E

- Preparar datos de transcripción/duración con el proceso de importación
  existente y una cuenta de pruebas propia, activa, matriculada y con el examen
  inicial completado para acceder al itinerario.
- Con esa sesión, comprobar que el endpoint devuelve `200` con los datos reales,
  que el vídeo/transcripción corresponden al contenido y que los enlaces
  anterior/siguiente reflejan el itinerario real.
- Volver a probar el arranque de la imagen Docker actualizada; la inspección
  anterior encontró que el contenedor existente todavía respondía `404` para
  `leccion.html`, por lo que no se considera validada esa imagen.

No se ejecutó el downloader ni el importador de transcripciones, no se
modificaron datos de PostgreSQL y no se confirmó un acceso `200` con una sesión
real de alumno. Por tanto, la validación E2E con PostgreSQL y cuenta real sigue
pendiente.
