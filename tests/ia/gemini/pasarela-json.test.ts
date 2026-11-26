import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { LIMITES, consultarIAJson, type ConsultaIAJson } from "../../../src/ia/gemini";

const alumna = { nombre: "Ana", apellidos: "García López" };

const ESQUEMA = {
  type: "OBJECT",
  properties: {
    entendido: { type: "BOOLEAN" },
    explicacion: { type: "STRING" },
  },
  required: ["entendido", "explicacion"],
};

function geminiFalso(textoRespuesta: string) {
  const enviados: Array<Record<string, unknown>> = [];
  const fetchFalso = (async (_url: string | URL | Request, init?: RequestInit) => {
    enviados.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: textoRespuesta }] } }] }),
    );
  }) as typeof fetch;
  return { opciones: { fetch: fetchFalso, clave: "clave-de-prueba" }, enviados };
}

const consulta = (cambios: Partial<ConsultaIAJson> = {}): ConsultaIAJson => ({
  instrucciones: "Evalúa la respuesta del alumno.",
  mensajes: [{ rol: "usuario", texto: "Una lista se puede modificar." }],
  alumno: alumna,
  esquema: ESQUEMA,
  ...cambios,
});

let errorConsola: ReturnType<typeof mock.method>;
beforeEach(() => {
  errorConsola = mock.method(console, "error", () => {});
});
afterEach(() => errorConsola.mock.restore());

describe("respuestas JSON", () => {
  test("pide JSON con el esquema y devuelve los datos", async () => {
    const { opciones, enviados } = geminiFalso('{"entendido": true, "explicacion": "Correcto."}');

    const resultado = await consultarIAJson<{ entendido: boolean; explicacion: string }>(
      consulta(),
      opciones,
    );

    assert.deepEqual(resultado, { ok: true, datos: { entendido: true, explicacion: "Correcto." } });
    assert.deepEqual(enviados[0].generationConfig, {
      temperature: 0.3,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseJsonSchema: ESQUEMA,
    });
  });

  test("filtra los textos del JSON, también en listas y objetos anidados", async () => {
    const { opciones } = geminiFalso(
      JSON.stringify({
        explicacion: "Bien hecho, Ana.",
        pasos: ["Escribe a ana@gmail.com", { nota: "Llama al 612345678", puntos: 7 }],
        aprobado: true,
        extra: null,
      }),
    );

    const resultado = await consultarIAJson(consulta(), opciones);

    assert.deepEqual(resultado, {
      ok: true,
      datos: {
        explicacion: "Bien hecho, [NOMBRE].",
        pasos: ["Escribe a [EMAIL]", { nota: "Llama al [TELEFONO]", puntos: 7 }],
        aprobado: true,
        extra: null,
      },
    });
  });

  test("también filtra la entrada", async () => {
    const { opciones, enviados } = geminiFalso('{"entendido": true, "explicacion": "ok"}');
    await consultarIAJson(
      consulta({ mensajes: [{ rol: "usuario", texto: "Soy Ana, DNI 12345678Z" }] }),
      opciones,
    );
    const enviado = JSON.stringify(enviados[0]);
    assert.ok(!enviado.includes("Ana"));
    assert.ok(!enviado.includes("12345678Z"));
  });

  test("las respuestas de texto no piden JSON", async () => {
    const { consultarIA } = await import("../../../src/ia/gemini");
    const { opciones, enviados } = geminiFalso("Texto normal.");
    await consultarIA(consulta(), opciones);
    assert.deepEqual(enviados[0].generationConfig, { temperature: 0.3, maxOutputTokens: 1024 });
  });
});

describe("fallo seguro con JSON", () => {
  test("si Gemini no devuelve JSON válido", async () => {
    const { opciones } = geminiFalso("Aquí tienes: {entendido: true");
    assert.deepEqual(await consultarIAJson(consulta(), opciones), {
      ok: false,
      motivo: "respuesta_no_json",
    });
  });

  test("si la respuesta supera el límite", async () => {
    const largo = JSON.stringify({ explicacion: "a".repeat(LIMITES.respuesta) });
    const { opciones } = geminiFalso(largo);
    assert.deepEqual(await consultarIAJson(consulta(), opciones), {
      ok: false,
      motivo: "proteccion_respuesta",
    });
  });

  for (const esquema of [undefined, null, "OBJECT"]) {
    test(`sin esquema válido (${JSON.stringify(esquema)}) no llama a Gemini`, async () => {
      const { opciones, enviados } = geminiFalso("{}");
      const resultado = await consultarIAJson(
        { ...consulta(), esquema: esquema as unknown as object },
        opciones,
      );
      assert.deepEqual(resultado, { ok: false, motivo: "consulta_no_valida" });
      assert.equal(enviados.length, 0);
    });
  }

  test("los logs no incluyen el contenido de la respuesta", async () => {
    const { opciones } = geminiFalso("no es json: ana@gmail.com");
    await consultarIAJson(consulta(), opciones);
    const registrado = JSON.stringify(errorConsola.mock.calls.map((llamada) => llamada.arguments));
    assert.match(registrado, /respuesta_no_json/);
    assert.ok(!registrado.includes("ana@gmail.com"));
  });
});
