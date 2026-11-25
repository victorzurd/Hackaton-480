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

Requiere `Authorization: Bearer <token>`. Devuelve las matrículas activas y finalizadas del alumno autenticado, con los campos de curso y además `estado`, `fechaMatricula` y `progreso`. El progreso se calcula con los vídeos completados o marcados como saltados; una matrícula `finalizado` se presenta al 100 %.

## Inscribirse en un curso

`POST /api/courses/:id/enroll`

Requiere `Authorization: Bearer <token>`. Crea la matrícula en un curso activo. Si la matrícula estaba cancelada, la reactiva; si ya está activa o finalizada, responde `409`. Si se completa, responde `201` con el identificador del curso y el estado de la matrícula.

## Salud

`GET /health` comprueba la conexión a PostgreSQL y devuelve `503` si la base de datos no está disponible.

## Privacidad y alcance

El token se entrega al cliente para usarlo en peticiones a la API; no se envía a Gemini. El campo de edad es autodeclarado: no hay verificación de identidad ni fecha de nacimiento. La preferencia de bolsa de trabajo no comparte automáticamente el perfil con empresas. La política de consentimiento de menores y los permisos de publicación en la bolsa siguen pendientes de definición por el producto.
