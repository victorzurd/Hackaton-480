# Entorno local

## Arranque rápido

Con Docker Desktop abierto:

```powershell
npm run levantar
```

Crea `.env` si no existe, detecta la IPv4 local, actualiza la configuración de Caddy y levanta los contenedores. En Windows instala el certificado local de Caddy si puede acceder al almacén de certificados; después, abre **`https://localhost`** en el ordenador o la URL HTTPS que muestra el script en el móvil, conectado a la misma red.

Para usar la IA, pon tu `GEMINI_API_KEY` en `.env`. La primera vez también descarga los subtítulos de CS50P (en `media/cs50p/`, fuera de Git) y los importa para el Tutor IA.

| Dirección | Uso |
| --- | --- |
| `https://localhost` | Aplicación CON HTTPS |
| `https://<IP-local>` | Aplicación desde el móvil en la misma red |
| `http://localhost:3000` | Aplicación sin HTTPS, solo desde tu equipo |
| `localhost:5432` | PostgreSQL |

## HTTPS local

El contenedor `proxy` ([Caddy](https://caddyserver.com/), configurado en [`Caddyfile`](Caddyfile)) sirve HTTPS y reenvía a la API. Solo para desarrollo.

- Usa `https://localhost`: sin puerto y no `127.0.0.1`.
- `npm run levantar` detecta la IPv4 local y la guarda en `CADDY_HOSTS` y `CADDY_DEFAULT_SNI` dentro de `.env` en cada arranque.
- En el móvil, abre la URL `https://<IP-local>` que muestra el script. Si el teléfono no confía en Caddy, instala el certificado raíz `caddy-root.crt` que el script deja en la carpeta del proyecto.
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

## Subtítulos para los reels

Los reels buscan el tramo del vídeo en los subtítulos de CS50P, que no están en el repositorio. Para descargarlos en `media/cs50p/`:

```powershell
# Windows
.\DataBase\seeds\download_cs50p.ps1
```

```bash
# Linux y macOS, desde la raíz del proyecto
cd media/cs50p
for i in $(seq 0 9); do
  base="https://cdn.cs50.net/python/2022/x/lectures/$i/lang/en"
  curl -fL --retry 3 -o "lecture-$i.srt" "$base/lecture$i.srt"
  curl -fL --retry 3 -o "lecture-$i.txt" "$base/lecture$i.txt"
  { echo "WEBVTT"; echo; sed -E 's/([0-9]{2}:[0-9]{2}:[0-9]{2}),([0-9]{3})/\1.\2/g' "lecture-$i.srt"; } > "lecture-$i.vtt"
done
cd ../..
```

Con los contenedores levantados, impórtalos a la base de datos:

```bash
docker exec academy-api node DataBase/seeds/import_cs50p_transcripts.mjs
```

Debe mostrar una línea por lección. Después de `docker compose down -v` hay que volver a importarlos; los ficheros descargados se conservan.

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

`npm run dev` compila el TypeScript de la interfaz e inicia la API con `NODE_ENV=development`. Para probar la pantalla de lección sin iniciar sesión, abre `http://localhost:3000/leccion.html?preview=1`. El preview solo se sirve en ese modo; `npm start` sin `NODE_ENV=development` y Docker (`NODE_ENV=production`) lo mantienen deshabilitado.

Consulta los endpoints y ejemplos en [docs/auth-api.md](docs/auth-api.md). Para el flujo, el preview y la validación del reproductor, consulta [docs/reproductor-lecciones.md](docs/reproductor-lecciones.md). La edad se declara durante el registro y no se verifica documentalmente. Solo se guarda la preferencia de bolsa de trabajo para cuentas de 18 años o más; la decisión del usuario es opcional y empieza desactivada.
