import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";
import { LONGITUD_MAXIMA, protegerTexto } from "../../../src/ia/proteccion";

const alumna = { nombre: "Ana", apellidos: "García López" };

describe("protegerTexto", () => {
  test("filtra un mensaje realista con todos los tipos de datos", () => {
    const mensaje =
      "Hola, soy Ana García López. Mi compañero se llama Iván Ruiz y no entiende este código:\n" +
      "for i in range(10):\n    print(i)\n" +
      "Si hace falta, escribidme a ana.garcia@gmail.com o al +34 612 34 56 78. Mi DNI es 12345678Z.";

    const resultado = protegerTexto(mensaje, alumna);

    assert.ok(resultado.ok);
    assert.equal(
      resultado.texto,
      "Hola, soy [NOMBRE]. Mi compañero se llama [NOMBRE] y no entiende este código:\n" +
        "for i in range(10):\n    print(i)\n" +
        "Si hace falta, escribidme a [EMAIL] o al [TELEFONO]. Mi DNI es [DOCUMENTO].",
    );
    assert.deepEqual(resultado.detectados, { email: 1, documento: 1, telefono: 1, nombre: 2 });
    for (const dato of ["Ana", "García", "Iván", "gmail", "612", "12345678Z"]) {
      assert.ok(!resultado.texto.includes(dato), dato);
    }
  });

  test("un texto sin datos personales sale igual", () => {
    const resultado = protegerTexto("¿Qué diferencia hay entre una lista y una tupla?", alumna);
    assert.deepEqual(resultado, {
      ok: true,
      texto: "¿Qué diferencia hay entre una lista y una tupla?",
      detectados: { email: 0, documento: 0, telefono: 0, nombre: 0 },
    });
  });

  test("funciona sin datos del alumno", () => {
    const resultado = protegerTexto("Me llamo Laura, mi correo es laura@correo.es");
    assert.ok(resultado.ok);
    assert.equal(resultado.texto, "Me llamo [NOMBRE], mi correo es [EMAIL]");
  });
});

describe("caracteres invisibles", () => {
  test("no permiten esconder un email o un teléfono", () => {
    const resultado = protegerTexto("ana@gm\u200Bail.com y 612\u200D345\u2060678", alumna);
    assert.ok(resultado.ok);
    assert.equal(resultado.texto, "[EMAIL] y [TELEFONO]");
  });

  test("detecta el nombre aunque la tilde venga como carácter aparte", () => {
    const resultado = protegerTexto("Garci\u0301a", alumna);
    assert.ok(resultado.ok);
    assert.equal(resultado.texto, "[NOMBRE]");
  });

  test("conserva saltos de línea y tabuladores", () => {
    const codigo = "if x:\n\tprint(x)";
    const resultado = protegerTexto(codigo, alumna);
    assert.ok(resultado.ok);
    assert.equal(resultado.texto, codigo);
  });
});

describe("fallo seguro: si algo va mal no hay texto que enviar", () => {
  for (const entrada of [undefined, null, 42, { texto: "hola" }, ["hola"]]) {
    test(`rechaza ${JSON.stringify(entrada)}`, () => {
      assert.deepEqual(protegerTexto(entrada), { ok: false, motivo: "texto_no_valido" });
    });
  }

  test("acepta textos hasta el límite y rechaza los más largos", () => {
    assert.equal(protegerTexto("a".repeat(LONGITUD_MAXIMA)).ok, true);
    assert.deepEqual(protegerTexto("a".repeat(LONGITUD_MAXIMA + 1)), {
      ok: false,
      motivo: "texto_demasiado_largo",
    });
  });

  test("el límite se puede ampliar o reducir por llamada", () => {
    const largo = "a".repeat(LONGITUD_MAXIMA + 1);
    assert.equal(protegerTexto(largo, {}, { longitudMaxima: LONGITUD_MAXIMA + 1 }).ok, true);
    assert.deepEqual(protegerTexto("hola", {}, { longitudMaxima: 3 }), {
      ok: false,
      motivo: "texto_demasiado_largo",
    });
  });

  for (const longitudMaxima of [0, -1, 1.5, Number.NaN]) {
    test(`un límite no válido (${longitudMaxima}) no deja pasar el texto`, () => {
      assert.deepEqual(protegerTexto("hola", {}, { longitudMaxima }), {
        ok: false,
        motivo: "error_interno",
      });
    });
  }

  test("ante un error interno no devuelve texto ni registra datos personales", () => {
    const alumnoQueFalla = {
      get nombre(): string {
        throw new Error("Fallo con ana@gmail.com");
      },
    };
    const errorConsola = mock.method(console, "error", () => {});

    try {
      const resultado = protegerTexto("Mi correo es ana@gmail.com", alumnoQueFalla);

      assert.deepEqual(resultado, { ok: false, motivo: "error_interno" });
      assert.equal(errorConsola.mock.callCount(), 1);
      const registrado = JSON.stringify(errorConsola.mock.calls.map((llamada) => llamada.arguments));
      assert.ok(!registrado.includes("ana@gmail.com"));
      assert.ok(!registrado.includes("Mi correo"));
    } finally {
      errorConsola.mock.restore();
    }
  });
});
