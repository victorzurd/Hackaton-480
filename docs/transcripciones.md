# Transcripciones en español

Los subtítulos de CS50P están en inglés. Su traducción al español se hace a mano con un LLM de chat (ChatGPT, Claude, Gemini…) y se guarda en el repositorio, así nadie más tiene que repetirla. Se importa en la misma tabla `transcripciones` con `idioma = 'es'` y los mismos tiempos que el inglés, de modo que la usan sin cambios:

- el **reproductor**, que puede mostrar `lecture-N.es.vtt` como subtítulos;
- el **RAG del Tutor IA**, que da preferencia al español si existe ([IA/rag.md](IA/rag.md));
- los **reels**, que buscan el concepto en todos los fragmentos del vídeo, en cualquier idioma.

## Por qué con partes numeradas

Si se pega un `.srt` entero en un chat, el LLM suele juntar, saltar o cortar líneas, y los tiempos dejan de cuadrar. Por eso al LLM solo se le envía texto numerado, sin tiempos:

```
[301] And this isn't a huge deal because we're only talking about two lines of code.
[302] But in the interest of preaching best practices,
```

El script comprueba después que vuelve exactamente una línea por número y pone los tiempos del original.

## Pasos

Requisitos: los subtítulos en inglés descargados en `media/cs50p/` (ver [LOCAL.md](../LOCAL.md)) y `npm install` hecho.

**1. Trocear** una lección (o varias) en partes de 300 líneas:

```bash
npx tsx scripts/traduccion_cs50p.ts dividir 3
```

Crea `media/cs50p/traduccion/lecture-3/parte-01.txt`, `parte-02.txt`… Esa carpeta no se sube al repositorio.

**2. Traducir cada parte.** Abre un chat nuevo, pega las instrucciones de abajo y después el contenido de la parte. Guarda la respuesta en la misma carpeta con el nombre `parte-01.es.txt`, `parte-02.es.txt`… Da igual si el LLM añade una frase antes o después: solo se leen las líneas que empiezan por `[número]`.

**3. Unir y comprobar:**

```bash
npx tsx scripts/traduccion_cs50p.ts unir 3
```

Si falta, sobra o se repite alguna línea, indica cuáles y en qué parte, y no escribe nada. Vuelve a pedir esa parte al LLM y repite. Si todo está bien, crea `media/cs50p/lecture-3.es.srt` y `lecture-3.es.vtt`.

**4. Importar** a la base de datos (con los contenedores levantados):

```bash
docker exec academy-api node DataBase/seeds/import_cs50p_transcripts.mjs
```

Debe mostrar, por ejemplo, `Lección 3: 977 fragmentos, 977 en español`. Reimportar el inglés ya no borra el español.

**5. Subir** los `lecture-N.es.srt` y `lecture-N.es.vtt` al repositorio para que el resto del equipo los tenga.

## Instrucciones para el LLM

```text
Traduce al español de España estas líneas de subtítulos de una clase de programación en Python. Reglas:
1. Cada línea empieza por un número entre corchetes, por ejemplo [301]. Mantén ese número exactamente igual al principio de su traducción.
2. Devuelve una línea traducida por cada línea original y en el mismo orden. No juntes ni dividas líneas, aunque una frase continúe en la siguiente.
3. No traduzcas código, nombres de funciones, palabras reservadas de Python ni nombres de bibliotecas (print, def, return, range, elif, input, pytest, csv…).
4. Mantén los nombres de quien habla, por ejemplo «DAVID MALAN:».
5. Responde solo con las líneas traducidas, sin comentarios ni explicaciones.
```

## Tamaño del trabajo

| Lección | Líneas | Partes |
| --- | ---: | ---: |
| 0 | 2.222 | 8 |
| 1 | 1.168 | 4 |
| 2 | 1.581 | 6 |
| 3 | 992 | 4 |
| 4 | 1.569 | 6 |
| 5 | 1.023 | 4 |
| 6 | 1.864 | 7 |
| 7 | 2.511 | 9 |
| 8 | 3.370 | 12 |
| 9 | 2.982 | 10 |
| **Total** | **19.282** | **70** |

Las lecciones son independientes: se pueden repartir entre varias personas y subir a medida que se terminan.

## Licencia

CS50P se publica bajo [CC BY-NC-SA 4.0](https://cs50.harvard.edu/python/license/). La traducción es una adaptación y se comparte con la misma licencia y su atribución (ver `media/cs50p/README.md`).
