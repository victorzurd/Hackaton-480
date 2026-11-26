# Entorno local

## Arranque rápido

Con Docker Desktop abierto:

```powershell
npm run levantar
```

Crea `.env` si no existe, levanta los contenedores y, la primera vez, instala el certificado local de Caddy (**pulsa «Sí» en el aviso de Windows** y reinicia el navegador). Después, abre **`https://localhost`**.

Para usar la IA, pon tu `GEMINI_API_KEY` en `.env`.

| Dirección | Uso |
| --- | --- |
| `https://localhost` | Aplicación CON HTTPS |
| `http://localhost:3000` | Aplicación sin HTTPS, solo desde tu equipo |
| `localhost:5432` | PostgreSQL |

## HTTPS local

El contenedor `proxy` ([Caddy](https://caddyserver.com/), configurado en [`Caddyfile`](Caddyfile)) sirve HTTPS y reenvía a la API. Solo para desarrollo.

- Usa `https://localhost`: sin puerto y no `127.0.0.1`.
- Los puertos 80 y 443 deben estar libres.
- Chrome y Edge no muestran candado: pulsa el icono junto a la dirección y comprueba «La conexión es segura».
- `docker compose down -v` borra el certificado; vuelve a ejecutar `npm run levantar`.

## Base de datos

Requiere Docker Desktop con Docker Compose. Desde la carpeta del proyecto:

```powershell
Copy-Item .env.example .env
docker compose up -d db
docker compose ps
```

La primera vez, PostgreSQL crea la base de datos y ejecuta `DataBase/Database.sql`. El esquema de la aplicación es `academy`.

Parámetros de conexión por defecto:

- Host: `localhost`
- Puerto: `5432`
- Base de datos: `academy`
- Usuario: `academy`
- Contraseña: `academy_local` (solo para desarrollo local; se puede cambiar en `.env`)
- URL: `postgresql://academy:academy_local@localhost:5432/academy`

Para detener PostgreSQL sin borrar los datos, ejecuta `docker compose down`. Para reiniciarlo, `docker compose up -d db`.

El SQL de inicialización solo se ejecuta al crear un volumen de datos vacío. Si necesitas recrear la base desde cero, `docker compose down -v` elimina también los datos persistidos.

## Aplicación

La API de autenticación usa Express, TypeScript y PostgreSQL. Tras copiar `.env.example` a `.env`, cambia `AUTH_JWT_SECRET` por una cadena aleatoria propia de al menos 32 bytes. Si usas Docker Compose, evita el carácter `$` en esta variable (Compose intenta interpolarlo); usa una cadena hexadecimal o alfanumérica. Para personalizar itinerarios, configura también `GEMINI_API_KEY` con una clave válida de Google AI Studio; `GEMINI_MODEL` permite cambiar el modelo. Además de con `npm run levantar`, puedes levantar todo con:

```powershell
docker compose up --build -d
```

La interfaz y la API quedan disponibles en `https://localhost` y en `http://localhost:3000`. Al arrancar, aplica de forma idempotente las migraciones de autenticación, itinerarios personalizados y examen inicial, también si el volumen de PostgreSQL ya existía. El seed crea CS50P con su examen inicial de curso y preguntas asociadas a los diez contenidos de la demo.

Para ejecutarla fuera de Docker (se recarga al guardar), instala Node.js 22 y añade a tu `.env` las variables `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` y `PGPASSWORD` de `.env.example`. Detén la API y el proxy de Docker, que ocupan el puerto 3000, y deja solo la base de datos:

```powershell
docker compose stop api proxy
npm install
npm run migrate
npm run dev
```

En este modo la aplicación está en `http://localhost:3000`, sin HTTPS.

`npm run dev` compila el TypeScript de la interfaz antes de iniciar la API. Consulta los endpoints y ejemplos en [docs/auth-api.md](docs/auth-api.md). La edad se declara durante el registro y no se verifica documentalmente. Solo se guarda la preferencia de bolsa de trabajo para cuentas de 18 años o más; la decisión del usuario es opcional y empieza desactivada.
