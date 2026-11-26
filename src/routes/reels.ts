/**
 * API de la biblioteca de reels de repaso.
 *
 * - GET  /api/reels                 Biblioteca del alumno (filtros opcionales).
 * - GET  /api/reels/:id             Un reel concreto.
 * - POST /api/reels/:id/revisado    Marca un reel como revisado (o pendiente).
 *
 * Los reels se crean desde el servicio `crearReelDesdeRespuesta` cuando el
 * alumno falla una pregunta; esta API solo los consulta y actualiza.
 */
import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";
import { requerirAlumno } from "../security/sesion-alumno";

type ReelsDependencies = {
  db: Pool;
  jwtSecret: string;
};

export type ReelRow = {
  id: string;
  concepto: string;
  descripcion_error: string;
  recomendacion: string;
  tiempo_inicio: number | null;
  tiempo_fin: number | null;
  veces_detectado: number;
  revisada: boolean;
  fecha_creacion: Date | string;
  contenido_id: string | null;
  contenido_titulo: string | null;
  url: string | null;
  modulo_titulo: string | null;
  modulo_orden: number | null;
  curso_id: string | null;
  curso_titulo: string | null;
};

const MAX_BIGINT = 9_223_372_036_854_775_807n;

/** Comprueba que un id de la URL es un número válido para un BIGINT de PostgreSQL. */
export function esIdValido(valor: unknown): valor is string {
  return typeof valor === "string" && /^\d{1,19}$/.test(valor) && BigInt(valor) <= MAX_BIGINT;
}

/** Convierte segundos en texto de reloj: 75 → "1:15", 3725 → "1:02:05". */
export function formatearTiempo(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const resto = String(total % 60).padStart(2, "0");
  return horas > 0 ? `${horas}:${String(minutos).padStart(2, "0")}:${resto}` : `${minutos}:${resto}`;
}

/**
 * Lee `?estado=` de la URL: `pendiente`, `revisado` o nada (todos).
 * Devuelve `undefined` si el valor no es válido.
 */
export function leerFiltroEstado(valor: unknown): boolean | null | undefined {
  if (valor === undefined || valor === "" || valor === "todos") return null;
  if (valor === "pendiente") return false;
  if (valor === "revisado") return true;
  return undefined;
}

/** Da forma a una fila de la base de datos para enviarla al cliente. */
export function mapearReel(row: ReelRow) {
  const tieneClip = row.url !== null && row.tiempo_inicio !== null && row.tiempo_fin !== null;

  return {
    id: row.id,
    concepto: row.concepto,
    motivo: row.descripcion_error,
    recomendacion: row.recomendacion,
    vecesDetectado: Number(row.veces_detectado),
    revisada: row.revisada,
    fechaCreacion: new Date(row.fecha_creacion).toISOString(),
    curso: row.curso_id ? { id: row.curso_id, titulo: row.curso_titulo } : null,
    leccion: row.contenido_id
      ? { id: row.contenido_id, titulo: row.contenido_titulo, modulo: row.modulo_titulo, orden: row.modulo_orden }
      : null,
    // Sin clip, la interfaz muestra solo la recomendación y el enlace a la lección.
    clip: tieneClip
      ? {
          url: row.url as string,
          inicio: row.tiempo_inicio as number,
          fin: row.tiempo_fin as number,
          duracion: (row.tiempo_fin as number) - (row.tiempo_inicio as number),
          inicioTexto: formatearTiempo(row.tiempo_inicio as number),
          // Fragmento de medios: el <video> reproduce solo este tramo.
          urlFragmento: `${row.url}#t=${row.tiempo_inicio},${row.tiempo_fin}`,
        }
      : null,
  };
}

