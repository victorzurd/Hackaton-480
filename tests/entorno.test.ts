import assert from "node:assert/strict";
import { test } from "node:test";

// Comprueba que el entorno de tests funciona.
// Se elimina cuando existan los tests del servicio de protección de datos.
test("el entorno de tests funciona", () => {
  assert.equal(1 + 1, 2);
});
