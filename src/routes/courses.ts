import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";
import { verifyToken } from "../security/token";

type CourseDependencies = {
  db: Pool;
  jwtSecret: string;
};

type CourseRow = {
  id: string;
  titulo: string;
  descripcion: string | null;
  total_modulos: number;
  total_videos: number;
  estado?: "activo" | "finalizado";
  fecha_matricula?: string;
  videos_completados?: number;
};

function getSearchTerm(request: Request): string | null {
  const value = request.query.search;
  if (value === undefined) return "";
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length <= 100 ? normalized : null;
}

function mapCourse(row: CourseRow) {
  const videos = Number(row.total_videos);
  const completados = Number(row.videos_completados ?? 0);
  const finalizado = row.estado === "finalizado";

  return {
    id: row.id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    modulos: Number(row.total_modulos),
    videos,
    ...(row.estado
      ? {
          estado: row.estado,
          fechaMatricula: row.fecha_matricula,
          progreso: finalizado ? 100 : videos === 0 ? 0 : Math.round((completados / videos) * 100),
        }
      : {}),
  };
}

export function createCoursesRouter({ db, jwtSecret }: CourseDependencies) {
  const router = Router();

  router.use(async (request: Request, response: Response, next) => {
    const header = request.header("authorization");
    const match = header ? /^Bearer\s+(.+)$/i.exec(header) : null;
    const claims = match ? verifyToken(match[1], jwtSecret) : null;
    if (!claims) {
      response.status(401).json({ error: "La sesión no es válida o ha caducado." });
      return;
    }

    try {
      const account = await db.query(
        `SELECT 1
         FROM academy.usuarios
         WHERE id = $1 AND activo = TRUE AND rol = 'alumno'
         LIMIT 1`,
        [claims.sub],
      );
      if (account.rowCount === 0) {
        response.status(401).json({ error: "La cuenta ya no está disponible." });
        return;
      }

      response.locals.alumnoId = claims.sub;
      next();
    } catch (error) {
      console.error("Error al validar la sesión de cursos:", error);
      response.status(500).json({ error: "No se pudo validar la sesión." });
    }
  });

  router.get("/available", async (request: Request, response: Response) => {
    const search = getSearchTerm(request);
    if (search === null) {
      response.status(400).json({ error: "El filtro debe tener como máximo 100 caracteres." });
      return;
    }

    try {
      const result = await db.query<CourseRow>(
        `SELECT
           c.id::text,
           c.titulo,
           c.descripcion,
           COUNT(DISTINCT m.id)::int AS total_modulos,
           COUNT(DISTINCT v.id)::int AS total_videos
         FROM academy.cursos c
         LEFT JOIN academy.modulos m ON m.curso_id = c.id
         LEFT JOIN academy.contenidos v
           ON v.modulo_id = m.id AND v.tipo = 'video' AND v.disponible = TRUE
         WHERE c.activo = TRUE
           AND NOT EXISTS (
             SELECT 1
             FROM academy.matriculas matricula
             WHERE matricula.alumno_id = $1
               AND matricula.curso_id = c.id
               AND matricula.estado IN ('activo', 'finalizado')
           )
           AND (
             $2 = ''
             OR POSITION(LOWER($2) IN LOWER(c.titulo)) > 0
             OR POSITION(LOWER($2) IN LOWER(COALESCE(c.descripcion, ''))) > 0
           )
         GROUP BY c.id
         ORDER BY c.titulo ASC`,
        [response.locals.alumnoId, search],
      );

      response.json({ cursos: result.rows.map(mapCourse) });
    } catch (error) {
      console.error("Error al consultar cursos disponibles:", error);
      response.status(500).json({ error: "No se pudieron cargar los cursos disponibles." });
    }
  });

  router.get("/enrolled", async (request: Request, response: Response) => {
    const search = getSearchTerm(request);
    if (search === null) {
      response.status(400).json({ error: "El filtro debe tener como máximo 100 caracteres." });
      return;
    }

    try {
      const result = await db.query<CourseRow>(
        `SELECT
           c.id::text,
           c.titulo,
           c.descripcion,
           matricula.estado,
           matricula.fecha_matricula::text,
           COUNT(DISTINCT m.id)::int AS total_modulos,
           COUNT(DISTINCT v.id)::int AS total_videos,
           COUNT(DISTINCT v.id) FILTER (
             WHERE progreso.estado IN ('completado', 'saltado')
           )::int AS videos_completados
         FROM academy.matriculas matricula
         JOIN academy.cursos c ON c.id = matricula.curso_id
         LEFT JOIN academy.modulos m ON m.curso_id = c.id
         LEFT JOIN academy.contenidos v
           ON v.modulo_id = m.id AND v.tipo = 'video' AND v.disponible = TRUE
         LEFT JOIN academy.progreso_contenido progreso
           ON progreso.contenido_id = v.id AND progreso.alumno_id = matricula.alumno_id
         WHERE matricula.alumno_id = $1
           AND matricula.estado IN ('activo', 'finalizado')
           AND (
             $2 = ''
             OR POSITION(LOWER($2) IN LOWER(c.titulo)) > 0
             OR POSITION(LOWER($2) IN LOWER(COALESCE(c.descripcion, ''))) > 0
           )
         GROUP BY c.id, matricula.estado, matricula.fecha_matricula
         ORDER BY CASE WHEN matricula.estado = 'activo' THEN 0 ELSE 1 END, c.titulo ASC`,
        [response.locals.alumnoId, search],
      );

      response.json({ cursos: result.rows.map(mapCourse) });
    } catch (error) {
      console.error("Error al consultar cursos inscritos:", error);
      response.status(500).json({ error: "No se pudieron cargar tus cursos." });
    }
  });

  router.post("/:id/enroll", async (request: Request, response: Response) => {
    const courseId = request.params.id;
    if (!/^\d{1,19}$/.test(courseId) || BigInt(courseId) > 9_223_372_036_854_775_807n) {
      response.status(400).json({ error: "El curso indicado no es válido." });
      return;
    }

    try {
      const enrolled = await db.query<{ curso_id: string }>(
        `INSERT INTO academy.matriculas AS matricula_actual (alumno_id, curso_id, estado)
         SELECT $1, c.id, 'activo'
         FROM academy.cursos c
         WHERE c.id = $2 AND c.activo = TRUE
         ON CONFLICT (alumno_id, curso_id)
         DO UPDATE SET estado = 'activo', fecha_matricula = CURRENT_TIMESTAMP
         WHERE matricula_actual.estado = 'cancelado'
         RETURNING curso_id::text`,
        [response.locals.alumnoId, courseId],
      );

      if (enrolled.rowCount && enrolled.rowCount > 0) {
        response.status(201).json({
          cursoId: enrolled.rows[0].curso_id,
          estado: "activo",
        });
        return;
      }

      const existing = await db.query<{ activo: boolean; estado: string | null }>(
        `SELECT c.activo, matricula.estado
         FROM academy.cursos c
         LEFT JOIN academy.matriculas matricula
           ON matricula.curso_id = c.id AND matricula.alumno_id = $1
         WHERE c.id = $2
         LIMIT 1`,
        [response.locals.alumnoId, courseId],
      );
      const course = existing.rows[0];
      if (!course || !course.activo) {
        response.status(404).json({ error: "Este curso ya no está disponible." });
        return;
      }
      if (course.estado === "activo" || course.estado === "finalizado") {
        response.status(409).json({ error: "Ya estás inscrito en este curso." });
        return;
      }

      response.status(409).json({ error: "No se pudo completar la inscripción. Inténtalo de nuevo." });
    } catch (error) {
      console.error("Error al inscribir al alumno en el curso:", error);
      response.status(500).json({ error: "No se pudo completar la inscripción." });
    }
  });

  return router;
}
