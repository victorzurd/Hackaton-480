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

Este repositorio contiene actualmente la especificación, documentación y el esquema de la base de datos, pero no incluye el código ejecutable de la aplicación. Por eso Compose prepara y arranca la base de datos; para añadir el servicio de la aplicación hace falta incorporar su código y definir su tecnología y comando de inicio.
