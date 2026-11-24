# Cómo trabajamos — Equipo B (Reto 480 Academy)

Acuerdos de trabajo del equipo: quién hace qué, cómo usamos ramas y pull requests, y cuándo damos algo por terminado.

## 1. Roles

| Persona | Responsabilidad principal |
|---|---|
| Jordi | Frontend, bitácora (`BITACORA.md`), preguntas y cuestionarios (UI) y borrador de la presentación |
| Alex | Integración de IA y Tutor IA |
| Victor | Backend, base de datos, cuestionario inicial |
| Iker | Backend, base de datos, sección de reels, documentación (`CONTRIBUTING.md`, `docs/decisiones.md`) |

- Cada historia de usuario es un **issue** de GitHub con una persona asignada y una estimación.
- Si alguien se bloquea más de 30 minutos, lo comenta en el grupo o en el issue en lugar de quedarse atascado.

## 2. Ramas

- `main` es la rama estable: **siempre tiene que arrancar** con `docker compose up`. Nadie hace push directo a `main`.
- Cada tarea se hace en su propia rama, creada desde `main` y con un nombre que indique el tipo y el tema:

  | Prefijo | Uso | Ejemplo |
  |---|---|---|
  | `feat/` | Funcionalidad nueva | `feat/reels-errores` |
  | `fix/` | Corrección de un error | `fix/login-token` |
  | `docs/` | Solo documentación | `docs/decisiones` |
  | `chore/` | Configuración, Docker, dependencias | `chore/docker-compose` |

- Antes de abrir una pull request, actualiza tu rama con lo último de `main`:

  ```bash
  git switch main
  git pull
  git switch feat/mi-rama
  git merge main
  ```

## 3. Commits

Mensajes cortos, en español y en imperativo, con el mismo prefijo que la rama:

```
feat: añadir endpoint GET /reels
fix: corregir cálculo de progreso del itinerario
docs: añadir decisión sobre el proveedor de IA
```

Mejor muchos commits pequeños que uno enorme al final.

## 4. Pull requests

1. Abre la PR contra `main` en cuanto la tarea esté lista (o como *draft* si quieres feedback antes).
2. En la descripción: qué hace, cómo probarlo y el issue que cierra (`Closes #12`).
3. Necesita **al menos 1 aprobación** de otra persona del equipo.
4. Quien revisa lo prueba en local, no solo lee el código.
5. Se fusiona con **Squash and merge** y se borra la rama.

## 5. Cuándo algo está terminado (Definition of Done)

Una tarea está terminada cuando:

- [ ] Cumple los criterios de aceptación de su historia de usuario en `SPEC.md` (apartado 4).
- [ ] Funciona en **vista móvil** (el 71 % del tráfico de 480 Academy es móvil).
- [ ] Todos los textos que ve el alumno están **en español**.
- [ ] Toda petición a la IA pasa por el **servicio de protección de datos** y solo usa las columnas permitidas del RAG (ver `SPEC.md` apartado 6 y `docs/rag.md`).
- [ ] El proyecto sigue arrancando con `docker compose up` sin errores.
- [ ] No hay claves, contraseñas ni `.env` subidos al repositorio.
- [ ] Si se crea o cambia un agente de IA, sus instrucciones y límites están documentados en el repositorio y la tabla de agentes de `SPEC.md` (apartado 7) está al día.
- [ ] Ha pasado la revisión de la PR y está fusionado en `main`.
- [ ] El issue está cerrado.

## 6. Secretos y configuración

- Las claves (por ejemplo la API key de Gemini) van en un fichero `.env` que **no se sube** (está en `.gitignore`).
- En el repositorio solo se sube `.env.example` con los nombres de las variables, sin valores reales.

## 7. Bitácora

Al final de cada sesión de trabajo, quien coordine añade una entrada a `BITACORA.md`: qué se hizo, quién lo hizo y qué problemas surgieron.
