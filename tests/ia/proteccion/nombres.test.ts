import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { filtrarNombres } from "../../../src/ia/proteccion/nombres";

describe("nombre del alumno de la sesión", () => {
  const ana = { nombre: "Ana", apellidos: "García López" };

  test("filtra el nombre completo como un solo [NOMBRE]", () => {
    const resultado = filtrarNombres("Hola, soy Ana García López y tengo una duda.", ana);
    assert.equal(resultado.texto, "Hola, soy [NOMBRE] y tengo una duda.");
    assert.equal(resultado.detectados, 1);
  });

  test("filtra cada aparición por separado", () => {
    const resultado = filtrarNombres("ana dice que García no entiende los bucles", ana);
    assert.equal(resultado.texto, "[NOMBRE] dice que [NOMBRE] no entiende los bucles");
    assert.equal(resultado.detectados, 2);
  });

  test("ignora tildes y mayúsculas", () => {
    const jose = { nombre: "José", apellidos: "Núñez" };
    assert.equal(filtrarNombres("JOSE nunez y josé NÚÑEZ", jose).texto, "[NOMBRE] y [NOMBRE]");
  });

  test("encuentra el nombre con tilde aunque se guardara sin ella", () => {
    assert.equal(filtrarNombres("Me ayudó Martín", { nombre: "Martin" }).texto, "Me ayudó [NOMBRE]");
  });

  test("solo filtra palabras completas", () => {
    const texto = "Anabel come banana con Mariana";
    assert.equal(filtrarNombres(texto, { nombre: "Ana" }).texto, texto);
  });

  test("no corta un nombre largo con uno corto", () => {
    const alumno = { nombre: "Mari Maribel" };
    assert.equal(filtrarNombres("Maribel y Mari", alumno).texto, "[NOMBRE] y [NOMBRE]");
  });

  test("no filtra las partículas solas", () => {
    const maria = { nombre: "María", apellidos: "de la Cruz" };
    assert.equal(
      filtrarNombres("María de la Cruz pregunta por el valor de la lista", maria).texto,
      "[NOMBRE] pregunta por el valor de la lista",
    );
  });

  test("nombres compuestos con guion y apóstrofo", () => {
    const alumno = { nombre: "Ana-María", apellidos: "O'Brien" };
    assert.equal(filtrarNombres("Soy Ana-María O'Brien.", alumno).texto, "Soy [NOMBRE].");
  });

  test("sin datos del alumno no cambia el texto", () => {
    assert.equal(filtrarNombres("Ana tiene una duda").texto, "Ana tiene una duda");
    assert.equal(filtrarNombres("Ana tiene una duda", { nombre: null }).texto, "Ana tiene una duda");
  });
});

describe("frases de presentación", () => {
  for (const [texto, esperado] of [
    ["Me llamo Laura Pérez", "Me llamo [NOMBRE]"],
    ["me llamo laura y tengo una duda", "me llamo [NOMBRE] y tengo una duda"],
    ["Mi nombre es Pedro", "Mi nombre es [NOMBRE]"],
    ["Mi nombre completo es Pedro Ruiz de la Fuente.", "Mi nombre completo es [NOMBRE]."],
    ["Mis apellidos son Ruiz Gómez", "Mis apellidos son [NOMBRE]"],
    ["Llámame Pepe", "Llámame [NOMBRE]"],
    ["Hola, soy Marta.", "Hola, soy [NOMBRE]."],
    ["Mi compañera se llama Lucía Vidal", "Mi compañera se llama [NOMBRE]"],
  ]) {
    test(texto, () => {
      assert.equal(filtrarNombres(texto).texto, esperado);
    });
  }

  test("cuenta cada presentación", () => {
    assert.equal(filtrarNombres("Me llamo Laura y mi amigo se llama Iván").detectados, 2);
  });
});

describe("no modifica lo que no son nombres", () => {
  for (const texto of [
    "Soy nuevo en Python y no entiendo las listas.",
    "soy de Madrid",
    "La función se llama sumar.",
    "Me llamó la atención el bucle while.",
    "¿Qué es una lista? ¿Y un diccionario?",
    "def saludar(nombre):\n    return f'Hola, {nombre}'",
    "Ya está filtrado: [NOMBRE] y [EMAIL].",
  ]) {
    test(JSON.stringify(texto), () => {
      const resultado = filtrarNombres(texto, { nombre: "Ana", apellidos: "García" });
      assert.equal(resultado.texto, texto);
      assert.equal(resultado.detectados, 0);
    });
  }
});
