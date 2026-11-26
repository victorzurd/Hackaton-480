import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { llamarGemini, type PeticionGemini } from "../../../src/ia/gemini/cliente";

const CLAVE = "clave-de-prueba-secreta";

const peticion: PeticionGemini = {
  instrucciones: "Eres un tutor de Python.",
  mensajes: [
    { rol: "usuario", texto: "¿Qué es una lista?" },
    { rol: "modelo", texto: "Una colección ordenada." },
    { rol: "usuario", texto: "¿Y una tupla?" },
  ],
};

type Llamada = { url: string; init: RequestInit };

// Simula Gemini: guarda la petición y devuelve la respuesta indicada.
function geminiFalso(cuerpo: unknown, estado = 200) {
  const llamadas: Llamada[] = [];
  const fetchFalso = (async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), init: init ?? {} });
    return new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), {
      status: estado,
    });
  }) as typeof fetch;
  return { fetchFalso, llamadas };
}

const respuestaConTexto = (...partes: string[]) => ({
  candidates: [{ finishReason: "STOP", content: { parts: partes.map((text) => ({ text })) } }],
});

describe("petición a Gemini", () => {
  test("envía instrucciones, mensajes con su rol, configuración y clave", async () => {
    const { fetchFalso, llamadas } = geminiFalso(respuestaConTexto("Una lista inmutable."));

    await llamarGemini(
      { ...peticion, temperatura: 0.1, maxTokensSalida: 200 },
      { fetch: fetchFalso, clave: CLAVE, modelo: "modelo/raro" },
    );

    assert.equal(llamadas.length, 1);
    const { url, init } = llamadas[0];
    assert.equal(
      url,
      "https://generativelanguage.googleapis.com/v1beta/models/modelo%2Fraro:generateContent",
    );
    assert.equal(init.method, "POST");
    assert.equal((init.headers as Record<string, string>)["x-goog-api-key"], CLAVE);
    assert.ok(init.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(String(init.body)), {
      systemInstruction: { parts: [{ text: "Eres un tutor de Python." }] },
      contents: [
        { role: "user", parts: [{ text: "¿Qué es una lista?" }] },
        { role: "model", parts: [{ text: "Una colección ordenada." }] },
        { role: "user", parts: [{ text: "¿Y una tupla?" }] },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
    });
  });

  test("usa el modelo de GEMINI_MODEL y valores por defecto", async () => {
    const { fetchFalso, llamadas } = geminiFalso(respuestaConTexto("ok"));
    const anterior = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = "modelo-del-env";
    try {
      await llamarGemini(peticion, { fetch: fetchFalso, clave: CLAVE });
    } finally {
      if (anterior === undefined) delete process.env.GEMINI_MODEL;
      else process.env.GEMINI_MODEL = anterior;
    }
    assert.match(llamadas[0].url, /\/modelo-del-env:generateContent$/);
    const cuerpo = JSON.parse(String(llamadas[0].init.body));
    assert.deepEqual(cuerpo.generationConfig, { temperature: 0.3, maxOutputTokens: 1024 });
  });
});

describe("respuesta de Gemini", () => {
  test("devuelve el texto, uniendo sus partes", async () => {
    const { fetchFalso } = geminiFalso(respuestaConTexto("Una tupla ", "es inmutable. "));
    assert.deepEqual(await llamarGemini(peticion, { fetch: fetchFalso, clave: CLAVE }), {
      ok: true,
      texto: "Una tupla es inmutable.",
    });
  });

  for (const [caso, cuerpo] of [
    ["sin candidatos", { candidates: [] }],
    ["texto en blanco", respuestaConTexto("   ")],
  ] as const) {
    test(`${caso}: respuesta_vacia`, async () => {
      const { fetchFalso } = geminiFalso(cuerpo);
      assert.deepEqual(await llamarGemini(peticion, { fetch: fetchFalso, clave: CLAVE }), {
        ok: false,
        motivo: "respuesta_vacia",
      });
    });
  }

  for (const [caso, cuerpo] of [
    ["petición bloqueada", { promptFeedback: { blockReason: "SAFETY" } }],
    ["respuesta cortada por seguridad", { candidates: [{ finishReason: "SAFETY" }] }],
  ] as const) {
    test(`${caso}: respuesta_bloqueada`, async () => {
      const { fetchFalso } = geminiFalso(cuerpo);
      assert.deepEqual(await llamarGemini(peticion, { fetch: fetchFalso, clave: CLAVE }), {
        ok: false,
        motivo: "respuesta_bloqueada",
      });
    });
  }
});

describe("errores", () => {
  for (const clave of ["", "   ", "replace-with-your-google-ai-studio-api-key", "Api_Gemini"]) {
    test(`sin clave válida (${JSON.stringify(clave)}) no llama a Gemini`, async () => {
      const { fetchFalso, llamadas } = geminiFalso(respuestaConTexto("ok"));
      assert.deepEqual(await llamarGemini(peticion, { fetch: fetchFalso, clave }), {
        ok: false,
        motivo: "sin_clave",
      });
      assert.equal(llamadas.length, 0);
    });
  }

  test("error HTTP de Gemini, con su código", async () => {
    const { fetchFalso } = geminiFalso({ error: { message: "cuota agotada" } }, 429);
    assert.deepEqual(await llamarGemini(peticion, { fetch: fetchFalso, clave: CLAVE }), {
      ok: false,
      motivo: "error_gemini",
      estado: 429,
    });
  });

  test("respuesta que no es JSON", async () => {
    const { fetchFalso } = geminiFalso("<html>error</html>");
    assert.deepEqual(await llamarGemini(peticion, { fetch: fetchFalso, clave: CLAVE }), {
      ok: false,
      motivo: "error_gemini",
      estado: 200,
    });
  });

  test("sin conexión", async () => {
    const fetchFalso = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    assert.deepEqual(await llamarGemini(peticion, { fetch: fetchFalso, clave: CLAVE }), {
      ok: false,
      motivo: "error_red",
    });
  });

  test("Gemini tarda demasiado", async () => {
    // Espera hasta que el límite de tiempo cancele la petición.
    const fetchLento = ((_url: string, init?: RequestInit) =>
      new Promise((_resolver, rechazar) => {
        init?.signal?.addEventListener("abort", () => rechazar(init.signal?.reason));
      })) as typeof fetch;

    assert.deepEqual(
      await llamarGemini(peticion, { fetch: fetchLento, clave: CLAVE, tiempoMaximoMs: 20 }),
      { ok: false, motivo: "tiempo_agotado" },
    );
  });

  test("ningún resultado incluye la clave ni el texto enviado", async () => {
    const { fetchFalso } = geminiFalso({ error: { message: CLAVE } }, 500);
    const resultado = JSON.stringify(await llamarGemini(peticion, { fetch: fetchFalso, clave: CLAVE }));
    assert.ok(!resultado.includes(CLAVE));
    assert.ok(!resultado.includes("lista"));
  });
});
