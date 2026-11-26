-- El examen inicial pertenece al curso y puede reunir preguntas de todos sus contenidos.
ALTER TABLE academy.evaluaciones
    ADD COLUMN IF NOT EXISTS curso_id BIGINT REFERENCES academy.cursos(id) ON DELETE CASCADE;

ALTER TABLE academy.evaluaciones
    ALTER COLUMN modulo_id DROP NOT NULL;

ALTER TABLE academy.evaluaciones
    DROP CONSTRAINT IF EXISTS evaluaciones_check,
    DROP CONSTRAINT IF EXISTS ck_evaluaciones_ubicacion;

ALTER TABLE academy.evaluaciones
    ADD CONSTRAINT ck_evaluaciones_ubicacion CHECK (
        (tipo = 'inicial' AND contenido_id IS NULL AND
            ((curso_id IS NOT NULL AND modulo_id IS NULL) OR (curso_id IS NULL AND modulo_id IS NOT NULL)))
        OR
        (tipo IN ('intermedia', 'final') AND curso_id IS NULL AND modulo_id IS NOT NULL AND contenido_id IS NOT NULL)
    );

CREATE UNIQUE INDEX IF NOT EXISTS uq_evaluacion_inicial_curso
    ON academy.evaluaciones(curso_id)
    WHERE tipo = 'inicial' AND curso_id IS NOT NULL;

-- Consolida los diagnósticos antiguos de módulo en una evaluación inicial por curso.
INSERT INTO academy.evaluaciones (curso_id, tipo, titulo, descripcion)
SELECT m.curso_id, 'inicial', 'Diagnóstico inicial: ' || c.titulo,
       'Evaluación inicial del curso con preguntas sobre todos sus contenidos. No es una nota.'
FROM academy.evaluaciones antigua
JOIN academy.modulos m ON m.id = antigua.modulo_id
JOIN academy.cursos c ON c.id = m.curso_id
WHERE antigua.tipo = 'inicial' AND antigua.curso_id IS NULL
GROUP BY m.curso_id, c.titulo
ON CONFLICT DO NOTHING;

INSERT INTO academy.evaluacion_preguntas (evaluacion_id, pregunta_id, orden, origen)
SELECT nueva.id, vinculacion.pregunta_id,
       ROW_NUMBER() OVER (
           PARTITION BY nueva.id ORDER BY modulo.orden, vinculacion.orden, vinculacion.pregunta_id
       )::integer,
       'test_inicial'
FROM academy.evaluaciones antigua
JOIN academy.modulos modulo ON modulo.id = antigua.modulo_id
JOIN academy.evaluaciones nueva ON nueva.curso_id = modulo.curso_id AND nueva.tipo = 'inicial'
JOIN academy.evaluacion_preguntas vinculacion ON vinculacion.evaluacion_id = antigua.id
WHERE antigua.tipo = 'inicial' AND antigua.curso_id IS NULL
ON CONFLICT (evaluacion_id, pregunta_id) DO NOTHING;

-- Vincula las preguntas diagnósticas antiguas al primer contenido de su módulo cuando faltaba el vínculo.
UPDATE academy.preguntas pregunta
SET contenido_id = contenido.id
FROM academy.evaluacion_preguntas vinculacion
JOIN academy.evaluaciones evaluacion ON evaluacion.id = vinculacion.evaluacion_id
JOIN academy.modulos modulo ON modulo.id = evaluacion.modulo_id
JOIN LATERAL (
    SELECT c.id FROM academy.contenidos c
    WHERE c.modulo_id = modulo.id
    ORDER BY c.orden, c.id
    LIMIT 1
) contenido ON TRUE
WHERE vinculacion.pregunta_id = pregunta.id
  AND evaluacion.tipo = 'inicial'
  AND evaluacion.curso_id IS NULL
  AND pregunta.contenido_id IS NULL;

