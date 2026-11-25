# Entorno local

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

La API de autenticación usa Express, TypeScript y PostgreSQL. Tras copiar `.env.example` a `.env`, cambia `AUTH_JWT_SECRET` por una cadena aleatoria propia de al menos 32 bytes. Puedes levantar la base y la API con:

```powershell
docker compose up --build -d
```

La interfaz de acceso y la API quedan disponibles en `http://localhost:3000`. Al arrancar, aplica la migración de autenticación de forma idempotente, también si el volumen de PostgreSQL ya existía.

Para ejecutarla fuera de Docker, instala Node.js 22, arranca PostgreSQL y ejecuta:

```powershell
npm install
npm run migrate
npm run dev
```

`npm run dev` compila el TypeScript de la interfaz antes de iniciar la API. Consulta los endpoints y ejemplos en [docs/auth-api.md](docs/auth-api.md). La edad se declara durante el registro y no se verifica documentalmente. Solo se guarda la preferencia de bolsa de trabajo para cuentas de 18 años o más; la decisión del usuario es opcional y empieza desactivada.
