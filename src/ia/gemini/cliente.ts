const URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODELO_POR_DEFECTO = "gemini-3.5-flash-lite";
const TIEMPO_MAXIMO_MS = 30_000;

// Valores de ejemplo que no son una clave real.
const CLAVES_DE_EJEMPLO = [/^$/, /^replace-with/i, /^Api_Gemini$/];

export type MensajeGemini = {
  rol: "usuario" | "modelo";
  texto: string;
};

export type PeticionGemini = {
  instrucciones: string;
  mensajes: MensajeGemini[];
  temperatura?: number;
  maxTokensSalida?: number;
};

export type MotivoErrorGemini =
  | "sin_clave"
  | "tiempo_agotado"
  | "error_red"
  | "error_gemini"
  | "respuesta_bloqueada"
  | "respuesta_vacia";

export type ResultadoGemini =
  | { ok: true; texto: string }
  | { ok: false; motivo: MotivoErrorGemini; estado?: number };

// Para los tests: permiten simular Gemini sin llamar gogole
export type OpcionesCliente = {
  fetch?: typeof fetch;
  clave?: string;
  modelo?: string;
  tiempoMaximoMs?: number;
};

type RespuestaApi = {
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

function claveValida(clave: string | undefined): clave is string {
  const limpia = clave?.trim() ?? "";
  return !CLAVES_DE_EJEMPLO.some((patron) => patron.test(limpia));
}

export async function llamarGemini(
  peticion: PeticionGemini,
  opciones: OpcionesCliente = {},
  
): Promise<ResultadoGemini> {
  const clave = (opciones.clave ?? process.env.GEMINI_API_KEY)?.trim();
  if (!claveValida(clave)) return { ok: false, motivo: "sin_clave" };

  const modelo = opciones.modelo ?? (process.env.GEMINI_MODEL?.trim() || MODELO_POR_DEFECTO);
  const peticionHttp = opciones.fetch ?? fetch;

  let respuesta: Response;
  
  try {
    respuesta = await peticionHttp(`${URL_BASE}/${encodeURIComponent(modelo)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
      signal: AbortSignal.timeout(opciones.tiempoMaximoMs ?? TIEMPO_MAXIMO_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: peticion.instrucciones }] },
        contents: peticion.mensajes.map((mensaje) => ({
          role: mensaje.rol === "usuario" ? "user" : "model",
          parts: [{ text: mensaje.texto }],
        })),
        generationConfig: {
          temperature: peticion.temperatura ?? 0.3,
          maxOutputTokens: peticion.maxTokensSalida ?? 1024,
        },
      }),
    });
  } catch (error) {
    const nombre = (error as { name?: string } | null)?.name;
    if (nombre === "TimeoutError" || nombre === "AbortError") {
      return { ok: false, motivo: "tiempo_agotado" };
    }
    return { ok: false, motivo: "error_red" };
  }

  if (!respuesta.ok) return { ok: false, motivo: "error_gemini", estado: respuesta.status };

  let cuerpo: RespuestaApi;
  try {
    cuerpo = (await respuesta.json()) as RespuestaApi;
  } catch {
    return { ok: false, motivo: "error_gemini", estado: respuesta.status };
  }

  const candidato = cuerpo.candidates?.[0];
  if (cuerpo.promptFeedback?.blockReason || candidato?.finishReason === "SAFETY") {
    return { ok: false, motivo: "respuesta_bloqueada" };
  }

  const texto = candidato?.content?.parts?.map((parte) => parte.text ?? "").join("").trim() ?? "";
  if (!texto) return { ok: false, motivo: "respuesta_vacia" };

  return { ok: true, texto };
}