const SELECT_REELS = `
  SELECT
    r.id::text,
    r.concepto,
    r.descripcion_error,
    r.recomendacion,
    r.tiempo_inicio,
    r.tiempo_fin,
    r.veces_detectado,
    r.revisada,
    r.fecha_creacion,
    c.id::text AS contenido_id,
    c.titulo AS contenido_titulo,
    c.url,
    m.titulo AS modulo_titulo,
    m.orden AS modulo_orden,
    cu.id::text AS curso_id,
    cu.titulo AS curso_titulo
  FROM academy.recomendaciones_repaso r
  LEFT JOIN academy.contenidos c ON c.id = r.contenido_id
  LEFT JOIN academy.modulos m ON m.id = c.modulo_id
  LEFT JOIN academy.cursos cu ON cu.id = m.curso_id`;

export function createReelsRouter({ db, jwtSecret }: ReelsDependencies) {
  const router = Router();
  router.use(requerirAlumno(db, jwtSecret));

  router.get("/", async (request: Request, response: Response) => {
    const revisada = leerFiltroEstado(request.query.estado);
    if (revisada === undefined) {
      response.status(400).json({ error: "El estado debe ser «pendiente», «revisado» o «todos»." });
      return;
    }
    const cursoId = request.query.curso;
    if (cursoId !== undefined && !esIdValido(cursoId)) {
      response.status(400).json({ error: "El curso indicado no es válido." });
      return;
    }

    try {
      const resultado = await db.query<ReelRow>(
        `${SELECT_REELS}
         WHERE r.alumno_id = $1
           AND ($2::boolean IS NULL OR r.revisada = $2)
           AND ($3::bigint IS NULL OR cu.id = $3)
         ORDER BY r.revisada ASC, r.veces_detectado DESC, r.fecha_creacion DESC, r.id DESC
         LIMIT 200`,
        [response.locals.alumnoId, revisada, cursoId ?? null],
      );
      const resumen = await db.query<{ total: number; pendientes: number }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE NOT revisada)::int AS pendientes
         FROM academy.recomendaciones_repaso
         WHERE alumno_id = $1`,
        [response.locals.alumnoId],
      );

      response.json({ reels: resultado.rows.map(mapearReel), resumen: resumen.rows[0] });
    } catch (error) {
      console.error("Error al consultar los reels:", error);
      response.status(500).json({ error: "No se pudieron cargar tus reels de repaso." });
    }
  });

  router.get("/:id", async (request: Request, response: Response) => {
    if (!esIdValido(request.params.id)) {
      response.status(400).json({ error: "El reel indicado no es válido." });
      return;
    }

    try {
      const resultado = await db.query<ReelRow>(
        `${SELECT_REELS}
         WHERE r.id = $1 AND r.alumno_id = $2`,
        [request.params.id, response.locals.alumnoId],
      );
      if (!resultado.rows[0]) {
        response.status(404).json({ error: "No se encontró este reel." });
        return;
      }
      response.json({ reel: mapearReel(resultado.rows[0]) });
    } catch (error) {
      console.error("Error al consultar el reel:", error);
      response.status(500).json({ error: "No se pudo cargar el reel." });
    }
  });

  router.post("/:id/revisado", async (request: Request, response: Response) => {
    if (!esIdValido(request.params.id)) {
      response.status(400).json({ error: "El reel indicado no es válido." });
      return;
    }
    // Por defecto marca como revisado; { "revisada": false } lo devuelve a pendiente.
    const valor = request.body?.revisada ?? true;
    if (typeof valor !== "boolean") {
      response.status(400).json({ error: "«revisada» debe ser true o false." });
      return;
    }

    try {
      const actualizado = await db.query(
        `UPDATE academy.recomendaciones_repaso
         SET revisada = $3
         WHERE id = $1 AND alumno_id = $2`,
        [request.params.id, response.locals.alumnoId, valor],
      );
      if (actualizado.rowCount === 0) {
        response.status(404).json({ error: "No se encontró este reel." });
        return;
      }
      response.json({ id: request.params.id, revisada: valor });
    } catch (error) {
      console.error("Error al actualizar el reel:", error);
      response.status(500).json({ error: "No se pudo guardar el cambio." });
    }
  });

  return router;
}
