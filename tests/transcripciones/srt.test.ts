import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  aplicarTraduccion,
  escribirNumerado,
  escribirSrt,
  escribirVtt,
  leerNumerado,
  leerSrt,
  resumirNumeros,
} from "../../src/transcripciones/srt";

describe("formato numerado para el LLM", () => {
  test("escribe una línea «[n] texto» empezando en el número indicado", () => {
    assert.equal(escribirNumerado(["hello", "world"], 301), "[301] hello\n[302] world\n");
  });

  test("lee las líneas numeradas e ignora los comentarios del LLM", () => {
    const respuesta = "Aquí tienes la traducción:\n\n[1] hola\r\n[2]   mundo  \n```\n";
    const { textos, repetidos } = leerNumerado(respuesta);
    assert.deepEqual([...textos], [[1, "hola"], [2, "mundo"]]);
    assert.deepEqual(repetidos, []);
  });

  test("detecta números repetidos", () => {
    assert.deepEqual(leerNumerado("[1] a\n[1] b\n").repetidos, [1]);
  });
});

describe("resumirNumeros", () => {
  test("agrupa los números consecutivos", () => {
    assert.equal(resumirNumeros([7, 1, 2, 3, 9, 10]), "1-3, 7, 9-10");
    assert.equal(resumirNumeros([]), "");
  });
});

describe("aplicarTraduccion", () => {
  const original = [
    { inicio: "00:00:01,000", fin: "00:00:02,000", texto: "hello" },
    { inicio: "00:00:02,000", fin: "00:00:03,000", texto: "world" },
  ];

  test("conserva los tiempos del original", () => {
    const { subtitulos, faltan, sobran } = aplicarTraduccion(original, new Map([[1, "hola"], [2, "mundo"]]));
    assert.deepEqual(subtitulos, [
      { inicio: "00:00:01,000", fin: "00:00:02,000", texto: "hola" },
      { inicio: "00:00:02,000", fin: "00:00:03,000", texto: "mundo" },
    ]);
    assert.deepEqual(faltan, []);
    assert.deepEqual(sobran, []);
  });

  test("informa de las líneas que faltan, vacías o que sobran", () => {
    const { faltan, sobran } = aplicarTraduccion(original, new Map([[2, ""], [3, "extra"]]));
    assert.deepEqual(faltan, [1, 2]);
    assert.deepEqual(sobran, [3]);
  });
});

const SRT =
  "﻿1\r\n00:00:01,000 --> 00:00:03,500\r\nHello,\r\nworld\r\n\r\n" +
  "2\r\n00:00:04,000 --> 00:00:06,000\r\nthis is CS50\r\n\r\n" +
  "3\r\nsin tiempos\r\n\r\n" +
  "4\r\n00:00:07,000 --> 00:00:08,000\r\n\r\n";

describe("leerSrt", () => {
  test("lee tiempos y texto, une las líneas y salta bloques no válidos", () => {
    assert.deepEqual(leerSrt(SRT), [
      { inicio: "00:00:01,000", fin: "00:00:03,500", texto: "Hello, world" },
      { inicio: "00:00:04,000", fin: "00:00:06,000", texto: "this is CS50" },
    ]);
  });
});

describe("escribirSrt y escribirVtt", () => {
  const subtitulos = [
    { inicio: "00:00:01,000", fin: "00:00:03,500", texto: "Hola, mundo" },
    { inicio: "00:00:04,000", fin: "00:00:06,000", texto: "esto es CS50" },
  ];

  test("el SRT escrito se vuelve a leer igual", () => {
    assert.deepEqual(leerSrt(escribirSrt(subtitulos)), subtitulos);
  });

  test("el VTT lleva cabecera y usa punto en los milisegundos", () => {
    const vtt = escribirVtt(subtitulos);
    assert.ok(vtt.startsWith("WEBVTT\n\n"));
    assert.ok(vtt.includes("00:00:01.000 --> 00:00:03.500\nHola, mundo"));
    assert.ok(!vtt.includes(","+ "000"));
  });
});
