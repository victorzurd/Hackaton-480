import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  filtrarDatosConFormato,
  letraDocumentoValida,
} from "../../../src/ia/proteccion/filtros";

const filtrar = (texto: string) => filtrarDatosConFormato(texto).texto;

// Pack correos
describe("emails", () => {

  for (const email of [
    "ana@gmail.com",
    "Ana.Garcia@Empresa.ES",
    "ana+curso@correo.example.org",
    "user_99@sub-dominio.co.uk",
    "josé.núñez@correo.es",
  ]) {
  
    test(`filtra ${email}`, () => {
      assert.equal(filtrar(`Mi correo es ${email}, escríbeme.`), "Mi correo es [EMAIL], escríbeme.");
    });
  }

  test("filtra el email antes que el teléfono que contiene", () => {
    assert.equal(filtrar("612345678@gmail.com"), "[EMAIL]");
  });
});

describe("documentos", () => {

  for (const documento of [
    "12345678Z",
    "12345678z",
    "12345678-Z",
    "12345678 Z",
    "12.345.678-Z",
    "X1234567L",
    "y-1234567-x",
    "Z 1234567 R",
    "00000000T",
    "99999999R",
  ]) {
  
    test(`filtra ${documento}`, () => {
      assert.equal(filtrar(`Mi DNI es ${documento}.`), "Mi DNI es [DOCUMENTO].");
    });
  }

  for (const documento of ["12345678A", "12.345.678-A", "X1234567A", "Y1234567L"]) {
    test(`no filtra ${documento} porque la letra de control no es válida`, () => {
      assert.equal(filtrar(documento), documento);
      assert.equal(filtrarDatosConFormato(documento).detectados.documento, 0);
    });
  }
});

describe("letraDocumentoValida", () => {
  test("calcula la letra con el resto de dividir entre 23", () => {
    assert.equal(letraDocumentoValida("12345678Z"), true);
    assert.equal(letraDocumentoValida("X1234567L"), true);
    assert.equal(letraDocumentoValida("12345678Y"), false);
  });

  test("las 23 letras corresponden a su resto", () => {
    const letras = "TRWAGMYFPDXBNJZSQVHLCKE";
    for (let resto = 0; resto < 23; resto++) {
      const numero = String(23 * 1000 + resto).padStart(8, "0");
      assert.equal(letraDocumentoValida(`${numero}${letras[resto]}`), true, numero);
    }
  });
});

//pack telefonos
describe("teléfonos", () => {
  for (const telefono of [
    "612345678",
    "712345678",
    "912345678",
    "612 345 678",
    "612 34 56 78",
    "612-345-678",
    "612.345.678",
    "+34 612345678",
    "+34612345678",
    "+34 612 34 56 78",
    "0034 612 345 678",
    "34612345678",
  ]) {

    test(`filtra ${telefono}`, () => {
      assert.equal(filtrar(`Llámame al ${telefono}.`), "Llámame al [TELEFONO].");
    });
  }
});

describe("cuenta lo que detecta", () => {
  test("varios datos en el mismo texto", () => {
    const resultado = filtrarDatosConFormato(
      "Soy ana@gmail.com, DNI 12345678Z, móvil 612345678 o 699 111 222.",
    );

    assert.equal(
      resultado.texto,
      "Soy [EMAIL], DNI [DOCUMENTO], móvil [TELEFONO] o [TELEFONO].",
    );
    
    assert.deepEqual(resultado.detectados, { email: 1, documento: 1, telefono: 2 });
  });

  test("sin datos personales no detecta nada", () => {
    assert.deepEqual(filtrarDatosConFormato("¿Qué es una lista?").detectados, {
      email: 0,
      documento: 0,
      telefono: 0,
    });
  });
});

describe("no modifica lo que no son datos personales", () => {
  for (const texto of [
    "for i in range(10):\n    print(i)",
    "pi = 3.141592653\ntau = 6.28318530",
    "edad = 25\nif edad >= 18:\n    print('mayor de edad')",
    "@staticmethod\ndef sumar(a, b):\n    return a @ b",
    "En el minuto 12:30 explica los bucles.",
    "Python 3.12 salió en 2023.",
    "El número 512345678 no empieza por 6, 7, 8 o 9.",
    "El número 6123456789 tiene 10 cifras.",
    "La variable x1234567 no tiene letra final.",
    "Escribe 12345678 sin letra.",
    "Usa el operador @ entre matrices.",
  ]) {
    test(JSON.stringify(texto), () => {
      assert.equal(filtrar(texto), texto);
    });
  }
});
