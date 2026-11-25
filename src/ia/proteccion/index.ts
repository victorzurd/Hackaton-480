/**
 * Servicio de protección de datos para la IA
 * Filtra emails, teléfonos, documentos y nombres.
 * 
 * 
 * Fallback: False - para no enviarle nada a la IA
 */
import { filtrarDatosConFormato, type TipoDatoConFormato } from "./filtros";
import { filtrarNombres, type DatosAlumno } from "./nombres";

export { RegistroSeudonimos, registroSeudonimos } from "./seudonimos";
export type { DatosAlumno } from "./nombres";

//TODO medir en tutorIA
export const LONGITUD_MAXIMA = 4000;

export type DatosDetectados = Record<TipoDatoConFormato | "nombre", number>;

export type MotivoRechazo = "texto_no_valido" | "texto_demasiado_largo" | "error_interno";

export type ResultadoProteccion =
  | { ok: true; texto: string; detectados: DatosDetectados }
  | { ok: false; motivo: MotivoRechazo };

  // Caracteres invisibles
  const INVISIBLES = /[\p{Cf}\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu;

export function protegerTexto(texto: unknown, alumno: DatosAlumno = {}): ResultadoProteccion {
  if (typeof texto !== "string") return { ok: false, motivo: "texto_no_valido" };
  if (texto.length > LONGITUD_MAXIMA) return { ok: false, motivo: "texto_demasiado_largo" };

  try {
    const limpio = texto.normalize("NFC").replace(INVISIBLES, "");
    const conFormato = filtrarDatosConFormato(limpio);
    const sinNombres = filtrarNombres(conFormato.texto, alumno);

    return {
      ok: true,
      texto: sinNombres.texto,
      detectados: { ...conFormato.detectados, nombre: sinNombres.detectados },
    };
  
  } catch {  
    console.error("Protección de datos: error al filtrar el texto. No se envía nada a la IA.");
    
    return { ok: false, motivo: "error_interno" };
  }
}
