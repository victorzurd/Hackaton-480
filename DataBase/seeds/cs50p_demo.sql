-- Curso demo CS50P. Ejecutar con psql contra la base academy.
-- Material original CS50 bajo CC BY-NC-SA 4.0; atribución y adaptación
-- documentadas en media/cs50p/README.md.

SET search_path TO academy;

DO $seed$
DECLARE
  v_lessons JSONB := $lessons$
[
  {
    "title":"Funciones y variables","source":"Functions, Variables","topics":"Funciones, argumentos, variables, tipos y valores de retorno.",
    "initial":{"text":"¿Qué devuelve la llamada greet(\"Ana\") si se define def greet(name): return \"Hola \" + name?","concept":"Llamada de función","correct":"b","explanation":"La llamada pasa Ana como argumento y la función devuelve Hola Ana.","options":["Ana","Hola Ana","name","No devuelve nada"]},
    "checks":[
      {"text":"En def suma(a, b), ¿qué representan a y b?","concept":"Parámetros y argumentos","correct":"a","explanation":"a y b son parámetros; reciben los argumentos cuando se llama a la función.","options":["Parámetros","Módulos","Valores de retorno","Comentarios"]},
      {"text":"¿Qué diferencia principal hay entre print(valor) y return valor dentro de una función?","concept":"Print y return","correct":"c","explanation":"print muestra algo en pantalla; return entrega un valor a quien llamó la función.","options":["Son equivalentes","return solo funciona con texto","return entrega un valor; print lo muestra","print termina siempre el programa"]}
    ]
  },
  {
    "title":"Condicionales","source":"Conditionals","topics":"Expresiones booleanas, if, elif, else, operadores lógicos y match.",
    "initial":{"text":"¿Qué estructura permite ejecutar un bloque solo cuando edad es mayor o igual que 18?","concept":"Condiciones","correct":"b","explanation":"if evalúa la condición y ejecuta el bloque cuando resulta verdadera.","options":["for edad >= 18","if edad >= 18","while edad >= 18 siempre","def edad >= 18"]},
    "checks":[
      {"text":"¿Cuándo se evalúa una rama elif?","concept":"if y elif","correct":"d","explanation":"elif se evalúa cuando las condiciones anteriores de if/elif fueron falsas.","options":["Antes del if","Siempre, aunque el if se cumpla","Solo al terminar el programa","Cuando las condiciones anteriores fueron falsas"]},
      {"text":"¿Qué compara el operador == en Python?","concept":"Operadores de comparación","correct":"a","explanation":"== compara si dos valores son iguales; = asigna un valor.","options":["Si dos valores son iguales","Si un valor se asigna a otro","Si ambos valores son cadenas","Si una condición es falsa"]}
    ]
  },
  {
    "title":"Bucles","source":"Loops","topics":"Bucles while y for, range, listas, diccionarios, break y continue.",
    "initial":{"text":"¿Qué bucle es adecuado para recorrer cada elemento de una lista llamada nombres?","concept":"Bucle for","correct":"c","explanation":"for elemento in nombres recorre los elementos de la lista.","options":["if nombre in nombres","def nombre in nombres","for nombre in nombres","return nombres"]},
    "checks":[
      {"text":"¿Qué valores produce range(3) al recorrerlo?","concept":"range","correct":"b","explanation":"range(3) produce 0, 1 y 2; el límite final no se incluye.","options":["1, 2, 3","0, 1, 2","0, 1, 2, 3","Solo 3"]},
      {"text":"Dentro de un bucle, ¿qué hace continue?","concept":"Control de bucles","correct":"d","explanation":"continue omite el resto de la iteración actual y pasa a la siguiente.","options":["Termina todo el programa","Reinicia la función","Sale definitivamente del bucle","Pasa a la siguiente iteración"]}
    ]
  },
  {
    "title":"Excepciones","source":"Exceptions","topics":"Errores, try, except, else, pass y raise.",
    "initial":{"text":"¿Qué bloque permite gestionar un ValueError al convertir una entrada con int()?","concept":"Manejo de excepciones","correct":"a","explanation":"El bloque except captura el tipo de error indicado producido dentro del try.","options":["try: ... except ValueError: ...","if ValueError: ...","for ValueError: ...","def except ValueError: ..."]},
    "checks":[
      {"text":"¿Qué error suele producir int(\"hola\")?","concept":"ValueError","correct":"c","explanation":"El texto no representa un entero válido, por lo que int produce ValueError.","options":["SyntaxError","NameError","ValueError","ImportError"]},
      {"text":"¿Para qué se usa raise en Python?","concept":"raise","correct":"b","explanation":"raise permite lanzar explícitamente una excepción.","options":["Ignorar una excepción","Lanzar una excepción","Repetir un bucle","Importar un error"]}
    ]
  },
  {
    "title":"Bibliotecas","source":"Libraries","topics":"Módulos, import, paquetes, pip, PyPI, argumentos de línea de comandos, APIs y JSON.",
    "initial":{"text":"¿Cómo se hace disponible el módulo random en un archivo Python?","concept":"Importación de módulos","correct":"d","explanation":"La sentencia import random importa el módulo para poder usar sus funciones.","options":["use random","include random","pip random","import random"]},
    "checks":[
      {"text":"¿Qué herramienta se usa habitualmente para instalar paquetes de Python desde PyPI?","concept":"Paquetes y pip","correct":"a","explanation":"pip es el instalador de paquetes de Python.","options":["pip","range","pytest","sys.argv"]},
      {"text":"¿Qué formato se usa con frecuencia para intercambiar datos estructurados con una API web?","concept":"JSON y APIs","correct":"c","explanation":"JSON representa datos estructurados y se utiliza ampliamente en APIs web.","options":["MP3","CSS","JSON","PNG"]}
    ]
  },
  {
    "title":"Pruebas unitarias","source":"Unit Tests","topics":"Aserciones, AssertionError, pytest y pruebas automatizadas.",
    "initial":{"text":"¿Qué verifica assert suma(2, 3) == 5 en una prueba?","concept":"Aserciones","correct":"b","explanation":"La aserción comprueba que la expresión sea verdadera; si no, se informa un fallo.","options":["Que suma se ejecute dos veces","Que el resultado sea 5","Que Python instale suma","Que el programa no tenga funciones"]},
    "checks":[
      {"text":"¿Qué indica AssertionError durante una prueba?","concept":"Fallos de aserción","correct":"d","explanation":"La condición comprobada por assert no se cumplió.","options":["Que el archivo no existe siempre","Que la prueba pasó","Que pytest no es compatible","Que una aserción falló"]},
      {"text":"¿Qué ventaja ofrece pytest?","concept":"pytest","correct":"a","explanation":"pytest descubre y ejecuta pruebas automatizadas, y presenta sus resultados.","options":["Ejecutar y organizar pruebas automáticamente","Convertir Python en HTML","Instalar el sistema operativo","Sustituir todas las funciones"]}
    ]
  },
  {
    "title":"Lectura y escritura de archivos","source":"File I/O","topics":"open, with, lectura y escritura de texto, CSV y Pillow.",
    "initial":{"text":"¿Qué forma recomienda Python para cerrar un archivo incluso si ocurre un error?","concept":"Gestión de archivos","correct":"c","explanation":"with administra el contexto del archivo y lo cierra al salir del bloque.","options":["Abrirlo sin guardarlo","Llamar print al final","Usar with open(...) as archivo:","Usar range sobre el archivo"]},
    "checks":[
      {"text":"¿Qué modo de open se usa normalmente para leer un archivo de texto?","concept":"Modos de apertura","correct":"a","explanation":"El modo r abre el archivo para lectura.","options":["r","w","x","a"]},
      {"text":"¿Qué biblioteca estándar facilita leer y escribir archivos CSV?","concept":"Archivos CSV","correct":"d","explanation":"El módulo csv proporciona lectores y escritores para datos CSV.","options":["random","re","pytest","csv"]}
    ]
  },
  {
    "title":"Expresiones regulares","source":"Regular Expressions","topics":"Patrones, re.search, match, fullmatch, sub, split y findall.",
    "initial":{"text":"¿Qué módulo de Python incluye funciones para trabajar con expresiones regulares?","concept":"Módulo re","correct":"b","explanation":"El módulo re de la biblioteca estándar permite buscar y manipular patrones.","options":["csv","re","sys","json"]},
    "checks":[
      {"text":"¿Qué comprueba re.fullmatch(patron, texto)?","concept":"fullmatch","correct":"c","explanation":"fullmatch requiere que todo el texto coincida con el patrón.","options":["Solo el primer carácter","Si el patrón aparece en otro archivo","Si todo el texto coincide","Si el texto se puede importar"]},
      {"text":"¿Qué función de re permite sustituir coincidencias por otro texto?","concept":"Sustitución de patrones","correct":"a","explanation":"re.sub busca coincidencias y las sustituye por el texto indicado.","options":["re.sub","re.search","re.findall","re.match"]}
    ]
  },
  {
    "title":"Programación orientada a objetos","source":"Object-Oriented Programming","topics":"Clases, objetos, atributos, métodos, herencia y sobrecarga de operadores.",
    "initial":{"text":"¿Qué palabra clave se usa para definir una clase en Python?","concept":"Clases","correct":"d","explanation":"Las clases se declaran con la palabra clave class.","options":["object","def","new","class"]},
    "checks":[
      {"text":"¿Qué método inicializa habitualmente el estado de un objeto nuevo?","concept":"Constructor","correct":"b","explanation":"__init__ se ejecuta al crear una instancia y suele inicializar sus atributos.","options":["__main__","__init__","__start__","__newfile__"]},
      {"text":"En un método de instancia, ¿qué representa normalmente self?","concept":"Métodos de instancia","correct":"c","explanation":"self referencia la instancia concreta sobre la que se invoca el método.","options":["La clase padre siempre","Un módulo externo","La instancia actual","El valor de retorno"]}
    ]
  },
  {
    "title":"Conceptos adicionales","source":"Et Cetera","topics":"Conjuntos, constantes, anotaciones de tipos, docstrings, argumentos, comprensiones e iteradores.",
    "initial":{"text":"¿Qué sintaxis crea una nueva lista con los cuadrados de los números de valores?","concept":"Comprensión de listas","correct":"a","explanation":"Una comprensión de listas expresa la transformación y el recorrido en una sola expresión.","options":["[n * n for n in valores]","{n * n for n in valores}","for n in valores: [n * n]","list = n ** valores"]},
    "checks":[
      {"text":"¿Qué suele indicar *args en la definición de una función?","concept":"Argumentos variables","correct":"d","explanation":"*args recoge argumentos posicionales adicionales en una tupla.","options":["Un argumento obligatorio llamado args","Un diccionario de palabras clave","Una lista global","Argumentos posicionales adicionales"]},
      {"text":"¿Qué produce yield dentro de una función generadora?","concept":"Generadores","correct":"b","explanation":"yield entrega un valor y conserva el estado para continuar la ejecución después.","options":["Un error de sintaxis","Un valor de una función generadora","Una clase nueva","Una instalación de pip"]}
    ]
  }
]
$lessons$::JSONB;
  v_course_id BIGINT;
  v_module_id BIGINT;
  v_content_id BIGINT;
  v_initial_eval_id BIGINT;
  v_intermediate_eval_id BIGINT;
  v_question_id BIGINT;
  v_lesson JSONB;
  v_question JSONB;
  v_option TEXT;
  v_option_index INTEGER;
  v_lesson_index INTEGER;
  v_question_index INTEGER;
  v_questions JSONB;
  v_difficulty INTEGER;
  v_course_level_initial BOOLEAN;
