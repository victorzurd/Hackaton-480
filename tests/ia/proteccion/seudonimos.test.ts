import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { RegistroSeudonimos } from "../../../src/ia/proteccion/seudonimos";

function registroConReloj(duracionMs = 1000) {
  let ahora = 0;
  const registro = new RegistroSeudonimos({ duracionMs, ahora: () => ahora });
  return { registro, avanzar: (ms: number) => (ahora += ms) };
}

describe("seudónimos de sesión", () => {
  test("tiene formato aleatorio y no contiene el id real", () => {
    const seudonimo = new RegistroSeudonimos().obtener("sesion-1", 987654321);
    assert.match(seudonimo, /^alumno_[0-9a-f]{16}$/);
    assert.ok(!seudonimo.includes("987654321"));
  });

  test("la misma sesión recibe siempre el mismo seudónimo", () => {
    const registro = new RegistroSeudonimos();
    assert.equal(registro.obtener("sesion-1", 7), registro.obtener("sesion-1", "7"));
  });

  test("sesiones distintas reciben seudónimos distintos, aunque sean del mismo alumno", () => {
    const registro = new RegistroSeudonimos();
    assert.notEqual(registro.obtener("sesion-1", 7), registro.obtener("sesion-2", 7));
  });

  test("no se puede deducir el alumno del seudónimo sin el registro", () => {
    const seudonimoA = new RegistroSeudonimos().obtener("sesion-1", 7);
    const seudonimoB = new RegistroSeudonimos().obtener("sesion-1", 7);
    assert.notEqual(seudonimoA, seudonimoB);
  });

  test("el servidor puede resolver el seudónimo al alumno", () => {
    const registro = new RegistroSeudonimos();
    const seudonimo = registro.obtener("sesion-1", 7);
    assert.equal(registro.resolver(seudonimo), "7");
    assert.equal(registro.resolver("alumno_0000000000000000"), null);
  });

  test("rechaza una sesión que ya pertenece a otro alumno", () => {
    const registro = new RegistroSeudonimos();
    registro.obtener("sesion-1", 7);
    assert.throws(() => registro.obtener("sesion-1", 8), /otro alumno/);
  });

  test("rechaza datos vacíos", () => {
    const registro = new RegistroSeudonimos();
    assert.throws(() => registro.obtener("", 7));
    assert.throws(() => registro.obtener("sesion-1", ""));
  });
});

describe("caducidad y borrado", () => {
  test("caduca y la sesión recibe uno nuevo", () => {
    const { registro, avanzar } = registroConReloj(1000);
    const primero = registro.obtener("sesion-1", 7);

    avanzar(999);
    assert.equal(registro.obtener("sesion-1", 7), primero);

    avanzar(1);
    assert.equal(registro.resolver(primero), null);
    assert.notEqual(registro.obtener("sesion-1", 7), primero);
  });

  test("eliminar la sesión borra la correspondencia", () => {
    const registro = new RegistroSeudonimos();
    const seudonimo = registro.obtener("sesion-1", 7);
    registro.eliminarSesion("sesion-1");
    assert.equal(registro.resolver(seudonimo), null);
    assert.doesNotThrow(() => registro.eliminarSesion("no-existe"));
  });
});
