import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import {
  PRESUPUESTO_CONTEXTO,
  formatearTiempo,
  obtenerContexto,
  type BaseDatos,
  type ConsultaContexto,
} from "../../../src/ia/rag";

type Filas = {
  modulo?: unknown[];
  idiomas?: unknown[];
  fragmentos?: unknown[];
  errores?: unknown[];
  encuesta?: unknown[];
  progreso?: unknown[];
};

// Simula la BD reconociendo cada consulta por su SQL. `falla` hace fallar una de ellas.
function bdFalsa(filas: Filas, falla?: keyof Filas) {
  const consultas: Array<{ texto: string; valores?: unknown[] }> = [];
  const db: BaseDatos = {
    query: async (texto, valores) => {
      consultas.push({ texto, valores });
      const tipo: keyof Filas = texto.includes("academy.cursos cu")
        ? "modulo"
        : texto.includes("DISTINCT t.idioma")
          ? "idiomas"
          : texto.includes("fragmentos_transcripcion")
            ? "fragmentos"
            : texto.includes("DISTINCT ON")
              ? "errores"
              : texto.includes("tipo = 'inicial'")
                ? "encuesta"
                : "progreso";
      if (tipo === falla) throw new Error("conexión perdida");
      return { rows: filas[tipo] ?? [] };
    },
  };
  return { db, consultas };
}

function geminiFalso(palabras: string[] = ["loop", "while"]) {
  const fetchFalso = (async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ palabras }) }] } }],
      }),
    )) as typeof fetch;
  return { fetch: fetchFalso, clave: "clave-de-prueba" };
}

const fecha = new Date("2026-11-20T10:30:00Z");
const completas: Filas = {
  modulo: [{ curso: "Introducción a Python", modulo: "Bucles", orden: 3 }],
  idiomas: [{ idioma: "en" }],
  fragmentos: [{ titulo: "Bucles", inicio: 1680, fin: 1740, texto: "So we can do this with a loop." }],
  errores: [
    { modulo: "Bucles", pregunta: "¿Qué hace break?", concepto: "break", minuto: 1700, respuesta: "Ni idea", fecha },
    { modulo: "Condicionales", pregunta: "¿Qué es elif?", concepto: null, minuto: null, respuesta: null, fecha },
  ],
  encuesta: [{ fecha, modulo: "Bucles", pregunta: "¿Qué es un bucle?", concepto: "for", respuesta: "Repite", acierto: false }],
  progreso: [
    { modulo: "Condicionales", orden: 2, contenido: "Condicionales", tipo: "video", estado: "saltado", fecha },
    { modulo: "Bucles", orden: 3, contenido: "Bucles", tipo: "video", estado: "en_curso", fecha },
  ],
};

const consulta: ConsultaContexto = {
  alumnoId: "7",
  cursoId: 1,
  moduloId: 3,
  pregunta: "¿Cómo funciona un bucle while?",
  alumno: { nombre: "Ana" },
};

let errorConsola: ReturnType<typeof mock.method>;
beforeEach(() => {
  errorConsola = mock.method(console, "error", () => {});
});
afterEach(() => errorConsola.mock.restore());

