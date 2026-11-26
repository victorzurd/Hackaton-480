import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import {
  obtenerEncuestaInicial,
  obtenerErrores,
  obtenerProgreso,
  type ConsultaAlumno,
} from "../../../src/ia/rag/alumno";
import type { BaseDatos } from "../../../src/ia/rag/bd";

// Simula la BD: guarda las consultas y devuelve las filas indicadas.
function bdFalsa(filas: unknown[] = [], falla = false) {
  const consultas: Array<{ texto: string; valores?: unknown[] }> = [];
  const db: BaseDatos = {
    query: async (texto, valores) => {
      consultas.push({ texto, valores });
      if (falla) throw new Error("conexión perdida");
      return { rows: filas };
    },
  };
  return { db, consultas };
}

const consulta: ConsultaAlumno = { alumnoId: "7", cursoId: 1 };
const fecha = new Date("2026-11-20T10:30:00Z");

const CONSULTAS = [
  ["obtener_errores", obtenerErrores],
  ["obtener_encuesta_inicial", obtenerEncuestaInicial],
  ["obtener_progreso", obtenerProgreso],
] as const;

let errorConsola: ReturnType<typeof mock.method>;
beforeEach(() => {
  errorConsola = mock.method(console, "error", () => {});
});
afterEach(() => errorConsola.mock.restore());

describe("obtener_errores", () => {
  test("devuelve las preguntas falladas sin ids, con la respuesta recortada", async () => {
    const { db } = bdFalsa([
      {
        modulo: "Bucles",
        pregunta: "¿Qué hace break?",
        concepto: "break",
        minuto: 1680,
        respuesta: "x".repeat(600),
        fecha,
        pregunta_id: 99, // aunque la BD lo devolviera, no se pasa
      },
    ]);

    const resultado = await obtenerErrores(db, consulta);

    assert.ok(resultado.ok);
    assert.deepEqual(Object.keys(resultado.datos[0]).sort(), [
      "concepto", "fecha", "minuto", "modulo", "pregunta", "respuesta",
    ]);
    assert.equal(resultado.datos[0].respuesta?.length, 501);
    assert.equal(resultado.datos[0].fecha, "2026-11-20");
    assert.equal(resultado.datos[0].minuto, 1680);
  });

  test("solo del alumno y del curso indicados, y opcionalmente de un módulo", async () => {
    const { db, consultas } = bdFalsa();
    await obtenerErrores(db, { ...consulta, moduloId: 3 });
    assert.deepEqual(consultas[0].valores, ["7", 1, 3, 20]);
    await obtenerErrores(db, consulta);
    assert.deepEqual(consultas[1].valores, ["7", 1, null, 20]);
  });
});

describe("obtener_encuesta_inicial", () => {
  test("null si el alumno no ha hecho el examen inicial", async () => {
    const { db } = bdFalsa([]);
    assert.deepEqual(await obtenerEncuestaInicial(db, consulta), { ok: true, datos: null });
  });

  test("devuelve la fecha y cada respuesta con su acierto", async () => {
    const { db } = bdFalsa([
      { fecha, modulo: "Bucles", pregunta: "¿Qué es un bucle?", concepto: "for", respuesta: "Repite", acierto: true },
      { fecha, modulo: "Excepciones", pregunta: "¿Qué es try?", concepto: null, respuesta: null, acierto: null },
    ]);
    assert.deepEqual(await obtenerEncuestaInicial(db, consulta), {
      ok: true,
      datos: {
        fecha: "2026-11-20",
        respuestas: [
          { modulo: "Bucles", pregunta: "¿Qué es un bucle?", concepto: "for", respuesta: "Repite", acierto: true },
          { modulo: "Excepciones", pregunta: "¿Qué es try?", concepto: null, respuesta: null, acierto: null },
        ],
      },
    });
  });
});

describe("obtener_progreso", () => {
  test("devuelve el estado de cada contenido", async () => {
    const { db } = bdFalsa([
      { modulo: "Bucles", orden: 3, contenido: "Bucles", tipo: "video", estado: "completado", fecha },
      { modulo: "Excepciones", orden: 4, contenido: "Excepciones", tipo: "video", estado: "pendiente", fecha: null },
    ]);
    assert.deepEqual(await obtenerProgreso(db, consulta), {
      ok: true,
      datos: [
        { modulo: "Bucles", orden: 3, contenido: "Bucles", tipo: "video", estado: "completado", fecha: "2026-11-20" },
        { modulo: "Excepciones", orden: 4, contenido: "Excepciones", tipo: "video", estado: "pendiente", fecha: null },
      ],
    });
  });
});

describe("seguridad de las consultas", () => {
  for (const [nombre, funcion] of CONSULTAS) {
    test(`${nombre}: no lee datos personales ni columnas no permitidas`, async () => {
      const { db, consultas } = bdFalsa();
      await funcion(db, consulta);
      const sql = consultas[0].texto.toLowerCase();
      for (const prohibido of ["usuarios", "email", "nombre", "apellido", "password", "contrasena", "respuesta_correcta", "explicacion"]) {
        assert.ok(!sql.includes(prohibido), prohibido);
      }
      assert.ok(!/\b(insert|update|delete|drop)\b/.test(sql));
    });

    test(`${nombre}: filtra por el alumno de la sesión como parámetro`, async () => {
      const { db, consultas } = bdFalsa();
      await funcion(db, consulta);
      assert.match(consultas[0].texto, /alumno_id = \$1/);
      assert.equal(consultas[0].valores?.[0], "7");
    });

    for (const [caso, mala] of [
      ["sin alumno", { cursoId: 1 }],
      ["alumno no numérico", { alumnoId: "7 OR 1=1", cursoId: 1 }],
      ["alumno 0", { alumnoId: 0, cursoId: 1 }],
      ["curso decimal", { alumnoId: 7, cursoId: 1.5 }],
      ["módulo no válido", { alumnoId: 7, cursoId: 1, moduloId: "-3" }],
    ] as const) {
      test(`${nombre}: rechaza una consulta ${caso} sin tocar la BD`, async () => {
        const { db, consultas } = bdFalsa();
        assert.deepEqual(await funcion(db, mala as never), { ok: false, motivo: "consulta_no_valida" });
        assert.equal(consultas.length, 0);
      });
    }

    test(`${nombre}: error de la BD sin datos en el log`, async () => {
      const { db } = bdFalsa([], true);
      assert.deepEqual(await funcion(db, consulta), { ok: false, motivo: "error_bd" });
      const registrado = JSON.stringify(errorConsola.mock.calls.map((llamada) => llamada.arguments));
      assert.match(registrado, new RegExp(nombre));
      assert.ok(!registrado.includes("conexión perdida"));
    });
  }
});
