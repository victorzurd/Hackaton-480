/**
 * RAG: busca en la transcripción del módulo los minutos relacionados con la pregunta.
 *
 * Las transcripciones están en inglés: si es así, Gemini (a través de la pasarela)
 * traduce la pregunta a palabras clave en inglés. Con transcripciones en español se
 * busca directamente con las palabras de la pregunta.
 *
 * Fallback: {ok:false}
 */
import { consultarIAJson } from "../gemini";
import type { OpcionesCliente } from "../gemini/cliente";
import type { DatosAlumno } from "../proteccion";
import type { BaseDatos } from "./bd";

export type { BaseDatos } from "./bd";

export type FragmentoRelevante = {
  titulo: string; // título del vídeo
  inicio: number; // segundos
  fin: number;
  texto: string;
};

export type MotivoErrorBusqueda = "consulta_no_valida" | "error_bd" | "sin_palabras_clave";

export type ResultadoBusqueda =
  | { ok: true; fragmentos: FragmentoRelevante[] }
  | { ok: false; motivo: MotivoErrorBusqueda };

export type ConsultaBusqueda = {
  moduloId: number;
  pregunta: string;
  alumno?: DatosAlumno;
  limite?: number; // bloques de un minuto (por defecto 4)
};

// Idiomas de la columna transcripciones.idioma y su configuración de búsqueda en PostgreSQL.
const CONFIGURACION_IDIOMA: Record<string, string> = { en: "english", es: "spanish" };
const LIMITE_POR_DEFECTO = 4;
const LIMITE_MAXIMO = 10;
const MAX_PALABRAS = 8;
// Solo letras, números y algún símbolo de programación: lo que va a la búsqueda.
const PALABRA_VALIDA = /^[\p{L}\p{N}][\p{L}\p{N} _.+#-]{0,39}$/u;

const ESQUEMA_PALABRAS = {
  type: "OBJECT",
  properties: { palabras: { type: "ARRAY", items: { type: "STRING" } } },
  required: ["palabras"],
};

const INSTRUCCIONES_PALABRAS =
  "Eres un buscador de un curso de Python cuyas transcripciones están en inglés. " +
  `Devuelve entre 3 y ${MAX_PALABRAS} palabras clave en inglés, en minúsculas, para buscar en ` +
  "la transcripción lo que pregunta el alumno: conceptos, palabras reservadas de Python y " +
  "sinónimos. Sin frases ni explicaciones.";

function fallo(motivo: MotivoErrorBusqueda): ResultadoBusqueda {
  // Nunca se registra la pregunta: puede contener datos personales.
  console.error(`RAG: búsqueda en la transcripción no completada (${motivo}).`);
  return { ok: false, motivo };
}

export function limpiarPalabras(palabras: unknown[]): string[] {
  const limpias = palabras
    .filter((palabra): palabra is string => typeof palabra === "string")
    .map((palabra) => palabra.trim().toLowerCase())
    .filter((palabra) => PALABRA_VALIDA.test(palabra) && !palabra.includes("[")); // ni [NOMBRE]…
  return [...new Set(limpias)].slice(0, MAX_PALABRAS);
}

// Palabras de la pregunta con al menos 3 letras, para transcripciones en su mismo idioma.
function palabrasDeLaPregunta(pregunta: string): string[] {
  return limpiarPalabras(pregunta.split(/[^\p{L}\p{N}_]+/u).filter((palabra) => palabra.length >= 3));
}

async function palabrasEnIngles(
  pregunta: string,
  alumno: DatosAlumno,
  opciones: OpcionesCliente,
): Promise<string[]> {
  const resultado = await consultarIAJson<{ palabras: unknown }>(
    {
      instrucciones: INSTRUCCIONES_PALABRAS,
      mensajes: [{ rol: "usuario", texto: pregunta }],
      alumno,
      esquema: ESQUEMA_PALABRAS,
      temperatura: 0,
      maxTokensSalida: 200,
    },
    opciones,
  );
  if (!resultado.ok || !Array.isArray(resultado.datos?.palabras)) return [];
  return limpiarPalabras(resultado.datos.palabras);
}

// Agrupa las líneas de subtítulo en bloques de un minuto y devuelve los más relevantes.
const SQL_FRAGMENTOS = `
  WITH bloques AS (
    SELECT c.titulo,
           MIN(f.tiempo_inicio) AS inicio,
           MAX(f.tiempo_fin) AS fin,
           string_agg(f.texto, ' ' ORDER BY f.tiempo_inicio) AS texto
    FROM academy.contenidos c
    JOIN academy.transcripciones t ON t.contenido_id = c.id AND t.idioma = $2
    JOIN academy.fragmentos_transcripcion f ON f.transcripcion_id = t.id
    WHERE c.modulo_id = $1 AND c.tipo = 'video'
    GROUP BY c.id, c.titulo, f.tiempo_inicio / 60
  ), busqueda AS (
    SELECT websearch_to_tsquery($3::regconfig, $4) AS q
  )
  SELECT titulo, inicio, fin, texto
  FROM bloques, busqueda
  WHERE to_tsvector($3::regconfig, texto) @@ busqueda.q
  ORDER BY ts_rank(to_tsvector($3::regconfig, texto), busqueda.q) DESC, inicio
  LIMIT $5`;

export async function buscarEnTranscripcion(
  db: BaseDatos,
  consulta: ConsultaBusqueda,
  opciones: OpcionesCliente = {},
): Promise<ResultadoBusqueda> {
  const { moduloId, pregunta } = consulta ?? {};
  const limite = consulta?.limite ?? LIMITE_POR_DEFECTO;
  if (
    !Number.isInteger(moduloId) ||
    typeof pregunta !== "string" ||
    !pregunta.trim() ||
    !Number.isInteger(limite) ||
    limite < 1 ||
    limite > LIMITE_MAXIMO
  ) {
    return fallo("consulta_no_valida");
  }

  // 1. Idioma de la transcripción del módulo (el español tiene preferencia si existe).
  let idioma: string | undefined;
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT t.idioma
       FROM academy.contenidos c
       JOIN academy.transcripciones t ON t.contenido_id = c.id
       WHERE c.modulo_id = $1 AND c.tipo = 'video'`,
      [moduloId],
    );
    const idiomas = rows.map((fila) => fila.idioma);
    idioma = ["es", "en"].find((codigo) => idiomas.includes(codigo));
  } catch {
    return fallo("error_bd");
  }
  if (!idioma) return { ok: true, fragmentos: [] }; // módulo sin transcripción

  // 2. Palabras clave en el idioma de la transcripción.
  const palabras =
    idioma === "en"
      ? await palabrasEnIngles(pregunta, consulta.alumno ?? {}, opciones)
      : palabrasDeLaPregunta(pregunta);
  if (!palabras.length) return fallo("sin_palabras_clave");

  // 3. Búsqueda de texto completo. Las palabras van como parámetro, nunca dentro del SQL.
  try {
    const { rows } = await db.query(SQL_FRAGMENTOS, [
      moduloId,
      idioma,
      CONFIGURACION_IDIOMA[idioma],
      palabras.join(" or "),
      limite,
    ]);
    return {
      ok: true,
      fragmentos: rows.map((fila) => ({
        titulo: String(fila.titulo),
        inicio: Number(fila.inicio),
        fin: Number(fila.fin),
        texto: String(fila.texto),
      })),
    };
  } catch {
    return fallo("error_bd");
  }
}
