/**
 * RAG: consultas predefinidas sobre el alumno de la sesión.
 *
 * Solo lectura, solo las columnas permitidas en docs/IA/rag.md y sin identificadores:
 * la IA nunca ve ids, emails ni nombres. El alumnoId lo pone siempre el servidor
 * (el de la sesión), nunca la IA ni el alumno.
 *
 * Fallback: {ok:false}
 */
import { idValido, recortar, soloFecha, type BaseDatos } from "./bd";

export type ConsultaAlumno = {
  alumnoId: number | string; // de la sesión
  cursoId: number | string;
  moduloId?: number | string; // opcional: limita a un módulo
};

export type ErrorAlumno = {
  modulo: string;
  pregunta: string;
  concepto: string | null;
  minuto: number | null; // segundo del vídeo donde se explica, si se sabe
  respuesta: string | null; // lo que contestó el alumno
  fecha: string | null;
};

export type RespuestaEncuesta = {
  modulo: string;
  pregunta: string;
  concepto: string | null;
  respuesta: string | null;
  acierto: boolean | null;
};

export type EncuestaInicial = { fecha: string | null; respuestas: RespuestaEncuesta[] };

export type ProgresoContenido = {
  modulo: string;
  orden: number;
  contenido: string;
  tipo: string;
  estado: string; // pendiente, en_curso, completado o saltado
  fecha: string | null;
};

export type MotivoErrorAlumno = "consulta_no_valida" | "error_bd";
type Resultado<T> = { ok: true; datos: T } | { ok: false; motivo: MotivoErrorAlumno };

const MAX_ERRORES = 20;
const MAX_CARACTERES_RESPUESTA = 500;

function fallo(nombre: string, motivo: MotivoErrorAlumno): { ok: false; motivo: MotivoErrorAlumno } {
  // Solo el nombre de la consulta y el motivo: nunca ids ni datos del alumno.
  console.error(`RAG: ${nombre} no completada (${motivo}).`);
  return { ok: false, motivo };
}

function consultaValida(consulta: ConsultaAlumno): boolean {
  return (
    idValido(consulta?.alumnoId) &&
    idValido(consulta.cursoId) &&
    (consulta.moduloId === undefined || idValido(consulta.moduloId))
  );
}

// Respuestas falladas del alumno: la última respuesta a cada pregunta, si fue incorrecta.
// Si después la acertó, ya no cuenta como error.
export async function obtenerErrores(
  db: BaseDatos,
  consulta: ConsultaAlumno,
): Promise<Resultado<ErrorAlumno[]>> {
  if (!consultaValida(consulta)) return fallo("obtener_errores", "consulta_no_valida");
  try {
    const { rows } = await db.query(
      `SELECT modulo, pregunta, concepto, minuto, respuesta, fecha
       FROM (
         SELECT DISTINCT ON (r.pregunta_id)
                m.titulo AS modulo, m.orden AS orden_modulo, p.enunciado AS pregunta,
                p.concepto, p.tiempo_video AS minuto,
                COALESCE(r.transcripcion_oral, r.respuesta_texto) AS respuesta,
                r.es_correcta, r.fecha_respuesta AS fecha
         FROM academy.respuestas r
         JOIN academy.intentos_evaluacion i ON i.id = r.intento_id
         JOIN academy.preguntas p ON p.id = r.pregunta_id
         JOIN academy.modulos m ON m.id = p.modulo_id
         WHERE i.alumno_id = $1 AND m.curso_id = $2
           AND ($3::bigint IS NULL OR m.id = $3::bigint)
           AND r.respondida AND r.es_correcta IS NOT NULL
         ORDER BY r.pregunta_id, r.fecha_respuesta DESC
       ) ultimas
       WHERE es_correcta = FALSE
       ORDER BY fecha DESC, orden_modulo
       LIMIT $4`,
      [consulta.alumnoId, consulta.cursoId, consulta.moduloId ?? null, MAX_ERRORES],
    );
    return {
      ok: true,
      datos: rows.map((fila) => ({
        modulo: String(fila.modulo),
        pregunta: String(fila.pregunta),
        concepto: fila.concepto ?? null,
        minuto: fila.minuto === null || fila.minuto === undefined ? null : Number(fila.minuto),
        respuesta: recortar(fila.respuesta, MAX_CARACTERES_RESPUESTA),
        fecha: soloFecha(fila.fecha),
      })),
    };
  } catch {
    return fallo("obtener_errores", "error_bd");
  }
}

