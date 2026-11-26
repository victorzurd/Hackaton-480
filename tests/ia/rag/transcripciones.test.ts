import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import {
  buscarEnTranscripcion,
  limpiarPalabras,
  type BaseDatos,
} from "../../../src/ia/rag/transcripciones";

const alumna = { nombre: "Ana", apellidos: "García López" };

// Simula Gemini devolviendo las palabras clave indicadas.
function geminiFalso(palabras: unknown) {
  const enviados: Array<Record<string, unknown>> = [];
  const fetchFalso = (async (_url: string | URL | Request, init?: RequestInit) => {
    enviados.push(JSON.parse(String(init?.body)));
    const texto = JSON.stringify({ palabras });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }] }));
  }) as typeof fetch;
  return { opciones: { fetch: fetchFalso, clave: "clave-de-prueba" }, enviados };
}

// Simula la BD: la primera consulta devuelve los idiomas y la segunda los bloques.
function bdFalsa(idiomas: string[], bloques: unknown[] = [], fallaEn?: number) {
  const consultas: Array<{ texto: string; valores?: unknown[] }> = [];
  const db: BaseDatos = {
    query: async (texto, valores) => {
      consultas.push({ texto, valores });
      if (fallaEn === consultas.length) throw new Error("conexión perdida");
      return { rows: consultas.length === 1 ? idiomas.map((idioma) => ({ idioma })) : bloques };
    },
  };
  return { db, consultas };
}

const bloque = { titulo: "Bucles", inicio: 1680, fin: 1740, texto: "with a while loop..." };

let errorConsola: ReturnType<typeof mock.method>;
beforeEach(() => {
  errorConsola = mock.method(console, "error", () => {});
});
afterEach(() => errorConsola.mock.restore());

describe("búsqueda en la transcripción", () => {
  test("en inglés: pide palabras clave a Gemini y busca con ellas", async () => {
    const { opciones, enviados } = geminiFalso(["While", "loop", "infinite loop"]);
    const { db, consultas } = bdFalsa(["en"], [bloque]);

    const resultado = await buscarEnTranscripcion(
      db,
      { moduloId: 3, pregunta: "Soy Ana, ¿cómo funciona un bucle while?", alumno: alumna },
      opciones,
    );

    assert.deepEqual(resultado, { ok: true, fragmentos: [bloque] });
    assert.deepEqual(consultas[1].valores, [3, "en", "english", "while or loop or infinite loop", 4]);
    // La pregunta pasa por la pasarela: Gemini no recibe el nombre.
    assert.ok(!JSON.stringify(enviados[0]).includes("Ana"));
  });

  test("en español: busca con las palabras de la pregunta, sin llamar a Gemini", async () => {
    const { opciones, enviados } = geminiFalso([]);
    const { db, consultas } = bdFalsa(["en", "es"], [bloque]);

    await buscarEnTranscripcion(db, { moduloId: 3, pregunta: "¿Qué es un bucle while?" }, opciones);

    assert.equal(enviados.length, 0);
    assert.deepEqual(consultas[1].valores, [3, "es", "spanish", "qué or bucle or while", 4]);
  });

  test("las palabras van como parámetro, nunca dentro del SQL", async () => {
    const { opciones } = geminiFalso(["loop'; drop table academy.usuarios; --"]);
    const { db, consultas } = bdFalsa(["en"]);
    await buscarEnTranscripcion(db, { moduloId: 3, pregunta: "bucles" }, opciones);
    for (const { texto } of consultas) assert.ok(!texto.includes("drop"));
  });

  test("un módulo sin transcripción devuelve una lista vacía", async () => {
    const { opciones, enviados } = geminiFalso(["loop"]);
    const { db } = bdFalsa([]);
    assert.deepEqual(await buscarEnTranscripcion(db, { moduloId: 3, pregunta: "bucles" }, opciones), {
      ok: true,
      fragmentos: [],
    });
    assert.equal(enviados.length, 0);
  });

  test("respeta el límite indicado", async () => {
    const { opciones } = geminiFalso(["loop"]);
    const { db, consultas } = bdFalsa(["en"]);
    await buscarEnTranscripcion(db, { moduloId: 3, pregunta: "bucles", limite: 2 }, opciones);
    assert.equal(consultas[1].valores?.at(-1), 2);
  });
});

describe("palabras clave", () => {
  test("se limpian: minúsculas, sin repetidas, sin símbolos raros ni marcadores", () => {
    assert.deepEqual(
      limpiarPalabras(["Loop", "loop", " for ", "a+b", "c#", "[NOMBRE]", "<script>", "", 7, "x".repeat(41)]),
      ["loop", "for", "a+b", "c#"],
    );
  });

  test("como máximo 8", () => {
    assert.equal(limpiarPalabras(Array.from({ length: 20 }, (_, i) => `palabra${i}`)).length, 8);
  });
});

describe("fallo seguro", () => {
  for (const [caso, consulta] of [
    ["sin módulo", { pregunta: "bucles" }],
    ["módulo no entero", { moduloId: "3", pregunta: "bucles" }],
    ["sin pregunta", { moduloId: 3, pregunta: "   " }],
    ["límite excesivo", { moduloId: 3, pregunta: "bucles", limite: 50 }],
  ] as const) {
    test(`rechaza una consulta ${caso}, sin tocar la BD`, async () => {
      const { db, consultas } = bdFalsa(["en"]);
      assert.deepEqual(await buscarEnTranscripcion(db, consulta as never), {
        ok: false,
        motivo: "consulta_no_valida",
      });
      assert.equal(consultas.length, 0);
    });
  }

  test("si Gemini no da palabras útiles, no busca", async () => {
    const { opciones } = geminiFalso(["<<<", ""]);
    const { db, consultas } = bdFalsa(["en"]);
    assert.deepEqual(await buscarEnTranscripcion(db, { moduloId: 3, pregunta: "bucles" }, opciones), {
      ok: false,
      motivo: "sin_palabras_clave",
    });
    assert.equal(consultas.length, 1);
  });

  for (const fallaEn of [1, 2]) {
    test(`error de la BD en la consulta ${fallaEn}`, async () => {
      const { opciones } = geminiFalso(["loop"]);
      const { db } = bdFalsa(["en"], [], fallaEn);
      assert.deepEqual(await buscarEnTranscripcion(db, { moduloId: 3, pregunta: "bucles" }, opciones), {
        ok: false,
        motivo: "error_bd",
      });
    });
  }

  test("los logs no incluyen la pregunta", async () => {
    const { opciones } = geminiFalso([]);
    const { db } = bdFalsa(["en"]);
    await buscarEnTranscripcion(db, { moduloId: 3, pregunta: "Mi correo es ana@gmail.com" }, opciones);
    const registrado = JSON.stringify(errorConsola.mock.calls.map((llamada) => llamada.arguments));
    assert.match(registrado, /sin_palabras_clave/);
    assert.ok(!registrado.includes("ana@gmail.com"));
  });
});
