/**
 * Servicio de reels de repaso.
 *
 * Convierte una respuesta incorrecta en un reel guardado en
 * `academy.recomendaciones_repaso`: el concepto fallado, una recomendación y
 * el tramo exacto del vídeo que lo explica.
 */
import type { Pool } from "pg";
import { type Fragmento, seleccionarTramo, type Tramo, tramoDesdeSegundo } from "./selector";

/** Datos de la pregunta fallada que necesita el servicio. */
export type PreguntaFallada = {
  enunciado: string;
  concepto: string | null;
  explicacion: string | null;
  tiempoVideo: number | null;
  configuracion: unknown;
};

/**
 * Palabras con las que buscar el concepto en los subtítulos.
 *
 * Usa `configuracion.palabras_clave` si la pregunta las trae (útil cuando el
 * vídeo está en otro idioma) y siempre añade el propio concepto.
 */
export function palabrasClaveDe(pregunta: Pick<PreguntaFallada, "concepto" | "configuracion">): string[] {
  const palabras: string[] = [];
  const configuracion = pregunta.configuracion;

  if (configuracion && typeof configuracion === "object" && "palabras_clave" in configuracion) {
    const lista = (configuracion as { palabras_clave: unknown }).palabras_clave;
    if (Array.isArray(lista)) {
      for (const palabra of lista) {
        if (typeof palabra === "string" && palabra.trim()) palabras.push(palabra.trim());
      }
    }
  }
  if (pregunta.concepto?.trim()) palabras.push(pregunta.concepto.trim());

  return palabras;
}

/**
 * Decide qué tramo del vídeo enseñar, de la fuente más fiable a la menos:
 * 1. `tiempo_video` indicado a mano en la pregunta.
 * 2. Búsqueda de las palabras clave en los subtítulos.
 * Devuelve `null` si no se encuentra: el reel se guarda igualmente, sin clip.
 */
export function elegirTramo(
  pregunta: Pick<PreguntaFallada, "tiempoVideo" | "concepto" | "configuracion">,
  fragmentos: Fragmento[],
  duracionVideo: number | null,
): Tramo | null {
  if (pregunta.tiempoVideo !== null) {
    return tramoDesdeSegundo(pregunta.tiempoVideo, duracionVideo ?? undefined);
  }
  return seleccionarTramo(fragmentos, palabrasClaveDe(pregunta));
}

/** Textos que verá el alumno, con tono de aprendizaje y no de castigo. */
export function textosDelReel(pregunta: Pick<PreguntaFallada, "enunciado" | "concepto" | "explicacion">) {
  const concepto = pregunta.concepto?.trim() || "Concepto de la lección";
  return {
    concepto,
    descripcionError: `Pregunta para repasar: «${pregunta.enunciado}»`,
    recomendacion:
      pregunta.explicacion?.trim() || `Repasa en el vídeo cómo se explica «${concepto}».`,
  };
}

export type ResultadoReel =
  | { creado: true; reelId: string; nuevo: boolean }
  | { creado: false; motivo: "no_encontrada" | "no_es_un_fallo" | "examen_inicial" | "sin_video" };

/**
 * Crea o actualiza el reel de una respuesta incorrecta del alumno.
 *
 * - Solo se usan respuestas con `es_correcta = false` del propio alumno.
 * - Los fallos del examen inicial no generan reels: ese examen mide lo que el
 *   alumno ya sabe, y el contenido pendiente ya aparece en su itinerario.
 * - Si el alumno ya tenía un reel de esa pregunta, suma `veces_detectado` y lo
 *   vuelve a marcar como pendiente en vez de duplicarlo.
 */
