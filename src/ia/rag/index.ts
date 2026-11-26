/**
 * RAG: monta el contexto del Tutor IA para pasárselo a consultarIA.
 *
 * Junta, por orden de prioridad, el módulo actual, los minutos de la transcripción
 * relacionados con la pregunta, los errores del alumno, su encuesta inicial y su progreso.
 * Sin ids ni datos personales y sin pasar de LIMITES.contexto: si una parte no cabe o
 * falla, se omite y el resto sigue.
 *
 * Fallback: {ok:false} solo si el curso o el módulo no son válidos.
 */
import { LIMITES } from "../gemini";
import type { OpcionesCliente } from "../gemini/cliente";
import type { DatosAlumno } from "../proteccion";
import {
  obtenerEncuestaInicial,
  obtenerErrores,
  obtenerProgreso,
  type EncuestaInicial,
  type ErrorAlumno,
  type ProgresoContenido,
} from "./alumno";
import { idValido, type BaseDatos } from "./bd";
import { buscarEnTranscripcion, type FragmentoRelevante } from "./transcripciones";

export type { BaseDatos } from "./bd";

export type ConsultaContexto = {
  alumnoId: number | string; // de la sesión, nunca del alumno ni de la IA
  cursoId: number | string;
  moduloId: number | string; // módulo en el que está el alumno
  pregunta: string; // la última pregunta del alumno
  alumno?: DatosAlumno; // para filtrar su nombre en la búsqueda
};

export type ParteContexto = "modulo" | "transcripcion" | "errores" | "encuesta_inicial" | "progreso";

export type ResultadoContexto =
  | { ok: true; contexto: string; incluido: ParteContexto[] }
  | { ok: false; motivo: "consulta_no_valida" | "modulo_no_encontrado" | "error_bd" };

// Margen bajo LIMITES.contexto: al filtrar, «Ana» pasa a «[NOMBRE]» y el texto crece un poco.
export const PRESUPUESTO_CONTEXTO = LIMITES.contexto - 2_000;

const ESTADOS: Record<string, string> = {
  pendiente: "pendiente",
  en_curso: "en curso",
  completado: "completado",
  saltado: "saltado (ya lo dominaba)",
};

// 1680 → "28:00"; 6062 → "1:41:02"
export function formatearTiempo(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const [h, m, s] = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  const dos = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`;
}

function textoTranscripcion(fragmentos: FragmentoRelevante[]): string | undefined {
  if (!fragmentos.length) return undefined;
  const bloques = fragmentos.map(
    (f) => `[Vídeo «${f.titulo}», ${formatearTiempo(f.inicio)}-${formatearTiempo(f.fin)}]\n${f.texto}`,
  );
  return (
    "## Fragmentos de la transcripción del vídeo relacionados con la pregunta (en inglés)\n" +
    bloques.join("\n\n")
  );
}

function textoErrores(errores: ErrorAlumno[], moduloActual: string): string | undefined {
  if (!errores.length) return undefined;
  const lineas = errores.map((e) => {
    const detalles = [
      e.modulo === moduloActual ? `${e.modulo} (módulo actual)` : e.modulo,
      e.concepto && `concepto: ${e.concepto}`,
      e.minuto !== null && `se explica en el ${formatearTiempo(e.minuto)} del vídeo`,
      e.fecha,
    ].filter(Boolean);
    const respuesta = e.respuesta ? `\n  Respondió: ${e.respuesta}` : "";
    return `- ${e.pregunta} [${detalles.join("; ")}]${respuesta}`;
  });
  return "## Preguntas que el alumno ha fallado (las más recientes primero)\n" + lineas.join("\n");
}

function textoEncuesta(encuesta: EncuestaInicial | null): string | undefined {
  if (!encuesta?.respuestas.length) return undefined;
  const lineas = encuesta.respuestas.map((r) => {
    const resultado = r.acierto === null ? "sin evaluar" : r.acierto ? "bien" : "mal";
    return `- ${r.modulo}: ${r.pregunta} → ${resultado}`;
  });
  return `## Examen inicial del alumno (${encuesta.fecha ?? "sin fecha"})\n` + lineas.join("\n");
}

function textoProgreso(progreso: ProgresoContenido[]): string | undefined {
  if (!progreso.length) return undefined;
  const lineas = progreso.map(
    (p) => `- Módulo ${p.orden}, ${p.tipo} «${p.contenido}»: ${ESTADOS[p.estado] ?? p.estado}`,
  );
  return "## Progreso del alumno en el curso\n" + lineas.join("\n");
}

export async function obtenerContexto(
  db: BaseDatos,
  consulta: ConsultaContexto,
  opciones: OpcionesCliente = {},
): Promise<ResultadoContexto> {
  const { alumnoId, cursoId, moduloId, pregunta } = consulta ?? {};
  if (!idValido(alumnoId) || !idValido(cursoId) || !idValido(moduloId) || typeof pregunta !== "string") {
    console.error("RAG: contexto no completado (consulta_no_valida).");
    return { ok: false, motivo: "consulta_no_valida" };
  }

  // 1. El módulo tiene que ser del curso: así nada se sale del curso del alumno.
  let curso: string;
  let modulo: string;
  let orden: number;
  try {
    const { rows } = await db.query(
      `SELECT cu.titulo AS curso, m.titulo AS modulo, m.orden
       FROM academy.modulos m
       JOIN academy.cursos cu ON cu.id = m.curso_id
       WHERE m.id = $1 AND cu.id = $2`,
      [moduloId, cursoId],
    );
    if (!rows.length) {
      console.error("RAG: contexto no completado (modulo_no_encontrado).");
      return { ok: false, motivo: "modulo_no_encontrado" };
    }
    ({ curso, modulo, orden } = rows[0]);
  } catch {
    console.error("RAG: contexto no completado (error_bd).");
    return { ok: false, motivo: "error_bd" };
  }

  // 2. Todo lo demás a la vez. Si una parte falla, ya lo ha registrado y se omite.
  const delAlumno = { alumnoId, cursoId };
  const [transcripcion, errores, encuesta, progreso] = await Promise.all([
    pregunta.trim()
      ? buscarEnTranscripcion(db, { moduloId: Number(moduloId), pregunta, alumno: consulta.alumno }, opciones)
      : undefined,
    obtenerErrores(db, delAlumno),
    obtenerEncuestaInicial(db, delAlumno),
    obtenerProgreso(db, delAlumno),
  ]);

  // 3. Por orden de prioridad, mientras quepa.
  const partes: Array<[ParteContexto, string | undefined]> = [
    ["modulo", `## Curso y módulo actual\nCurso: ${curso}\nMódulo ${orden}: ${modulo}`],
    ["transcripcion", transcripcion?.ok ? textoTranscripcion(transcripcion.fragmentos) : undefined],
    ["errores", errores.ok ? textoErrores(errores.datos, String(modulo)) : undefined],
    ["encuesta_inicial", encuesta.ok ? textoEncuesta(encuesta.datos) : undefined],
    ["progreso", progreso.ok ? textoProgreso(progreso.datos) : undefined],
  ];

  const separador = "\n\n";
  const textos: string[] = [];
  const incluido: ParteContexto[] = [];
  let longitud = 0;
  for (const [nombre, texto] of partes) {
    if (!texto) continue;
    const extra = texto.length + (textos.length ? separador.length : 0);
    if (longitud + extra > PRESUPUESTO_CONTEXTO) continue; // no cabe: se omite
    textos.push(texto);
    incluido.push(nombre);
    longitud += extra;
  }

  return { ok: true, contexto: textos.join(separador), incluido };
}
