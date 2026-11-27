import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";
import { verifyToken } from "../security/token";
import { evaluarItinerarioInicial, type RespuestaEvaluacion } from "../ia/itinerario/evaluar-inicial";

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
  evaluacion_inicial_completada?: boolean;
};

function getSearchTerm(request: Request): string | null {
  const value = request.query.search;
  if (value === undefined) return "";
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length <= 100 ? normalized : null;
}

function isValidDatabaseId(value: string): boolean {
  return /^\d{1,19}$/.test(value) && BigInt(value) <= 9_223_372_036_854_775_807n;
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
          evaluacionInicialCompletada: row.evaluacion_inicial_completada ?? false,
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

  router.get("/:courseId/lessons/:contentId", async (request: Request, response: Response) => {
    const { courseId, contentId } = request.params;
    if (!isValidDatabaseId(courseId) || !isValidDatabaseId(contentId)) {
      response.status(400).json({ error: "El curso o la lección indicados no son válidos." });
      return;
    }

    try {
      const result = await db.query<{
        autorizado: boolean;
        contenido_id: string | null;
        titulo: string | null;
        modulo_titulo: string | null;
        video_url: string | null;
        duracion_segundos: number | null;
        transcripcion_texto: string | null;
        transcripcion_idioma: string | null;
      }>(
        `SELECT EXISTS (
           SELECT 1
           FROM academy.matriculas matricula
           WHERE matricula.alumno_id = $1
             AND matricula.curso_id = $2
             AND matricula.estado IN ('activo', 'finalizado')
         ) AS autorizado,
         contenido.id::text AS contenido_id,
         contenido.titulo,
         modulo.titulo AS modulo_titulo,
         contenido.url AS video_url,
         contenido.duracion_segundos,
         transcripcion.texto AS transcripcion_texto,
         transcripcion.idioma AS transcripcion_idioma
         FROM (SELECT 1) AS solicitud
         LEFT JOIN academy.contenidos contenido
           ON contenido.id = $3
          AND contenido.tipo = 'video'
          AND EXISTS (
            SELECT 1
            FROM academy.modulos modulo_curso
            WHERE modulo_curso.id = contenido.modulo_id
              AND modulo_curso.curso_id = $2
          )
         LEFT JOIN academy.modulos modulo ON modulo.id = contenido.modulo_id
         LEFT JOIN LATERAL (
           SELECT transcripciones.texto, transcripciones.idioma
           FROM academy.transcripciones transcripciones
           WHERE transcripciones.contenido_id = contenido.id
           ORDER BY CASE transcripciones.idioma
             WHEN 'es' THEN 0
             WHEN 'en' THEN 1
             ELSE 2
           END, transcripciones.idioma, transcripciones.id
           LIMIT 1
         ) transcripcion ON TRUE`,
        [response.locals.alumnoId, courseId, contentId],
      );
      const lesson = result.rows[0];

      if (!lesson.autorizado) {
        response.status(403).json({ error: "No estás inscrito en este curso." });
        return;
      }
      if (!lesson.contenido_id) {
        response.status(404).json({ error: "No se encontró el vídeo solicitado en este curso." });
        return;
      }

      response.json({
        leccion: {
          contenidoId: lesson.contenido_id,
          titulo: lesson.titulo,
          moduloTitulo: lesson.modulo_titulo,
          videoUrl: lesson.video_url,
          duracionSegundos: lesson.duracion_segundos,
          transcripcion: lesson.transcripcion_texto === null
            ? null
            : {
                texto: lesson.transcripcion_texto,
                idioma: lesson.transcripcion_idioma,
              },
        },
      });
    } catch (error) {
      console.error("Error al consultar la lección:", error);
      response.status(500).json({ error: "No se pudo cargar la lección." });
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
           EXISTS (
             SELECT 1
             FROM academy.evaluaciones diagnostico
             JOIN academy.intentos_evaluacion intento
               ON intento.evaluacion_id = diagnostico.id
              AND intento.alumno_id = $1
              AND intento.estado = 'completado'
             WHERE diagnostico.curso_id = c.id AND diagnostico.tipo = 'inicial'
           ) AS evaluacion_inicial_completada,
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

  router.post("/:id/initial-assessment/start", async (request: Request, response: Response) => {
    const courseId = request.params.id;
    if (!/^\d{1,19}$/.test(courseId) || BigInt(courseId) > 9_223_372_036_854_775_807n) {
      response.status(400).json({ error: "El curso indicado no es válido." });
      return;
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const enrollment = await client.query(
        `SELECT 1 FROM academy.matriculas
         WHERE alumno_id = $1 AND curso_id = $2 AND estado = 'activo'
         FOR UPDATE`,
        [response.locals.alumnoId, courseId],
      );
      if (!enrollment.rowCount) {
        await client.query("ROLLBACK");
        response.status(403).json({ error: "Inscríbete en el curso para hacer el examen inicial." });
        return;
      }

      const evaluation = await client.query<{ id: string; titulo: string; descripcion: string | null }>(
        `SELECT id::text, titulo, descripcion
         FROM academy.evaluaciones
         WHERE curso_id = $1 AND tipo = 'inicial'
         LIMIT 1`,
        [courseId],
      );
      if (!evaluation.rowCount) {
        await client.query("ROLLBACK");
        response.status(409).json({ error: "Este curso todavía no tiene configurado su examen inicial." });
        return;
      }

      const evaluationId = evaluation.rows[0].id;
      const previous = await client.query<{ id: string; numero_intento: number; estado: string }>(
        `SELECT id::text, numero_intento, estado
         FROM academy.intentos_evaluacion
         WHERE alumno_id = $1 AND evaluacion_id = $2
         ORDER BY numero_intento DESC
         LIMIT 1
         FOR UPDATE`,
        [response.locals.alumnoId, evaluationId],
      );
      if (previous.rows[0]?.estado === "completado") {
        await client.query("ROLLBACK");
        response.status(409).json({ error: "Ya completaste el examen inicial de este curso.", yaCompletada: true });
        return;
      }

      let attemptId = previous.rows[0]?.id;
      if (!attemptId) {
        const attempt = await client.query<{ id: string }>(
          `INSERT INTO academy.intentos_evaluacion (alumno_id, evaluacion_id, numero_intento)
           SELECT $1, $2, COALESCE(MAX(numero_intento), 0) + 1
           FROM academy.intentos_evaluacion
           WHERE alumno_id = $1 AND evaluacion_id = $2
           RETURNING id::text`,
          [response.locals.alumnoId, evaluationId],
        );
        attemptId = attempt.rows[0].id;
      }

      const questions = await client.query<{
        id: string; enunciado: string; tipo_interaccion: string | null;
        modulo_titulo: string; contenido_titulo: string;
        estimulo: Record<string, unknown> | null; respuesta: string | null;
        canal: "texto" | "voz" | null;
      }>(
        `SELECT pregunta.id::text, pregunta.enunciado, pregunta.tipo_interaccion,
                modulo.titulo AS modulo_titulo, contenido.titulo AS contenido_titulo,
                pregunta.configuracion->'estimulo' AS estimulo,
                COALESCE(respuesta.transcripcion_oral, respuesta.respuesta_texto) AS respuesta,
                respuesta.respuesta_json->>'canal' AS canal
         FROM academy.evaluacion_preguntas ep
         JOIN academy.preguntas pregunta ON pregunta.id = ep.pregunta_id AND pregunta.activa = TRUE
         JOIN academy.modulos modulo ON modulo.id = pregunta.modulo_id
         LEFT JOIN academy.contenidos contenido ON contenido.id = pregunta.contenido_id
         LEFT JOIN academy.respuestas respuesta
           ON respuesta.intento_id = $2 AND respuesta.pregunta_id = pregunta.id
         WHERE ep.evaluacion_id = $1
         ORDER BY ep.orden`,
        [evaluationId, attemptId],
      );
      if (questions.rows.length === 0) {
        await client.query("ROLLBACK");
        response.status(409).json({ error: "El examen inicial todavía no tiene preguntas." });
        return;
      }

      await client.query("COMMIT");
      response.json({
        intentoId: attemptId,
        evaluacion: {
          id: evaluationId,
          titulo: evaluation.rows[0].titulo,
          descripcion: evaluation.rows[0].descripcion,
          totalPreguntas: questions.rows.length,
        },
        preguntas: questions.rows.map((question) => ({
          id: question.id,
          enunciado: question.enunciado,
          tipoInteraccion: question.tipo_interaccion,
          moduloTitulo: question.modulo_titulo,
          contenidoTitulo: question.contenido_titulo,
          estimulo: question.estimulo,
          respuesta: question.respuesta,
          canal: question.canal,
        })),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error al iniciar el examen inicial:", error);
      response.status(500).json({ error: "No se pudo iniciar el examen inicial." });
    } finally {
      client.release();
    }
  });

  router.put("/:id/initial-assessment/answer", async (request: Request, response: Response) => {
    const courseId = request.params.id;
    const { intentoId, preguntaId, respuesta, canal } = request.body as {
      intentoId?: unknown; preguntaId?: unknown; respuesta?: unknown; canal?: unknown;
    };
    if (!/^\d{1,19}$/.test(courseId) || BigInt(courseId) > 9_223_372_036_854_775_807n ||
        typeof intentoId !== "string" || !/^\d{1,19}$/.test(intentoId) ||
        typeof preguntaId !== "string" || !/^\d{1,19}$/.test(preguntaId) ||
        typeof respuesta !== "string" || respuesta.length > 4000 ||
        (canal !== "texto" && canal !== "voz")) {
      response.status(400).json({ error: "La respuesta enviada no es válida." });
      return;
    }

    try {
      const valid = await db.query(
        `SELECT 1
         FROM academy.intentos_evaluacion intento
         JOIN academy.evaluaciones evaluacion ON evaluacion.id = intento.evaluacion_id
         JOIN academy.evaluacion_preguntas ep ON ep.evaluacion_id = evaluacion.id AND ep.pregunta_id = $3
         WHERE intento.id = $1 AND intento.alumno_id = $2 AND intento.estado = 'en_curso'
           AND evaluacion.curso_id = $4 AND evaluacion.tipo = 'inicial'`,
        [intentoId, response.locals.alumnoId, preguntaId, courseId],
      );
      if (!valid.rowCount) {
        response.status(400).json({ error: "La pregunta no pertenece a una evaluación activa del curso." });
        return;
      }

      await db.query(
        `INSERT INTO academy.respuestas
           (intento_id, pregunta_id, respuesta_texto, transcripcion_oral, respuesta_json, respondida)
         VALUES (
           $1, $2,
           CASE WHEN length(btrim($3)) > 0 THEN btrim($3) ELSE NULL END,
           CASE WHEN $4 = 'voz' AND length(btrim($3)) > 0 THEN btrim($3) ELSE NULL END,
           CASE WHEN length(btrim($3)) > 0 THEN jsonb_build_object('canal', $4::text) ELSE NULL END,
           length(btrim($3)) > 0
         )
         ON CONFLICT (intento_id, pregunta_id)
         DO UPDATE SET respuesta_json = EXCLUDED.respuesta_json,
                       respuesta_texto = EXCLUDED.respuesta_texto,
                       transcripcion_oral = EXCLUDED.transcripcion_oral,
                       es_correcta = NULL, respondida = EXCLUDED.respondida,
                       fecha_respuesta = CURRENT_TIMESTAMP`,
        [intentoId, preguntaId, respuesta.trim(), canal],
      );
      response.json({ guardada: true });
    } catch (error) {
      console.error("Error al guardar una respuesta del examen inicial:", error);
      response.status(500).json({ error: "No se pudo guardar la respuesta." });
    }
  });

  router.post("/:id/initial-assessment/submit", async (request: Request, response: Response) => {
    const courseId = request.params.id;
    const intentoId = (request.body as { intentoId?: unknown }).intentoId;
    if (!/^\d{1,19}$/.test(courseId) || BigInt(courseId) > 9_223_372_036_854_775_807n ||
        typeof intentoId !== "string" || !/^\d{1,19}$/.test(intentoId)) {
      response.status(400).json({ error: "El examen indicado no es válido." });
      return;
    }

    try {
      const attempt = await db.query<{ evaluacion_id: string; estado: string }>(
        `SELECT intento.evaluacion_id::text, intento.estado
         FROM academy.intentos_evaluacion intento
         JOIN academy.evaluaciones evaluacion ON evaluacion.id = intento.evaluacion_id
         WHERE intento.id = $1 AND intento.alumno_id = $2
           AND evaluacion.curso_id = $3 AND evaluacion.tipo = 'inicial'
         FOR UPDATE OF intento`,
        [intentoId, response.locals.alumnoId, courseId],
      );
      if (!attempt.rowCount || attempt.rows[0].estado !== "en_curso") {
        response.status(409).json({
          error: "Este intento ya no está disponible.",
          yaCompletada: attempt.rows[0]?.estado === "completado",
        });
        return;
      }
      const evaluationId = attempt.rows[0].evaluacion_id;
      const answerRows = await db.query<RespuestaEvaluacion & { preguntaId: string }>(
        `SELECT pregunta.modulo_id::text AS "moduloId", modulo.titulo AS "moduloTitulo",
                modulo.orden AS "ordenOriginal", contenido.id::text AS "contenidoId",
                contenido.titulo AS "contenidoTitulo", pregunta.id::text AS "preguntaId",
                pregunta.enunciado AS pregunta, pregunta.concepto,
                pregunta.explicacion AS "explicacion",
                COALESCE(opcion_correcta.texto, pregunta.respuesta_correcta->>'texto') AS "respuestaEsperada",
                COALESCE(respuesta.transcripcion_oral, respuesta.respuesta_texto, '') AS "respuestaAlumno"
         FROM academy.evaluacion_preguntas ep
         JOIN academy.preguntas pregunta ON pregunta.id = ep.pregunta_id AND pregunta.activa = TRUE
         JOIN academy.modulos modulo ON modulo.id = pregunta.modulo_id
         JOIN academy.contenidos contenido ON contenido.id = pregunta.contenido_id
         JOIN academy.respuestas respuesta
           ON respuesta.intento_id = $2 AND respuesta.pregunta_id = pregunta.id AND respuesta.respondida = TRUE
         LEFT JOIN LATERAL (
           SELECT opcion.texto FROM academy.opciones_pregunta opcion
           WHERE opcion.pregunta_id = pregunta.id
             AND opcion.valor = pregunta.respuesta_correcta->>'valor'
           LIMIT 1
         ) opcion_correcta ON TRUE
         WHERE ep.evaluacion_id = $1
         ORDER BY ep.orden`,
        [evaluationId, intentoId],
      );
      const questionCount = await db.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM academy.evaluacion_preguntas WHERE evaluacion_id = $1`,
        [evaluationId],
      );
      if (!questionCount.rows[0].total || answerRows.rowCount !== questionCount.rows[0].total) {
        response.status(400).json({ error: "Responde todas las preguntas antes de terminar." });
        return;
      }

      const videos = await db.query<{ id: string }>(
        `SELECT contenido.id::text AS id
         FROM academy.contenidos contenido
         JOIN academy.modulos modulo ON modulo.id = contenido.modulo_id
         JOIN academy.evaluaciones evaluacion ON evaluacion.curso_id = modulo.curso_id
         WHERE evaluacion.id = $1 AND contenido.tipo = 'video' AND contenido.disponible = TRUE`,
        [evaluationId],
      );
      const includedContentIds = new Set(answerRows.rows.map((row) => row.contenidoId));
      if (videos.rows.some((video) => !includedContentIds.has(video.id))) {
        response.status(409).json({ error: "El examen inicial no cubre todavía todos los vídeos de este curso." });
        return;
      }

      let decision;
      try {
        decision = await evaluarItinerarioInicial(answerRows.rows);
      } catch (error) {
        console.error("No se pudo obtener el diagnóstico de Gemini.", error instanceof Error ? error.message : "Error desconocido.");
        response.status(503).json({ error: "No se pudo preparar el itinerario con la IA. Tus respuestas están guardadas; inténtalo de nuevo." });
        return;
      }

      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const lockedAttempt = await client.query<{ estado: string }>(
          `SELECT intento.estado
           FROM academy.intentos_evaluacion intento
           WHERE intento.id = $1 AND intento.alumno_id = $2
             AND intento.evaluacion_id = $3
           FOR UPDATE`,
          [intentoId, response.locals.alumnoId, evaluationId],
        );
        if (!lockedAttempt.rowCount || lockedAttempt.rows[0].estado !== "en_curso") {
          await client.query("ROLLBACK");
          response.status(409).json({
            error: "Este intento ya no está disponible.",
            yaCompletada: lockedAttempt.rows[0]?.estado === "completado",
          });
          return;
        }

        await client.query(
          `UPDATE academy.respuestas respuesta
           SET es_correcta = (respuesta.pregunta_id = ANY($3::bigint[]))
           FROM academy.evaluacion_preguntas ep
           WHERE ep.evaluacion_id = $1 AND respuesta.intento_id = $2
             AND respuesta.pregunta_id = ep.pregunta_id`,
          [evaluationId, intentoId, decision.preguntasCorrectas],
        );
        await client.query(
          `UPDATE academy.intentos_evaluacion
           SET estado = 'completado', fecha_fin = CURRENT_TIMESTAMP, puntuacion = NULL
           WHERE id = $1`,
          [intentoId],
        );

        const mastered = await client.query<{ contenido_id: string }>(
          `UPDATE academy.itinerario_contenidos ic
           SET estado = 'saltado', motivo = 'conocimiento_previo'
           FROM academy.itinerarios itinerario
           WHERE ic.itinerario_id = itinerario.id
             AND itinerario.alumno_id = $1
             AND ic.contenido_id = ANY($2::bigint[])
           RETURNING ic.contenido_id::text`,
          [response.locals.alumnoId, decision.contenidosDominados],
        );
        await client.query(
          `INSERT INTO academy.progreso_contenido
             (alumno_id, contenido_id, estado, porcentaje, fecha_inicio, fecha_completado)
           SELECT $1, lista.contenido_id, 'saltado', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
           FROM UNNEST($2::bigint[]) AS lista(contenido_id)
           ON CONFLICT (alumno_id, contenido_id)
           DO UPDATE SET estado = 'saltado', porcentaje = 100,
                         fecha_completado = COALESCE(academy.progreso_contenido.fecha_completado, CURRENT_TIMESTAMP),
                         fecha_actualizacion = CURRENT_TIMESTAMP`,
          [response.locals.alumnoId, decision.contenidosDominados],
        );
        await client.query(
          `UPDATE academy.itinerarios itinerario
           SET orden_personalizado = modulos.posicion::integer,
               actualizado = CURRENT_TIMESTAMP
           FROM UNNEST($1::bigint[]) WITH ORDINALITY AS modulos(modulo_id, posicion)
           WHERE itinerario.modulo_id = modulos.modulo_id
             AND itinerario.alumno_id = $2`,
          [decision.ordenModulos, response.locals.alumnoId],
        );

        const masteredTitles = await client.query<{ titulo: string }>(
          `SELECT contenido.titulo
           FROM academy.contenidos contenido
           WHERE contenido.id = ANY($1::bigint[])
           ORDER BY array_position($1::bigint[], contenido.id)`,
          [decision.contenidosDominados],
        );
        const orderedModules = await client.query<{ titulo: string; orden: number }>(
          `SELECT modulo.titulo, itinerario.orden_personalizado AS orden
           FROM academy.itinerarios itinerario
           JOIN academy.modulos modulo ON modulo.id = itinerario.modulo_id
           JOIN academy.evaluaciones evaluacion ON evaluacion.curso_id = modulo.curso_id
           WHERE evaluacion.id = $1 AND itinerario.alumno_id = $2
           ORDER BY itinerario.orden_personalizado`,
          [evaluationId, response.locals.alumnoId],
        );
        await client.query("COMMIT");
        response.json({
          completado: true,
          contenidosDominados: masteredTitles.rows.map((row) => row.titulo),
          modulosOrdenados: orderedModules.rows,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error al terminar el examen inicial.", error instanceof Error ? error.message : "Error desconocido.");
      response.status(500).json({ error: "No se pudo finalizar el examen inicial." });
    }
  });

  router.get("/:id/itinerary", async (request: Request, response: Response) => {
    const courseId = request.params.id;
    if (!/^\d{1,19}$/.test(courseId) || BigInt(courseId) > 9_223_372_036_854_775_807n) {
      response.status(400).json({ error: "El curso indicado no es válido." });
      return;
    }

    try {
      const initialAssessment = await db.query<{ completada: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM academy.matriculas matricula
           JOIN academy.evaluaciones evaluacion ON evaluacion.curso_id = matricula.curso_id AND evaluacion.tipo = 'inicial'
           JOIN academy.intentos_evaluacion intento
             ON intento.evaluacion_id = evaluacion.id AND intento.alumno_id = matricula.alumno_id
            AND intento.estado = 'completado'
           WHERE matricula.alumno_id = $1 AND matricula.curso_id = $2
             AND matricula.estado IN ('activo', 'finalizado')
         ) AS completada`,
        [response.locals.alumnoId, courseId],
      );
      if (!initialAssessment.rows[0]?.completada) {
        response.status(409).json({ error: "Completa el examen inicial para preparar tu itinerario.", evaluacionInicialPendiente: true });
        return;
      }

      const result = await db.query<{
        curso_id: string; curso_titulo: string; curso_descripcion: string | null;
        modulo_id: string; modulo_titulo: string; modulo_descripcion: string | null; modulo_orden: number;
        contenido_id: string | null; contenido_titulo: string | null; contenido_tipo: string | null;
        contenido_url: string | null; contenido_duracion: number | null; contenido_orden: number | null;
        estado: string | null; porcentaje: number | null;
      }>(
        `SELECT c.id::text AS curso_id, c.titulo AS curso_titulo, c.descripcion AS curso_descripcion,
                m.id::text AS modulo_id, m.titulo AS modulo_titulo,
                m.descripcion AS modulo_descripcion, COALESCE(i.orden_personalizado, m.orden) AS modulo_orden,
                contenido.id::text AS contenido_id, contenido.titulo AS contenido_titulo,
                contenido.tipo AS contenido_tipo, contenido.url AS contenido_url,
                contenido.duracion_segundos AS contenido_duracion, ic.orden AS contenido_orden,
                COALESCE(progreso.estado, ic.estado) AS estado,
                COALESCE(progreso.porcentaje, CASE WHEN ic.estado IN ('completado', 'saltado') THEN 100 ELSE 0 END) AS porcentaje
         FROM academy.matriculas matricula
         JOIN academy.cursos c ON c.id = matricula.curso_id
         JOIN academy.modulos m ON m.curso_id = c.id
         LEFT JOIN academy.itinerarios i
           ON i.alumno_id = matricula.alumno_id AND i.modulo_id = m.id
         LEFT JOIN academy.itinerario_contenidos ic ON ic.itinerario_id = i.id
         LEFT JOIN academy.contenidos contenido ON contenido.id = ic.contenido_id
         LEFT JOIN academy.progreso_contenido progreso
           ON progreso.alumno_id = matricula.alumno_id AND progreso.contenido_id = contenido.id
         WHERE matricula.alumno_id = $1 AND matricula.curso_id = $2
           AND matricula.estado IN ('activo', 'finalizado')
         ORDER BY COALESCE(i.orden_personalizado, m.orden), ic.orden NULLS LAST, contenido.id`,
        [response.locals.alumnoId, courseId],
      );

      if (result.rows.length === 0) {
        const enrolled = await db.query<{ id: string; titulo: string; descripcion: string | null }>(
          `SELECT c.id::text, c.titulo, c.descripcion
           FROM academy.matriculas m JOIN academy.cursos c ON c.id = m.curso_id
           WHERE m.alumno_id = $1 AND m.curso_id = $2 AND m.estado IN ('activo', 'finalizado')`,
          [response.locals.alumnoId, courseId],
        );
        response.status(enrolled.rowCount ? 200 : 404).json(enrolled.rowCount
          ? { curso: enrolled.rows[0], modulos: [] }
          : { error: "No estás inscrito en este curso." });
        return;
      }

      const first = result.rows[0];
      const modules = new Map<string, {
        id: string; titulo: string; descripcion: string | null; orden: number;
        contenidos: Array<{ id: string; titulo: string; tipo: string; url: string | null; duracionSegundos: number | null; orden: number; estado: string; porcentaje: number }>;
        evaluaciones: Array<{ id: string; contenidoId: string | null; tipo: string; titulo: string; estado: string }>;
      }>();
      for (const row of result.rows) {
        let module = modules.get(row.modulo_id);
        if (!module) {
          module = { id: row.modulo_id, titulo: row.modulo_titulo, descripcion: row.modulo_descripcion, orden: row.modulo_orden, contenidos: [], evaluaciones: [] };
          modules.set(row.modulo_id, module);
        }
        if (row.contenido_id) {
          module.contenidos.push({
            id: row.contenido_id, titulo: row.contenido_titulo ?? "Contenido",
            tipo: row.contenido_tipo ?? "video", url: row.contenido_url,
            duracionSegundos: row.contenido_duracion, orden: row.contenido_orden ?? 0,
            estado: row.estado ?? "pendiente", porcentaje: Number(row.porcentaje ?? 0),
          });
        }
      }

      const evaluations = await db.query<{
        id: string; modulo_id: string; contenido_id: string | null; tipo: string; titulo: string; estado: string;
      }>(
        `SELECT e.id::text, e.modulo_id::text, e.contenido_id::text, e.tipo, e.titulo,
                COALESCE(ultimo_intento.estado, 'pendiente') AS estado
         FROM academy.evaluaciones e
         JOIN academy.modulos m ON m.id = e.modulo_id
         JOIN academy.matriculas matricula ON matricula.curso_id = m.curso_id
         LEFT JOIN LATERAL (
           SELECT intento.estado
           FROM academy.intentos_evaluacion intento
           WHERE intento.alumno_id = matricula.alumno_id AND intento.evaluacion_id = e.id
           ORDER BY intento.numero_intento DESC
           LIMIT 1
         ) ultimo_intento ON TRUE
         WHERE matricula.alumno_id = $1 AND matricula.curso_id = $2 AND e.tipo <> 'inicial'
           AND matricula.estado IN ('activo', 'finalizado')
         ORDER BY m.orden, CASE e.tipo WHEN 'intermedia' THEN 1 ELSE 2 END,
                  e.contenido_id NULLS FIRST, e.id`,
        [response.locals.alumnoId, courseId],
      );
      for (const evaluation of evaluations.rows) {
        modules.get(evaluation.modulo_id)?.evaluaciones.push({
          id: evaluation.id,
          contenidoId: evaluation.contenido_id,
          tipo: evaluation.tipo,
          titulo: evaluation.titulo,
          estado: evaluation.estado,
        });
      }
      response.json({
        curso: { id: first.curso_id, titulo: first.curso_titulo, descripcion: first.curso_descripcion },
        modulos: [...modules.values()],
      });
    } catch (error) {
      console.error("Error al cargar el itinerario del curso:", error);
      response.status(500).json({ error: "No se pudo cargar el itinerario del curso." });
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
