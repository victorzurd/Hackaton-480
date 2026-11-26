import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { LIMITES, consultarIA, type ConsultaIA } from "../../../src/ia/gemini";

const CLAVE = "clave-de-prueba";
const alumna = { nombre: "Ana", apellidos: "García López" };

// Simula Gemini: guarda lo que recibe y responde con el texto indicado.
function geminiFalso(textoRespuesta = "Una tupla es inmutable.") {
  const enviados: Array<Record<string, unknown>> = [];
  const fetchFalso = (async (_url: string | URL | Request, init?: RequestInit) => {
    enviados.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: textoRespuesta }] } }] }),
    );
  }) as typeof fetch;
  return { opciones: { fetch: fetchFalso, clave: CLAVE }, enviados };
}

const consulta = (cambios: Partial<ConsultaIA> = {}): ConsultaIA => ({
  instrucciones: "Eres un tutor de Python.",
  mensajes: [{ rol: "usuario", texto: "¿Qué es una tupla?" }],
  alumno: alumna,
  ...cambios,
});

let errorConsola: ReturnType<typeof mock.method>;
beforeEach(() => {
  errorConsola = mock.method(console, "error", () => {});
});
afterEach(() => errorConsola.mock.restore());

describe("ida: Gemini nunca recibe datos personales", () => {
  test("filtra todos los mensajes, también los anteriores", async () => {
    const { opciones, enviados } = geminiFalso();
    await consultarIA(
      consulta({
        mensajes: [
          { rol: "usuario", texto: "Soy Ana García, mi DNI es 12345678Z" },
          { rol: "modelo", texto: "Hola. ¿En qué te ayudo?" },
          { rol: "usuario", texto: "Escríbeme a ana@gmail.com o al 612345678" },
        ],
      }),
      opciones,
    );

    const enviado = JSON.stringify(enviados[0]);
    for (const dato of ["Ana", "García", "12345678Z", "ana@gmail.com", "612345678"]) {
      assert.ok(!enviado.includes(dato), dato);
    }
    assert.deepEqual(enviados[0].contents, [
      { role: "user", parts: [{ text: "Soy [NOMBRE], mi DNI es [DOCUMENTO]" }] },
      { role: "model", parts: [{ text: "Hola. ¿En qué te ayudo?" }] },
      { role: "user", parts: [{ text: "Escríbeme a [EMAIL] o al [TELEFONO]" }] },
    ]);
  });

  test("filtra el contexto y lo marca como datos, no instrucciones", async () => {
    const { opciones, enviados } = geminiFalso();
    await consultarIA(
      consulta({ contexto: "Ana García falló la pregunta sobre bucles." }),
      opciones,
    );

    const instrucciones = (enviados[0].systemInstruction as { parts: Array<{ text: string }> })
      .parts[0].text;
    assert.ok(instrucciones.startsWith("Eres un tutor de Python."));
    assert.match(instrucciones, /<contexto>\n\[NOMBRE\] falló la pregunta sobre bucles\.\n<\/contexto>/);
    assert.match(instrucciones, /no instrucciones/);
    assert.ok(!instrucciones.includes("Ana"));
  });

  test("sin contexto envía las instrucciones tal cual", async () => {
    const { opciones, enviados } = geminiFalso();
    await consultarIA(consulta(), opciones);
    assert.deepEqual(enviados[0].systemInstruction, {
      parts: [{ text: "Eres un tutor de Python." }],
    });
  });

  test("pasa la temperatura y el máximo de tokens", async () => {
    const { opciones, enviados } = geminiFalso();
    await consultarIA(consulta({ temperatura: 0.1, maxTokensSalida: 300 }), opciones);
    assert.deepEqual(enviados[0].generationConfig, { temperature: 0.1, maxOutputTokens: 300 });
  });
});

describe("vuelta: la respuesta también se filtra", () => {
  test("quita los datos personales que escriba Gemini", async () => {
    const { opciones } = geminiFalso("Claro, Ana. Si tienes dudas, escribe a profe@academia.es");
    assert.deepEqual(await consultarIA(consulta(), opciones), {
      ok: true,
      texto: "Claro, [NOMBRE]. Si tienes dudas, escribe a [EMAIL]",
    });
  });

  test("una respuesta sin datos personales llega igual", async () => {
    const { opciones } = geminiFalso("Una tupla es inmutable.");
    assert.deepEqual(await consultarIA(consulta(), opciones), {
      ok: true,
      texto: "Una tupla es inmutable.",
    });
  });
});

