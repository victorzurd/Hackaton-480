import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import express from "express";
import type { Pool } from "pg";
import { after, before, describe, test } from "node:test";
import { createCoursesRouter } from "../../src/routes/courses";
import { createToken } from "../../src/security/token";

const JWT_SECRET = "lesson-route-tests-use-a-secret-with-32-bytes";
const BASE_URL = "http://127.0.0.1";

type LessonRow = {
  autorizado: boolean;
  contenido_id: string | null;
  titulo: string | null;
  modulo_titulo: string | null;
  video_url: string | null;
  duracion_segundos: number | null;
  transcripcion_texto: string | null;
  transcripcion_idioma: string | null;
};

type DatabaseCall = { sql: string; values: unknown[] };

function createDatabase(
  lesson: LessonRow,
  { accountActive = true }: { accountActive?: boolean } = {},
): { db: Pool; calls: DatabaseCall[] } {
  const calls: DatabaseCall[] = [];
  const db = {
    query: async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values });
      if (sql.includes("FROM academy.usuarios")) {
        return { rows: accountActive ? [{ account: 1 }] : [], rowCount: accountActive ? 1 : 0 };
      }
      if (sql.includes("AS autorizado")) {
        return { rows: [lesson], rowCount: 1 };
      }
      throw new Error(`Consulta inesperada en el test: ${sql}`);
    },
  } as unknown as Pool;
  return { db, calls };
}

async function startTestServer(db: Pool): Promise<{ server: Server; url: string }> {
  const app = express();
  app.use("/api/courses", createCoursesRouter({ db, jwtSecret: JWT_SECRET }));
  const server = createServer(app).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { server, url: `${BASE_URL}:${address.port}/api/courses` };
}

async function stopTestServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

const lessonRow = (overrides: Partial<LessonRow> = {}): LessonRow => ({
  autorizado: true,
  contenido_id: "34",
  titulo: "Funciones y variables",
  modulo_titulo: "Introducción a Python",
  video_url: "https://example.test/lesson.mp4",
  duracion_segundos: 600,
  transcripcion_texto: "Primera línea.\n\nSegundo párrafo.",
  transcripcion_idioma: "en",
  ...overrides,
});

describe("GET /:courseId/lessons/:contentId", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const { db } = createDatabase(lessonRow());
    const started = await startTestServer(db);
    server = started.server;
    baseUrl = started.url;
  });

  after(async () => {
    if (server) await stopTestServer(server);
  });

  test("devuelve los datos de la lección y la transcripción elegida por idioma", async () => {
    const { db, calls } = createDatabase(lessonRow());
    const { server: localServer, url } = await startTestServer(db);
    try {
      const response = await fetch(`${url}/12/lessons/34`, {
        headers: { Authorization: `Bearer ${createToken("7", JWT_SECRET)}` },
      });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        leccion: {
          contenidoId: "34",
          titulo: "Funciones y variables",
          moduloTitulo: "Introducción a Python",
          videoUrl: "https://example.test/lesson.mp4",
          duracionSegundos: 600,
          transcripcion: {
            texto: "Primera línea.\n\nSegundo párrafo.",
            idioma: "en",
          },
        },
      });
      const detailCall = calls.find((call) => call.sql.includes("AS autorizado"));
      assert.deepEqual(detailCall?.values, ["7", "12", "34"]);
      assert.match(detailCall?.sql ?? "", /WHEN 'es' THEN 0/);
      assert.match(detailCall?.sql ?? "", /WHEN 'en' THEN 1/);
      assert.match(detailCall?.sql ?? "", /ORDER BY CASE transcripciones\.idioma/);
      assert.match(detailCall?.sql ?? "", /END, transcripciones\.idioma, transcripciones\.id/);
    } finally {
      await stopTestServer(localServer);
    }
  });

  test("devuelve la lección aunque falten URL y transcripción", async () => {
    const { db } = createDatabase(lessonRow({
      video_url: null,
      transcripcion_texto: null,
      transcripcion_idioma: null,
    }));
    const { server: localServer, url } = await startTestServer(db);
    try {
      const response = await fetch(`${url}/12/lessons/34`, {
        headers: { Authorization: `Bearer ${createToken("7", JWT_SECRET)}` },
      });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        leccion: {
          contenidoId: "34",
          titulo: "Funciones y variables",
          moduloTitulo: "Introducción a Python",
          videoUrl: null,
          duracionSegundos: 600,
          transcripcion: null,
        },
      });
    } finally {
      await stopTestServer(localServer);
    }
  });

  test("responde 403 si no hay matrícula autorizada", async () => {
    const { db } = createDatabase(lessonRow({ autorizado: false }));
    const { server: localServer, url } = await startTestServer(db);
    try {
      const response = await fetch(`${url}/12/lessons/34`, {
        headers: { Authorization: `Bearer ${createToken("7", JWT_SECRET)}` },
      });

      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "No estás inscrito en este curso." });
    } finally {
      await stopTestServer(localServer);
    }
  });

  test("responde 404 si el vídeo no pertenece al curso solicitado", async () => {
    const { db } = createDatabase(lessonRow({ contenido_id: null }));
    const { server: localServer, url } = await startTestServer(db);
    try {
      const response = await fetch(`${url}/12/lessons/34`, {
        headers: { Authorization: `Bearer ${createToken("7", JWT_SECRET)}` },
      });

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), {
        error: "No se encontró el vídeo solicitado en este curso.",
      });
    } finally {
      await stopTestServer(localServer);
    }
  });

  test("responde 401 sin autenticación válida", async () => {
    const response = await fetch(`${baseUrl}/12/lessons/34`);
    assert.equal(response.status, 401);
  });

  test("responde 401 si la cuenta está inactiva", async () => {
    const { db } = createDatabase(lessonRow(), { accountActive: false });
    const { server: localServer, url } = await startTestServer(db);
    try {
      const response = await fetch(`${url}/12/lessons/34`, {
        headers: { Authorization: `Bearer ${createToken("7", JWT_SECRET)}` },
      });

      assert.equal(response.status, 401);
    } finally {
      await stopTestServer(localServer);
    }
  });

  test("rechaza identificadores que no tienen formato de BIGINT", async () => {
    const response = await fetch(`${baseUrl}/abc/lessons/34`, {
      headers: { Authorization: `Bearer ${createToken("7", JWT_SECRET)}` },
    });
    assert.equal(response.status, 400);
  });
});
