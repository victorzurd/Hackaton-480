import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  esIdValido,
  formatearTiempo,
  leerFiltroEstado,
  mapearReel,
  type ReelRow,
} from "../../src/routes/reels";

const filaBase: ReelRow = {
  id: "7",
  concepto: "range",
  descripcion_error: "Pregunta para repasar: «¿Qué devuelve range(3)?»",
  recomendacion: "range(3) produce 0, 1 y 2.",
  tiempo_inicio: 2486,
  tiempo_fin: 2544,
  veces_detectado: 2,
  revisada: false,
  fecha_creacion: "2026-11-26T10:00:00.000Z",
  contenido_id: "3",
  contenido_titulo: "Bucles",
  url: "https://cdn.example.com/lecture2.mp4",
  modulo_titulo: "Bucles",
  modulo_orden: 3,
  curso_id: "1",
  curso_titulo: "Introducción a Python",
};

describe("esIdValido", () => {
  test("acepta números positivos dentro del rango de BIGINT", () => {
    assert.ok(esIdValido("1"));
    assert.ok(esIdValido("9223372036854775807"));
  });

  test("rechaza textos, negativos y números demasiado grandes", () => {
    for (const valor of ["", "abc", "-1", "1.5", "9223372036854775808", undefined, 3]) {
      assert.equal(esIdValido(valor), false, String(valor));
    }
  });
});

describe("formatearTiempo", () => {
  test("usa minutos y segundos por debajo de una hora", () => {
    assert.equal(formatearTiempo(0), "0:00");
    assert.equal(formatearTiempo(75), "1:15");
  });

  test("añade las horas cuando hacen falta", () => {
    assert.equal(formatearTiempo(3725), "1:02:05");
  });
});

describe("leerFiltroEstado", () => {
  test("traduce los valores válidos", () => {
    assert.equal(leerFiltroEstado(undefined), null);
    assert.equal(leerFiltroEstado("todos"), null);
    assert.equal(leerFiltroEstado("pendiente"), false);
    assert.equal(leerFiltroEstado("revisado"), true);
  });

  test("devuelve undefined con valores no válidos", () => {
    assert.equal(leerFiltroEstado("otro"), undefined);
    assert.equal(leerFiltroEstado(["pendiente"]), undefined);
  });
});

describe("mapearReel", () => {
  test("incluye el clip con el fragmento exacto del vídeo", () => {
    const reel = mapearReel(filaBase);

    assert.equal(reel.vecesDetectado, 2);
    assert.deepEqual(reel.clip, {
      url: "https://cdn.example.com/lecture2.mp4",
      inicio: 2486,
      fin: 2544,
      duracion: 58,
      inicioTexto: "41:26",
      urlFragmento: "https://cdn.example.com/lecture2.mp4#t=2486,2544",
    });
    assert.deepEqual(reel.curso, { id: "1", titulo: "Introducción a Python" });
  });

  test("sin tramo encontrado no hay clip, pero sí lección y recomendación", () => {
    const reel = mapearReel({ ...filaBase, tiempo_inicio: null, tiempo_fin: null });

    assert.equal(reel.clip, null);
    assert.equal(reel.leccion?.titulo, "Bucles");
    assert.equal(reel.recomendacion, "range(3) produce 0, 1 y 2.");
  });

  test("no expone el id del alumno ni datos personales", () => {
    const claves = Object.keys(mapearReel(filaBase));
    assert.ok(!claves.includes("alumno_id"));
    assert.ok(!claves.includes("alumnoId"));
  });
});