export async function crearReelDesdeRespuesta(
  db: Pool,
  alumnoId: string,
  respuestaId: string,
): Promise<ResultadoReel> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const datos = await client.query<{
      pregunta_id: string;
      es_correcta: boolean | null;
      tipo_evaluacion: string;
      enunciado: string;
      concepto: string | null;
      explicacion: string | null;
      tiempo_video: number | null;
      configuracion: unknown;
      contenido_id: string | null;
      duracion_segundos: number | null;
    }>(
      `SELECT
         p.id::text AS pregunta_id,
         r.es_correcta,
         e.tipo AS tipo_evaluacion,
         p.enunciado,
         p.concepto,
         p.explicacion,
         p.tiempo_video,
         p.configuracion,
         video.id::text AS contenido_id,
         video.duracion_segundos
       FROM academy.respuestas r
       JOIN academy.intentos_evaluacion i ON i.id = r.intento_id
       JOIN academy.evaluaciones e ON e.id = i.evaluacion_id
       JOIN academy.preguntas p ON p.id = r.pregunta_id
       -- El vídeo de la pregunta; si no lo tiene, el de su evaluación;
       -- y si tampoco, el primer vídeo de su módulo.
       LEFT JOIN LATERAL (
         SELECT c.id, c.duracion_segundos
         FROM academy.contenidos c
         WHERE c.tipo = 'video'
           AND (
             c.id = COALESCE(p.contenido_id, e.contenido_id)
             OR (COALESCE(p.contenido_id, e.contenido_id) IS NULL AND c.modulo_id = p.modulo_id)
           )
         ORDER BY c.orden
         LIMIT 1
       ) video ON TRUE
       WHERE r.id = $1 AND i.alumno_id = $2`,
      [respuestaId, alumnoId],
    );

    const fila = datos.rows[0];
    let resultado: ResultadoReel;

    if (!fila) {
      resultado = { creado: false, motivo: "no_encontrada" };
    } else if (fila.es_correcta !== false) {
      resultado = { creado: false, motivo: "no_es_un_fallo" };
    } else if (fila.tipo_evaluacion === "inicial") {
      resultado = { creado: false, motivo: "examen_inicial" };
    } else if (!fila.contenido_id) {
      resultado = { creado: false, motivo: "sin_video" };
    } else {
      const pregunta: PreguntaFallada = {
        enunciado: fila.enunciado,
        concepto: fila.concepto,
        explicacion: fila.explicacion,
        tiempoVideo: fila.tiempo_video,
        configuracion: fila.configuracion,
      };

      // Solo cargamos subtítulos si la pregunta no trae ya su segundo exacto.
      let fragmentos: Fragmento[] = [];
      if (pregunta.tiempoVideo === null) {
        const subtitulos = await client.query<Fragmento>(
          `SELECT f.tiempo_inicio AS "tiempoInicio", f.tiempo_fin AS "tiempoFin", f.texto
           FROM academy.fragmentos_transcripcion f
           JOIN academy.transcripciones t ON t.id = f.transcripcion_id
           WHERE t.contenido_id = $1`,
          [fila.contenido_id],
        );
        fragmentos = subtitulos.rows;
      }

      const tramo = elegirTramo(pregunta, fragmentos, fila.duracion_segundos);
      const textos = textosDelReel(pregunta);

      // FOR UPDATE bloquea la fila para que dos fallos simultáneos no la dupliquen.
      const existente = await client.query<{ id: string }>(
        `SELECT id::text
         FROM academy.recomendaciones_repaso
         WHERE alumno_id = $1 AND pregunta_id = $2
         ORDER BY id
         LIMIT 1
         FOR UPDATE`,
        [alumnoId, fila.pregunta_id],
      );

      if (existente.rows[0]) {
        await client.query(
          `UPDATE academy.recomendaciones_repaso
           SET respuesta_id = $2,
               veces_detectado = veces_detectado + 1,
               revisada = FALSE,
               tiempo_inicio = COALESCE($3, tiempo_inicio),
               tiempo_fin = COALESCE($4, tiempo_fin)
           WHERE id = $1`,
          [existente.rows[0].id, respuestaId, tramo?.tiempoInicio ?? null, tramo?.tiempoFin ?? null],
        );
        resultado = { creado: true, reelId: existente.rows[0].id, nuevo: false };
      } else {
        const insertado = await client.query<{ id: string }>(
          `INSERT INTO academy.recomendaciones_repaso
             (alumno_id, pregunta_id, respuesta_id, contenido_id,
              concepto, descripcion_error, recomendacion, tiempo_inicio, tiempo_fin)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id::text`,
          [
            alumnoId,
            fila.pregunta_id,
            respuestaId,
            fila.contenido_id,
            textos.concepto,
            textos.descripcionError,
            textos.recomendacion,
            tramo?.tiempoInicio ?? null,
            tramo?.tiempoFin ?? null,
          ],
        );
        resultado = { creado: true, reelId: insertado.rows[0].id, nuevo: true };
      }
    }

    await client.query("COMMIT");
    return resultado;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
