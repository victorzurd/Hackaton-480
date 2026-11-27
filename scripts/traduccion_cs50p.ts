/**
 * Ayuda a traducir a mano, con un LLM de chat, los subtítulos de CS50P.
 *
 *   npx tsx scripts/traduccion_cs50p.ts dividir [lección...]
 *     Trocea media/cs50p/lecture-N.srt en partes para pegar en el chat:
 *     media/cs50p/traduccion/lecture-N/parte-01.txt, parte-02.txt...
 *
 *   npx tsx scripts/traduccion_cs50p.ts unir [lección...]
 *     Lee las respuestas del LLM (parte-01.es.txt, parte-02.es.txt...),
 *     comprueba que no falte ni sobre ninguna línea y escribe
 *     media/cs50p/lecture-N.es.srt y lecture-N.es.vtt con los tiempos originales.
 *
 * Sin lección, se aplica a las 10 (0 a 9). Guía completa en docs/transcripciones.md.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  aplicarTraduccion,
  escribirNumerado,
  escribirSrt,
  escribirVtt,
  leerNumerado,
  leerSrt,
  resumirNumeros,
} from "../src/transcripciones/srt";

/** Líneas por parte: cabe de sobra en la respuesta de un LLM de chat. */
const LINEAS_POR_PARTE = 300;

const MEDIA = resolve(process.cwd(), "media/cs50p");
const carpetaDe = (leccion: number) => resolve(MEDIA, "traduccion", `lecture-${leccion}`);
const nombreParte = (n: number) => `parte-${String(n).padStart(2, "0")}`;

async function leerOriginal(leccion: number) {
  const ruta = resolve(MEDIA, `lecture-${leccion}.srt`);
  try {
    return leerSrt(await readFile(ruta, "utf8"));
  } catch {
    throw new Error(`Falta ${ruta}. Descarga antes los subtítulos (ver LOCAL.md).`);
  }
}

async function dividir(leccion: number): Promise<void> {
  const original = await leerOriginal(leccion);
  const carpeta = carpetaDe(leccion);
  await mkdir(carpeta, { recursive: true });

  let partes = 0;
  for (let desde = 0; desde < original.length; desde += LINEAS_POR_PARTE) {
    partes++;
    const textos = original.slice(desde, desde + LINEAS_POR_PARTE).map((s) => s.texto);
    await writeFile(resolve(carpeta, `${nombreParte(partes)}.txt`), escribirNumerado(textos, desde + 1), "utf8");
  }
  console.log(`Lección ${leccion}: ${original.length} líneas en ${partes} partes → ${carpeta}`);
}

async function unir(leccion: number): Promise<boolean> {
  const original = await leerOriginal(leccion);
  const carpeta = carpetaDe(leccion);
  let ficheros: string[];
  try {
    ficheros = (await readdir(carpeta)).filter((f) => /^parte-\d+\.es\.txt$/.test(f)).sort();
  } catch {
    ficheros = [];
  }
  if (ficheros.length === 0) {
    console.log(`Lección ${leccion}: no hay respuestas (parte-XX.es.txt) en ${carpeta}.`);
    return false;
  }

  const traducidos = new Map<number, string>();
  const repetidos: number[] = [];
  for (const fichero of ficheros) {
    const leido = leerNumerado(await readFile(resolve(carpeta, fichero), "utf8"));
    for (const [numero, texto] of leido.textos) {
      if (traducidos.has(numero)) repetidos.push(numero);
      traducidos.set(numero, texto);
    }
    repetidos.push(...leido.repetidos);
  }

  const { subtitulos, faltan, sobran } = aplicarTraduccion(original, traducidos);
  if (faltan.length || sobran.length || repetidos.length) {
    console.log(`Lección ${leccion}: la traducción no está completa. No se ha escrito nada.`);
    if (faltan.length) {
      const partes = [...new Set(faltan.map((n) => Math.ceil(n / LINEAS_POR_PARTE)))].map(nombreParte);
      console.log(`  Faltan o están vacías: ${resumirNumeros(faltan)} (en ${partes.join(", ")}).`);
    }
    if (sobran.length) console.log(`  Sobran (no existen en el original): ${resumirNumeros(sobran)}.`);
    if (repetidos.length) console.log(`  Repetidas: ${resumirNumeros(repetidos)}.`);
    return false;
  }

  await writeFile(resolve(MEDIA, `lecture-${leccion}.es.srt`), escribirSrt(subtitulos), "utf8");
  await writeFile(resolve(MEDIA, `lecture-${leccion}.es.vtt`), escribirVtt(subtitulos), "utf8");
  console.log(`Lección ${leccion}: ${subtitulos.length} líneas traducidas → lecture-${leccion}.es.srt y .es.vtt`);
  return true;
}

async function main(): Promise<void> {
  const [accion, ...resto] = process.argv.slice(2);
  const elegidas = resto.map(Number);
  if ((accion !== "dividir" && accion !== "unir") || elegidas.some((n) => !Number.isInteger(n) || n < 0 || n > 9)) {
    console.log("Uso: npx tsx scripts/traduccion_cs50p.ts dividir|unir [lección 0-9...]");
    process.exitCode = 1;
    return;
  }
  const lecciones = elegidas.length ? elegidas : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  let correctas = true;
  for (const leccion of lecciones) {
    if (accion === "dividir") await dividir(leccion);
    else correctas = (await unir(leccion)) && correctas;
  }
  if (accion === "unir" && correctas) {
    console.log("Impórtalas con: docker exec academy-api node DataBase/seeds/import_cs50p_transcripts.mjs");
  }
  if (!correctas) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
