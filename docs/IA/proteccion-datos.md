# Servicio de protección de datos

Todo texto que va a Gemini pasa antes por `protegerTexto`, y su respuesta debe pasar también antes de mostrarla. Si algo falla, no se envía nada. Código en `src/ia/proteccion/`.

Responde al tratamiento de privacidad de [SPEC.md](../../SPEC.md#6-modelo-de-datos-y-flujo-hacia-la-ia) y al cumplimiento de la Ley Orgánica de Protección de Datos Personales y garantía de los derechos digitales.

```mermaid
flowchart LR
    a["Alumno"] --> b["protegerTexto"] --> c["Gemini"] --> d["protegerTexto"] --> e["Alumno"]
```

## Cómo llamarlo

```ts
import { protegerTexto, registroSeudonimos } from "./ia/proteccion";

// 1. Ida: se filtra el mensaje
const entrada = protegerTexto(mensaje, { nombre, apellidos });
if (!entrada.ok) return; // no se llama a Gemini

// 2. Se envía solo el texto filtrado y el seudónimo, nunca el id real
const seudonimo = registroSeudonimos.obtener(sesionId, alumnoId);
const respuestaIA = await llamarGemini(entrada.texto, seudonimo); // pendiente de crear

// 3. Vuelta: se filtra la respuesta
const salida = protegerTexto(respuestaIA, { nombre, apellidos });
if (!salida.ok) return; // no se muestra
```

## Qué responde

```ts
// "Soy Ana, mi correo es ana@gmail.com"
{
  ok: true,
  texto: "Soy [NOMBRE], mi correo es [EMAIL]",
  detectados: { email: 1, documento: 0, telefono: 0, nombre: 1 }
}

// Si algo falla
{ ok: false, motivo: "error_interno" }
```

| `motivo` | Cuándo |
| --- | --- |
| `texto_no_valido` | No es un texto |
| `texto_demasiado_largo` | Más de 4.000 caracteres |
| `error_interno` | Error al filtrar |

## Qué filtra

| Dato | Etiqueta |
| --- | --- |
| Email | `[EMAIL]` |
| DNI y NIE con letra válida | `[DOCUMENTO]` |
| Teléfono español | `[TELEFONO]` |
| Nombre del alumno, o tras «me llamo», «soy»… | `[NOMBRE]` |

## Límites

- No detecta todos los nombres de terceros, los teléfonos extranjeros ni los DNI con la letra mal escrita.
- Puede filtrar de más: por ejemplo, «Soy Python developer».
- Los seudónimos caducan a las 8 horas y se pierden al reiniciar el servidor.
