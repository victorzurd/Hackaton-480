// Seudónimos de sesión que sustituyen el identificador real del alumno
import { randomBytes } from "node:crypto";

const OCHO_HORAS_MS = 8 * 60 * 60 * 1000;

type Entrada = {
  seudonimo: string;
  alumnoId: string;
  expira: number;
};

export type OpcionesSeudonimos = {
  duracionMs?: number;
  ahora?: () => number;
};

export class RegistroSeudonimos {
  private readonly porSesion = new Map<string, Entrada>();
  private readonly porSeudonimo = new Map<string, Entrada>();
  private readonly duracionMs: number;
  private readonly ahora: () => number;

  constructor({ duracionMs = OCHO_HORAS_MS, ahora = Date.now }: OpcionesSeudonimos = {}) {
    this.duracionMs = duracionMs;
    this.ahora = ahora;
  }

  // Devuelve el seudónimo de la sesión, o crea uno aleatorio si no existe o ha caducado.
  // Es aleatorio, no derivado del id, así que no se puede revertir sin este registro.
  obtener(sesionId: string, alumnoId: string | number): string {
    const alumno = String(alumnoId);
    if (!sesionId || !alumno) {
      throw new Error("Faltan la sesión o el alumno para crear el seudónimo.");
    }

    this.limpiarCaducados();
    const existente = this.porSesion.get(sesionId);
    if (existente) {
      if (existente.alumnoId !== alumno) {
        throw new Error("La sesión pertenece a otro alumno.");
      }
      return existente.seudonimo;
    }

    const entrada: Entrada = {
      seudonimo: `alumno_${randomBytes(8).toString("hex")}`,
      alumnoId: alumno,
      expira: this.ahora() + this.duracionMs,
    };
    this.porSesion.set(sesionId, entrada);
    this.porSeudonimo.set(entrada.seudonimo, entrada);
    return entrada.seudonimo;
  }

  // Solo para uso interno del servidor: nunca debe enviarse el resultado a la IA.
  resolver(seudonimo: string): string | null {
    this.limpiarCaducados();
    return this.porSeudonimo.get(seudonimo)?.alumnoId ?? null;
  }

  eliminarSesion(sesionId: string): void {
    const entrada = this.porSesion.get(sesionId);
    if (!entrada) return;
    this.porSesion.delete(sesionId);
    this.porSeudonimo.delete(entrada.seudonimo);
  }

  private limpiarCaducados(): void {
    const ahora = this.ahora();
    for (const [sesionId, entrada] of this.porSesion) {
      if (entrada.expira <= ahora) {
        this.porSesion.delete(sesionId);
        this.porSeudonimo.delete(entrada.seudonimo);
      }
    }
  }
}

// Registro compartido por todo el servidor.
export const registroSeudonimos = new RegistroSeudonimos();
