// Filtro de nombres del alumno de la sesión y los que aparecen tras frases
export const ETIQUETA_NOMBRE = "[NOMBRE]";

export type DatosAlumno = {
  nombre?: string | null;
  apellidos?: string | null;
};

export type ResultadoNombres = {
  texto: string;
  detectados: number;
};

// Nombres compuestos
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "i", "e", "da", "van", "von"]);
// Las que unen partes de un mismo nombre. Sin «y», para que «Ana y Pedro» sigan siendo dos.
const PARTICULA = String.raw`(?:de|del|la|las|los|da|van|von)`;

const INICIO = String.raw`(?<![\p{L}\p{N}])`;
const FIN = String.raw`(?![\p{L}\p{N}])`;

// Cada letra base acepta sus variantes con tilde, para que «Jose» encuentre «José».
const VARIANTES: Record<string, string> = {
  a: "aáàäâ",
  e: "eéèëê",
  i: "iíìïî",
  o: "oóòöô",
  u: "uúùüû",
  n: "nñ",
  c: "cç",
};

function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "");
}

function patronPalabra(palabra: string): string {
  return [...sinTildes(palabra).toLowerCase()]
    .map((letra) => {
      const variantes = VARIANTES[letra];
      if (variantes) return `[${variantes}]`;
      return letra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
}

function palabrasDelAlumno(alumno: DatosAlumno): string[] {
  const palabras = [alumno.nombre, alumno.apellidos]
    .filter((parte): parte is string => typeof parte === "string")
    .flatMap((parte) => parte.split(/[\s-]+/))
    .map((palabra) => palabra.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""))
    .filter((palabra) => palabra.length >= 2 && !PARTICULAS.has(palabra.toLowerCase()));

  // Las más largas primero, para que «Mari» no corte «Maribel».
  return [...new Set(palabras)].sort((a, b) => b.length - a.length);
}

// Una palabra que empieza por mayúscula, con apóstrofos o guiones (O'Brien, Ana-María).
const MAYUSCULA = String.raw`\p{Lu}[\p{L}'’-]*`;
const CUALQUIERA = String.raw`\p{L}[\p{L}'’-]*`;
const MAS_PALABRAS = String.raw`(?:\s+(?:${PARTICULA}\s+)*${MAYUSCULA})*`;

// Tras estas frases, el primer nombre puede ir en minúscula («me llamo ana»).
const PRESENTACION = new RegExp(
  String.raw`${INICIO}((?:[Mm]e\s+llamo|[Mm]i\s+nombre(?:\s+completo)?\s+es|[Mm]is?\s+apellidos?\s+(?:es|son)|[Ll]l[aá]mame)\s+)${CUALQUIERA}${MAS_PALABRAS}`,
  "gu",
);

// Tras «soy» o «se llama» solo cuenta si va en mayúscula, para no filtrar «soy nuevo».
const PRESENTACION_MAYUSCULA = new RegExp(
  String.raw`${INICIO}((?:[Ss]oy|[Ss]e\s+llama)\s+)${MAYUSCULA}${MAS_PALABRAS}`,
  "gu",
);

const NOMBRES_SEGUIDOS = new RegExp(
  String.raw`\[NOMBRE\](?:(?:\s+(?:${PARTICULA}\s+)*|-)\[NOMBRE\])+`,
  "giu",
);

function contarEtiquetas(texto: string): number {
  return texto.split(ETIQUETA_NOMBRE).length - 1;
}

export function filtrarNombres(texto: string, alumno: DatosAlumno = {}): ResultadoNombres {
  const etiquetasPrevias = contarEtiquetas(texto);
  let resultado = texto;

  for (const palabra of palabrasDelAlumno(alumno)) {
    const patron = new RegExp(`${INICIO}${patronPalabra(palabra)}${FIN}`, "giu");
    resultado = resultado.replace(patron, ETIQUETA_NOMBRE);
  }

  resultado = resultado
    .replace(PRESENTACION, (_coincidencia, frase: string) => `${frase}${ETIQUETA_NOMBRE}`)
    .replace(PRESENTACION_MAYUSCULA, (_coincidencia, frase: string) => `${frase}${ETIQUETA_NOMBRE}`)
    .replace(NOMBRES_SEGUIDOS, ETIQUETA_NOMBRE);

  return {
    texto: resultado,
    detectados: Math.max(0, contarEtiquetas(resultado) - etiquetasPrevias),
  };
}
