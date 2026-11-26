import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { elegirTramo, palabrasClaveDe, textosDelReel } from "../../src/reels/servicio";

const fragmentos = [
  { tiempoInicio: 0, tiempoFin: 3, texto: "welcome to the lecture" },
  { tiempoInicio: 300, tiempoFin: 303, texto: "now a for loop" },
  { tiempoInicio: 303, tiempoFin: 306, texto: "the loop repeats" },
];

describe("palabrasClaveDe", () => {
  test("usa las palabras clave de la configuración y añade el concepto", () => {
    const palabras = palabrasClaveDe({
      concepto: "Bucle for",
      configuracion: { palabras_clave: ["for loop", "  loop "] },
    });
    assert.deepEqual(palabras, ["for loop", "loop", "Bucle for"]);
  });

  test("ignora configuraciones sin palabras clave o con valores no válidos", () => {
    assert.deepEqual(palabrasClaveDe({ concepto: "range", configuracion: {} }), ["range"]);
    assert.deepEqual(palabrasClaveDe({ concepto: "range", configuracion: null }), ["range"]);
    assert.deepEqual(
      palabrasClaveDe({ concepto: null, configuracion: { palabras_clave: [3, "", "range"] } }),
      ["range"],
    );
  });
});

describe("elegirTramo", () => {
  test("si la pregunta trae tiempo_video, lo usa sin buscar en los subtítulos", () => {
    const tramo = elegirTramo(
      { tiempoVideo: 100, concepto: "for loop", configuracion: {} },
      fragmentos,
      null,
    );
    assert.equal(tramo?.tiempoInicio, 95);
  });

  test("sin tiempo_video busca las palabras clave en los subtítulos", () => {
    const tramo = elegirTramo(
      { tiempoVideo: null, concepto: "Bucle for", configuracion: { palabras_clave: ["loop"] } },
      fragmentos,
      null,
    );
    assert.equal(tramo?.tiempoInicio, 295);
    assert.equal(tramo?.coincidencias, 2);
  });

  test("devuelve null si no encuentra el concepto", () => {
    const tramo = elegirTramo({ tiempoVideo: null, concepto: "Bucle for", configuracion: {} }, fragmentos, null);
    assert.equal(tramo, null);
  });
});

describe("textosDelReel", () => {
  test("usa la explicación de la pregunta como recomendación", () => {
    const textos = textosDelReel({
      enunciado: "¿Qué devuelve range(3)?",
      concepto: "range",
      explicacion: "range(3) genera 0, 1 y 2.",
    });
    assert.equal(textos.concepto, "range");
    assert.equal(textos.recomendacion, "range(3) genera 0, 1 y 2.");
    assert.ok(textos.descripcionError.includes("¿Qué devuelve range(3)?"));
  });

  test("sin explicación ni concepto genera textos por defecto", () => {
    const textos = textosDelReel({ enunciado: "Pregunta", concepto: null, explicacion: null });
    assert.equal(textos.concepto, "Concepto de la lección");
    assert.ok(textos.recomendacion.includes("Concepto de la lección"));
  });

  test("no usa un tono de castigo", () => {
    const textos = textosDelReel({ enunciado: "Pregunta", concepto: "if", explicacion: null });
    const todo = `${textos.descripcionError} ${textos.recomendacion}`.toLowerCase();
    assert.ok(!todo.includes("has fallado"));
  });
});
