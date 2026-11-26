# API de 480 Academy

La interfaz y la API se sirven desde `http://localhost:3000`. Todas las respuestas y errores están en español. Los datos personales se guardan en PostgreSQL y la contraseña nunca se persiste en texto claro.

La interfaz está disponible en `/`. El alta se presenta en dos pasos y, tras registrarse o iniciar sesión, guarda el token en el almacenamiento de sesión del navegador para validarlo al volver a cargar esta pestaña. La página principal muestra el catálogo disponible y los cursos inscritos.

## Crear cuenta

`POST /api/auth/register`

```json
{
  "nombreCompleto": "Ana García López",
  "correo": "ana@example.com",
  "contrasena": "una contraseña larga",
  "edad": 19,
  "consentimientoDatos": true,
  "bolsaTrabajo": true
}
```

- `nombreCompleto`, `correo`, `contrasena`, `edad` y `consentimientoDatos` son obligatorios.
- La contraseña debe tener entre 12 y 128 caracteres. Se procesa con scrypt y una sal aleatoria por cuenta.
- El consentimiento debe aceptarse para completar el alta; se almacena junto con la fecha y hora.
- `bolsaTrabajo` es opcional y su valor predeterminado es `false`. Solo se puede activar desde los 18 años.
- El correo se normaliza a minúsculas. Si ya existe, responde `409`.
- Si el registro se completa, responde `201` con el perfil y un token Bearer válido durante 8 horas.

## Iniciar sesión

`POST /api/auth/login`

```json
{
  "correo": "ana@example.com",
  "contrasena": "una contraseña larga"
}
```

Responde con el perfil y un nuevo token Bearer. Un correo inexistente y una contraseña incorrecta producen el mismo `401`.

## Consultar la sesión

`GET /api/auth/me`

Incluye la cabecera `Authorization: Bearer <token>`. Devuelve el perfil asociado al token o `401` si no es válido, ha caducado o la cuenta está inactiva.

## Consultar cursos disponibles

`GET /api/courses/available?search=python`

Requiere `Authorization: Bearer <token>`. `search` es opcional, admite hasta 100 caracteres y filtra por título o descripción. Solo devuelve cursos activos en los que el alumno no está inscrito ni ha finalizado. Cada curso incluye `id`, `titulo`, `descripcion`, `modulos` y `videos`.

El catálogo se lee de PostgreSQL y no se precarga con cursos ficticios. Si `academy.cursos` está vacío, la respuesta será una lista vacía y la interfaz mostrará ese estado.

## Consultar cursos inscritos

`GET /api/courses/enrolled?search=python`

Requiere `Authorization: Bearer <token>`. Devuelve las matrículas activas y finalizadas del alumno autenticado, con los campos de curso y además `estado`, `fechaMatricula`, `progreso` y `evaluacionInicialCompletada`. El progreso se calcula con los vídeos completados o marcados como saltados; una matrícula `finalizado` se presenta al 100 %.

## Inscribirse en un curso

`POST /api/courses/:id/enroll`

Requiere `Authorization: Bearer <token>`. Crea la matrícula en un curso activo. Si la matrícula estaba cancelada, la reactiva; si ya está activa o finalizada, responde `409`. Si se completa, responde `201` con el identificador del curso y el estado de la matrícula. La interfaz inicia a continuación el examen inicial del curso.

## Examen inicial del curso

- `POST /api/courses/:id/initial-assessment/start` comprueba que el alumno está inscrito y crea o retoma su intento. Devuelve preguntas abiertas y ejemplos del curso, sin opciones ni respuestas correctas.
- `PUT /api/courses/:id/initial-assessment/answer` guarda texto escrito o transcrito por voz para poder retomar el examen.
- `POST /api/courses/:id/initial-assessment/submit` envía a Gemini las respuestas filtradas junto con preguntas y referencias del curso. Gemini devuelve los contenidos dominados y el orden de módulos; el servidor valida y guarda el resultado. No calcula ni muestra una nota.
- `GET /api/courses/:id/itinerary` requiere un examen inicial completado y devuelve el orden personal del alumno.

El examen inicial CS50P es material de práctica original en español: tiene diez preguntas abiertas con ejemplos visuales de código, una por cada contenido de la demo. Se puede contestar por escrito o mediante dictado de voz. En móviles que abren la web por HTTP en la red local, el botón enfoca la respuesta para usar el micrófono del teclado del sistema, sin necesitar HTTPS ni permiso de micrófono para el sitio. La API del curso guarda solo el texto y filtra las respuestas antes de enviarlas a Gemini.

## Reels de repaso

Requieren `Authorization: Bearer <token>` y solo devuelven los reels del alumno autenticado. Funcionamiento del agente en [IA/reels.md](IA/reels.md).

- `GET /api/reels` devuelve la biblioteca: primero los pendientes, ordenados por las veces que se ha repetido el error. Incluye `resumen` con `total` y `pendientes`. Filtros opcionales: `estado=pendiente|revisado|todos` y `curso=<id>`.
- `GET /api/reels/:id` devuelve un reel. Responde `404` si no existe o es de otro alumno.
- `POST /api/reels/:id/revisado` lo marca como revisado. Con `{ "revisada": false }` vuelve a pendiente.

Cada reel incluye `concepto`, `motivo`, `recomendacion`, `vecesDetectado`, `revisada`, `curso`, `leccion` y `clip`:

```json
"clip": {
  "url": "https://cdn.cs50.net/python/2022/x/lectures/2/lecture2-360p.mp4",
  "inicio": 2486,
  "fin": 2544,
  "duracion": 58,
  "inicioTexto": "41:26",
  "urlFragmento": "https://cdn.cs50.net/python/2022/x/lectures/2/lecture2-360p.mp4#t=2486,2544"
}
```

`urlFragmento` se puede usar directamente en un `<video>` para reproducir solo ese tramo. Si no se encontró el tramo, `clip` es `null` y la interfaz muestra la recomendación y la lección.

## Salud

`GET /health` comprueba la conexión a PostgreSQL y devuelve `503` si la base de datos no está disponible.

## Privacidad y alcance

El token se entrega al cliente para usarlo en peticiones a la API; no se envía a Gemini. El campo de edad es autodeclarado: no hay verificación de identidad ni fecha de nacimiento. La preferencia de bolsa de trabajo no comparte automáticamente el perfil con empresas. La política de consentimiento de menores y los permisos de publicación en la bolsa siguen pendientes de definición por el producto.
