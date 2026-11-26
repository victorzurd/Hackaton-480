// Lo mínimo que el RAG usa del Pool de pg: permite simular la BD en los tests.
export type BaseDatos = {
  query: (texto: string, valores?: unknown[]) => Promise<{ rows: any[] }>;
};

// Identificador de la BD (bigint): número entero positivo o su texto, como el `sub` del token.
export function idValido(id: unknown): id is number | string {
  if (typeof id === "number") return Number.isSafeInteger(id) && id > 0;
  return typeof id === "string" && /^[1-9]\d{0,18}$/.test(id);
}

// Recorta un texto largo (p. ej. una respuesta libre del alumno) para no inflar el contexto.
export function recortar(texto: unknown, maximo: number): string | null {
  if (typeof texto !== "string") return null;
  return texto.length > maximo ? `${texto.slice(0, maximo)}…` : texto;
}

// Fecha en formato AAAA-MM-DD, sin hora: suficiente para la IA.
export function soloFecha(fecha: unknown): string | null {
  const valor = fecha instanceof Date ? fecha : typeof fecha === "string" ? new Date(fecha) : null;
  return valor && !Number.isNaN(valor.getTime()) ? valor.toISOString().slice(0, 10) : null;
}