describe("contexto del Tutor", () => {
  test("junta módulo, transcripción, errores, encuesta y progreso", async () => {
    const { db } = bdFalsa(completas);
    const resultado = await obtenerContexto(db, consulta, geminiFalso());

    assert.ok(resultado.ok);
    assert.deepEqual(resultado.incluido, ["modulo", "transcripcion", "errores", "encuesta_inicial", "progreso"]);
    const { contexto } = resultado;
    assert.match(contexto, /Curso: Introducción a Python\nMódulo 3: Bucles/);
    assert.match(contexto, /\[Vídeo «Bucles», 28:00-29:00\]\nSo we can do this with a loop\./);
    assert.match(contexto, /- ¿Qué hace break\? \[Bucles \(módulo actual\); concepto: break; se explica en el 28:20 del vídeo; 2026-11-20\]\n  Respondió: Ni idea/);
    assert.match(contexto, /- ¿Qué es elif\? \[Condicionales; 2026-11-20\]/);
    assert.match(contexto, /Examen inicial del alumno \(2026-11-20\)\n- Bucles: ¿Qué es un bucle\? → mal/);
    assert.match(contexto, /Módulo 2, video «Condicionales»: saltado \(ya lo dominaba\)/);
    assert.match(contexto, /Módulo 3, video «Bucles»: en curso/);
  });

  test("todas las consultas usan el alumno y el curso de la sesión", async () => {
    const { db, consultas } = bdFalsa(completas);
    await obtenerContexto(db, consulta, geminiFalso());
    const delAlumno = consultas.filter(({ texto }) => texto.includes("alumno_id"));
    assert.equal(delAlumno.length, 3);
    for (const { valores } of delAlumno) assert.deepEqual(valores?.slice(0, 2), ["7", 1]);
    assert.deepEqual(consultas[0].valores, [3, 1]); // el módulo debe ser del curso
  });

  test("no incluye ids ni el nombre del alumno", async () => {
    const { db } = bdFalsa(completas);
    const resultado = await obtenerContexto(db, consulta, geminiFalso());
    assert.ok(resultado.ok);
    assert.ok(!resultado.contexto.includes("Ana"));
    assert.ok(!/\bid\b|alumno_id|"7"/.test(resultado.contexto));
  });

  test("las partes vacías no aparecen", async () => {
    const { db } = bdFalsa({ modulo: completas.modulo });
    const resultado = await obtenerContexto(db, consulta, geminiFalso());
    assert.deepEqual(resultado, {
      ok: true,
      contexto: "## Curso y módulo actual\nCurso: Introducción a Python\nMódulo 3: Bucles",
      incluido: ["modulo"],
    });
  });

  test("sin pregunta no busca en la transcripción", async () => {
    const { db, consultas } = bdFalsa(completas);
    const resultado = await obtenerContexto(db, { ...consulta, pregunta: "  " }, geminiFalso());
    assert.ok(resultado.ok && !resultado.incluido.includes("transcripcion"));
    assert.ok(!consultas.some(({ texto }) => texto.includes("fragmentos_transcripcion")));
  });

  test("nunca pasa del presupuesto: omite lo que no cabe y sigue con lo demás", async () => {
    const enorme = "x".repeat(PRESUPUESTO_CONTEXTO);
    const { db } = bdFalsa({
      ...completas,
      errores: [{ ...(completas.errores![0] as object), pregunta: enorme }],
    });
    const resultado = await obtenerContexto(db, consulta, geminiFalso());
    assert.ok(resultado.ok);
    assert.deepEqual(resultado.incluido, ["modulo", "transcripcion", "encuesta_inicial", "progreso"]);
    assert.ok(resultado.contexto.length <= PRESUPUESTO_CONTEXTO);
  });

  test("formatea los tiempos del vídeo", () => {
    assert.equal(formatearTiempo(0), "0:00");
    assert.equal(formatearTiempo(1680), "28:00");
    assert.equal(formatearTiempo(6062), "1:41:02");
  });
});

describe("fallo seguro", () => {
  for (const parte of ["idiomas", "errores", "encuesta", "progreso"] as const) {
    test(`si falla ${parte}, el contexto sale sin esa parte`, async () => {
      const { db } = bdFalsa(completas, parte);
      const resultado = await obtenerContexto(db, consulta, geminiFalso());
      assert.ok(resultado.ok);
      assert.ok(resultado.incluido.includes("modulo"));
      assert.equal(resultado.incluido.length, 4);
    });
  }

  test("si Gemini falla al sacar palabras clave, sigue sin transcripción", async () => {
    const { db } = bdFalsa(completas);
    const resultado = await obtenerContexto(db, consulta, { ...geminiFalso(), clave: "" });
    assert.ok(resultado.ok);
    assert.deepEqual(resultado.incluido, ["modulo", "errores", "encuesta_inicial", "progreso"]);
  });

  test("un módulo de otro curso no devuelve nada", async () => {
    const { db, consultas } = bdFalsa({ ...completas, modulo: [] });
    assert.deepEqual(await obtenerContexto(db, consulta, geminiFalso()), {
      ok: false,
      motivo: "modulo_no_encontrado",
    });
    assert.equal(consultas.length, 1);
  });

  test("error de la BD al comprobar el módulo", async () => {
    const { db } = bdFalsa(completas, "modulo");
    assert.deepEqual(await obtenerContexto(db, consulta, geminiFalso()), { ok: false, motivo: "error_bd" });
  });

  for (const [caso, mala] of [
    ["sin alumno", { ...consulta, alumnoId: undefined }],
    ["módulo no válido", { ...consulta, moduloId: "3; drop" }],
    ["sin pregunta", { ...consulta, pregunta: undefined }],
  ] as const) {
    test(`rechaza una consulta ${caso} sin tocar la BD`, async () => {
      const { db, consultas } = bdFalsa(completas);
      assert.deepEqual(await obtenerContexto(db, mala as never, geminiFalso()), {
        ok: false,
        motivo: "consulta_no_valida",
      });
      assert.equal(consultas.length, 0);
    });
  }
});
