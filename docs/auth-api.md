# API de registro e inicio de sesión

La interfaz y la API se sirven desde `http://localhost:3000`. Todas las respuestas y errores están en español. Los datos personales se guardan en PostgreSQL y la contraseña nunca se persiste en texto claro.

La interfaz está disponible en `/`. El alta se presenta en dos pasos y, tras registrarse o iniciar sesión, guarda el token en el almacenamiento de sesión del navegador para validarlo al volver a cargar esta pestaña.

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

## Salud

`GET /health` comprueba la conexión a PostgreSQL y devuelve `503` si la base de datos no está disponible.

## Privacidad y alcance

El token se entrega al cliente para usarlo en peticiones a la API; no se envía a Gemini. El campo de edad es autodeclarado: no hay verificación de identidad ni fecha de nacimiento. La preferencia de bolsa de trabajo no comparte automáticamente el perfil con empresas. La política de consentimiento de menores y los permisos de publicación en la bolsa siguen pendientes de definición por el producto.
