import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DURACION_MAXIMA,
  type Fragmento,
  normalizar,
  seleccionarTramo,
  tramoDesdeSegundo,
} from "../../src/reels/selector";

/** Crea fragmentos de 3 segundos seguidos a partir de una lista de textos. */
function fragmentosDesde(textos: string[], inicio = 0): Fragmento[] {
  return textos.map((texto, i) => ({
    tiempoInicio: inicio + i * 3,
    tiempoFin: inicio + i * 3 + 3,
    texto,
  }));
}

describe("normalizar", () => {
  test("quita tildes, mayúsculas y espacios repetidos", () => {
    assert.equal(normalizar("  Función   ÁRBOL "), "funcion arbol");
  });
});

describe("seleccionarTramo", () => {
  test("devuelve null si ninguna palabra clave aparece", () => {
    const fragmentos = fragmentosDesde(["hello world", "print something"]);
    assert.equal(seleccionarTramo(fragmentos, ["range"]), null);
  });

  test("devuelve null sin palabras clave o sin fragmentos", () => {
    assert.equal(seleccionarTramo(fragmentosDesde(["range"]), []), null);
    assert.equal(seleccionarTramo(fragmentosDesde(["range"]), ["  "]), null);
    assert.equal(seleccionarTramo([], ["range"]), null);
  });

  test("elige el tramo donde más se menciona el concepto, no el primero", () => {
    const relleno = Array(40).fill("some unrelated words");
    const fragmentos = fragmentosDesde([
      "we mention range once",
      ...relleno,
      "range is a function",
      "range of ten",
      "range returns numbers",
    ]);

    const tramo = seleccionarTramo(fragmentos, ["range"]);

    assert.ok(tramo);
    assert.equal(tramo.coincidencias, 3);
    // El segundo bloque empieza en el fragmento 41 (41 * 3 = 123 s), menos el margen.
    assert.equal(tramo.tiempoInicio, 118);
  });

  test("ningún tramo supera la duración máxima", () => {
    const fragmentos = fragmentosDesde(Array(100).fill("range range"));
    const tramo = seleccionarTramo(fragmentos, ["range"]);

    assert.ok(tramo);
    assert.ok(tramo.tiempoFin - tramo.tiempoInicio <= DURACION_MAXIMA);
  });

  test("ignora mayúsculas y tildes", () => {
    const fragmentos = fragmentosDesde(["La FUNCIÓN principal"]);
    assert.equal(seleccionarTramo(fragmentos, ["funcion"])?.coincidencias, 1);
  });

  test("solo cuenta palabras completas", () => {
    const fragmentos = fragmentosDesde(["arrange the strange ranges", "use range(10)"]);
    const tramo = seleccionarTramo(fragmentos, ["range"]);

    assert.ok(tramo);
    assert.equal(tramo.coincidencias, 1);
    assert.equal(tramo.tiempoInicio, 0);
  });

  test("encuentra frases de varias palabras", () => {
    const fragmentos = fragmentosDesde(["a for loop repeats code"]);
    assert.equal(seleccionarTramo(fragmentos, ["for loop"])?.coincidencias, 1);
  });

  test("con empate gana el tramo que aparece antes", () => {
    const relleno = Array(40).fill("nothing here");
    const fragmentos = fragmentosDesde(["range", ...relleno, "range"]);

    assert.equal(seleccionarTramo(fragmentos, ["range"])?.tiempoInicio, 0);
  });

  test("funciona aunque los fragmentos lleguen desordenados", () => {
    const fragmentos = fragmentosDesde(["intro", "range here", "outro"]).reverse();
    assert.equal(seleccionarTramo(fragmentos, ["range"])?.tiempoInicio, 0);
  });
});

describe("tramoDesdeSegundo", () => {
  test("empieza unos segundos antes y dura como máximo 60 s", () => {
    assert.deepEqual(tramoDesdeSegundo(100), { tiempoInicio: 95, tiempoFin: 155, coincidencias: 0 });
  });

  test("no empieza antes del segundo 0 ni acaba después del vídeo", () => {
    assert.deepEqual(tramoDesdeSegundo(2, 30), { tiempoInicio: 0, tiempoFin: 30, coincidencias: 0 });
  });
});
