import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool();
const courseTitle = "Introducción a Python — CS50P (demo)";
const mediaDirectory = "/app/media/cs50p";

function toSeconds(timestamp) {
  const match = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(timestamp);
  if (!match) throw new Error(`Marca temporal SRT inválida: ${timestamp}`);
  const [, hours, minutes, seconds, milliseconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Math.ceil(Number(milliseconds) / 1000);
}

function parseSrt(source) {
  return source
    .replace(/^\uFEFF/, "")
    .split(/\r?\n\s*\r?\n/)
    .map((block) => {
      const lines = block.trim().split(/\r?\n/);
      const timingIndex = lines.findIndex((line) => line.includes(" --> "));
      if (timingIndex < 0) return null;

      const [start, end] = lines[timingIndex].split(" --> ").map((value) => value.trim());
      const text = lines
        .slice(timingIndex + 1)
        .join(" ")
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) return null;

      const startSeconds = toSeconds(start);
      const endSeconds = toSeconds(end);
      if (endSeconds <= startSeconds) return null;
      return { tiempo_inicio: startSeconds, tiempo_fin: endSeconds, texto: text };
    })
    .filter(Boolean);
}

async function readText(filePath) {
  return (await fs.readFile(filePath, "utf8")).replace(/^\uFEFF/, "").trim();
}

// Sustituye la transcripción de un idioma sin tocar las de otros idiomas.
async function saveTranscript(client, contentId, language, text, captions) {
  await client.query(
    "DELETE FROM academy.transcripciones WHERE contenido_id = $1 AND idioma = $2",
    [contentId, language],
  );
  const inserted = await client.query(
    `INSERT INTO academy.transcripciones (contenido_id, texto, idioma)
     VALUES ($1, $2, $3) RETURNING id`,
    [contentId, text, language],
  );
  await client.query(
    `INSERT INTO academy.fragmentos_transcripcion
       (transcripcion_id, tiempo_inicio, tiempo_fin, texto)
     SELECT $1, cues.tiempo_inicio, cues.tiempo_fin, cues.texto
     FROM jsonb_to_recordset($2::jsonb)
       AS cues(tiempo_inicio integer, tiempo_fin integer, texto text)`,
    [inserted.rows[0].id, JSON.stringify(captions)],
  );
}

async function importTranscripts() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const course = await client.query(
      "SELECT id FROM academy.cursos WHERE titulo = $1 LIMIT 1",
      [courseTitle],
    );
    if (!course.rowCount) throw new Error("Primero carga el curso con cs50p_demo.sql.");

    for (let week = 0; week < 10; week++) {
      const module = await client.query(
        `SELECT c.id AS contenido_id
         FROM academy.modulos m
         JOIN academy.contenidos c ON c.modulo_id = m.id AND c.tipo = 'video'
         WHERE m.curso_id = $1 AND m.orden = $2 AND c.orden = 1`,
        [course.rows[0].id, week + 1],
      );
      if (!module.rowCount) throw new Error(`No se encuentra el vídeo de la lección ${week}.`);

      const srtPath = path.join(mediaDirectory, `lecture-${week}.srt`);
      const txtPath = path.join(mediaDirectory, `lecture-${week}.txt`);
      const captions = parseSrt(await readText(srtPath));
      if (!captions.length) throw new Error(`La transcripción sincronizada de la lección ${week} está vacía.`);

      let transcript;
      try {
        transcript = await readText(txtPath);
      } catch {
        transcript = captions.map(({ texto }) => texto).join(" ");
      }
      if (!transcript) transcript = captions.map(({ texto }) => texto).join(" ");

      const contentId = module.rows[0].contenido_id;
      await saveTranscript(client, contentId, "en", transcript, captions);
      const duration = Math.max(...captions.map(({ tiempo_fin }) => tiempo_fin));
      await client.query(
        "UPDATE academy.contenidos SET duracion_segundos = $1 WHERE id = $2",
        [duration, contentId],
      );

      // Traducción al español (opcional): lecture-N.es.srt, con los mismos tiempos.
      let spanish = "";
      try {
        const spanishCaptions = parseSrt(await readText(path.join(mediaDirectory, `lecture-${week}.es.srt`)));
        if (spanishCaptions.length) {
          await saveTranscript(
            client,
            contentId,
            "es",
            spanishCaptions.map(({ texto }) => texto).join(" "),
            spanishCaptions,
          );
          spanish = `, ${spanishCaptions.length} en español`;
        }
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }

      console.log(`Lección ${week}: ${captions.length} fragmentos${spanish}, ${duration} s.`);
    }

    await client.query("COMMIT");
    console.log("Transcripciones y fragmentos temporales importados.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importTranscripts().catch((error) => {
  console.error("No se pudieron importar las transcripciones:", error);
  process.exitCode = 1;
});