BEGIN
  SELECT id INTO v_course_id
  FROM academy.cursos
  WHERE titulo = 'Introducción a Python — CS50P (demo)'
  LIMIT 1;

  IF v_course_id IS NOT NULL THEN
    RAISE NOTICE 'El curso CS50P ya está cargado (id=%). No se duplicó.', v_course_id;
    RETURN;
  END IF;

  INSERT INTO academy.cursos (titulo, descripcion, activo)
  VALUES (
    'Introducción a Python — CS50P (demo)',
    'Demo basada en CS50’s Introduction to Programming with Python (CS50P), curso abierto de Harvard con 10 lecciones. Incluye vídeos oficiales, transcripciones en inglés y cuestionarios de práctica en español preparados para esta demo. Audio de los vídeos en inglés. Material fuente bajo CC BY-NC-SA 4.0. No está afiliado ni respaldado por Harvard.',
    TRUE
  ) RETURNING id INTO v_course_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'academy'
      AND table_name = 'evaluaciones'
      AND column_name = 'curso_id'
  ) INTO v_course_level_initial;

  IF v_course_level_initial THEN
    EXECUTE
      'INSERT INTO academy.evaluaciones (curso_id, tipo, titulo, descripcion) ' ||
      'VALUES ($1, $2, $3, $4) RETURNING id'
      INTO v_initial_eval_id
      USING v_course_id,
        'inicial',
        'Diagnóstico inicial: CS50P',
        'Diez preguntas breves, una por módulo, para conocer los conceptos previos. Cuestionario de práctica en español preparado para esta demo.';
  END IF;

  FOR v_lesson_index IN 0..jsonb_array_length(v_lessons) - 1 LOOP
    v_lesson := v_lessons -> v_lesson_index;

    INSERT INTO academy.modulos (curso_id, titulo, descripcion, orden)
    VALUES (
      v_course_id,
      v_lesson->>'title',
      (v_lesson->>'topics') || ' Lección fuente: ' || (v_lesson->>'source') || '.',
      v_lesson_index + 1
    ) RETURNING id INTO v_module_id;

    INSERT INTO academy.contenidos
      (modulo_id, titulo, descripcion, tipo, url, orden, disponible)
    VALUES (
      v_module_id,
      v_lesson->>'title',
      'Lección ' || v_lesson_index || ' de CS50P: ' || (v_lesson->>'source') ||
      '. Audio y transcripción en inglés. Cuestionarios de práctica en español.' ||
      ' | Subtítulos WebVTT: /media/cs50p/lecture-' || v_lesson_index || '.vtt' ||
      ' Vídeo oficial: https://cs50.harvard.edu/python/weeks/' || v_lesson_index || '/' ||
      ' | Lista de reproducción: https://www.youtube.com/playlist?list=PLhQjrBD2T3817j24-GogXmWqO5Q5vYy0V' ||
      ' | Licencia: https://cs50.harvard.edu/python/license/',
      'video',
      'https://cdn.cs50.net/python/2022/x/lectures/' || v_lesson_index ||
        '/lecture' || v_lesson_index || '-360p.mp4',
      1,
      TRUE
    ) RETURNING id INTO v_content_id;

    IF NOT v_course_level_initial THEN
      INSERT INTO academy.evaluaciones (modulo_id, tipo, titulo, descripcion)
      VALUES (
        v_module_id,
        'inicial',
        'Diagnóstico: ' || (v_lesson->>'title'),
        'Una pregunta breve para conocer los conceptos previos. Cuestionario de práctica en español preparado para esta demo.'
      ) RETURNING id INTO v_initial_eval_id;
    END IF;

    INSERT INTO academy.evaluaciones (modulo_id, contenido_id, tipo, titulo, descripcion)
    VALUES (
      v_module_id,
      v_content_id,
      'intermedia',
      'Repaso: ' || (v_lesson->>'title'),
      'Dos preguntas de opción múltiple sobre esta lección. Cuestionario original de práctica en español para la demo.'
    ) RETURNING id INTO v_intermediate_eval_id;

    v_questions := jsonb_build_array(v_lesson->'initial');
    FOR v_question_index IN 0..jsonb_array_length(v_questions) - 1 LOOP
      v_question := v_questions -> v_question_index;
      v_difficulty := 1;
      INSERT INTO academy.preguntas (
        modulo_id, enunciado, tipo, tipo_interaccion, configuracion,
        respuesta_correcta, explicacion, concepto, dificultad
      ) VALUES (
        v_module_id,
        v_question->>'text',
        'escrita',
        'opcion_multiple',
        jsonb_build_object('seleccion', 'unica'),
        jsonb_build_object('valor', v_question->>'correct'),
        v_question->>'explanation',
        v_question->>'concept',
        v_difficulty
      ) RETURNING id INTO v_question_id;

      INSERT INTO academy.evaluacion_preguntas (evaluacion_id, pregunta_id, orden, origen)
      VALUES (
        v_initial_eval_id,
        v_question_id,
        CASE WHEN v_course_level_initial THEN v_lesson_index + 1 ELSE 1 END,
        'test_inicial'
      );

      v_option_index := 0;
      FOR v_option IN SELECT jsonb_array_elements_text(v_question->'options') LOOP
        v_option_index := v_option_index + 1;
        INSERT INTO academy.opciones_pregunta
          (pregunta_id, texto, valor, orden, es_correcta)
        VALUES (
          v_question_id,
          v_option,
          chr(ascii('a') + v_option_index - 1),
          v_option_index,
          chr(ascii('a') + v_option_index - 1) = v_question->>'correct'
        );
      END LOOP;
    END LOOP;

    v_questions := v_lesson->'checks';
    FOR v_question_index IN 0..jsonb_array_length(v_questions) - 1 LOOP
      v_question := v_questions -> v_question_index;
      v_difficulty := 2 + v_question_index;
      INSERT INTO academy.preguntas (
        modulo_id, contenido_id, enunciado, tipo, tipo_interaccion,
        configuracion, respuesta_correcta, explicacion, concepto, dificultad
      ) VALUES (
        v_module_id,
        v_content_id,
        v_question->>'text',
        'escrita',
        'opcion_multiple',
        jsonb_build_object('seleccion', 'unica'),
        jsonb_build_object('valor', v_question->>'correct'),
        v_question->>'explanation',
        v_question->>'concept',
        v_difficulty
      ) RETURNING id INTO v_question_id;

      INSERT INTO academy.evaluacion_preguntas (evaluacion_id, pregunta_id, orden, origen)
      VALUES (v_intermediate_eval_id, v_question_id, v_question_index + 1, 'original');

      v_option_index := 0;
      FOR v_option IN SELECT jsonb_array_elements_text(v_question->'options') LOOP
        v_option_index := v_option_index + 1;
        INSERT INTO academy.opciones_pregunta
          (pregunta_id, texto, valor, orden, es_correcta)
        VALUES (
          v_question_id,
          v_option,
          chr(ascii('a') + v_option_index - 1),
          v_option_index,
          chr(ascii('a') + v_option_index - 1) = v_question->>'correct'
        );
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Curso CS50P demo cargado con 10 módulos y sus evaluaciones.';
END
$seed$;