// Resultado del último examen inicial completado del curso. null si no lo ha hecho.
export async function obtenerEncuestaInicial(
  db: BaseDatos,
  consulta: ConsultaAlumno,
): Promise<Resultado<EncuestaInicial | null>> {
  if (!consultaValida(consulta)) return fallo("obtener_encuesta_inicial", "consulta_no_valida");
  try {
    const { rows } = await db.query(
      `WITH ultimo AS (
         SELECT i.id, i.fecha_fin
         FROM academy.intentos_evaluacion i
         JOIN academy.evaluaciones e ON e.id = i.evaluacion_id
         WHERE i.alumno_id = $1 AND e.curso_id = $2 AND e.tipo = 'inicial'
           AND i.estado = 'completado'
         ORDER BY i.fecha_fin DESC NULLS LAST, i.numero_intento DESC
         LIMIT 1
       )
       SELECT u.fecha_fin AS fecha, m.titulo AS modulo, p.enunciado AS pregunta, p.concepto,
              COALESCE(r.transcripcion_oral, r.respuesta_texto) AS respuesta,
              r.es_correcta AS acierto
       FROM ultimo u
       JOIN academy.respuestas r ON r.intento_id = u.id
       JOIN academy.preguntas p ON p.id = r.pregunta_id
       JOIN academy.modulos m ON m.id = p.modulo_id
       WHERE $3::bigint IS NULL OR m.id = $3::bigint
       ORDER BY m.orden, r.fecha_respuesta`,
      [consulta.alumnoId, consulta.cursoId, consulta.moduloId ?? null],
    );
    if (!rows.length) return { ok: true, datos: null };
    return {
      ok: true,
      datos: {
        fecha: soloFecha(rows[0].fecha),
        respuestas: rows.map((fila) => ({
          modulo: String(fila.modulo),
          pregunta: String(fila.pregunta),
          concepto: fila.concepto ?? null,
          respuesta: recortar(fila.respuesta, MAX_CARACTERES_RESPUESTA),
          acierto: typeof fila.acierto === "boolean" ? fila.acierto : null,
        })),
      },
    };
  } catch {
    return fallo("obtener_encuesta_inicial", "error_bd");
  }
}

// Estado de cada contenido del curso para el alumno (pendiente si aún no lo ha empezado).
export async function obtenerProgreso(
  db: BaseDatos,
  consulta: ConsultaAlumno,
): Promise<Resultado<ProgresoContenido[]>> {
  if (!consultaValida(consulta)) return fallo("obtener_progreso", "consulta_no_valida");
  try {
    const { rows } = await db.query(
      `SELECT m.titulo AS modulo, m.orden, c.titulo AS contenido, c.tipo,
              COALESCE(pc.estado, 'pendiente') AS estado, pc.fecha_actualizacion AS fecha
       FROM academy.modulos m
       JOIN academy.contenidos c ON c.modulo_id = m.id AND c.disponible
       LEFT JOIN academy.progreso_contenido pc ON pc.contenido_id = c.id AND pc.alumno_id = $1
       WHERE m.curso_id = $2 AND ($3::bigint IS NULL OR m.id = $3::bigint)
       ORDER BY m.orden, c.orden`,
      [consulta.alumnoId, consulta.cursoId, consulta.moduloId ?? null],
    );
    return {
      ok: true,
      datos: rows.map((fila) => ({
        modulo: String(fila.modulo),
        orden: Number(fila.orden),
        contenido: String(fila.contenido),
        tipo: String(fila.tipo),
        estado: String(fila.estado),
        fecha: soloFecha(fila.fecha),
      })),
    };
  } catch {
    return fallo("obtener_progreso", "error_bd");
  }
}
