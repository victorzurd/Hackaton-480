/**SOPA DE REGEX GRACIAS A CLAUDE */
export type TipoDatoConFormato = "email" | "documento" | "telefono";

export const ETIQUETAS: Record<TipoDatoConFormato, string> = {
  email: "[EMAIL]",
  documento: "[DOCUMENTO]",
  telefono: "[TELEFONO]",
};

export type ResultadoFiltro = {
  texto: string;
  detectados: Record<TipoDatoConFormato, number>;
};

// Ninguna letra ni dígito justo antes o después, para no cortar palabras ni números.
const INICIO = String.raw`(?<![\p{L}\p{N}])`;
const FIN = String.raw`(?![\p{L}\p{N}])`;

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;

// DNI: 8 dígitos y letra (12345678Z, 12.345.678-Z). NIE: X, Y o Z, 7 dígitos y letra.
const DOCUMENTO = new RegExp(
  `${INICIO}(?:\\d{2}\\.?\\d{3}\\.?\\d{3}|[XYZ][\\s-]?\\d{7})[\\s-]?[A-Z]${FIN}`,
  "giu",
);

const LETRAS_CONTROL = "TRWAGMYFPDXBNJZSQVHLCKE";
const PREFIJOS_NIE: Record<string, string> = { X: "0", Y: "1", Z: "2" };

// La letra debe ser la del resto de dividir el número entre 23.
// En el NIE, la X, la Y y la Z cuentan como 0, 1 y 2.
export function letraDocumentoValida(documento: string): boolean {
  const limpio = documento.toUpperCase().replace(/[\s.-]/g, "");
  const numero = (PREFIJOS_NIE[limpio[0]] ?? limpio[0]) + limpio.slice(1, -1);
  return LETRAS_CONTROL[Number(numero) % 23] === limpio.at(-1);
}

// Teléfono español: 9 dígitos empezando por 6, 7, 8 o 9, con prefijo +34, 0034 o 34 opcional.
// Admite espacios o guiones entre cifras, y puntos solo en grupos 3-3-3 (612.345.678),
// para no confundirlo con decimales como 6.28318530.
const PREFIJO = String.raw`(?:(?:\+|00)?34[\s.-]?)?`;
const NUEVE_CIFRAS = String.raw`(?:[6-9]\d{2}\.\d{3}\.\d{3}|[6-9](?:[\s-]?\d){8})`;
const TELEFONO = new RegExp(
  String.raw`(?<![\p{N}+]|\p{N}[.,])${PREFIJO}${NUEVE_CIFRAS}(?![\p{N}]|[.,]\p{N})`,
  "gu",
);

// El orden importa: un email puede contener números y un DNI tiene 8 cifras.
// El validador, si existe, decide si una coincidencia es realmente un dato personal.
const FILTROS: ReadonlyArray<[TipoDatoConFormato, RegExp, ((valor: string) => boolean)?]> = [
  ["email", EMAIL],
  ["documento", DOCUMENTO, letraDocumentoValida],
  ["telefono", TELEFONO],
];

export function filtrarDatosConFormato(texto: string): ResultadoFiltro {
  const detectados: Record<TipoDatoConFormato, number> = {
    email: 0,
    documento: 0,
    telefono: 0,
  };

  let resultado = texto;
  for (const [tipo, patron, esValido] of FILTROS) {
    resultado = resultado.replace(patron, (coincidencia) => {
      if (esValido && !esValido(coincidencia)) return coincidencia;
      detectados[tipo] += 1;
      return ETIQUETAS[tipo];
    });
  }

  return { texto: resultado, detectados };
}