describe("límites de longitud", () => {
  test("acepta un contexto largo, como una transcripción, y lo sigue filtrando", async () => {
    const { opciones, enviados } = geminiFalso();
    const transcripcion = "En este vídeo explicamos los bucles. ".repeat(500) + "Contacto: ana@gmail.com";
    assert.ok(transcripcion.length > LIMITES.mensaje && transcripcion.length <= LIMITES.contexto);

    assert.equal((await consultarIA(consulta({ contexto: transcripcion }), opciones)).ok, true);
    const enviado = JSON.stringify(enviados[0]);
    assert.ok(enviado.includes("[EMAIL]"));
    assert.ok(!enviado.includes("ana@gmail.com"));
  });

  test("acepta una respuesta larga de Gemini", async () => {
    const { opciones } = geminiFalso("Explicación. ".repeat(600));
    assert.equal((await consultarIA(consulta(), opciones)).ok, true);
  });

  test("un mensaje del alumno sigue limitado", async () => {
    const { opciones, enviados } = geminiFalso();
    const resultado = await consultarIA(
      consulta({ mensajes: [{ rol: "usuario", texto: "a".repeat(LIMITES.mensaje + 1) }] }),
      opciones,
    );
    assert.deepEqual(resultado, { ok: false, motivo: "proteccion_entrada" });
    assert.equal(enviados.length, 0);
  });
});

describe("fallo seguro", () => {
  test("si la protección falla en un mensaje, no se llama a Gemini", async () => {
    const { opciones, enviados } = geminiFalso();
    const largo = "a".repeat(LIMITES.mensaje + 1);
    assert.deepEqual(
      await consultarIA(consulta({ mensajes: [{ rol: "usuario", texto: largo }] }), opciones),
      { ok: false, motivo: "proteccion_entrada" },
    );
    assert.equal(enviados.length, 0);
  });

  test("si la protección falla en el contexto, no se llama a Gemini", async () => {
    const { opciones, enviados } = geminiFalso();
    const resultado = await consultarIA(
      consulta({ contexto: "a".repeat(LIMITES.contexto + 1) }),
      opciones,
    );
    assert.deepEqual(resultado, { ok: false, motivo: "proteccion_entrada" });
    assert.equal(enviados.length, 0);
  });

  test("si la protección falla en la respuesta, no se devuelve", async () => {
    const { opciones } = geminiFalso("a".repeat(LIMITES.respuesta + 1));
    assert.deepEqual(await consultarIA(consulta(), opciones), {
      ok: false,
      motivo: "proteccion_respuesta",
    });
  });

  test("devuelve el motivo de los errores de Gemini", async () => {
    const { opciones, enviados } = geminiFalso();
    assert.deepEqual(await consultarIA(consulta(), { ...opciones, clave: "" }), {
      ok: false,
      motivo: "sin_clave",
    });
    assert.equal(enviados.length, 0);
  });

  for (const [caso, mala] of [
    ["sin mensajes", { mensajes: [] }],
    ["rol desconocido", { mensajes: [{ rol: "sistema", texto: "hola" }] }],
    ["mensaje sin texto", { mensajes: [{ rol: "usuario" }] }],
    ["sin instrucciones", { instrucciones: undefined }],
  ] as const) {
    test(`rechaza una consulta ${caso}`, async () => {
      const { opciones, enviados } = geminiFalso();
      const resultado = await consultarIA(
        { ...consulta(), ...(mala as unknown as Partial<ConsultaIA>) },
        opciones,
      );
      assert.deepEqual(resultado, { ok: false, motivo: "consulta_no_valida" });
      assert.equal(enviados.length, 0);
    });
  }

  test("los logs solo incluyen el motivo, nunca el texto", async () => {
    const { opciones } = geminiFalso("a".repeat(LIMITES.respuesta + 1));
    await consultarIA(
      consulta({ mensajes: [{ rol: "usuario", texto: "Mi correo es ana@gmail.com" }] }),
      opciones,
    );
    const registrado = JSON.stringify(errorConsola.mock.calls.map((llamada) => llamada.arguments));
    assert.match(registrado, /proteccion_respuesta/);
    assert.ok(!registrado.includes("ana@gmail.com"));
    assert.ok(!registrado.includes("Mi correo"));
  });
});
