/**
 * Lectura y escritura de subtítulos SRT y WebVTT.
 *
 * Conserva las marcas de tiempo tal cual vienen en el fichero, para que una
 * traducción tenga exactamente los mismos tiempos que el original.
 */

export type Subtitulo = {
  /** Marca de inicio en formato SRT: "00:01:02,500". */
  inicio: string;
  /** Marca de fin en formato SRT. */
  fin: string;
  texto: string;
};

const MARCA_SRT = /^\d{2}:\d{2}:\d{2},\d{3}$/;

/** Lee un fichero SRT. Ignora bloques sin tiempos o sin texto. */
export function leerSrt(contenido: string): Subtitulo[] {
  return contenido
    .replace(/^﻿/, "")
    .split(/\r?\n\s*\r?\n/)
    .map((bloque): Subtitulo | null => {
      const lineas = bloque.trim().split(/\r?\n/);
      const posicion = lineas.findIndex((linea) => linea.includes(" --> "));
      if (posicion < 0) return null;

      const [inicio, fin] = lineas[posicion].split(" --> ").map((valor) => valor.trim());
      if (!MARCA_SRT.test(inicio) || !MARCA_SRT.test(fin)) return null;

      const texto = lineas.slice(posicion + 1).join(" ").replace(/\s+/g, " ").trim();
      return texto ? { inicio, fin, texto } : null;
    })
    .filter((subtitulo): subtitulo is Subtitulo => subtitulo !== null);
}

/** Escribe subtítulos en formato SRT, numerados desde 1. */
export function escribirSrt(subtitulos: Subtitulo[]): string {
  return (
    subtitulos
      .map((s, i) => `${i + 1}\n${s.inicio} --> ${s.fin}\n${s.texto}`)
      .join("\n\n") + "\n"
  );
}

/**
 * Formato para traducir con un LLM: una línea por subtítulo, «[n] texto»,
 * sin tiempos. `desde` es el número del primer subtítulo (empieza en 1).
 */
export function escribirNumerado(textos: string[], desde = 1): string {
  return textos.map((texto, i) => `[${desde + i}] ${texto}`).join("\n") + "\n";
}

/**
 * Lee líneas «[n] texto». Devuelve el texto de cada número y los números
 * repetidos. Ignora las líneas que no siguen el formato (comentarios del LLM).
 */
export function leerNumerado(contenido: string): { textos: Map<number, string>; repetidos: number[] } {
  const textos = new Map<number, string>();
  const repetidos: number[] = [];

  for (const linea of contenido.replace(/^﻿/, "").split(/\r?\n/)) {
    const encontrado = /^\s*\[(\d+)\]\s*(.*)$/.exec(linea);
    if (!encontrado) continue;
    const numero = Number(encontrado[1]);
    const texto = encontrado[2].replace(/\s+/g, " ").trim();
    if (textos.has(numero)) repetidos.push(numero);
    textos.set(numero, texto);
  }
  return { textos, repetidos };
}

/** Agrupa números consecutivos para informar de forma legible: [1,2,3,7] → "1-3, 7". */
export function resumirNumeros(numeros: number[]): string {
  const ordenados = [...new Set(numeros)].sort((a, b) => a - b);
  const tramos: string[] = [];
  for (let i = 0; i < ordenados.length; i++) {
    const inicio = ordenados[i];
    while (i + 1 < ordenados.length && ordenados[i + 1] === ordenados[i] + 1) i++;
    tramos.push(inicio === ordenados[i] ? `${inicio}` : `${inicio}-${ordenados[i]}`);
  }
  return tramos.join(", ");
}

/**
 * Pone los textos traducidos sobre los tiempos del original.
 * Devuelve los números que faltan o están vacíos, y los que sobran.
 */
export function aplicarTraduccion(
  original: Subtitulo[],
  traducidos: Map<number, string>,
): { subtitulos: Subtitulo[]; faltan: number[]; sobran: number[] } {
  const faltan: number[] = [];
  const subtitulos = original.map((subtitulo, i) => {
    const texto = traducidos.get(i + 1);
    if (!texto) faltan.push(i + 1);
    return { ...subtitulo, texto: texto ?? "" };
  });
  const sobran = [...traducidos.keys()].filter((n) => n < 1 || n > original.length);
  return { subtitulos, faltan, sobran };
}

/** Escribe subtítulos en formato WebVTT, el que entiende la etiqueta <track>. */
export function escribirVtt(subtitulos: Subtitulo[]): string {
  const aVtt = (marca: string) => marca.replace(",", ".");
  return (
    "WEBVTT\n\n" +
    subtitulos.map((s) => `${aVtt(s.inicio)} --> ${aVtt(s.fin)}\n${s.texto}`).join("\n\n") +
    "\n"
  );
}
