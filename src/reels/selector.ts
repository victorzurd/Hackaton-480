/**
 * Selector de fragmentos para los reels de repaso (versión sin IA).
 *
 * Dado el listado de fragmentos de subtítulos de un vídeo y unas palabras
 * clave, devuelve el tramo de como máximo `DURACION_MAXIMA` segundos en el que
 * más se habla de esas palabras. Es una función pura: no consulta la base de
 * datos ni llama a la IA, por lo que sirve para cualquier curso y como plan B
 * si Gemini no está disponible.
 */

/** Duración máxima de un reel, en segundos (SPEC, historia de usuario de repaso). */
export const DURACION_MAXIMA = 60;

/** Segundos de contexto que se añaden antes de la primera mención. */
export const MARGEN_PREVIO = 5;

export type Fragmento = {
  tiempoInicio: number;
  tiempoFin: number;
  texto: string;
};

export type Tramo = {
  tiempoInicio: number;
  tiempoFin: number;
  /** Número de menciones de las palabras clave dentro del tramo. */
  coincidencias: number;
};

/** Pasa a minúsculas, quita tildes y une espacios repetidos. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Crea una expresión que busca cada palabra clave como palabra completa:
 * "range" coincide con "range(10)" pero no con "arrange".
 */
function crearBuscador(palabrasClave: string[]): RegExp | null {
  const limpias = [...new Set(palabrasClave.map(normalizar).filter(Boolean))];
  if (limpias.length === 0) return null;

  // Las más largas primero, para que "for loop" gane a "for" en la misma posición.
  limpias.sort((a, b) => b.length - a.length);
  const alternativas = limpias.map(escaparRegex).join("|");
  return new RegExp(`(?<![a-z0-9_])(?:${alternativas})(?![a-z0-9_])`, "g");
}

function contarCoincidencias(texto: string, buscador: RegExp): number {
  return normalizar(texto).match(buscador)?.length ?? 0;
}

/**
 * Elige el tramo con más menciones de las palabras clave.
 *
 * - Cada tramo empieza `MARGEN_PREVIO` segundos antes de un fragmento que
 *   menciona alguna palabra clave y dura como máximo `duracionMaxima`.
 * - Si hay empate, gana el tramo que aparece antes en el vídeo.
 * - Devuelve `null` si ninguna palabra clave aparece en los subtítulos.
 */
export function seleccionarTramo(
  fragmentos: Fragmento[],
  palabrasClave: string[],
  duracionMaxima: number = DURACION_MAXIMA,
): Tramo | null {
  const buscador = crearBuscador(palabrasClave);
  if (!buscador || fragmentos.length === 0) return null;

  const ordenados = [...fragmentos].sort((a, b) => a.tiempoInicio - b.tiempoInicio);
  const menciones = ordenados.map((fragmento) => contarCoincidencias(fragmento.texto, buscador));

  let mejor: Tramo | null = null;

  for (let i = 0; i < ordenados.length; i++) {
    if (menciones[i] === 0) continue;

    const inicio = Math.max(0, ordenados[i].tiempoInicio - MARGEN_PREVIO);
    const limite = inicio + duracionMaxima;
    let coincidencias = 0;
    let fin = ordenados[i].tiempoFin;

    // Sumamos los fragmentos que caben enteros dentro del tramo.
    for (let j = i; j < ordenados.length && ordenados[j].tiempoFin <= limite; j++) {
      coincidencias += menciones[j];
      fin = ordenados[j].tiempoFin;
    }

    if (!mejor || coincidencias > mejor.coincidencias) {
      mejor = { tiempoInicio: inicio, tiempoFin: Math.min(fin, limite), coincidencias };
    }
  }

  return mejor;
}

/**
 * Tramo a partir de un segundo concreto del vídeo, para preguntas que ya
 * indican en `tiempo_video` dónde se explica su concepto.
 */
export function tramoDesdeSegundo(
  segundo: number,
  duracionVideo?: number,
  duracionMaxima: number = DURACION_MAXIMA,
): Tramo {
  const inicio = Math.max(0, segundo - MARGEN_PREVIO);
  const fin = inicio + duracionMaxima;
  return {
    tiempoInicio: inicio,
    tiempoFin: duracionVideo === undefined ? fin : Math.min(fin, duracionVideo),
    coincidencias: 0,
  };
}