-- La web presenta el examen como preguntas abiertas acompañadas de ejemplos de código,
-- no como un cuestionario de opciones del mockup.
UPDATE academy.preguntas pregunta
SET tipo_interaccion = 'texto',
    configuracion = jsonb_build_object('estimulo', jsonb_build_object('codigo', CASE modulo.titulo
        WHEN 'Funciones y variables' THEN E'def greet(name):\n    return "Hola " + name\n\nprint(greet("Ana"))'
        WHEN 'Condicionales' THEN E'edad = 17\n\nif edad >= 18:\n    print("Mayor de edad")\nelse:\n    print("Menor de edad")'
        WHEN 'Bucles' THEN E'for numero in range(3):\n    print(numero)'
        WHEN 'Excepciones' THEN E'try:\n    edad = int("hola")\nexcept ValueError:\n    print("Introduce un número")'
        WHEN 'Bibliotecas' THEN E'import random\n\ncolor = random.choice(["azul", "verde"])\nprint(color)'
        WHEN 'Pruebas unitarias' THEN E'def suma(a, b):\n    return a + b\n\nassert suma(2, 3) == 5'
        WHEN 'Lectura y escritura de archivos' THEN E'with open("datos.txt") as archivo:\n    contenido = archivo.read()'
        WHEN 'Expresiones regulares' THEN E'import re\n\ncoincide = re.fullmatch(r"\\d+", "480")\nprint(coincide is not None)'
        WHEN 'Programación orientada a objetos' THEN E'class Persona:\n    def __init__(self, nombre):\n        self.nombre = nombre\n\npersona = Persona("Alex")'
        WHEN 'Conceptos adicionales' THEN E'valores = [1, 2, 3]\ncuadrados = [n * n for n in valores]\nprint(cuadrados)'
        ELSE NULL
    END))
FROM academy.evaluacion_preguntas vinculacion,
     academy.evaluaciones evaluacion,
     academy.modulos modulo
WHERE vinculacion.pregunta_id = pregunta.id
  AND evaluacion.id = vinculacion.evaluacion_id
  AND modulo.id = pregunta.modulo_id
  AND evaluacion.tipo = 'inicial'
  AND evaluacion.curso_id IS NOT NULL
  AND modulo.curso_id = evaluacion.curso_id;

-- El resultado del diagnóstico puede personalizar el orden de módulos de cada alumno.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'academy' AND table_name = 'itinerarios'
          AND column_name = 'orden_personalizado'
    ) THEN
        ALTER TABLE academy.itinerarios
            ADD COLUMN orden_personalizado INTEGER NOT NULL DEFAULT 1;
        UPDATE academy.itinerarios itinerario
        SET orden_personalizado = modulo.orden
        FROM academy.modulos modulo
        WHERE modulo.id = itinerario.modulo_id;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'academy.itinerarios'::regclass
          AND conname = 'ck_itinerarios_orden_personalizado'
    ) THEN
        ALTER TABLE academy.itinerarios
            ADD CONSTRAINT ck_itinerarios_orden_personalizado CHECK (orden_personalizado > 0);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION academy.crear_itinerario_al_matricular()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.estado = 'activo' THEN
        INSERT INTO academy.itinerarios (alumno_id, modulo_id, orden_personalizado)
        SELECT NEW.alumno_id, m.id, m.orden
        FROM academy.modulos m
        WHERE m.curso_id = NEW.curso_id
        ON CONFLICT (alumno_id, modulo_id) DO NOTHING;

        INSERT INTO academy.itinerario_contenidos (itinerario_id, modulo_id, contenido_id, orden)
        SELECT i.id, m.id, c.id,
               (COALESCE((SELECT MAX(ic.orden) FROM academy.itinerario_contenidos ic WHERE ic.itinerario_id = i.id), 0)
                + ROW_NUMBER() OVER (PARTITION BY i.id ORDER BY c.orden, c.id))::integer
        FROM academy.itinerarios i
        JOIN academy.modulos m ON m.id = i.modulo_id AND m.curso_id = NEW.curso_id
        JOIN academy.contenidos c ON c.modulo_id = m.id AND c.disponible = TRUE
        WHERE i.alumno_id = NEW.alumno_id
        ON CONFLICT (itinerario_id, contenido_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;
